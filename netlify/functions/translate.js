// netlify/functions/translate.js
// Translates the app's on-screen text into the language the visitor picked.
// Each phrase is translated once and saved (table ui_translations), so every later
// visitor, in every company, gets it instantly and for free.
//
// POST { lang: "es", phrases: ["Book a job", ...] }  ->  { ok: true, t: { "Book a job": "Reservar un trabajo", ... } }
// Public on purpose (customers book jobs before they have a login), so it is limited:
// fixed language list, short phrases, small batches, per-visitor and daily caps.
//
// Env: ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY   (optional TRANSLATE_DAILY_MAX, default 4000 new phrases/day; TRANSLATE_MODEL)

var SB = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
var LANGS = { es: "Spanish (Latin American)", pt: "Portuguese (Brazilian)", kk: "Kazakh", ru: "Russian", fr: "French", zh: "Simplified Chinese", ko: "Korean", vi: "Vietnamese", ar: "Arabic", hi: "Hindi", ht: "Haitian Creole", pl: "Polish", de: "German" };
var MAX_BATCH = 60, MAX_LEN = 240;

function J(status, obj) { return { statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(obj) }; }
function sb(path, opts) {
    opts = opts || {};
    var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    var h = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
    if (opts.prefer) h.Prefer = opts.prefer;
    return fetch(SB + "/rest/v1/" + path, { method: opts.method || "GET", headers: h, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
        .then(function (r) { return r.text().then(function (t) { var d = null; try { d = JSON.parse(t); } catch (e) { } return { ok: r.ok, data: d }; }); });
}
var ipHits = {}, dayKey = "", dayCount = 0;
function visitorLimited(ip, n) {
    var now = Date.now(), a = (ipHits[ip] || []).filter(function (x) { return now - x.t < 3600000; });
    var total = a.reduce(function (s, x) { return s + x.n; }, 0);
    if (total + n > 600) { ipHits[ip] = a; return true; }
    a.push({ t: now, n: n }); ipHits[ip] = a; return false;
}
function dailyLeft(n) {
    var d = new Date().toISOString().slice(0, 10); if (d !== dayKey) { dayKey = d; dayCount = 0; }
    var max = Number(process.env.TRANSLATE_DAILY_MAX) || 4000;
    if (dayCount + n > max) return false; dayCount += n; return true;
}

async function askModel(lang, list) {
    var r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
            model: process.env.TRANSLATE_MODEL || "claude-haiku-5-5", max_tokens: 4096,
            system: "You translate short user-interface strings of a trucking and freight dispatch app from English into " + LANGS[lang] + ". " +
                "Return ONLY a JSON array of strings, the same length and order as the input. Keep it short and natural, the way a trucking app would say it. " +
                "Leave UNCHANGED: brand and company names (POTENT, POTENT OS, Stripe, Samsara, Motive...), person names, street addresses, city names, job and load IDs, emails, phone numbers, URLs, numbers, currency amounts, emoji, and the abbreviations DOT, MC, VIN, CDL, ELD, HOS, COI, IFTA. " +
                "If a string is already in " + LANGS[lang] + " or is not translatable, return it unchanged. Keep any leading or trailing symbols and spaces.",
            messages: [{ role: "user", content: JSON.stringify(list) }]
        })
    });
    if (!r.ok) return null;
    var d = await r.json().catch(function () { return null; });
    var txt = d && d.content && d.content[0] && d.content[0].text; if (!txt) return null;
    var m = txt.match(/\[[\s\S]*\]/); if (!m) return null;
    try { var arr = JSON.parse(m[0]); return Array.isArray(arr) && arr.length === list.length && arr.every(function (x) { return typeof x === "string"; }) ? arr : null; } catch (e) { return null; }
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
    if (visitorLimited(ip, phrases.length)) return J(429, { ok: false, error: "Slow down" });
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
    if (missing.length && process.env.ANTHROPIC_API_KEY && dailyLeft(missing.length)) {
        var tr = null; try { tr = await askModel(lang, missing); } catch (e) { tr = null; }
        if (tr) {
            var rows = [];
            missing.forEach(function (p, i) { out[p] = tr[i]; rows.push({ lang: lang, src: p, dst: tr[i] }); });
            await sb("ui_translations?on_conflict=lang,src", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: rows });
        }
    }
    return J(200, { ok: true, t: out });
};
