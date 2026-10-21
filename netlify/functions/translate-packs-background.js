// netlify/functions/translate-packs-background.js
// Background job (Netlify runs it up to 15 minutes). Translates every phrase in /lang/phrases.json that a language does not have yet,
// saves each batch to ui_translations as it goes, then rebuilds that language's ready-made pack (ui_packs).
// Only the scheduled function (translate-packs-cron) can start it: it must send the internal key.
var C = require("./lib/translate-core.js");
var BATCH_ITEMS = 25, BATCH_CHARS = 5000, PARALLEL = 6;

function batches(list) {
    var out = [], cur = [], chars = 0;
    list.forEach(function (p) {
        if (cur.length && (cur.length >= BATCH_ITEMS || chars + p.length > BATCH_CHARS)) { out.push(cur); cur = []; chars = 0; }
        cur.push(p); chars += p.length;
    });
    if (cur.length) out.push(cur);
    return out;
}
async function haveFor(lang) { return new Set(Object.keys(await C.allRows(lang))); }

// Does one language until it is complete or the time is up. Returns { lang, left, added }.
async function doLang(lang, phrases, deadline) {
    var have = await haveFor(lang), todo = phrases.filter(function (p) { return !have.has(p); }), added = 0, failed = 0;
    var queue = batches(todo);
    async function worker() {
        while (queue.length && Date.now() < deadline) {
            var b = queue.shift(), res = await C.translateList(lang, b, { timeoutMs: 70000 });
            var rows = [];
            b.forEach(function (p, i) { if (res[i]) rows.push({ lang: lang, src: p, dst: res[i] }); else failed++; });
            if (rows.length) { var w = await C.sb("ui_translations?on_conflict=lang,src", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: rows }); if (w.ok) added += rows.length; }
        }
    }
    var ws = []; for (var i = 0; i < PARALLEL; i++) ws.push(worker());
    await Promise.all(ws);
    var pack = await C.buildPack(lang);
    return { lang: lang, todo: todo.length, added: added, failed: failed, pack: pack.n };
}

exports.handler = async function (event) {
    var h = event.headers || {};
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || h["x-pack-key"] !== C.packKey()) return { statusCode: 403, body: "no" };
    var base = process.env.URL || "https://potentoperations.netlify.app";
    var r = await fetch(base + "/lang/phrases.json?" + Date.now()); if (!r.ok) { console.log("packs: phrases.json HTTP " + r.status); return { statusCode: 200, body: "no phrases" }; }
    var phrases = await r.json(), only = (event.queryStringParameters && event.queryStringParameters.lang) || "";
    var langs = Object.keys(C.LANGS).filter(function (l) { return !only || l === only; });
    var deadline = Date.now() + 12 * 60 * 1000, per = Math.floor((deadline - Date.now()) / langs.length);
    // take the languages one after another, each with its share of the time, so no language is starved
    var report = [];
    for (var i = 0; i < langs.length; i++) {
        try { report.push(await doLang(langs[i], phrases, Math.min(deadline, Date.now() + per * 1.6))); } catch (e) { report.push({ lang: langs[i], error: String(e.message || e) }); }
    }
    console.log("packs: " + JSON.stringify(report));
    return { statusCode: 200, body: "done" };
};
