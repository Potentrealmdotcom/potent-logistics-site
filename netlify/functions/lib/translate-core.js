// Shared by translate.js (live fallback), translate-packs-background.js (bulk job) and lang-pack.js (the packs people download).
// One place for: the 14 languages, the translation prompt (with the trucking glossary), the model call with retries, and the Supabase helpers.
var SB = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
var LANGS = { es: "Spanish (Latin American)", pt: "Portuguese (Brazilian)", kk: "Kazakh", ru: "Russian", fr: "French", zh: "Simplified Chinese", ko: "Korean", vi: "Vietnamese", ar: "Arabic", hi: "Hindi", ht: "Haitian Creole", pl: "Polish", de: "German" };
var GLOSSARY = "Trucking and moving words, use the normal term a driver or dispatcher in that language would use: pallet, box truck, cargo van, liftgate, dock, curb-to-curb, white glove, deadhead, detention, rate confirmation, bill of lading (BOL), proof of delivery (POD), dispatch, dispatcher, load, lane, route, stop, fuel surcharge, per mile, flat rate, hourly rate, tow, hot shot, LTL, FTL, owner-operator, carrier, broker, shipper, consignee, job, quote, booking, invoice, payroll, settlement.";

function sys(lang) {
    return "You translate user-interface text of a trucking, moving and freight-dispatch app from English into " + LANGS[lang] + ". " +
        "Return ONLY a JSON array of strings, exactly the same length and order as the input array. Natural and short, the way a real app in that language would say it; keep the tone (friendly, plain). " + GLOSSARY + " " +
        "Leave UNCHANGED: brand and company names (POTENT, POTENT OS, POTENT Logistics, POTENT OPERATIONS LLC, Əlevate, Elevate, Stripe, Samsara, Motive, QuickBooks, Google, Calendly...), person names, street addresses, city and state names, job and load IDs, emails, phone numbers, URLs, currency amounts, emoji, and the abbreviations DOT, MC, VIN, CDL, ELD, HOS, COI, IFTA, EIN, ACH, GPS, PDF, CSV, SMS, API, AI. " +
        "Keep every digit as a Western digit 0-9 (never Arabic-Indic or Devanagari digits), and keep every number, price, time and percentage exactly. Keep leading/trailing spaces, symbols, bullets, line breaks and punctuation marks like arrows and checkmarks. " +
        "If a string is already in " + LANGS[lang] + ", or is not translatable, return it unchanged.";
}
function parseList(txt, list) {
    if (!txt) return null;
    var m = String(txt).match(/\[[\s\S]*\]/); if (!m) return null;
    try { var arr = JSON.parse(m[0]); return Array.isArray(arr) && arr.length === list.length && arr.every(function (x) { return typeof x === "string"; }) ? arr : null; } catch (e) { return null; }
}
function digits(s) { return (String(s).match(/[0-9]+/g) || []).sort().join(","); }
// A translation is only stored if it keeps every number the English had, so prices and times can never change by accident.
function sane(src, dst) { return typeof dst === "string" && dst.trim() !== "" && digits(src) === digits(dst) && dst.length < src.length * 6 + 40; }

