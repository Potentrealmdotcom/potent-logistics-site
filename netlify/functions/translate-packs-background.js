// netlify/functions/translate-packs-background.js
// Background job (Netlify runs it up to 15 minutes). Translates every phrase in /lang/phrases.json that a language does not have yet,
// saves each batch to ui_translations as it goes, then rebuilds that language's ready-made pack (ui_packs).
// Only the scheduled function (translate-packs-cron) can start it: it must send the internal key.
var C = require("./lib/translate-core.js");
var BATCH_ITEMS = 25, BATCH_CHARS = 5000, PARALLEL = 1;     // workers per language; all languages run side by side

function batches(list) {
    var out = [], cur = [], chars = 0;
    list.forEach(function (p) {
        if (cur.length && (cur.length >= BATCH_ITEMS || chars + p.length > BATCH_CHARS)) { out.push(cur); cur = []; chars = 0; }
        cur.push(p); chars += p.length;
    });
    if (cur.length) out.push(cur);
    return out;
}
function logRow(lang, kind, msg) { return C.sb("ui_pack_log", { method: "POST", prefer: "return=minimal", body: { lang: lang, kind: kind, msg: String(msg || "").slice(0, 900) } }).catch(function () { }); }

var QUARANTINE_RUNS = 3;     // consecutive model-answering attempts that must reject a phrase before it is quarantined

// Does one language until it is complete or the time is up. Returns { lang, left, added }.
async function doLang(lang, phrases, deadline, rid) {
    // Cheap completeness check FIRST: one count-only query, never a table download just to decide.
    // Same completeness bar as the cron (99.5% — a few strings are untranslatable): a language at the
    // bar is skipped entirely this run — zero page fetches, no pack rebuild, no per-language log row.
    var stored = await C.countRows(lang);
    if (C.isComplete(stored, phrases.length)) return { lang: lang, skipped: true, stored: stored };
    var ph = C.phrasesHash(phrases);
    // ZERO-GAIN BACKOFF (egress fix, Nov 11 2026): if this language's last finished attempt added
    // NOTHING, its stored count has not moved since, and phrases.json is unchanged (hash match),
    // retrying now would only re-download the whole dictionary to fail the same phrases again —
    // wait 24h from the last attempt instead of paying for the download every 15 minutes. Live
    // case: Korean sits 6 rows under the bar with 42 phrases failing every run; each run pulled
    // its full ~7,100-row slice (~2 MB) and gained zero, ~130 MB/day of pure egress. The shared
    // gate lives in translate-core (zeroGainBackoff) and the cron enforces the same rule before
    // it even starts this job. A backoff skip writes no lang_end, so the clock stays anchored.
    if (await C.zeroGainBackoff(lang, stored, phrases)) return { lang: lang, skipped: "backoff", stored: stored };
    // CLAIM-THEN-WORK: stamp the attempt BEFORE the expensive work. If this run crashes or times
    // out mid-attempt, this row is the anchor the backoff reads — a dead run can never restart
    // the 15-minute loop by failing to reach its own lang_end.
    await logRow(lang, "lang_attempt", JSON.stringify({ ph: ph, rid: rid }));
    // Incomplete: download this language's slice ONCE and reuse that same copy for everything below —
    // the missing-phrase list, and (with this run's new rows merged in) the pack rebuild.
    // (A count of 0 means the slice is empty — there is nothing to download at all.)
    var dict = stored > 0 ? await C.allRows(lang) : {};
    var have = new Set(Object.keys(dict)), todo = phrases.filter(function (p) { return !have.has(p); }), added = 0, failed = 0;
    var queue = batches(todo), notes = [];
    var onNote = function (m) { if (notes.length < 6) notes.push(m); };
    // Validator rejections ONLY (the model answered; the answer broke the number/empty/length
    // rule). Provider failures never land here — that distinction is what the quarantine below
    // is allowed to act on, and the lang_reject_sample rows are the diagnostic record of the
    // actual (source, output) pairs for a human to judge whether sane() is too strict.
    var rejected = [], rejectedWhy = {};
    var onReject = function (s, d, w) { if (!rejectedWhy[s]) { rejected.push(s); rejectedWhy[s] = { dst: d, why: w }; } };
    async function worker() {
        while (queue.length && Date.now() < deadline) {
            var b = queue.shift(), res = await C.translateList(lang, b, { timeoutMs: 70000, tries: 3, onNote: onNote, onReject: onReject });
            var rows = [];
            b.forEach(function (p, i) { if (res[i]) rows.push({ lang: lang, src: p, dst: res[i] }); else failed++; });
            if (rows.length) { var w = await C.sb("ui_translations?on_conflict=lang,src", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: rows }); if (w.ok) { added += rows.length; rows.forEach(function (r) { dict[r.src] = r.dst; }); } }
        }
    }
    var ws = []; for (var i = 0; i < PARALLEL; i++) ws.push(worker());
    await Promise.all(ws);
    // QUARANTINE (egress fix, Nov 11 2026): a phrase the validator has rejected in QUARANTINE_RUNS
    // separate model-answering attempts is never going to pass as-is — while it stays missing, the
    // language can NEVER reach the completeness bar (Korean's ceiling is 7,103 in-list rows + 1
    // stale = 7,104 against a 7,110 bar), so the sweep would run forever, backoff or not. Such a
    // phrase is stored as its own English source (identity row — the same "leave unchanged" the
    // translation prompt itself prescribes for untranslatable strings): the row counts, the pack
    // completes, the loop ENDS. The string shows in English in that language's UI until a human
    // fixes it — the lang_reject_sample rows keep the evidence. Only validator rejections count;
    // a provider-outage attempt records no rejections and can neither cause nor advance this.
    var quarantined = 0;
    if (rejected.length) {
        var hashes = rejected.map(function (s) { return C.phraseHash(s); });
        await logRow(lang, "lang_reject", JSON.stringify({ ph: ph, rid: rid, hashes: hashes }));
        await logRow(lang, "lang_reject_sample", JSON.stringify(rejected.slice(0, 4).map(function (s) { return { src: String(s).slice(0, 120), dst: String(rejectedWhy[s].dst).slice(0, 120), why: rejectedWhy[s].why }; })));
        var rrows = await C.lastLogRow(lang, "lang_reject", QUARANTINE_RUNS);
        if (rrows.length >= QUARANTINE_RUNS) {
            var parsed = rrows.map(function (r) { try { return JSON.parse(r.msg || ""); } catch (e) { return null; } });
            var distinctRuns = {}; parsed.forEach(function (p) { if (p && p.rid) distinctRuns[p.rid] = 1; });
            if (parsed.every(function (p) { return p && Array.isArray(p.hashes); }) && Object.keys(distinctRuns).length >= QUARANTINE_RUNS) {
                var common = hashes.filter(function (h) { return parsed.every(function (p) { return p.hashes.indexOf(h) >= 0; }); });
                var qsrcs = rejected.filter(function (s) { return common.indexOf(C.phraseHash(s)) >= 0; });
                if (qsrcs.length) {
                    var qw = await C.sb("ui_translations?on_conflict=lang,src", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: qsrcs.map(function (s) { return { lang: lang, src: s, dst: s }; }) });
                    if (qw.ok) { quarantined = qsrcs.length; added += quarantined; failed -= quarantined; qsrcs.forEach(function (s) { dict[s] = s; }); }
                }
            }
        }
    }
    // No new translations this run -> the stored pack is already right; do not rebuild or re-upload it.
    var pack = added > 0 ? await C.buildPack(lang, dict) : { ok: true, n: stored, built: false };
    await logRow(lang, "lang_end", JSON.stringify({ todo: todo.length, added: added, failed: failed, pack: pack.n, q: quarantined, ph: ph, rid: rid, notes: notes }));
    return { lang: lang, todo: todo.length, added: added, failed: failed, pack: pack.n, q: quarantined };
}

