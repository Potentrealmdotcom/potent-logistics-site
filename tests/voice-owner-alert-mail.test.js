"use strict";
// Run: node tests/voice-owner-alert-mail.test.js
// EVERY owner email carries the full Elevate design (Tony, Nov 1–2, 2026 — the Nov 1 push designed only
// the end-of-call report; the safety-net "Unfinished call saved" alert still arrived as bare text on
// Nov 2, session 86ac437e). The fix lives at the choke point: notifyOwner renders lib/voice/alert-mail.js
// whenever a caller did not supply html. This suite proves the design, the facts, the passthrough for
// the report's own html, Tony's exact Nov 2 alert rebuilt as a fixture, and — by source audit — that no
// owner-bound voice email can leave text-only anymore.
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); console.log("ok -", m); n++; };
process.env.AUTH_SECRET = "testsecret"; process.env.TWILIO_ACCOUNT_SID = "ACtest"; process.env.TWILIO_AUTH_TOKEN = "twtoken"; process.env.TWILIO_SMS_FROM = "+14045550999";
process.env.VOICE_WEBHOOK_URL = "https://hooks.test/voice"; process.env.VOICE_BRIDGE_URL = "wss://voice.test/twilio"; process.env.VOICE_BRIDGE_SECRET = "bridgesecret"; process.env.RESEND_API_KEY = "rk";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const read = function (p) { return fs.readFileSync(path.join(ROOT, p), "utf8"); };
const M = require("./_voicemock.js")({
  organizations: [{ id: "org1", name: "Acme Trucking LLC", slug: "acme", plan: "fleet", owner_email: "owner@acme.test", license_status: "paid", timezone: "America/New_York" }]
});
const { EXT } = M;
(async () => {
  const T = require("../netlify/functions/lib/voice/tools.js");
  const AM = require("../netlify/functions/lib/voice/alert-mail.js");
  const DESIGN = [/ƏLEVATE/, /coin-banner-email\.gif/, /mouth\.png/, /globe\.png/, /VIEW IN YOUR ELEVATE DASHBOARD/, /#FFFF00/, /POTENT/];
  const hasDesign = function (html) { return DESIGN.every(function (re) { return re.test(html || ""); }); };

  // (a) notifyOwner WITHOUT html: the mail that leaves carries the full design, addressed to the owner
  EXT.mail.length = 0;
  await T.notifyOwner("org1", "Job we could not take", "A job came in that Elevate could not take.\nCaller: Sam (+15551234567).\nReason: over the weight limit.");
  let m = EXT.mail[EXT.mail.length - 1];
  ok(m && (m.to || []).includes("owner@acme.test") && m.subject === "Job we could not take", "the alert still goes to the org's owner with its subject");
  ok(hasDesign(m.html), "notifyOwner without html: the html part carries the full Elevate design (header, coin banner, mouth, globe, dashboard button, palette, POTENT footer)");
  ok(/Acme Trucking LLC/.test(m.html), "the footer carries the org name from the org record (tenant-generic, not hard-coded)");
  ok(m.text && /could not take/.test(m.text), "the plain-text part is unchanged for clients that show text");

  // (b) the alert's own facts ride inside the design, HTML-escaped
  ok(/Sam \(\+15551234567\)/.test(m.html) && /over the weight limit/.test(m.html), "the alert's facts appear inside the design card");
  EXT.mail.length = 0;
  await T.notifyOwner("org1", "Alert <b>now</b>", "Caller said <script>alert(1)</script> & \"quotes\" <here>");
  m = EXT.mail[EXT.mail.length - 1];
  ok(!/<script>alert/.test(m.html) && /&lt;script&gt;alert\(1\)&lt;\/script&gt;/.test(m.html) && /&amp; &quot;quotes&quot; &lt;here&gt;/.test(m.html), "alert text is HTML-escaped inside the design — caller words cannot inject markup");
  ok(/Alert &lt;b&gt;now&lt;\/b&gt;/.test(m.html), "the subject is escaped in the headline");

  // (c) explicit html (the end-of-call report) passes through byte-for-byte unchanged
  EXT.mail.length = 0;
  await T.notifyOwner("org1", "Call report", "plain fallback", "<html>THE REPORT'S OWN DESIGN</html>");
  m = EXT.mail[EXT.mail.length - 1];
  ok(m.html === "<html>THE REPORT'S OWN DESIGN</html>", "notifyOwner with explicit html passes it through unchanged (owner-report behavior untouched)");

  // (d) Tony's Nov 2 unfinished call, rebuilt exactly as the safety net sent it — now in the full design
  const fixture = "A call ended before Elevate finished collecting the details, so nothing was booked. What she had: Caller: Tony (+14704531616). Pickup: 1200 Peachtree Street, Atlanta, GA. Drop-off: 500 Roswell Street, Marietta, GA. 5 pieces. Total weight: 500 lb. Freight: cloting. Still missing: service date. Session 86ac437e-e38a-4ddc-8da2-f6adce33268e. Saved on the dashboard under Calls so you can follow up — she never throws a partial call away.";
  EXT.mail.length = 0;
  await T.notifyOwner("org1", "Unfinished call saved", fixture);
  m = EXT.mail[EXT.mail.length - 1];
  ok(hasDesign(m.html), "the Nov 2 'Unfinished call saved' alert now renders in the full Elevate design");
  ["Tony (+14704531616)", "1200 Peachtree Street, Atlanta, GA", "500 Roswell Street, Marietta, GA", "5 pieces", "500 lb", "cloting", "Still missing: service date"].forEach(function (fact) { ok(m.html.indexOf(fact) >= 0, "the design carries the fact: " + fact); });
  ok(/Session 86ac437e/.test(m.html), "the footer carries the session prefix lifted from the alert text, like the call report's footer");

  // the renderer itself: tenant-generic, standalone (no tools.js require — that would be a cycle)
  const amSrc = read("netlify/functions/lib/voice/alert-mail.js");
  ok(!/require\(/.test(amSrc), "alert-mail.js requires nothing (no require cycle with owner-report.js possible)");
  ok(!/Potent Logistics|Conyers|Georgia|912|470/.test(AM.render("Headline", "Body text", { orgName: "Acme" })), "the rendered design contains no Potent-specific names, places or numbers");

  // (e) SOURCE AUDIT: zero paths by which an owner voice email can leave text-only.
  const toolsSrc = read("netlify/functions/lib/voice/tools.js");
  ok(/html \|\| ALERT_MAIL\.render\(subject, text, \{ orgName: o\.name \}\)/.test(toolsSrc), "notifyOwner auto-renders the alert design whenever html is not supplied — there is no text-only branch");
  ok(/select=owner_email,name/.test(toolsSrc), "notifyOwner fetches the org name alongside owner_email for the design footer");
  const reportSrc = read("netlify/functions/lib/voice/owner-report.js");
  ok(/notifyOwner\(orgId, rep\.subject, rep\.text, rep\.html\)/.test(reportSrc), "the end-of-call report is the one caller that supplies its own design html (passthrough, unchanged)");
  // every notifyOwner call site in the voice surface, enumerated: none passes an html of its own except
  // owner-report, so every one of them is covered by the choke point.
  const surface = ["netlify/functions/lib/voice/tools.js", "netlify/functions/lib/voice/owner-report.js", "netlify/functions/voice-tools.js", "netlify/functions/voice-webhook.js"];
  let sites = [];
  surface.forEach(function (f) { (read(f).match(/notifyOwner\([^)]*\)/g) || []).forEach(function (s) { sites.push(f.split("/").pop() + ": " + s.slice(0, 60)); }); });
  ok(sites.length >= 10, "audit enumerated the notifyOwner call sites (" + sites.length + "): " + sites.join(" | "));
  // the only direct mail.send calls in the voice library are the three customer-facing ones (demo link to
  // the prospect, payment link to the customer, booking confirmation to the customer) — none is owner-bound.
  const directSends = toolsSrc.match(/require\("\.\.\/mail"\)\.send\([a-z]+,/g) || [];
  ok(directSends.length === 3 && directSends.every(function (s) { return /\.send\((email|to),/.test(s); }), "the only direct mail.send calls in tools.js address the customer/prospect (email/to), never the owner");
  ["netlify/functions/voice-tools.js", "netlify/functions/voice-webhook.js"].forEach(function (f) { ok(!/require\("\.\.\/mail"\)|require\("\.\/lib\/mail"\)|mail\.send/.test(read(f)), f.split("/").pop() + " sends no mail directly — its owner alerts flow through notifyOwner"); });
  console.log("voice-owner-alert-mail:", n, "assertions passed");
})().catch(e => { console.error(e); process.exit(1); });
