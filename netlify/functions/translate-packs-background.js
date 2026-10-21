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
async function haveFor(lang) { return new Set(Object.keys(await C.allRows(lang))); }

// Does one language until it is complete or the time is up. Returns { lang, left, added }.
async function doLang(lang, phrases, deadline) {
    var have = await haveFor(lang), todo = phrases.filter(function (p) { return !have.has(p); }), added = 0, failed = 0;
    var queue = batches(todo), notes = [];
    var onNote = function (m) { if (notes.length < 6) notes.push(m); };
    async function worker() {
        while (queue.length && Date.now() < deadline) {
            var b = queue.shift(), res = await C.translateList(lang, b, { timeoutMs: 70000, tries: 3, onNote: onNote });
            var rows = [];
            b.forEach(function (p, i) { if (res[i]) rows.push({ lang: lang, src: p, dst: res[i] }); else failed++; });
            if (rows.length) { var w = await C.sb("ui_translations?on_conflict=lang,src", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: rows }); if (w.ok) added += rows.length; }
        }
    }
    var ws = []; for (var i = 0; i < PARALLEL; i++) ws.push(worker());
    await Promise.all(ws);
    var pack = await C.buildPack(lang);
    await logRow(lang, "lang_end", JSON.stringify({ todo: todo.length, added: added, failed: failed, pack: pack.n, notes: notes }));
    return { lang: lang, todo: todo.length, added: added, failed: failed, pack: pack.n };
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
    var langs = Object.keys(C.LANGS).filter(function (l) { return !only || l === only; });
    var deadline = Date.now() + 9 * 60 * 1000;
    // every language at the same time (the earlier one-after-another order ran out of time before the last languages got a turn)
    var report = [], LANES = 2; // two languages at a time, one worker each: the provider was refusing 13 at once with 429
    for (var gi = 0; gi < langs.length && Date.now() < deadline; gi += LANES) {
      var grp = langs.slice(gi, gi + LANES);
      report = report.concat(await Promise.all(grp.map(function (l) { return doLang(l, phrases, deadline).catch(function (e) { return { lang: l, error: String(e.message || e) }; }); })));
    }
    await logRow(null, "run_end", JSON.stringify(report).slice(0, 800));
    console.log("packs: " + JSON.stringify(report));
    return { statusCode: 200, body: "done" };
};