exports.handler = async function (event) {
    var h = event.headers || {};
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || h["x-pack-key"] !== C.packKey()) return { statusCode: 403, body: "no" };
    // one run at a time: skip if a run started in the last 14 minutes and has not logged its end
    var last = await C.sb("ui_pack_log?kind=in.(run_start,run_end)&select=kind,at&order=id.desc&limit=1");
    if (last.ok && last.data && last.data[0] && last.data[0].kind === "run_start" && Date.now() - Date.parse(last.data[0].at) < 14 * 60000) return { statusCode: 200, body: "already running" };
    await logRow(null, "run_start", "");
    var base = process.env.URL || "https://potentoperations.netlify.app";
    var r = await fetch(base + "/lang/phrases.json?" + Date.now()); if (!r.ok) { console.log("packs: phrases.json HTTP " + r.status); return { statusCode: 200, body: "no phrases" }; }
    var phrases = await r.json(), only = (event.queryStringParameters && event.queryStringParameters.lang) || "";
    var rid = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);   // one id per run: attempt/reject/end rows carry it, so "separate attempts" is provable from the log
    var langs = Object.keys(C.LANGS).filter(function (l) { return !only || l === only; });
    var deadline = Date.now() + 9 * 60 * 1000;
    // every language at the same time (the earlier one-after-another order ran out of time before the last languages got a turn)
    var report = [], LANES = 2; // two languages at a time, one worker each: the provider was refusing 13 at once with 429
    for (var gi = 0; gi < langs.length && Date.now() < deadline; gi += LANES) {
      var grp = langs.slice(gi, gi + LANES);
      report = report.concat(await Promise.all(grp.map(function (l) { return doLang(l, phrases, deadline, rid).catch(function (e) { return { lang: l, error: String(e.message || e) }; }); })));
    }
    await logRow(null, "run_end", JSON.stringify(report).slice(0, 800));
    console.log("packs: " + JSON.stringify(report));
    return { statusCode: 200, body: "done" };
};
