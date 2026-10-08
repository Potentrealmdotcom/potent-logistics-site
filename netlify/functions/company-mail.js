// netlify/functions/company-mail.js
// Sends ONE email on behalf of the signed-in company (quote, receipt, driver login, ETA).
// Not an open relay: it needs a valid login, sends to one recipient per call, limits volume per
// company, and always sends from POTENT OS's verified address with the company's name and Reply-To.
//
// POST { to, subject, message }      owner/dispatch   (Authorization: Bearer <login token>)
// POST { test: true }                owner            sends a sample to the company's reply email
//
// Env: RESEND_API_KEY, MAIL_FROM_ADDRESS (an address on a domain verified in Resend, e.g. notify@yourdomain.com),
//      AUTH_SECRET, SUPABASE_SERVICE_ROLE_KEY   (optional POTENT_ORG_SLUG)

var crypto = require("crypto");
var SB = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
var DAILY_MAX = 150;

function J(status, obj) { return { statusCode: status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) }; }
function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function verify(token) {
    if (!token || typeof token !== "string" || token.indexOf(".") < 0) return null;
    var parts = token.split(".");
    var expect = b64u(crypto.createHmac("sha256", process.env.AUTH_SECRET).update(parts[0]).digest());
    var a = Buffer.from(parts[1] || ""), b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        var p = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
        return p.exp && p.exp >= Date.now() ? p : null;
    } catch (e) { return null; }
}
function sbGet(path) {
    var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return fetch(SB + "/rest/v1/" + path, { headers: { apikey: key, Authorization: "Bearer " + key } })
        .then(function (r) { return r.text().then(function (t) { try { return r.ok ? JSON.parse(t) : null; } catch (e) { return null; } }); });
}
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function oneLine(s, n) { return String(s == null ? "" : s).replace(/[\r\n\t]+/g, " ").trim().slice(0, n); }
var sent = {};
function overLimit(org, max) {
    var day = new Date().toISOString().slice(0, 10), k = org + ":" + day;
    sent = Object.keys(sent).reduce(function (o, key) { if (key.slice(-10) === day) o[key] = sent[key]; return o; }, {});
    sent[k] = (sent[k] || 0) + 1;
    return sent[k] > (max || DAILY_MAX);
}

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") return J(405, { ok: false, error: "Method not allowed" });
    if (!process.env.AUTH_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) return J(500, { ok: false, error: "Server not configured" });
    try {
        var h = event.headers || {};
        var tok = verify(String(h.authorization || h.Authorization || "").replace(/^Bearer\s+/i, ""));
        var body; try { body = JSON.parse(event.body || "{}"); } catch (e) { body = {}; }
        var publicMode = false;
        if (!tok) {
            // A signed-out customer of a company (booking confirmation, review request). Allowed only to the address on THAT job, or to the company's own inbox.
            if (!body || !body.org_slug || !/^[a-z0-9\-]{1,60}$/.test(String(body.org_slug))) return J(401, { ok: false, error: "Sign in again." });
            publicMode = true;
        } else if (["owner", "dispatch", "dispatcher"].indexOf(tok.role) < 0) return J(403, { ok: false, error: "Not allowed" });
        if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM_ADDRESS) return J(503, { ok: false, error: "Email sending is not switched on yet. Contact POTENT." });

        var orgId = tok && tok.orgId ? String(tok.orgId) : null;
        if (publicMode) {
            var so = await sbGet("organizations?slug=eq." + encodeURIComponent(String(body.org_slug)) + "&select=id");
            orgId = so && so[0] ? String(so[0].id) : null;
        }
        if (!orgId) {
            var po = await sbGet("organizations?slug=eq." + encodeURIComponent(process.env.POTENT_ORG_SLUG || "potent-logistics") + "&select=id");
            orgId = po && po[0] ? String(po[0].id) : null;
        }
        if (!orgId) return J(500, { ok: false, error: "Company not found" });
        var orgRows = await sbGet("organizations?id=eq." + encodeURIComponent(orgId) + "&select=*");
        var org = orgRows && orgRows[0];
        if (!org) return J(404, { ok: false, error: "Company not found" });

        var color = "#F28C00";
        var bc = org.branding && /^#[0-9a-fA-F]{6}$/.test(org.branding.primaryColor || "") ? org.branding.primaryColor : null;
        if (bc) color = bc;
        var company = oneLine((org.branding && org.branding.companyName) || org.mail_from_name || org.name, 60);
        var fromName = oneLine(org.mail_from_name || company, 60).replace(/[<>",]/g, "");
        var replyTo = org.mail_reply_to || null;

        var to, subject, message;
        if (body.test === true) {
            if (tok.role !== "owner") return J(403, { ok: false, error: "Owner only" });
            if (!replyTo) return J(400, { ok: false, error: "Save your reply-to email first." });
            to = replyTo; subject = "Test email from " + company; message = "This is a test. Your customers will see emails like this, from \"" + fromName + "\", and their replies will come to " + replyTo + ".";
        } else {
            to = String(body.to || "").trim().toLowerCase();
            subject = oneLine(body.subject, 150); message = String(body.message || "").slice(0, 5000);
            if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(to)) return J(400, { ok: false, error: "Enter one valid email address." });
            if (!subject || !message.trim()) return J(400, { ok: false, error: "Subject and message are required." });
            if (!replyTo) return J(400, { ok: false, error: "Set your reply-to email in Get Started first, so replies reach you." });
        }
        if (publicMode) {
            if (body.test === true) return J(403, { ok: false, error: "Not allowed" });
            var ownInbox = replyTo && to === String(replyTo).toLowerCase();
            if (!ownInbox) {
                var jid = String(body.job_id || "");
                if (!/^[A-Za-z0-9\-_.]{1,60}$/.test(jid)) return J(403, { ok: false, error: "Not allowed" });
                var jr = await sbGet("jobs?id=eq." + encodeURIComponent(jid) + "&org_id=eq." + encodeURIComponent(orgId) + "&select=email&limit=1");
                if (!jr || !jr[0] || String(jr[0].email || "").toLowerCase() !== to) return J(403, { ok: false, error: "Not allowed" });
                if (overLimit("job:" + jid + ":" + orgId, 3)) return J(429, { ok: false, error: "Too many emails for this job." });
            }
            message = message.slice(0, 2500);
        }
        if (overLimit(orgId)) return J(429, { ok: false, error: "Daily email limit reached (" + DAILY_MAX + "). Try again tomorrow." });

        var html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111">' +
            '<div style="border-top:5px solid ' + color + ';padding:18px 4px 6px;font-size:18px;font-weight:700">' + esc(company) + '</div>' +
            '<div style="padding:8px 4px 18px;font-size:15px;line-height:1.55;white-space:pre-wrap">' + esc(message) + '</div>' +
            '<div style="border-top:1px solid #ddd;padding:10px 4px;font-size:11px;color:#777">Sent by ' + esc(company) + ' using POTENT OS. Reply to this email to reach them.</div></div>';
        var r = await fetch("https://api.resend.com/emails", {
            method: "POST", headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ from: fromName + " <" + process.env.MAIL_FROM_ADDRESS + ">", to: [to], reply_to: replyTo || undefined, subject: subject, html: html, text: message })
        });
        if (!r.ok) return J(502, { ok: false, error: "The email service did not accept it." });
        return J(200, { ok: true });
    } catch (e) {
        return J(500, { ok: false, error: "Server error" });
    }
};
