// netlify/functions/translate.js
// Translates the app's on-screen text into the language the visitor picked.
// Each phrase is translated once and saved (table ui_translations), so every later
// visitor, in every company, gets it instantly and for free.
//
// POST { lang: "es", phrases: ["Book a job", ...] }  ->  { ok: true, t: { "Book a job": "Reservar un trabajo", ... } }
// Public on purpose (customers book jobs before they have a login), so it is limited:
// fixed language list, short phrases, small batches, per-visitor and daily caps.
//
// Env: ANTHROPIC_API_KEY or GEMINI_API_KEY (either one), SUPABASE_SERVICE_ROLE_KEY   (optional TRANSLATE_DAILY_MAX, default 20000 new phrases/day; TRANSLATE_MODEL)

var C = require("./lib/translate-core.js");
var LANGS = C.LANGS, sb = C.sb;
// Live fallback only: the ready-made packs (lang-pack) carry almost everything. This catches text that is built while the app runs (names, counts, new wording).
var MAX_BATCH = 40, MAX_LEN = 1200;

function J(status, obj) { return { statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(obj) }; }
var ipHits = {}, dayKey = "", dayCount = 0;
function visitorLimited(ip, n) {
    var now = Date.now(), a = (ipHits[ip] || []).filter(function (x) { return now - x.t < 3600000; });
    var total = a.reduce(function (s, x) { return s + x.n; }, 0);
    if (total + n > 3000) { ipHits[ip] = a; return true; }
    a.push({ t: now, n: n }); ipHits[ip] = a; return false;
}
function dailyLeft(n) {
    var d = new Date().toISOString().slice(0, 10); if (d !== dayKey) { dayKey = d; dayCount = 0; }
    var max = Number(process.env.TRANSLATE_DAILY_MAX) || 20000;
    if (dayCount + n > max) return false; dayCount += n; return true;
}

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") return J(405, { ok: false });
    var body; try { body = JSON.parse(event.body || "{}"); } catch (e) { return J(400, { ok: false }); }
    var lang = String(body.lang || "");
    if (!LANGS[lang]) return J(400, { ok: false, error: "Unsupported language" });
    var seen = {}, phrases = (Array.isArray(body.phrases) ? body.phrases : []).filter(function (p) {
        if (typeof p !== "string" || !p.trim() || p.length > MAX_LEN || seen[p]) return false; seen[p] = 1; return true;
    }).slice(0, MAX_BATCH);
    if (!phrases.length) return J(200, { ok: true, t: {} });
    var h = event.headers || {};
    var ip = String(h["x-nf-client-connection-ip"] || h["x-forwarded-for"] || "x").split(",")[0].trim();
    if (visitorLimited(ip, phrases.length)) return J(429, { ok: false, error: "Slow down", retry: true });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return J(200, { ok: true, t: {} });

    var out = {};
    // 1) what we already know
    for (var c = 0; c < phrases.length; c += 10) {
        var chunk = phrases.slice(c, c + 10);
        var list = chunk.map(function (p) { return encodeURIComponent('"' + p.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'); }).join(",");
        var q = await sb("ui_translations?lang=eq." + lang + "&src=in.(" + list + ")&select=src,dst");
        if (q.ok && Array.isArray(q.data)) q.data.forEach(function (r) { out[r.src] = r.dst; });
    }
    var missing = phrases.filter(function (p) { return out[p] === undefined; });
    // 2) translate only what is new
    if (missing.length && (process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY) && !dailyLeft(missing.length)) return J(429, { ok: false, t: out, retry: true });
    if (missing.length && (process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY)) {
        var tr = null; try { tr = await C.translateList(lang, missing, { timeoutMs: 7000, tries: 1, noSplit: true }); } catch (e) { tr = null; }
        if (tr) {
            var rows = [];
            missing.forEach(function (p, i) { if (tr[i]) { out[p] = tr[i]; rows.push({ lang: lang, src: p, dst: tr[i] }); } });
            if (rows.length) await sb("ui_translations?on_conflict=lang,src", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: rows });
        }
        // nothing came back (model busy / refused): tell the app to ask again later instead of treating the phrases as untranslatable
        if (missing.length && missing.every(function (p) { return out[p] === undefined; })) return J(503, { ok: false, t: out, retry: true });
    }
    return J(200, { ok: true, t: out });
};
