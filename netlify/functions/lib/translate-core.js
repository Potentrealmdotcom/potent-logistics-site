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
// saneWhy names the reason (null = sane) so callers can tell a validator rejection (the model DID
// answer; the answer broke a rule) from a provider failure (no usable answer at all) — the Nov 11
// quarantine in the packs job acts only on the former.
function saneWhy(src, dst) { if (typeof dst !== "string" || dst.trim() === "") return "empty"; if (digits(src) !== digits(dst)) return "digits"; if (dst.length >= src.length * 6 + 40) return "toolong"; return null; }
function sane(src, dst) { return saneWhy(src, dst) === null; }

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
            if (r.status === 429 || r.status >= 500 || r.status === 529) return { retry: true, status: r.status, wait: (Number(r.headers.get("retry-after")) * 1000) || 20000 };
            if (!r.ok) return { fail: true, status: r.status, msg: (await r.text().catch(function () { return ""; })).slice(0, 200) };
            var d = await r.json().catch(function () { return null; });
            var out = parseList(d && d.content && d.content[0] && d.content[0].text, list);
            return out ? { list: out } : { fail: true, msg: "unparseable_or_wrong_length" };
        }
        if (process.env.GEMINI_API_KEY) {
            var o = await require("./gemini.js").chat({ model: process.env.TRANSLATE_MODEL || "gemini-3.5-flash-lite", temperature: 0, max_tokens: 16000, messages: [{ role: "system", content: sys(lang) }, { role: "user", content: JSON.stringify(list) }] }, { timeoutMs: ms });
            if (o.status === 429 || o.status >= 500) return { retry: true, status: o.status, wait: 20000 };
            if (!o.ok) return { fail: true, status: o.status, msg: (await o.text().catch(function () { return ""; })).slice(0, 200) };
            var od = await o.json().catch(function () { return null; });
            var out2 = parseList(od && od.choices && od.choices[0] && od.choices[0].message && od.choices[0].message.content, list);
            return out2 ? { list: out2 } : { fail: true, msg: "unparseable_or_wrong_length" };
        }
    } catch (e) { return { retry: true, wait: 0, msg: String(e && e.message || e).slice(0, 120) }; }
    return { fail: true, nokey: true, msg: "no ANTHROPIC_API_KEY or GEMINI_API_KEY" };
}
// Translate a list with retries. Returns an array the same length: a string where it worked, null where it did not.
// Wrong-length answers are split in halves and tried again; refused/slow calls are retried with a pause, never given up on at the first miss.
async function translateList(lang, list, opts) {
    opts = opts || {}; var tries = opts.tries || 4, res = new Array(list.length).fill(null);
    if (!list.length) return res;
    var r = null;
    for (var a = 0; a < tries; a++) {
        r = await callModel(lang, list, opts);
        if (!r.list && opts.onNote) opts.onNote((r.retry ? "retry " : "fail ") + (r.status || "") + " " + (r.msg || ""));
        if (r.list || r.fail) break;
        await wait(Math.min(30000, Math.max(r.wait || 0, 1500 * Math.pow(2, a))));
    }
    if (r && r.list) { list.forEach(function (s, i) { var w = saneWhy(s, r.list[i]); if (w === null) res[i] = r.list[i]; else if (opts.onReject) { try { opts.onReject(s, r.list[i], w); } catch (e) { } } }); return res; }
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
        .then(function (r) { return r.text().then(function (t) { var d = null; try { d = JSON.parse(t); } catch (e) { } var cr = r.headers && r.headers.get ? r.headers.get("content-range") : null, cnt = null; if (cr) { var m = /\/(\d+)\s*$/.exec(cr); if (m) cnt = parseInt(m[1], 10); } return { ok: r.ok, status: r.status, data: d, count: cnt }; }); });
}
// How many translations are stored for one language — a count-only query (limit=0, empty body back).
// This is the cheap completeness check: it must never be replaced by a page download.
async function countRows(lang) {
    var q = await sb("ui_translations?lang=eq." + lang + "&select=src&limit=0", { prefer: "count=exact" });
    if (!q.ok) throw new Error("db count failed " + q.status);
    return typeof q.count === "number" ? q.count : (Array.isArray(q.data) ? q.data.length : 0);
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
// Pass rows you already fetched and it builds from them — no second download of the same slice.
async function buildPack(lang, rows) {
    var t = rows || await allRows(lang), n = Object.keys(t).length;
    var w = await sb("ui_packs?on_conflict=lang", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: [{ lang: lang, data: t, n: n, updated_at: new Date().toISOString() }] });
    return { ok: w.ok, n: n };
}
function packKey() { return require("crypto").createHash("sha256").update("lang-packs:" + (process.env.SUPABASE_SERVICE_ROLE_KEY || "")).digest("hex"); }

