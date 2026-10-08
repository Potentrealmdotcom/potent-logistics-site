// netlify/functions/send-email.js  (REPLACES the old file)
// Sends email through Mailjet. Keys now live in Netlify environment variables, not in the code.
//
// Who can send what:
//   - Anyone (no login): only to POTENT's own inbox, or to an address that already booked a job
//     (so booking confirmations and "how did we do" emails still work). Never to arbitrary people.
//   - Signed-in staff (valid login token): to any address.
// Limits: per visitor and per recipient per hour, short subject and body.
//
// Env: MAILJET_API_KEY, MAILJET_SECRET_KEY, AUTH_SECRET, SUPABASE_SERVICE_ROLE_KEY
//      (optional FROM_EMAIL, FROM_NAME; defaults below)

var crypto = require("crypto");
var SB = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
var FROM_EMAIL = process.env.FROM_EMAIL || "potentlogistics@pm.me";
var FROM_NAME = process.env.FROM_NAME || "POTENT Logistics";
var HEAD = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Content-Type": "application/json" };

function out(status, obj) { return { statusCode: status, headers: HEAD, body: JSON.stringify(obj) }; }
function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function verify(token) {
    if (!process.env.AUTH_SECRET || !token || token.indexOf(".") < 0) return null;
    var parts = token.split(".");
    var expect = b64u(crypto.createHmac("sha256", process.env.AUTH_SECRET).update(parts[0]).digest());
    var a = Buffer.from(parts[1] || ""), b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        var p = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
        return p.exp && p.exp >= Date.now() ? p : null;
    } catch (e) { return null; }
}
var hits = {};
function limited(key, max) {
    var now = Date.now(), a = (hits[key] || []).filter(function (t) { return now - t < 3600000; });
    if (a.length >= max) { hits[key] = a; return true; } a.push(now); hits[key] = a; return false;
}
async function hasBooked(email) {
    var key = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!key) return false;
    var r = await fetch(SB + "/rest/v1/jobs?email=ilike." + encodeURIComponent(email) + "&select=id&limit=1", { headers: { apikey: key, Authorization: "Bearer " + key } });
    if (!r.ok) return false;
    var d = await r.json().catch(function () { return null; });
    return Array.isArray(d) && d.length > 0;
}

exports.handler = async function (event) {
    if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: HEAD, body: "" };
    if (event.httpMethod !== "POST") return out(405, { error: "POST only" });
    if (!process.env.MAILJET_API_KEY || !process.env.MAILJET_SECRET_KEY) return out(200, { sent: false, error: "Email is not configured (add MAILJET_API_KEY and MAILJET_SECRET_KEY in Netlify)." });
    try {
        var body = JSON.parse(event.body || "{}");
        var to = String(body.to || "").trim().toLowerCase();
        var subject = String(body.subject || "").replace(/[\r\n]+/g, " ").trim().slice(0, 150);
        var message = String(body.message || "").slice(0, 6000);
        if (!to || !subject || !message) return out(400, { error: "Missing to, subject, or message" });
        if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(to)) return out(400, { error: "One valid email address only" });

        var h = event.headers || {};
        var ip = String(h["x-nf-client-connection-ip"] || h["x-forwarded-for"] || "x").split(",")[0].trim();
        var tok = verify(String(h.authorization || h.Authorization || "").replace(/^Bearer\s+/i, ""));
        var staff = !!tok && ["owner", "dispatch", "dispatcher", "driver"].indexOf(tok.role) > -1;
        if (limited("ip:" + ip, staff ? 200 : 20) || limited("to:" + to, staff ? 60 : 5)) return out(429, { sent: false, error: "Too many emails. Try again later." });

        if (!staff && to !== FROM_EMAIL.toLowerCase() && !(await hasBooked(to))) return out(403, { sent: false, error: "Not allowed" });

        var auth = Buffer.from(process.env.MAILJET_API_KEY + ":" + process.env.MAILJET_SECRET_KEY).toString("base64");
        var res = await fetch("https://api.mailjet.com/v3.1/send", {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: "Basic " + auth },
            body: JSON.stringify({ Messages: [{ From: { Email: FROM_EMAIL, Name: FROM_NAME }, To: [{ Email: to }], Subject: subject, TextPart: message }] })
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) return out(200, { sent: false, error: "The email service did not accept it." });
        return out(200, { sent: true });
    } catch (err) {
        return out(200, { sent: false, error: "Could not send." });
    }
};
