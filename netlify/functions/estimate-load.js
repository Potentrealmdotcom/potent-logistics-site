// netlify/functions/estimate-load.js
// Staff-only. Looks at photos of a junk / cleanout / demo job and returns an ESTIMATE of the items, their weights,
// the volume in cubic yards and the kind of material. The app turns that into a truck-vs-dumpster plan with real prices.
// A person always reviews it before it becomes a quote.
//
// POST { images: ["data:image/jpeg;base64,...", ...up to 6], notes: "optional" }
//   -> { ok: true, estimate: { items: [{name, qty, lbs_each, heavy}], total_cu_yd, total_lbs, material, hazards: [], confidence, notes } }
// Env: AUTH_SECRET, ANTHROPIC_API_KEY  (optional ESTIMATE_MODEL, ESTIMATE_DAILY_MAX per company, default 150)

var crypto = require("crypto");
function J(s, o) { return { statusCode: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(o) }; }
function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function verify(token) {
    if (!token || typeof token !== "string" || token.indexOf(".") < 0) return null;
    var parts = token.split(".");
    var expect = b64u(crypto.createHmac("sha256", process.env.AUTH_SECRET).update(parts[0]).digest());
    var a = Buffer.from(parts[1] || ""), b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try { var p = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); return p.exp && p.exp >= Date.now() ? p : null; } catch (e) { return null; }
}
var DAY = {};
var MATERIALS = ["household", "construction", "yard", "concrete_dirt", "mixed"];
function num(v, lo, hi) { v = Number(v); if (!isFinite(v)) return 0; return Math.max(lo, Math.min(hi, v)); }
function clean(raw) {
    var e = raw && typeof raw === "object" ? raw : {};
    var items = (Array.isArray(e.items) ? e.items : []).slice(0, 40).map(function (it) {
        return { name: String((it && it.name) || "item").slice(0, 60), qty: Math.round(num(it && it.qty, 1, 200)) || 1, lbs_each: Math.round(num(it && it.lbs_each, 0, 4000)), heavy: !!(it && it.heavy) };
    });
    var lbsFromItems = items.reduce(function (s, i) { return s + i.qty * i.lbs_each; }, 0);
    return {
        items: items,
        total_cu_yd: Math.round(num(e.total_cu_yd, 0, 400) * 10) / 10,
        total_lbs: Math.round(Math.max(num(e.total_lbs, 0, 200000), lbsFromItems)),
        material: MATERIALS.indexOf(e.material) >= 0 ? e.material : "mixed",
        hazards: (Array.isArray(e.hazards) ? e.hazards : []).slice(0, 10).map(function (h) { return String(h).slice(0, 80); }),
        confidence: ["low", "medium", "high"].indexOf(e.confidence) >= 0 ? e.confidence : "low",
        notes: String(e.notes || "").slice(0, 400)
    };
}
exports.handler = async function (event) {
    if (event.httpMethod !== "POST") return J(405, { ok: false, error: "POST only" });
    if (!process.env.AUTH_SECRET || !process.env.ANTHROPIC_API_KEY) return J(500, { ok: false, error: "Not configured" });
    var h = event.headers || {};
    var tok = verify(String(h.authorization || h.Authorization || "").replace(/^Bearer\s+/i, ""));
    if (!tok) return J(401, { ok: false, error: "Sign in again" });
    if (["owner", "dispatch", "dispatcher", "driver"].indexOf(tok.role) < 0) return J(403, { ok: false, error: "Not allowed" });
    var org = String(tok.orgId || "potent"), day = new Date().toISOString().slice(0, 10), k = org + ":" + day;
    DAY[k] = (DAY[k] || 0) + 1;
    if (DAY[k] > (Number(process.env.ESTIMATE_DAILY_MAX) || 150)) return J(429, { ok: false, error: "Daily photo-estimate limit reached" });
    var body; try { body = JSON.parse(event.body || "null"); } catch (e) { body = null; }
    var imgs = body && Array.isArray(body.images) ? body.images.slice(0, 6) : [];
    if (!imgs.length) return J(400, { ok: false, error: "Add at least one photo" });
    var content = [];
    for (var i = 0; i < imgs.length; i++) {
        var m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+\/=]+)$/.exec(String(imgs[i] || ""));
        if (!m || m[2].length > 2200000) return J(400, { ok: false, error: "Photo " + (i + 1) + " is not a usable image (max about 1.6 MB each)" });
        content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
    }
    content.push({ type: "text", text:
        "You are estimating a junk removal / cleanout / demolition-debris job from photos for a hauling company in Georgia.\n" +
        "Identify the distinct items or piles, how many of each, and a realistic weight in pounds for ONE of each (use typical weights: couch 100-200, mattress 50-100, refrigerator 250, washer 175, gun safe 250-1000, upright piano 450, concrete or dirt very heavy, wet wood and shingles heavy, drywall about 2 lb per sq ft sheet 50-60 lb). " +
        "Mark an item heavy=true if it is 150 lb or more each. Estimate the total volume in cubic yards of everything pictured as loose pile (a standard 16 ft box truck holds about 25 cubic yards; a 20-yard dumpster holds 20). " +
        "Choose material: household, construction, yard, concrete_dirt, or mixed. List hazards you can see (paint, propane, tires, refrigerant appliances, asbestos-looking material, batteries, sharps) in hazards. " +
        "If you cannot see enough, say so in notes and set confidence=low. Never invent items that are not visible. " +
        (body.notes ? "Staff notes: " + String(body.notes).slice(0, 400) + "\n" : "") +
        "Reply with ONLY a JSON object: {\"items\":[{\"name\":\"\",\"qty\":1,\"lbs_each\":0,\"heavy\":false}],\"total_cu_yd\":0,\"total_lbs\":0,\"material\":\"mixed\",\"hazards\":[],\"confidence\":\"low|medium|high\",\"notes\":\"\"}" });
    var r;
    try {
        r = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
            body: JSON.stringify({ model: process.env.ESTIMATE_MODEL || "claude-sonnet-5-5", max_tokens: 1500, messages: [{ role: "user", content: content }] })
        });
    } catch (e) { return J(502, { ok: false, error: "Estimator unreachable. Try again." }); }
    var d; try { d = await r.json(); } catch (e) { d = null; }
    if (!r.ok || !d || !Array.isArray(d.content)) return J(502, { ok: false, error: "Estimator error. Try again." });
    var txt = d.content.filter(function (c) { return c.type === "text"; }).map(function (c) { return c.text; }).join("");
    var jm = /\{[\s\S]*\}/.exec(txt), parsed = null;
    try { parsed = jm ? JSON.parse(jm[0]) : null; } catch (e) { parsed = null; }
    if (!parsed) return J(502, { ok: false, error: "Could not read the estimate. Try clearer photos." });
    return J(200, { ok: true, estimate: clean(parsed) });
};
