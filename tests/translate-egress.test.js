// Run: node tests/translate-egress.test.js
// SUPABASE EGRESS FIX (Nov 10, 2026) — the translation-pack builder was re-downloading the ENTIRE
// ui_translations table on every run: Supabase logs showed 12.5k ui_translations GETs in 24h (~66% of
// all API traffic), burst sweeps per language (pages of limit=1000), each lang/offset combo repeating
// 192x/day, egress 8.79 GB against the 5 GB free cap. Root cause (code): translate-packs-background.js
// ran doLang() for EVERY language — complete ones included — and each doLang downloaded its language's
// full slice TWICE (haveFor, then buildPack re-downloaded it), and rebuilt/re-uploaded the pack even
// when the run added nothing.
// This suite mocks the Supabase fetch layer and drives the real background handler + cron to prove:
// (a) all languages complete -> a run issues ZERO ui_translations page GETs (count checks only),
//     no pack uploads, and only the minimal run_start/run_end log rows;
// (b) one incomplete language -> that language is paged exactly ONCE per run (its pages, one pass),
//     never twice;
// (c) a complete language sitting next to an incomplete one is never paged;
// (d) the cron, with every pack complete, answers "complete" and starts nothing.
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert.ok(c, m); console.log("ok -", m); n++; };
delete process.env.ANTHROPIC_API_KEY; delete process.env.GEMINI_API_KEY;   // no model key: translations "fail closed" (all null), which is fine — this suite grades FETCH behaviour
process.env.SUPABASE_SERVICE_ROLE_KEY = "testkey";
const C = require("../netlify/functions/lib/translate-core.js");
const B = require("../netlify/functions/translate-packs-background.js");

const resp = (st, body, hdr) => ({
  ok: st < 300, status: st,
  headers: { get: k => { const h = {}; Object.keys(hdr || {}).forEach(x => { h[x.toLowerCase()] = hdr[x]; }); const v = h[String(k).toLowerCase()]; return v === undefined ? null : v; } },
  json: async () => body, text: async () => (typeof body === "string" ? body : JSON.stringify(body))
});

// 2,500 phrases: an incomplete language holding 1,200 of them spans 2 pages — enough to prove one pass vs two.
const phrases = []; for (let i = 0; i < 2500; i++) phrases.push("Phrase number " + i);
const rowsFor = list => list.map(p => ({ src: p, dst: "t:" + p }));

let db, events, pageGets, countGets, packPosts, logKinds, triggerCalls;
function reset() { events = []; pageGets = []; countGets = []; packPosts = []; logKinds = []; triggerCalls = 0; }
function installFetch() {
  global.fetch = async (u, o) => {
    const url = String(u);
    if (url.includes("phrases.json")) return resp(200, phrases);
    if (url.includes(".netlify/functions/translate-packs-background")) { triggerCalls++; return resp(200, "started"); }
    const m = url.match(/\/rest\/v1\/([a-z_]+)(?:\?(.*))?$/); assert.ok(m, "unexpected fetch " + url);
    const table = m[1], qs = new URLSearchParams(m[2] || ""), method = (o && o.method) || "GET";
    const lang = (qs.get("lang") || "").replace("eq.", "");
    if (table === "ui_translations" && method === "GET") {
      const limit = Number(qs.get("limit")), offset = Number(qs.get("offset") || 0);
      if (limit === 0) { countGets.push(lang); events.push("count:" + lang); return resp(200, [], { "content-range": "*/" + db[lang].length }); }
      pageGets.push({ lang, offset }); events.push("page:" + lang + ":" + offset);
      return resp(200, db[lang].slice(offset, offset + limit));
    }
    if (table === "ui_translations" && method === "POST") { const rows = JSON.parse(o.body); rows.forEach(r => { if (!db[lang].some(x => x.src === r.src)) db[lang].push({ src: r.src, dst: r.dst }); }); return resp(201, []); }
    if (table === "ui_pack_log" && method === "GET") return resp(200, []);
    if (table === "ui_pack_log" && method === "POST") { logKinds.push(JSON.parse(o.body).kind); return resp(201, []); }
    if (table === "ui_packs" && method === "GET") return resp(200, [{ n: db[lang].length }]);
    if (table === "ui_packs" && method === "POST") { packPosts.push(JSON.parse(o.body)[0].lang); return resp(200, []); }
    return resp(200, []);
  };
}
const evt = { headers: { "x-pack-key": C.packKey() } };

(async () => {
  // (a) ALL languages complete
  db = {}; Object.keys(C.LANGS).forEach(l => { db[l] = rowsFor(phrases); }); reset(); installFetch();
  let out = await B.handler(evt);
  ok(out.statusCode === 200, "(a) run completes");
  ok(pageGets.length === 0, "(a) ZERO ui_translations page GETs when every language is complete (got " + pageGets.length + ")");
  ok(countGets.length === 13, "(a) completeness decided by 13 count-only queries, one per language (got " + countGets.length + ")");
  ok(packPosts.length === 0, "(a) no pack is rebuilt or re-uploaded");
  ok(logKinds.join(",") === "run_start,run_end", "(a) log churn is the minimal run record only (got " + logKinds.join(",") + ")");

  // (b) + (c) Spanish complete, French incomplete (1,200 of 2,500), the rest empty
  db = {}; Object.keys(C.LANGS).forEach(l => { db[l] = []; });
  db.es = rowsFor(phrases); db.fr = rowsFor(phrases.slice(0, 1200)); reset(); installFetch();
  out = await B.handler(evt);
  ok(out.statusCode === 200, "(b) run completes");
  const frPages = pageGets.filter(g => g.lang === "fr");
  ok(frPages.length === 2 && frPages.map(g => g.offset).join(",") === "0,1000", "(b) the incomplete language is paged exactly ONCE — 2 pages, one pass (got " + frPages.length + ": " + frPages.map(g => g.offset).join(",") + ")");
  ok(events.indexOf("count:fr") > -1 && events.indexOf("count:fr") < events.indexOf("page:fr:0"), "(b) the count check for French happens before any French page fetch");
  ok(pageGets.filter(g => g.lang === "es").length === 0, "(c) the complete language next to it (Spanish, 2,500 stored) is never paged");
  ok(countGets.includes("es") && countGets.includes("fr"), "(c) both languages were decided by the cheap count check");
  ok(packPosts.length === 0, "(b) nothing translated this run (no model key) -> no pack rebuilds at all");

  // (d) cron with every pack complete
  db = {}; Object.keys(C.LANGS).forEach(l => { db[l] = rowsFor(phrases); }); reset(); installFetch();
  const cron = (await import("../netlify/functions/translate-packs-cron.mjs")).default;
  const txt = await (await cron()).text();
  ok(txt === "complete", "(d) cron answers 'complete' when every pack is at the bar");
  ok(triggerCalls === 0 && pageGets.length === 0 && countGets.length === 0, "(d) cron starts no job and touches ui_translations zero times");

  console.log("translate-egress: " + n + " assertions PASS");
})().catch(e => { console.error(e); process.exit(1); });
