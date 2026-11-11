// Run: node tests/translate-backoff.test.js
// SUPABASE EGRESS FIX v2 (Nov 11, 2026) — backoff + shared gate + quarantine.
// After fix 1d3ce31 the builder still re-downloaded Korean's full ~7,100-row slice every 15 min:
// ko sits at 7,104 stored rows vs a 7,109.275 bar, and while its 42 missing phrases keep failing
// its ceiling IS 7,104 (7,103 in-list + 1 stale) — the completeness gate is permanently true by
// construction, on BOTH gates (the Nov 11 fingerprint proved ui_translations count == ui_packs.n
// for all 13 languages, so the cron's pack gate and the job's count gate read the same number).
// This suite mocks the Supabase fetch layer (with a real in-memory ui_pack_log) and drives the
// real background handler + cron to prove:
// (A) zero-gain attempt 1h ago, nothing moved -> the language is NOT paged (backoff), and the 12
//     complete languages skip on count checks only;
// (F) a backoff skip writes no lang_end, and the next run still skips (clock stays anchored);
// (I) a lang_attempt claim 1h ago + lang_end 25h ago -> still backoff (claim-then-work anchor:
//     a crashed/timed-out attempt cannot restart the loop);
// (B) zero-gain attempt 25h ago -> a real retry happens (paged once, fresh lang_end + claim);
// (C) last attempt gained rows -> processes;  (D) stored count moved -> processes;
// (E) phrases.json changed (hash differs) -> processes;
// (H) the CRON enforces the same gate: all-incomplete-in-backoff -> it does not start the job;
//     a phrases.json change makes it start the job again;
// (J) QUARANTINE: with a working model that keeps digit-dropping two phrases, the validator
//     rejects them in 3 separate attempts -> they are stored as identity rows, the language
//     completes, and the loop ends (later runs page nothing);
// (K) a provider-failure attempt (no model key) records NO rejections and quarantines nothing.
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert.ok(c, m); console.log("ok -", m); n++; };
delete process.env.ANTHROPIC_API_KEY; delete process.env.GEMINI_API_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = "testkey";
const C = require("../netlify/functions/lib/translate-core.js");
const B = require("../netlify/functions/translate-packs-background.js");

const resp = (st, body, hdr) => ({
  ok: st < 300, status: st,
  headers: { get: k => { const h = {}; Object.keys(hdr || {}).forEach(x => { h[x.toLowerCase()] = hdr[x]; }); const v = h[String(k).toLowerCase()]; return v === undefined ? null : v; } },
  json: async () => body, text: async () => (typeof body === "string" ? body : JSON.stringify(body))
});

