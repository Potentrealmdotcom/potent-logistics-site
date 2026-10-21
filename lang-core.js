// lang-core.js: the language switcher + on-screen translator for pages outside the main app (Əlevate, landing, guides).
// Same engine as app.js: a ready-made language pack per language (no model call), safe retries for anything the pack lacks,
// long text split into sentences, Arabic right-to-left, and window.plTrReport() to count what is still English.
// Page can set window.PL_NOTRANS = ".css, .selector" for areas that must never be translated (live chat from the assistant, user data).
(function () {
var PL_NOTRANS = window.PL_NOTRANS || ".msg, .did, [data-notranslate]";
var LANG_KEY = "potent_lang";
function getLang() { try { return localStorage.getItem(LANG_KEY) || "en"; } catch (e) { return "en"; } }
function setLang(l) { try { localStorage.setItem(LANG_KEY, l); } catch (e) { } }
var PL_TR = { lang: "en", cache: {}, miss: {}, nodes: new Set(), orig: new WeakMap(), done: new WeakMap(), pending: {}, timer: null, obs: null, flushing: false, retryN: 0, packLang: "", packOk: false, stats: { packN: 0, live: 0, failed: 0 } };
var PL_TR_SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1, NOSCRIPT: 1, INPUT: 1, SVG: 1 };
var PL_TR_ATTRS = ["placeholder", "title", "aria-label"];
var PL_STREET = /\b(st|street|ave|avenue|rd|road|blvd|dr|drive|ln|lane|hwy|highway|pkwy|ct|way|suite|ste|apt)\b/i;
function plTrWanted(core) {
    if (core.length < 2 || core.length > 20000) return false;
    if (!/[A-Za-zÀ-ɏ]/.test(core)) return false;
    if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(core) || /^(https?:|www\.)/i.test(core)) return false;
    if (/^[A-Z]{1,4}[-#]?\d{3,}/.test(core)) return false;            // job / load IDs like PL-8842
    if (/^\d{1,6}\s+[A-Za-z]/.test(core) && PL_STREET.test(core)) return false; // street addresses
    return true;
}
// Same splitting rule as scripts/extract-phrases.js: text over 1000 characters is looked up sentence by sentence, so no text is skipped for length.
function plTrPieces(s) {
    var sent = s.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [s], out = [];
    sent.forEach(function (x) { while (x.length > 900) { var k = x.lastIndexOf(" ", 900); if (k < 300) k = 900; out.push(x.slice(0, k)); x = x.slice(k); } out.push(x); });
    var g = []; out.forEach(function (x) { var l = g[g.length - 1]; if (l !== undefined && (l + x).length <= 900) g[g.length - 1] = l + x; else g.push(x); });
    return g.map(function (x) { return x.trim(); }).filter(Boolean);
}
function plTrKey(core) { return core.replace(/\s+/g, " "); }
// Finds the translation for a piece of text. Returns the translated text, or undefined if it is not known yet (and queues it).
function plTrLookup(core) {
    var key = plTrKey(core);
    if (key.length > 1000) {
        var parts = plTrPieces(key), outs = [], ok = true;
        parts.forEach(function (p) { var h = PL_TR.cache[p]; if (h !== undefined) outs.push(h || p); else { ok = false; if (!PL_TR.miss[p] && plTrWanted(p)) PL_TR.pending[p] = 1; } });
        return ok ? outs.join(" ") : undefined;
    }
    var hit = PL_TR.cache[key];
    if (hit === undefined && !PL_TR.miss[key]) PL_TR.pending[key] = 1;
    return hit;
}
function plTrBlocked(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentNode) {
        if (PL_TR_SKIP_TAGS[(e.tagName || "").toUpperCase()]) return true;
        if (PL_NOTRANS && e.matches && e.matches(PL_NOTRANS)) return true;
        if (e.hasAttribute && (e.hasAttribute("data-notranslate") || e.getAttribute("contenteditable") === "true" || (e.classList && e.classList.contains("notranslate")))) return true;
    }
    return false;
}
function plTrLoadCache(lang) { try { return JSON.parse(localStorage.getItem("pl_tr_" + lang) || "{}") || {}; } catch (e) { return {}; } }
function plTrSaveCache() { try { var j = JSON.stringify(PL_TR.cache); if (j.length < 4500000) localStorage.setItem("pl_tr_" + PL_TR.lang, j); } catch (e) { } }
function plTrApplyText(node) {
    var text = node.nodeValue;
    if (PL_TR.done.get(node) === text) return;                    // our own translation, leave it
    var core = text.trim();
    if (!plTrWanted(core) || plTrBlocked(node.parentNode)) return;
    PL_TR.orig.set(node, text); PL_TR.nodes.add(node);
    var hit = plTrLookup(core);
    if (hit !== undefined) { if (hit && hit !== plTrKey(core)) { var out = text.replace(core, function () { return hit; }); PL_TR.done.set(node, out); node.nodeValue = out; } }
}
function plTrApplyAttrs(el) {
    PL_TR_ATTRS.forEach(function (a) {
        var v = el.getAttribute && el.getAttribute(a); if (!v) return;
        if (el.getAttribute("data-pl-t-" + a) === v) return;
        var core = v.trim(); if (!plTrWanted(core) || (el.hasAttribute("data-notranslate") || plTrBlocked(el.parentNode))) return;
        el.setAttribute("data-pl-o-" + a, v); PL_TR.nodes.add(el);
        var hit = plTrLookup(core);
        if (hit !== undefined) { if (hit && hit !== plTrKey(core)) { var out = v.replace(core, function () { return hit; }); el.setAttribute("data-pl-t-" + a, out); el.setAttribute(a, out); } }
    });
}
function plTrScan(root) {
    if (!root || PL_TR.lang === "en") return;
    if (root.nodeType === 3) { plTrApplyText(root); return; }
    if (root.nodeType !== 1) return;
    plTrApplyAttrs(root);
    if (plTrBlocked(root)) return;
    var w = document.createTreeWalker(root, 4 | 1, null), n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) plTrApplyText(n); else plTrApplyAttrs(n); }
}
function plTrSchedule(ms) {
    if (PL_TR.timer) return;
    PL_TR.timer = setTimeout(function () { PL_TR.timer = null; plTrFlush(); }, ms || 200);
}
// Ready-made language pack: one download holds every known phrase for the language (no model involved). It is saved in the browser, so later visits are instant and work offline.
function plTrLoadPack(lang) {
    fetch("/.netlify/functions/lang-pack?lang=" + encodeURIComponent(lang)).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (lang !== PL_TR.lang) return;
        if (d && d.t) { var n = 0; Object.keys(d.t).forEach(function (k) { if (PL_TR.cache[k] === undefined) { PL_TR.cache[k] = d.t[k]; n++; } }); PL_TR.stats.packN = d.n || n; PL_TR.packOk = true; plTrSaveCache(); }
        PL_TR.nodes.forEach(function (n) { if (!n.isConnected) PL_TR.nodes.delete(n); });
        plTrScan(document.body); plTrSchedule();
    }).catch(function () { plTrScan(document.body); plTrSchedule(); });
}
function plTrFlush() {
    var keys = Object.keys(PL_TR.pending);
    if (!keys.length || PL_TR.flushing || PL_TR.lang === "en") return;
    if (!PL_TR.packOk && PL_TR.retryN === 0 && PL_TR.packLang === PL_TR.lang && PL_TR.packWait) { PL_TR.packWait = false; return plTrSchedule(1200); }
    var lang = PL_TR.lang, batch = [], chars = 0;
    for (var i = 0; i < keys.length && batch.length < 40; i++) { if (batch.length && chars + keys[i].length > 6000) break; batch.push(keys[i]); chars += keys[i].length; }
    batch.forEach(function (k) { delete PL_TR.pending[k]; });
    PL_TR.flushing = true;
    function again(wait) {                         // a refused or failed request is never treated as "no translation": the phrases go back in the queue
        PL_TR.flushing = false; PL_TR.retryN++;
        if (PL_TR.retryN > 8) { batch.forEach(function (k) { PL_TR.stats.failed++; }); PL_TR.retryN = 0; setTimeout(function () { batch.forEach(function (k) { if (PL_TR.cache[k] === undefined) PL_TR.pending[k] = 1; }); plTrSchedule(); }, 120000); return; }
        batch.forEach(function (k) { if (PL_TR.cache[k] === undefined) PL_TR.pending[k] = 1; });
        plTrSchedule(Math.min(60000, wait || 1500 * Math.pow(2, PL_TR.retryN)));
    }
    fetch("/.netlify/functions/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang: lang, phrases: batch }) })
        .then(function (r) { return r.json().catch(function () { return null; }).then(function (d) { return { st: r.status, d: d }; }); })
        .then(function (x) {
            if (lang !== PL_TR.lang) { PL_TR.flushing = false; return; }
            if (x.st === 429 || x.st >= 500 || !x.d) return again();
            PL_TR.flushing = false; PL_TR.retryN = 0;
            var got = x.d.t || {};
            batch.forEach(function (k) { if (typeof got[k] === "string" && got[k]) { PL_TR.cache[k] = got[k]; PL_TR.stats.live++; } else PL_TR.miss[k] = 1; });
            plTrSaveCache();
            PL_TR.nodes.forEach(function (n) { if (!n.isConnected) PL_TR.nodes.delete(n); });
            plTrScan(document.body);
            if (Object.keys(PL_TR.pending).length) plTrSchedule();
        }).catch(function () { if (lang === PL_TR.lang) again(); else PL_TR.flushing = false; });
}
// Self-check: counts the visible text that is still English. Run window.plTrReport() in the console, or open any screen with ?langcheck=1.
function plTrReport() {
    var untr = [], total = 0, w = document.createTreeWalker(document.body, 4, null), n;
    while ((n = w.nextNode())) {
        var core = (n.nodeValue || "").trim(); if (!plTrWanted(core) || plTrBlocked(n.parentNode)) continue;
        var pe = n.parentNode; if (!pe || !(pe.offsetWidth || pe.offsetHeight || (pe.getClientRects && pe.getClientRects().length))) continue;   // only text a person can see
        total++; if (PL_TR.lang !== "en" && PL_TR.done.get(n) !== n.nodeValue) untr.push(core.slice(0, 80));
    }
    return { lang: PL_TR.lang, dir: document.documentElement.dir, visibleTexts: total, untranslated: untr.length, pct: total ? Math.round(100 * (total - untr.length) / total) : 100, pending: Object.keys(PL_TR.pending).length, miss: Object.keys(PL_TR.miss).length, stats: PL_TR.stats, samples: untr.slice(0, 25) };
}
if (typeof window !== "undefined") window.plTrReport = plTrReport;
function plTrRestore() {
    PL_TR.nodes.forEach(function (n) {
        if (n.nodeType === 3) { var o = PL_TR.orig.get(n); if (o !== undefined && PL_TR.done.get(n) === n.nodeValue) n.nodeValue = o; }
        else if (n.getAttribute) PL_TR_ATTRS.forEach(function (a) { var o = n.getAttribute("data-pl-o-" + a); if (o !== null && n.getAttribute("data-pl-t-" + a) === n.getAttribute(a)) { n.setAttribute(a, o); n.removeAttribute("data-pl-t-" + a); n.removeAttribute("data-pl-o-" + a); } });
    });
    PL_TR.nodes.clear(); PL_TR.done = new WeakMap();
}
function plTrStart(lang) {
    if (typeof document === "undefined" || !document.body) return;
    try { document.documentElement.lang = lang; document.documentElement.dir = lang === "ar" ? "rtl" : "ltr"; } catch (e) { }
    // put back English first, so switching language always starts from the original text
    plTrRestore(); PL_TR.pending = {}; PL_TR.miss = {}; PL_TR.retryN = 0; PL_TR.packOk = false; PL_TR.stats = { packN: 0, live: 0, failed: 0 };
    PL_TR.lang = lang;
    if (lang === "en") { if (PL_TR.obs) { PL_TR.obs.disconnect(); PL_TR.obs = null; } return; }
    PL_TR.cache = plTrLoadCache(lang);
    if (!PL_TR.obs && window.MutationObserver) {
        PL_TR.obs = new MutationObserver(function (recs) {
            recs.forEach(function (r) {
                if (r.type === "characterData") plTrScan(r.target);
                else if (r.type === "attributes") plTrApplyAttrs(r.target);
                else r.addedNodes.forEach(function (n) { plTrScan(n); });
            });
            plTrSchedule();
        });
        PL_TR.obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: PL_TR_ATTRS });
    }
    plTrScan(document.body);                 // what is already saved in this browser shows at once
    PL_TR.pending = {}; PL_TR.packLang = lang; PL_TR.packWait = true;
    plTrLoadPack(lang);                      // then the full pack fills in the rest; live translation only covers what the pack does not have
}

