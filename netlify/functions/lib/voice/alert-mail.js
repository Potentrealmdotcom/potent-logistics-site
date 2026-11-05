// THE DESIGN FOR EVERY OWNER ALERT (Tony, Nov 1–2, 2026: "Every email I got should look like this.
// Not this." — said three times). The end-of-call call report (owner-report.js) already carried the
// approved ƏLEVATE HTML design, but every mid-call / safety-net ALERT (unfinished call saved, payment
// needed, job we could not take, demo requested, call ended, keypad flags) still went out as bare
// text, because those senders call notifyOwner without an html part and mail.send then falls back to
// a one-line <p>. This module is the choke-point fix: notifyOwner renders THIS design from the
// alert's own subject + text whenever the caller did not supply html, so no owner voice email can
// leave as plain text again — including senders written in the future.
// It is deliberately standalone: owner-report.js requires tools.js, so the renderer must not live
// there and must not require tools.js (that would be a require cycle). The SITE/IMG/esc helpers are
// copied from owner-report.js on purpose; if the design assets move, move them in both places.
// Palette: the approved design's own — black, white, electric yellow #FFFF00, neutral greys for text.
const SITE = function () { return process.env.URL || "https://potentoperations.netlify.app"; };
const IMG = function (f) { return SITE() + "/voice/img/elevate-mail/" + f; };
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

// render(subject, text, opts) -> full-design HTML for a generic owner alert.
// opts: { orgName, sessionId } — the session id is also picked out of the text when a sender
// included "Session <uuid>." (the safety-net alerts do), so the footer matches the call record.
function render(subject, text, opts) {
  opts = opts || {};
  const body = String(text == null ? "" : text);
  let sid = opts.sessionId ? String(opts.sessionId) : "";
  if (!sid) { const m = body.match(/\bSession ([0-9a-fA-F-]{8,})\b/); if (m) sid = m[1]; }
  const foot = (sid ? "Session " + esc(sid.slice(0, 8)) : "Elevate alert") + (opts.orgName ? " &middot; " + esc(opts.orgName) : "");
  const lines = body.split(/\r?\n/).map(function (l) { return esc(l); }).join("<br>");
  return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head>"
    + '<body style="margin:0;padding:0;background:#e8e8e8;font-family:Arial,Helvetica,sans-serif;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8e8e8;"><tr><td align="center">'
    + '<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;background:#ffffff;">'
    + '<tr><td align="center" style="background:#000000;padding:30px 40px 24px;"><div style="color:#ffffff;font-size:40px;font-weight:bold;letter-spacing:8px;">ƏLEVATE</div><div style="color:#FFFF00;font-size:12.5px;letter-spacing:3.5px;margin-top:8px;text-transform:uppercase;">She answers. She books. She follows up.</div></td></tr>'
    + '<tr><td style="background:#FFFF00;height:5px;font-size:0;line-height:0;">&nbsp;</td></tr>'
    + '<tr><td><img src="' + IMG("coin-banner-email.gif") + '" width="640" height="250" alt="Potent Coin" style="display:block;width:640px;height:250px;"></td></tr>'
    + '<tr><td style="padding:30px 42px 8px;">'
    + '<div style="font-size:25px;font-weight:bold;color:#000000;line-height:1.3;">' + esc(subject || "Elevate alert") + '</div>'
    + '<p style="font-size:15.5px;color:#333333;margin:9px 0 0;line-height:1.5;">Elevate flagged this for you during a call. The details are below, and the full call record is saved in your Elevate dashboard.</p>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #000000;margin-top:24px;">'
    + '<tr><td style="background:#000000;color:#FFFF00;font-size:13px;font-weight:bold;letter-spacing:2.5px;padding:10px 16px;text-transform:uppercase;">Alert details</td></tr>'
    + '<tr><td style="padding:12px 16px;font-size:15px;line-height:1.55;color:#161616;">' + lines + '</td></tr>'
    + "</table>"
    + '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:30px;"><tr><td><img src="' + IMG("mouth.png") + '" width="52" height="38" alt="" style="display:block;width:52px;height:38px;"></td><td style="font-size:16px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;color:#000000;padding-left:8px;">Saved on your dashboard</td></tr></table>'
    + '<p style="font-size:15px;line-height:1.55;color:#161616;margin:10px 0 0;">This alert, the call it came from, and anything saved for follow-up are all in your Elevate dashboard.</p>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:30px 0 6px;"><a href="' + SITE() + '/voice/" style="display:inline-block;background:#FFFF00;color:#000000;font-size:16.5px;font-weight:bold;letter-spacing:1px;text-decoration:none;padding:15px 38px;border:2px solid #000000;">VIEW IN YOUR ELEVATE DASHBOARD</a><div style="font-size:12.5px;color:#777777;margin-top:11px;">Admins and team members with dashboard access can open this call.</div></td></tr></table>'
    + "</td></tr>"
    + '<tr><td align="center" style="background:#000000;padding:24px 40px 28px;"><img src="' + IMG("globe.png") + '" width="64" height="61" alt="" style="display:block;width:64px;height:61px;margin:0 auto;"><div style="color:#ffffff;font-size:13px;letter-spacing:3px;margin-top:9px;">POTENT</div><div style="color:#999999;font-size:11.5px;margin-top:7px;line-height:1.6;">Elevate by POTENT &middot; This is an owner alert &mdash; no marketing, just the call.<br>' + foot + "</div></td></tr>"
    + "</table></td></tr></table></body></html>";
}
module.exports = { render };
