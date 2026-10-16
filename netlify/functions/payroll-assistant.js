// netlify/functions/payroll-assistant.js  (OWNER ONLY) — POTENT's built-in payroll assistant.
// It READS wallets and payout requests and prepares a pay sheet. It never moves money; you send the money
// yourself (Zelle/PayPal/etc.) and tap Mark Paid in Team Wallets.
// POST { action:"ask", question } | { action:"sheet" }   Env: AUTH_SECRET, SUPABASE_SERVICE_ROLE_KEY, optional GEMINI_API_KEY
var crypto = require("crypto");
var SB = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
function J(s, o) { return { statusCode: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(o) }; }
function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function verify(token) {
    if (!token || token.indexOf(".") < 0) return null;
    var p = token.split(".");
    var exp = b64u(crypto.createHmac("sha256", process.env.AUTH_SECRET).update(p[0]).digest());
    var a = Buffer.from(p[1] || ""), b = Buffer.from(exp);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try { var d = JSON.parse(Buffer.from(p[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); return d.exp && d.exp >= Date.now() ? d : null; } catch (e) { return null; }
}
function sb(path) {
    var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return fetch(SB + "/rest/v1/" + path, { headers: { apikey: key, Authorization: "Bearer " + key } })
        .then(function (r) { return r.json().catch(function () { return null; }).then(function (d) { return r.ok && Array.isArray(d) ? d : []; }); });
}
function $(n) { return "$" + (Math.round(Number(n || 0) * 100) / 100).toFixed(2); }

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") return J(405, { ok: false, error: "POST only" });
    if (!process.env.AUTH_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) return J(500, { ok: false, error: "Server not configured" });
    var h = event.headers || {};
    var tok = verify(String(h.authorization || h.Authorization || "").replace(/^Bearer\s+/i, ""));
    if (!tok || tok.role !== "owner" || tok.orgId) return J(403, { ok: false, error: "Owner only" });
    var b; try { b = JSON.parse(event.body || "{}"); } catch (e) { b = {}; }
    try {
        var wallets = await sb("team_wallets?select=*&order=available_balance.desc&limit=500");
        var pend = await sb("payout_requests?status=eq.pending&select=*,team_wallets(member_name,member_email)&order=created_at.asc&limit=200");
        var owed = wallets.filter(function (w) { return Number(w.available_balance) > 0; });
        var totalOwed = owed.reduce(function (t, w) { return t + Number(w.available_balance); }, 0);
        var pendTotal = pend.reduce(function (t, p) { return t + Number(p.net_amount || 0); }, 0);
        var lines = owed.map(function (w) { return { name: w.member_name || w.member_email, email: w.member_email, owed: Number(w.available_balance), method: w.payout_method || null, handle: w.payout_handle || null }; });
        var sheet = {
            totalOwed: totalOwed, pendingTotal: pendTotal,
            pending: pend.map(function (p) { var w = p.team_wallets || {}; return { name: w.member_name || w.member_email, net: Number(p.net_amount), method: p.method, handle: p.payout_handle, since: String(p.created_at).slice(0, 10) }; }),
            owed: lines, missingPayInfo: lines.filter(function (l) { return !l.handle; }).map(function (l) { return l.name; })
        };
        if (b.action === "sheet") return J(200, { ok: true, sheet: sheet });

        var q = String(b.question || "").trim().slice(0, 400); if (!q) return J(400, { ok: false, error: "Ask a question." });
        var ql = q.toLowerCase(), ans = null;
        if (/who.*owed|owed money|who do i owe|who.*(need|needs).*(paid|pay)/.test(ql)) {
            ans = lines.length ? "You owe " + $(totalOwed) + " across " + lines.length + " people:\n" + lines.map(function (l) { return "• " + l.name + ": " + $(l.owed) + (l.handle ? " → " + l.handle + " (" + (l.method || "") + ")" : " (no payout info saved yet)"); }).join("\n") : "Nobody is owed anything right now.";
        } else if (/pending|waiting|requests?|cash.?out/.test(ql)) {
            ans = pend.length ? pend.length + " cashout request(s) waiting, " + $(pendTotal) + " total:\n" + sheet.pending.map(function (p) { return "• " + p.name + ": send " + $(p.net) + " to " + (p.handle || "(no handle)") + " via " + p.method + " (asked " + p.since + ")"; }).join("\n") + "\nSend the money yourself, then tap Mark Paid on each one." : "No cashout requests waiting.";
        } else if (/total|how much/.test(ql) && /owe|payroll|wallet/.test(ql)) {
            ans = "Wallets hold " + $(totalOwed) + " in total. " + $(pendTotal) + " of that has been requested for cashout.";
        } else if (/prepare|ready|pay.?run|payout|sheet/.test(ql)) {
            ans = pend.length ? "Your pay run is " + $(pendTotal) + " for " + pend.length + " people. Ready to send:\n" + sheet.pending.map(function (p) { return "• " + p.name + " " + $(p.net) + " → " + (p.handle || "(no handle)"); }).join("\n") + (sheet.missingPayInfo.length ? "\nStill no payout info: " + sheet.missingPayInfo.join(", ") : "") : "No one has requested a cashout. People owed money: " + lines.length + " (" + $(totalOwed) + "). They cash out from their own wallet.";
        }
        if (ans) return J(200, { ok: true, answer: ans, source: "books" });
        var key = process.env.GEMINI_API_KEY;
        if (!key) return J(200, { ok: true, answer: "Try: \"Who's owed money?\", \"Any pending cashouts?\" or \"Prepare the pay run.\" (Free-form questions need GEMINI_API_KEY in Netlify.)", source: "books" });
        var r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + (process.env.AI_MODEL || "gemini-flash-latest") + ":generateContent", {
            method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({ systemInstruction: { parts: [{ text: "You are the payroll assistant inside POTENT OS for a small trucking and hauling company. Answer only from the DATA given, briefly, in plain words. You cannot send money; you prepare. If the data does not contain the answer, say so." }] },
                contents: [{ role: "user", parts: [{ text: "DATA: " + JSON.stringify(sheet).slice(0, 12000) + "\n\nQUESTION: " + q }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 500 } })
        });
        if (!r.ok) return J(200, { ok: true, answer: "The AI is busy. Try one of: Who's owed money? / Any pending cashouts?", source: "books" });
        var d = await r.json();
        var txt = (((d.candidates || [])[0] || {}).content || {}).parts; txt = (txt || []).map(function (p) { return p.text || ""; }).join("").trim();
        return J(200, { ok: true, answer: txt || "I could not find that.", source: "ai" });
    } catch (e) { console.error("payroll-assistant", e && e.message); return J(500, { ok: false, error: "Server error" }); }
};