// ---- Shared completeness + zero-gain backoff (egress fix, Nov 11 2026) -------------------------
// ONE place for the rules BOTH gates use: translate-packs-cron (which reads ui_packs.n) and the
// background job (which reads the ui_translations count). The Nov 11 dashboard fingerprint proved
// the two counts are equal for all 13 languages (pack n is built from the stored rows), so both
// callers feed their count into the same functions below and cannot drift apart on the rule itself.
var BACKOFF_MS = 24 * 60 * 60000;     // a language that gained nothing waits a day, not 15 minutes
function phrasesHash(phrases) { return require("crypto").createHash("sha256").update(JSON.stringify(phrases)).digest("hex").slice(0, 16); }
function phraseHash(src) { return require("crypto").createHash("sha256").update(String(src)).digest("hex").slice(0, 10); }
function isComplete(stored, total) { return stored >= total * 0.995; }   // the one completeness bar, shared
async function lastLogRow(lang, kinds, limit) {
    var q = await sb("ui_pack_log?lang=eq." + lang + "&kind=in.(" + kinds + ")&select=kind,msg,at&order=id.desc&limit=" + (limit || 1)).catch(function () { return null; });
    if (!q || !q.ok || !Array.isArray(q.data)) return [];
    return q.data.map(function (r) { var at = Date.parse(r.at || ""); return { kind: r.kind, msg: r.msg, atMs: isFinite(at) ? at : 0 }; });
}
// The language's most recent finished attempt (its lang_end row), or null.
async function lastLangEnd(lang) {
    var rows = await lastLogRow(lang, "lang_end", 1);
    if (!rows.length) return null;
    var m = null; try { m = JSON.parse(rows[0].msg || ""); } catch (e) { }
    if (!m || typeof m.added !== "number") return null;
    return { added: m.added, todo: typeof m.todo === "number" ? m.todo : 0, pack: m.pack, ph: m.ph || null, atMs: rows[0].atMs };
}
// TRUE when the language must not be attempted now: its last finished attempt gained NOTHING,
// its stored count has not moved since, the phrases list is unchanged (hash match — any edit,
// addition or new missing key bypasses instantly), and the latest attempt anchor (the lang_end
// row OR a lang_attempt claim written at the START of a later attempt that then crashed or timed
// out — claim-then-work, so a mid-run death cannot restart the loop) is under 24h old.
async function zeroGainBackoff(lang, stored, phrases) {
    var le = await lastLangEnd(lang);
    if (!le || le.added !== 0 || !(le.todo > 0)) return false;
    if (le.pack !== stored) return false;
    if (le.ph) { if (le.ph !== phrasesHash(phrases)) return false; }
    else if ((phrases.length - stored) > le.todo + 3) return false;   // pre-hash log rows: count-based growth check
    var anchor = le.atMs;
    var latest = await lastLogRow(lang, "lang_end,lang_attempt", 1);
    if (latest.length && latest[0].atMs > anchor) anchor = latest[0].atMs;
    return anchor > 0 && (Date.now() - anchor) < BACKOFF_MS;
}
module.exports = { LANGS, SB, sys, parseList, sane, saneWhy, callModel, translateList, sb, allRows, countRows, buildPack, packKey, wait, BACKOFF_MS, phrasesHash, phraseHash, isComplete, lastLogRow, lastLangEnd, zeroGainBackoff };