var ALL = [["en", "English"], ["es", "Español"], ["pt", "Português"], ["kk", "Қазақша"], ["ru", "Русский"], ["fr", "Français"], ["zh", "中文"], ["ko", "한국어"], ["vi", "Tiếng Việt"], ["ar", "العربية"], ["hi", "हिन्दी"], ["ht", "Kreyòl"], ["pl", "Polski"], ["de", "Deutsch"]];
function mkSelect() {
    var s = document.createElement("select"); s.className = "pl-lang notranslate"; s.setAttribute("data-notranslate", "1"); s.setAttribute("aria-label", "Language");
    s.style.cssText = "background:transparent;color:inherit;border:1px solid rgba(255,255,255,.28);border-radius:8px;padding:4px 6px;font:inherit;font-size:13px;max-width:130px;cursor:pointer";
    ALL.forEach(function (l) { var o = document.createElement("option"); o.value = l[0]; o.textContent = l[1]; o.style.color = "#000"; s.appendChild(o); });
    s.value = getLang();
    s.addEventListener("change", function () { setLang(s.value); document.querySelectorAll(".pl-lang").forEach(function (x) { x.value = s.value; }); plTrStart(s.value); });
    return s;
}
function place() {
    if (document.querySelector(".pl-lang")) return;
    var h = document.querySelector("header"), lg = document.getElementById("login");
    if (h) h.appendChild(mkSelect());
    if (lg) lg.insertBefore(mkSelect(), lg.firstChild);
    if (!h && !lg) { var s = mkSelect(); s.style.cssText += ";position:fixed;top:8px;right:8px;z-index:9999;background:#0b1220;color:#fff"; document.body.appendChild(s); }
}
function boot() { place(); plTrStart(getLang()); setTimeout(function () { place(); }, 1500); }
window.plLangStart = plTrStart;
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