let phrases, db, logRows, pageGets, countGets, packPosts, triggerCalls;
const rowsFor = list => list.map(p => ({ src: p, dst: "t:" + p }));
function mkPhrases(cnt) { const p = []; for (let i = 0; i < cnt; i++) p.push("Phrase number " + i); return p; }
function reset() { pageGets = []; countGets = []; packPosts = []; triggerCalls = 0; }
function seedLog(lang, kind, obj, hoursAgo) { logRows.push({ lang: lang, kind: kind, msg: typeof obj === "string" ? obj : JSON.stringify(obj), at: new Date(Date.now() - hoursAgo * 3600000).toISOString() }); }
function ageAllLogs(hours) { logRows.forEach(r => { r.at = new Date(Date.parse(r.at) - hours * 3600000).toISOString(); }); }
function kindMatch(param, kind) {
  if (!param) return true;
  if (param.startsWith("eq.")) return param.slice(3) === kind;
  if (param.startsWith("in.(")) return param.slice(4, -1).split(",").includes(kind);
  return false;
}
function installFetch() {
  global.fetch = async (u, o) => {
    const url = String(u);
    if (url.includes("phrases.json")) return resp(200, phrases);
    if (url.includes("api.anthropic.com")) {   // the "model": digit-bearing phrases come back with digits stripped (validator bait); the rest translate cleanly
      const list = JSON.parse(JSON.parse(o.body).messages[0].content);
      const out = list.map(s => /[0-9]/.test(s) ? s.replace(/[0-9]+/g, "").replace(/\s+/g, " ").trim() : "T:" + s);
      return resp(200, { content: [{ text: JSON.stringify(out) }] });
    }
    if (url.includes(".netlify/functions/translate-packs-background")) { triggerCalls++; return resp(200, "started"); }
    const m = url.match(/\/rest\/v1\/([a-z_]+)(?:\?(.*))?$/); assert.ok(m, "unexpected fetch " + url);
    const table = m[1], qs = new URLSearchParams(m[2] || ""), method = (o && o.method) || "GET";
    const lang = (qs.get("lang") || "").replace("eq.", "");
    if (table === "ui_translations" && method === "GET") {
      const limit = Number(qs.get("limit")), offset = Number(qs.get("offset") || 0);
      if (limit === 0) { countGets.push(lang); return resp(200, [], { "content-range": "*/" + db[lang].length }); }
      pageGets.push({ lang, offset });
      return resp(200, db[lang].slice(offset, offset + limit));
    }
    if (table === "ui_translations" && method === "POST") { const rows = JSON.parse(o.body); rows.forEach(r => { if (!db[r.lang].some(x => x.src === r.src)) db[r.lang].push({ src: r.src, dst: r.dst }); }); return resp(201, []); }
    if (table === "ui_pack_log" && method === "GET") {
      const kindParam = qs.get("kind") || "";
      if (kindParam.includes("run_start")) return resp(200, []);   // the handler's overlap guard: no prior run
      const limit = Number(qs.get("limit") || 1);
      const rows = logRows.filter(r => (!lang || r.lang === lang) && kindMatch(kindParam, r.kind)).slice(-limit).reverse()
        .map(r => ({ kind: r.kind, msg: r.msg, at: r.at }));
      return resp(200, rows);
    }
    if (table === "ui_pack_log" && method === "POST") { const b = JSON.parse(o.body); logRows.push({ lang: b.lang, kind: b.kind, msg: b.msg, at: new Date().toISOString() }); return resp(201, []); }
    if (table === "ui_packs" && method === "GET") return resp(200, [{ n: db[lang].length }]);
    if (table === "ui_packs" && method === "POST") { packPosts.push(JSON.parse(o.body)[0].lang); return resp(200, []); }
    return resp(200, []);
  };
}
const evt = { headers: { "x-pack-key": C.packKey() } };
const koPages = () => pageGets.filter(g => g.lang === "ko");
const koLog = kind => logRows.filter(r => r.lang === "ko" && r.kind === kind);
function setup(koRows) {
  db = {}; Object.keys(C.LANGS).forEach(l => { db[l] = rowsFor(phrases); });
  db.ko = rowsFor(phrases.slice(0, koRows));
  logRows = []; reset(); installFetch();
}
const zeroGainSeed = (hours, extra) => seedLog("ko", "lang_end", Object.assign({ todo: 10, added: 0, failed: 10, pack: 90, ph: C.phrasesHash(phrases), rid: "seed" }, extra || {}), hours);

