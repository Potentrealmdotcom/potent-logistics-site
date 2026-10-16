// netlify/functions/estimate-load.js
// Photo load estimator (free Gemini vision). POST { images:[dataUrl,...] } + Bearer login token.
// Returns { ok:true, estimate:{ items:[{name,qty,lbs_each,heavy}], total_cu_yd, total_lbs, material, confidence, hazards[], notes } }
// Env: AUTH_SECRET, GEMINI_API_KEY (free at aistudio.google.com)
var crypto = require("crypto");
function J(s, o) { return { statusCode: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(o) }; }
function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function verify(token) {
    if (!token || typeof token !== "string" || token.indexOf(".") < 0) return null;
    var p = token.split(".");
    var exp = b64u(crypto.createHmac("sha256", process.env.AUTH_SECRET).update(p[0]).digest());
    var a = Buffer.from(p[1] || ""), b = Buffer.from(exp);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try { var d = JSON.parse(Buffer.from(p[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); return d.exp && d.exp >= Date.now() ? d : null; } catch (e) { return null; }
}
var MATS = ["household", "construction", "yard", "concrete_dirt", "mixed"];
function num(v, lo, hi, dflt) { var n = Number(v); if (!isFinite(n)) return dflt; return Math.min(hi, Math.max(lo, n)); }

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") return J(405, { ok: false, error: "POST only" });
    if (!process.env.AUTH_SECRET) return J(500, { ok: false, error: "Server not configured" });
    var h = event.headers || {};
    if (!verify(String(h.authorization || h.Authorization || "").replace(/^Bearer\s+/i, ""))) return J(401, { ok: false, error: "Sign in again" });
    var key = process.env.GEMINI_API_KEY;
    if (!key) return J(503, { ok: false, error: "Photo estimates need the free GEMINI_API_KEY added in Netlify (aistudio.google.com)." });
    if ((event.body || "").length > 6000000) return J(413, { ok: false, error: "Photos too large. Use fewer or smaller photos." });
    var b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return J(400, { ok: false, error: "Bad request" }); }
    var imgs = (Array.isArray(b.images) ? b.images : []).slice(0, 6), parts = [];
    imgs.forEach(function (u) {
        var m = String(u).match(/^data:(image\/(?:jpeg|png|webp|heic|heif));base64,([A-Za-z0-9+\/=]+)$/);
        if (m) parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
    });
    if (!parts.length) return J(400, { ok: false, error: "No usable photos. Use JPG or PNG." });
    var prompt = "You estimate junk removal / hauling loads from photos for a Georgia hauling company. Identify every distinct item or pile, its quantity and a realistic weight in pounds each. " +
        "Mark heavy=true for items 100+ lbs or dense material (appliances, safes, pianos, concrete, dirt, brick, tile). Estimate total volume in cubic yards of the whole pile (a pickup bed is about 2 yd; a 16 ft box truck about 16 yd) and total weight in pounds. " +
        "material is one of: household, construction, yard, concrete_dirt, mixed. List hazards you can see (paint, chemicals, tires, batteries, asbestos-looking material, propane, medical waste). " +
        "Reply with ONLY JSON: {\"items\":[{\"name\":\"\",\"qty\":1,\"lbs_each\":0,\"heavy\":false}],\"total_cu_yd\":0,\"total_lbs\":0,\"material\":\"mixed\",\"confidence\":\"low|medium|high\",\"hazards\":[],\"notes\":\"one short sentence\"}";
    parts.push({ text: prompt });
    try {
        var r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + (process.env.AI_MODEL || "gemini-flash-latest") + ":generateContent", {
            method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({ contents: [{ role: "user", parts: parts }], generationConfig: { temperature: 0.2, responseMimeType: "application/json", maxOutputTokens: 1500 } })
        });
        if (!r.ok) return J(502, { ok: false, error: r.status === 429 ? "The free AI is busy. Try again in a minute." : "The AI could not read the photos." });
        var d = await r.json();
        var txt = (((d.candidates || [])[0] || {}).content || {}).parts; txt = (txt || []).map(function (p) { return p.text || ""; }).join("");
        var o; try { o = JSON.parse(txt); } catch (e) { return J(502, { ok: false, error: "The AI answer was unreadable. Try again." }); }
        var items = (Array.isArray(o.items) ? o.items : []).slice(0, 40).map(function (i) {
            return { name: String(i.name || "Item").slice(0, 60), qty: Math.round(num(i.qty, 1, 500, 1)), lbs_each: Math.round(num(i.lbs_each, 0, 5000, 0)), heavy: !!i.heavy };
        });
        var est = {
            items: items,
            total_cu_yd: Math.round(num(o.total_cu_yd, 0.5, 100, 4) * 10) / 10,
            total_lbs: Math.round(num(o.total_lbs, 0, 80000, items.reduce(function (t, i) { return t + i.qty * i.lbs_each; }, 0))),
            material: MATS.indexOf(o.material) >= 0 ? o.material : "mixed",
            confidence: ["low", "medium", "high"].indexOf(o.confidence) >= 0 ? o.confidence : "low",
            hazards: (Array.isArray(o.hazards) ? o.hazards : []).slice(0, 10).map(function (x) { return String(x).slice(0, 60); }),
            notes: String(o.notes || "").slice(0, 300)
        };
        return J(200, { ok: true, estimate: est });
    } catch (e) { return J(502, { ok: false, error: "Could not reach the AI." }); }
};