function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
// One model call. Returns { list } or { retry: true } (rate limit / server trouble / timeout) or { fail: true }.
async function callModel(lang, list, opts) {
    opts = opts || {}; var ms = opts.timeoutMs || 60000;
    try {
        if (process.env.ANTHROPIC_API_KEY) {
            var r = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST", signal: AbortSignal.timeout(ms),
                headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
                body: JSON.stringify({ model: process.env.TRANSLATE_MODEL || "claude-haiku-5-5", max_tokens: 8192, system: sys(lang), messages: [{ role: "user", content: JSON.stringify(list) }] })
            });
            if (r.status === 429 || r.status >= 500 || r.status === 529) return { retry: true, wait: Number(r.headers.get("retry-after")) * 1000 || 0 };
            if (!r.ok) return { fail: true };
            var d = await r.json().catch(function () { return null; });
            var out = parseList(d && d.content && d.content[0] && d.content[0].text, list);
            return out ? { list: out } : { fail: true };
        }
        if (process.env.GEMINI_API_KEY) {
            var o = await require("./gemini.js").chat({ model: process.env.TRANSLATE_MODEL || "gemini-3.5-flash-lite", temperature: 0, max_tokens: 16000, messages: [{ role: "system", content: sys(lang) }, { role: "user", content: JSON.stringify(list) }] }, { timeoutMs: ms });
            if (o.status === 429 || o.status >= 500) return { retry: true, wait: 0 };
            if (!o.ok) return { fail: true };
            var od = await o.json().catch(function () { return null; });
            var out2 = parseList(od && od.choices && od.choices[0] && od.choices[0].message && od.choices[0].message.content, list);
            return out2 ? { list: out2 } : { fail: true };
        }
    } catch (e) { return { retry: true, wait: 0 }; }
    return { fail: true, nokey: true };
}
// Translate a list with retries. Returns an array the same length: a string where it worked, null where it did not.
// Wrong-length answers are split in halves and tried again; refused/slow calls are retried with a pause, never given up on at the first miss.
async function translateList(lang, list, opts) {
    opts = opts || {}; var tries = opts.tries || 4, res = new Array(list.length).fill(null);
    if (!list.length) return res;
    var r = null;
    for (var a = 0; a < tries; a++) {
        r = await callModel(lang, list, opts);
        if (r.list || r.fail) break;
        await wait(Math.min(30000, Math.max(r.wait || 0, 1500 * Math.pow(2, a))));
    }
    if (r && r.list) { list.forEach(function (s, i) { res[i] = sane(s, r.list[i]) ? r.list[i] : null; }); return res; }
    if (r && r.nokey) return res;
    if (list.length > 1 && !opts.noSplit) {                       // bad shape: split and try the halves
        var h = Math.ceil(list.length / 2), x = await translateList(lang, list.slice(0, h), Object.assign({}, opts, { tries: 2 })), y = await translateList(lang, list.slice(h), Object.assign({}, opts, { tries: 2 }));
        return x.concat(y);
    }
    return res;
}

function sb(path, opts) {
    opts = opts || {};
    var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    var h = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
    if (opts.prefer) h.Prefer = opts.prefer;
    return fetch(SB + "/rest/v1/" + path, { method: opts.method || "GET", headers: h, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
        .then(function (r) { return r.text().then(function (t) { var d = null; try { d = JSON.parse(t); } catch (e) { } return { ok: r.ok, status: r.status, data: d }; }); });
}
// every saved translation for one language, page by page (the database returns at most 1000 rows per request)
async function allRows(lang) {
    var out = {}, off = 0;
    for (;;) {
        var q = await sb("ui_translations?lang=eq." + lang + "&select=src,dst&order=src&limit=1000&offset=" + off);
        if (!q.ok || !Array.isArray(q.data)) throw new Error("db read failed " + q.status);
        q.data.forEach(function (r) { out[r.src] = r.dst; });
        if (q.data.length < 1000) break; off += 1000;
    }
    return out;
}
// Writes the ready-made pack (one JSON per language) that the app downloads.
async function buildPack(lang) {
    var t = await allRows(lang), n = Object.keys(t).length;
    var w = await sb("ui_packs?on_conflict=lang", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: [{ lang: lang, data: t, n: n, updated_at: new Date().toISOString() }] });
    return { ok: w.ok, n: n };
}
function packKey() { return require("crypto").createHash("sha256").update("lang-packs:" + (process.env.SUPABASE_SERVICE_ROLE_KEY || "")).digest("hex"); }
module.exports = { LANGS, SB, sys, parseList, sane, callModel, translateList, sb, allRows, buildPack, packKey, wait };