(async () => {
  phrases = mkPhrases(100);

  // (A) + (F) zero-gain 1h ago -> backoff, twice in a row, no new lang_end
  setup(90); zeroGainSeed(1);
  let out = await B.handler(evt);
  ok(out.statusCode === 200, "(A) run completes");
  ok(koPages().length === 0 && pageGets.length === 0, "(A) Korean is NOT paged inside the 24h zero-gain window — zero page GETs in the whole run");
  ok(countGets.filter(l => l !== "ko").length === 12, "(A) the other 12 languages skip on the cheap count check");
  ok(koLog("lang_end").length === 1, "(F) the backoff skip wrote NO new lang_end (clock stays anchored to the real attempt)");
  reset(); out = await B.handler(evt);
  ok(koPages().length === 0, "(F) the next run (t+15) still backs off with zero ko page GETs");

  // (I) claim anchor: lang_end 25h old but a lang_attempt claim 1h ago -> still backoff
  setup(90); zeroGainSeed(25); seedLog("ko", "lang_attempt", { ph: C.phrasesHash(phrases), rid: "seed2" }, 1);
  out = await B.handler(evt);
  ok(koPages().length === 0, "(I) a fresh lang_attempt claim holds the backoff even with a 25h-old lang_end (mid-run-timeout case)");

  // (B) zero-gain 25h ago, no claim -> real retry
  setup(90); zeroGainSeed(25);
  out = await B.handler(evt);
  ok(koPages().length === 1, "(B) after 24h Korean IS paged again — one slice pass (got " + koPages().length + ")");
  ok(koLog("lang_end").length === 2 && koLog("lang_attempt").length === 1, "(B) the retry claims first (lang_attempt) and re-anchors with a fresh lang_end");

  // (C) last attempt gained rows -> processes
  setup(90); seedLog("ko", "lang_end", { todo: 15, added: 5, failed: 10, pack: 90, ph: C.phrasesHash(phrases), rid: "seed" }, 1);
  out = await B.handler(evt);
  ok(koPages().length === 1, "(C) a language whose last attempt gained rows is paged, not backed off");

  // (D) stored count moved since the zero-gain attempt -> processes
  setup(93); zeroGainSeed(1);
  out = await B.handler(evt);
  ok(koPages().length === 1, "(D) stored count moved (90 -> 93) since the zero-gain attempt: Korean is paged");

  // (E) phrases.json changed -> hash mismatch -> processes
  const saved = phrases; phrases = mkPhrases(130);
  setup(90); seedLog("ko", "lang_end", { todo: 10, added: 0, failed: 10, pack: 90, ph: C.phrasesHash(saved), rid: "seed" }, 1);
  out = await B.handler(evt);
  ok(koPages().length === 1, "(E) phrases list changed: Korean is paged despite the recent zero-gain attempt");
  phrases = saved;

  // (H) cron: all incomplete languages in backoff -> no launch; phrases change -> launch
  setup(90); zeroGainSeed(1);
  const cron = (await import("../netlify/functions/translate-packs-cron.mjs")).default;
  let txt = await (await cron()).text();
  ok(txt === "backoff" && triggerCalls === 0, "(H) cron answers 'backoff' and does NOT start the job while Korean is in its window");
  phrases = mkPhrases(101); db = {}; Object.keys(C.LANGS).forEach(l => { db[l] = rowsFor(phrases); }); db.ko = rowsFor(phrases.slice(0, 90)); reset(); installFetch();
  txt = await (await cron()).text();
  ok(txt.startsWith("started") && triggerCalls === 1, "(H) a phrases.json change (new missing keys) makes the cron start the job again");
  phrases = mkPhrases(100);

  // (J) quarantine: a model that digit-drops two phrases; 3 rejecting attempts -> identity rows, language completes
  phrases = []; for (let i = 0; i < 17; i++) phrases.push("Welcome phrase " + "abcdefghijklmnopq"[i]);
  phrases.push("Load 42 ready", "Dock 7 open", "Welcome driver");
  setup(17); db.ko = rowsFor(phrases.slice(0, 17));
  process.env.ANTHROPIC_API_KEY = "testkey";
  out = await B.handler(evt);   // attempt 1: Welcome driver translates (+1), the two digit phrases are validator-rejected
  ok(db.ko.length === 18, "(J) attempt 1 stores the good translation only (ko 17 -> 18)");
  ok(koLog("lang_reject").length === 1 && koLog("lang_reject_sample").length === 1, "(J) attempt 1 logs the rejection hashes + a (source, output) sample");
  ok(JSON.parse(koLog("lang_reject_sample")[0].msg).every(x => x.why === "digits"), "(J) the logged sample names the reason: digits");
  ok(!db.ko.some(r => r.dst === r.src), "(J) nothing is quarantined after one attempt");
  ageAllLogs(25);
  out = await B.handler(evt);   // attempt 2: both digit phrases rejected again, zero gains
  ok(db.ko.length === 18 && !db.ko.some(r => r.dst === r.src), "(J) attempt 2 rejects again — still no quarantine (needs 3)");
  ageAllLogs(25);
  out = await B.handler(evt);   // attempt 3: third rejection of the same phrases -> quarantine fires
  ok(db.ko.length === 20, "(J) attempt 3 quarantines the two phrases — ko reaches the full 20 rows");
  ok(db.ko.some(r => r.src === "Load 42 ready" && r.dst === "Load 42 ready") && db.ko.some(r => r.src === "Dock 7 open" && r.dst === "Dock 7 open"), "(J) quarantined rows are identity rows (dst == src), the 'leave unchanged' rule");
  ok(JSON.parse(koLog("lang_end").slice(-1)[0].msg).q === 2, "(J) the attempt's lang_end records q=2");
  reset(); out = await B.handler(evt);
  ok(koPages().length === 0, "(J) the language now counts complete — later runs page nothing; the loop has ENDED");
  delete process.env.ANTHROPIC_API_KEY;

  // (K) provider failure: no model key -> attempt happens, but no rejections are recorded and nothing quarantines
  phrases = mkPhrases(100);
  setup(90); zeroGainSeed(25);
  out = await B.handler(evt);
  ok(koPages().length === 1 && koLog("lang_reject").length === 0 && db.ko.length === 90, "(K) a no-answer attempt pages once, records no rejections, quarantines nothing");

  console.log("translate-backoff: " + n + " assertions PASS");
})().catch(e => { console.error(e); process.exit(1); });
