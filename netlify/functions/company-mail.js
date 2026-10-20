// netlify/functions/company-mail.js
// Sends email on behalf of a licensed POTENT OS company (tenant): the mail
// goes out under the company's own name with its own reply-to. POTENT's own
// staff can also send through here as POTENT Logistics.
//
// POST JSON { to, subject, message, org_slug?, job_id? }
// - Signed-in company user (Bearer token with orgId): sends as their company.
// - POTENT staff (Bearer token, no orgId): sends as POTENT Logistics.
// - No token: org_slug + job_id are required, and the server verifies the
//   recipient address belongs to that job before anything is sent.

var crypto = require("crypto");

var SB = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
var FROM_EMAIL = process.env.MAIL_FROM_EMAIL || "info@potentworld.online"; // verified sender domain in Resend (Netlify env var)
var FROM_NAME = "POTENT Logistics";

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
function sb(path, opts) {
    opts = opts || {};
    var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return fetch(SB + "/rest/v1/" + path, {
        method: opts.method || "GET",
        headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: opts.prefer || "return=representation" },
        body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) { return r.text().then(function (t) { var d; try { d = JSON.parse(t); } catch (e) { d = t; } return { ok: r.ok, status: r.status, data: d }; }); });
}
function cleanStr(v, n) { return String(v == null ? "" : v).replace(/[<>]/g, "").trim().slice(0, n || 120); }
function validEmail(e) { return typeof e === "string" && /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(e.trim()); }

// send brake (per warm instance)
var hits = {};
function tooMany(key) {
    var now = Date.now();
    var a = (hits[key] || []).filter(function (t) { return now - t < 15 * 60 * 1000; });
    hits[key] = a;
    return a.length >= 30;
}
function noteHit(key) { (hits[key] = hits[key] || []).push(Date.now()); }

async function sendViaResend(to, subject, message, fromName, replyTo) {
    var key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("Mail is not configured.");
    // Sends from POTENT's verified domain under the company's display name;
    // replies go to the company's own address (replyTo).
    var msg = { from: (fromName || FROM_NAME) + " <" + FROM_EMAIL + ">", to: [to], subject: subject, text: message };
    if (replyTo) msg.reply_to = replyTo;
    var res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        body: JSON.stringify(msg)
    });
    var data = await res.json().catch(function () { return null; });
    if (!res.ok) { var e = new Error("The email service refused it."); e.data = data; throw e; }
    return data;
}

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") return J(405, { ok: false, error: "POST only" });
    if (!process.env.AUTH_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.RESEND_API_KEY) return J(500, { ok: false, error: "Server not configured" });
    var body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { return J(400, { ok: false, error: "Bad JSON" }); }

    var to = String(body.to || "").trim().toLowerCase();
    var subject = cleanStr(body.subject, 200);
    var message = String(body.message || "");
    if (!validEmail(to)) return J(400, { ok: false, error: "A valid recipient email is required." });
    if (!subject || !message) return J(400, { ok: false, error: "Subject and message are required." });
    if (message.length > 50000) return J(400, { ok: false, error: "Message is too long." });

    var ip = String((event.headers && (event.headers["x-nf-client-connection-ip"] || event.headers["x-forwarded-for"])) || "x").split(",")[0].trim();
    if (tooMany("cm:" + ip)) return J(429, { ok: false, error: "Too many emails. Try again later." });

    var h = event.headers || {};
    var tok = verify(String(h.authorization || h.Authorization || "").replace(/^Bearer\s+/i, ""));

    var fromName = FROM_NAME, replyTo = null;

    if (tok) {
        // Signed in: company users send as their company, POTENT staff as POTENT.
        if (tok.orgId) {
            var o = await sb("organizations?id=eq." + encodeURIComponent(tok.orgId) + "&select=id,name,mail_from_name,mail_reply_to,owner_email");
            var org = o.ok && Array.isArray(o.data) ? o.data[0] : null;
            if (!org) return J(404, { ok: false, error: "Company not found." });
            fromName = org.mail_from_name || org.name || FROM_NAME;
            replyTo = validEmail(org.mail_reply_to) ? org.mail_reply_to.trim().toLowerCase() : (validEmail(org.owner_email) ? org.owner_email.trim().toLowerCase() : null);
        }
    } else {
        // Not signed in: this must be a customer-facing send for a real job.
        var slug = String(body.org_slug || "").trim().toLowerCase();
        var jobId = String(body.job_id || "").trim();
        if (!slug || !jobId) return J(401, { ok: false, error: "Sign in again" });
        if (!/^[a-z0-9\-]{2,60}$/.test(slug)) return J(400, { ok: false, error: "Unknown company." });
        var so = await sb("organizations?slug=eq." + encodeURIComponent(slug) + "&select=id,name,mail_from_name,mail_reply_to,owner_email");
        var sorg = so.ok && Array.isArray(so.data) ? so.data[0] : null;
        if (!sorg) return J(404, { ok: false, error: "Unknown company." });
        var jr = await sb("jobs?id=eq." + encodeURIComponent(jobId) + "&select=id,email,org_id&limit=1");
        var job = jr.ok && Array.isArray(jr.data) ? jr.data[0] : null;
        if (!job) return J(404, { ok: false, error: "Job not found." });
        var jobEmail = String(job.email || "").trim().toLowerCase();
        if (!jobEmail || jobEmail !== to) return J(403, { ok: false, error: "Not allowed" });
        if (job.org_id && String(job.org_id) !== String(sorg.id)) return J(403, { ok: false, error: "Not allowed" });
        fromName = sorg.mail_from_name || sorg.name || FROM_NAME;
        replyTo = validEmail(sorg.mail_reply_to) ? sorg.mail_reply_to.trim().toLowerCase() : (validEmail(sorg.owner_email) ? sorg.owner_email.trim().toLowerCase() : null);
    }

    noteHit("cm:" + ip);
    try {
        await sendViaResend(to, subject, message, fromName, replyTo);
        return J(200, { ok: true });
    } catch (e) {
        return J(502, { ok: false, error: "Could not send the email. Try again." });
    }
};
