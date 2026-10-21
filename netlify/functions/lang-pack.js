// netlify/functions/lang-pack.js   GET ?lang=es  ->  { ok, lang, n, v, t: { "English phrase": "translation", ... } }
// The ready-made language pack. No model is called here; it only reads what the bulk job saved, and the answer is cached by the CDN and the browser.
var C = require("./lib/translate-core.js");
function J(status, obj, cache) { return { statusCode: status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache || "no-store", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(obj) }; }
exports.handler = async function (event) {
    var lang = String((event.queryStringParameters || {}).lang || "");
    if (!C.LANGS[lang]) return J(400, { ok: false, error: "Unsupported language" });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return J(200, { ok: true, lang: lang, n: 0, v: "0", t: {} });
    var q = await C.sb("ui_packs?lang=eq." + lang + "&select=data,n,updated_at");
    var row = q.ok && Array.isArray(q.data) ? q.data[0] : null, t = row ? row.data : null, n = row ? row.n : 0, v = row ? String(Date.parse(row.updated_at) || n) : "0";
    if (!t) { try { t = await C.allRows(lang); n = Object.keys(t).length; v = "live" + n; } catch (e) { return J(502, { ok: false, error: "pack unavailable" }); } }
    return J(200, { ok: true, lang: lang, n: n, v: v, t: t }, "public, max-age=900, s-maxage=900, stale-while-revalidate=86400");
};
