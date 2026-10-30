// THE OWNER'S COPY OF EVERY CALL (Tony, Oct 24, 2026): "Email me on EVERY call" + "I need full transcript".
// Until now the owner only heard about a call when a specific outcome fired its own notice (booking,
// demo, payment trouble, abuse, the safety net). A plain question call left no trace in his inbox.
// reportCall() runs once per finished session — from the bridge end (voice-tools finish) and from the
// Twilio status callback (voice-webhook), whichever lands first; store.firstTime is the gate, so the
// second path is always a no-op. It sends ONE email: a plain-English summary plus the FULL transcript
// (the stored, already-redacted lines, in seq order), and one push to the owner's own devices.
// It never throws: a reporting failure must not break the call path that calls it.
const B = require("../beats");
const S = require("./store");
const T = require("./tools");
const PUSH = require("../push");
const rows = S.rows;

const LABELS = { booked: "Booked", booking_requested: "Booking requested", callback: "Callback saved", handoff_requested: "Handoff requested", handoff: "Transferred to a person", declined: "Could not take it", ended_abuse: "Ended (abusive caller)", ended_do_not_contact: "Ended (do-not-contact)", info_only: "Information only" };
function label(outcome) { const o = String(outcome || "info_only"); return LABELS[o] || (o.replace(/_/g, " ").replace(/^./, function (c) { return c.toUpperCase(); })); }
function money(cents) { return cents == null || isNaN(Number(cents)) ? null : "$" + (Number(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function dur(sec) { const s = Math.max(0, Math.floor(Number(sec) || 0)); if (!s) return null; const m = Math.floor(s / 60), r = s % 60; return m ? (m + " min" + (r ? " " + r + " sec" : "")) : (r + " sec"); }
function city(addr) { const p = String(addr || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean); return p.length > 1 ? p[1] : (p[0] || ""); }

// ── HTML part (approved design, Tony Oct 29, 2026): the same call data as the text part, laid out
// as the ƏLEVATE call-record email. Table-based with inline styles so mail clients keep the look.
// Images are hosted on the site itself; owner alerts carry no marketing, and neither does this.
const SITE = function () { return process.env.URL || "https://potentoperations.netlify.app"; };
const IMG = function (f) { return SITE() + "/voice/img/elevate-mail/" + f; };
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function phoneFmt(n) { const d = String(n || "").replace(/\D/g, ""); const ten = d.length === 11 && d[0] === "1" ? d.slice(1) : d; return ten.length === 10 ? "(" + ten.slice(0, 3) + ") " + ten.slice(3, 6) + "-" + ten.slice(6) : (n ? String(n) : null); }
function whenFmt(iso) { const d = new Date(iso || ""); if (isNaN(d)) return null; const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(d).reduce(function (o, x) { o[x.type] = x.value; return o; }, {}); return p.weekday + ", " + p.month + " " + p.day + ", " + p.year + " · " + p.hour + ":" + p.minute + " " + p.dayPeriod; }
function nextStep(ses, callbacks, handoffs) {
  if (handoffs.some(function (h) { return h.status === "completed"; })) return "Transferred to a person on your team during the call.";
  if (callbacks.length) return (ses.outcome === "handoff_requested" ? "Handoff" : "Callback") + " saved — someone will call back on the number they confirmed.";
  switch (ses.outcome) {
    case "booked": return "Booking confirmed — the job is saved in your Elevate dashboard.";
    case "booking_requested": return "Booking request saved — a person needs to confirm it in the dashboard.";
    case "handoff": case "handoff_requested": return "Handoff saved — someone will call back on the number they confirmed.";
    case "callback": return "Callback saved — someone will call back on the number they confirmed.";
    case "declined": return "No booking was made on this call.";
    case "ended_abuse": case "ended_do_not_contact": return "The call was ended — the full record is saved in your dashboard.";
    default: return "No follow-up was saved on this call.";
  }
}
function buildHtml(r) {
  const srow = function (k, inner, last) { return '<tr><td style="padding:8px 16px;' + (last ? "" : "border-bottom:1px solid #e2e2e2;") + 'font-size:15px;color:#111111;"><span style="display:inline-block;width:118px;color:#666666;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;vertical-align:top;padding-top:2px;">' + k + "</span> " + inner + "</td></tr>"; };
  const tHtml = r.rows.length ? r.rows.map(function (t) {
    const who = t.role === "caller" ? '<span style="display:inline-block;background:#000000;color:#ffffff;font-size:10.5px;font-weight:bold;letter-spacing:1.5px;padding:3px 8px;margin-bottom:5px;">Caller</span>'
      : t.role === "agent" ? '<span style="display:inline-block;background:#FFFF00;color:#000000;font-size:10.5px;font-weight:bold;letter-spacing:1.5px;padding:3px 8px;margin-bottom:5px;">Elevate</span>'
      : '<span style="display:inline-block;background:#eeeeee;color:#666666;font-size:10.5px;font-weight:bold;letter-spacing:1.5px;padding:3px 8px;margin-bottom:5px;">System</span>';
    return '<tr><td style="padding:11px 0;border-bottom:1px solid #eeeeee;font-size:15px;line-height:1.55;color:#161616;">' + who + "<br>" + esc(t.text) + "</td></tr>";
  }).join("") : '<tr><td style="padding:11px 0;font-size:15px;color:#161616;">(No transcript was recorded for this call.)</td></tr>';
  const foot = "Session " + esc(String(r.sessionId || "").slice(0, 8)) + (r.orgName ? " &middot; " + esc(r.orgName) : "");
  return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head>"
    + '<body style="margin:0;padding:0;background:#e8e8e8;font-family:Arial,Helvetica,sans-serif;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8e8e8;"><tr><td align="center">'
    + '<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;background:#ffffff;">'
    + '<tr><td align="center" style="background:#000000;padding:30px 40px 24px;"><div style="color:#ffffff;font-size:40px;font-weight:bold;letter-spacing:8px;">ƏLEVATE</div><div style="color:#FFFF00;font-size:12.5px;letter-spacing:3.5px;margin-top:8px;text-transform:uppercase;">She answers. She books. She follows up.</div></td></tr>'
    + '<tr><td style="background:#FFFF00;height:5px;font-size:0;line-height:0;">&nbsp;</td></tr>'
    + '<tr><td><img src="' + IMG("coin-banner.png") + '" width="640" height="250" alt="Potent Coin" style="display:block;width:640px;height:250px;"></td></tr>'
    + '<tr><td style="padding:30px 42px 8px;">'
    + '<div style="font-size:25px;font-weight:bold;color:#000000;line-height:1.3;">You&rsquo;ve received a call from Elevate.</div>'
    + '<p style="font-size:15.5px;color:#333333;margin:9px 0 0;line-height:1.5;">Here&rsquo;s what happened, and what she said. The full call is saved in your Elevate dashboard, where your admins and team can view it any time.</p>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #000000;margin-top:24px;">'
    + '<tr><td style="background:#000000;color:#FFFF00;font-size:13px;font-weight:bold;letter-spacing:2.5px;padding:10px 16px;text-transform:uppercase;">Call summary</td></tr>'
    + srow("Outcome", '<span style="background:#FFFF00;color:#000000;font-weight:bold;padding:2px 9px;font-size:13.5px;">' + esc(r.outcome) + "</span>")
    + srow("Caller", esc(r.callerName || "name not given"))
    + srow("Number", esc(phoneFmt(r.callerNumber) || "—"))
    + srow("When", esc(r.when || "—"))
    + srow("Length", esc(r.length || "—"))
    + srow("Next step", esc(r.next), true)
    + "</table>"
    + '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:30px;"><tr><td><img src="' + IMG("mouth.png") + '" width="52" height="38" alt="" style="display:block;width:52px;height:38px;"></td><td style="font-size:16px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;color:#000000;padding-left:8px;">Here&rsquo;s what she said</td></tr></table>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + tHtml + "</table>"
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:30px 0 6px;"><a href="' + SITE() + '/voice/" style="display:inline-block;background:#FFFF00;color:#000000;font-size:16.5px;font-weight:bold;letter-spacing:1px;text-decoration:none;padding:15px 38px;border:2px solid #000000;">VIEW IN YOUR ELEVATE DASHBOARD</a><div style="font-size:12.5px;color:#777777;margin-top:11px;">Admins and team members with dashboard access can open this call.</div></td></tr></table>'
    + "</td></tr>"
    + '<tr><td align="center" style="background:#000000;padding:24px 40px 28px;"><img src="' + IMG("globe.png") + '" width="64" height="61" alt="" style="display:block;width:64px;height:61px;margin:0 auto;"><div style="color:#ffffff;font-size:13px;letter-spacing:3px;margin-top:9px;">POTENT</div><div style="color:#999999;font-size:11.5px;margin-top:7px;line-height:1.6;">Elevate by POTENT &middot; This is your call record &mdash; no marketing, just the call.<br>' + foot + "</div></td></tr>"
    + "</table></td></tr></table></body></html>";
}

// Everything the owner reads, built from the finished session + its records. Exported for tests.
async function buildReport(orgId, ses) {
  const i = ses.intake || {}, inbound = ses.direction !== "outbound";
  const bookings = rows(await B.sb("voice_bookings?org_id=eq." + orgId + "&session_id=eq." + ses.id + "&select=reference,status,job_id,customer_name&order=created_at.asc&limit=5"));
  const callbacks = rows(await B.sb("voice_callbacks?org_id=eq." + orgId + "&session_id=eq." + ses.id + "&select=id,name,phone&order=created_at.asc&limit=5"));
  const handoffs = rows(await B.sb("voice_handoffs?org_id=eq." + orgId + "&session_id=eq." + ses.id + "&select=status&limit=5"));
  const org = rows(await B.sb("organizations?id=eq." + orgId + "&select=name&limit=1"))[0];
  const tr = rows(await B.sb("voice_transcripts?session_id=eq." + ses.id + "&select=role,text,seq&order=seq.asc&limit=600"));
  // The caller's name does not always land in the session intake: the callback and booking tools
  // collect it mid-call and store it on THEIR records, never on the session — so a callback call
  // reported "name not given" while its callback row held the name all along. Resolve intake first,
  // then the callback record, then the booking record, and only then give up.
  const cbName = (callbacks.find(function (c) { return c && c.name; }) || {}).name;
  const bkName = (bookings.find(function (b) { return b && b.customer_name; }) || {}).customer_name;
  const callerName = i.customer_name || cbName || bkName || null;
  const callerNumber = (inbound ? ses.from_number : ses.to_number) || i.callback_phone || (callbacks.find(function (c) { return c && c.phone; }) || {}).phone || null;

  const L = [];
  L.push("Elevate " + (inbound ? "took a call" : "made a call") + " — outcome: " + label(ses.outcome) + ".");
  L.push("Caller: " + (callerName || "name not given") + (callerNumber ? " — " + callerNumber : "") + (i.company ? " (" + i.company + ")" : ""));
  const d = dur(ses.seconds); if (d) L.push("Length: " + d + ".");
  if (i.pickup_address || i.delivery_address) L.push("Trip: " + (i.pickup_address || "?") + " to " + (i.delivery_address || "?") + (i.service_date ? " on " + i.service_date : "") + (i.time_window ? " (" + i.time_window + ")" : "") + ".");
  if (i.freight_description || i.piece_count || i.total_weight_lb) L.push("Freight: " + [i.freight_description, i.piece_count && i.piece_count + " pieces", i.total_weight_lb && i.total_weight_lb + " lb"].filter(Boolean).join(", ") + ".");
  if (i._quote && i._quote.total_cents != null) L.push("Quote given: " + money(i._quote.total_cents) + (i._quote.number ? " (" + i._quote.number + ")" : "") + ".");
  bookings.forEach(function (b) { L.push("Booking " + b.reference + ": " + b.status + (b.job_id ? " — job " + b.job_id : "") + "."); });
  if (callbacks.length) L.push("A callback was saved for follow-up.");
  handoffs.forEach(function (h) { L.push("Handoff to a person: " + h.status + "."); });
  if (ses.end_reason) L.push("How it ended: " + String(ses.end_reason).replace(/_/g, " ") + ".");

  const toLine = function (t) { return (t.role === "caller" ? "Caller: " : t.role === "agent" ? "Elevate: " : "[system] ") + t.text; };
  const tRows = tr.map(function (t) { return { role: t.role, text: String(t.text || "").trim() }; }).filter(function (t) { return toLine(t).length > 9; });
  const lines = tRows.map(toLine);
  let transcript = lines.length ? lines.join("\n") : "(No transcript was recorded for this call.)";
  let htmlRows = tRows;
  if (transcript.length > 38000) { transcript = transcript.slice(0, 38000) + "\n[Transcript cut here — the full transcript is in the app under Voice → Calls.]"; let acc = 0; htmlRows = tRows.filter(function (t) { acc += t.text.length + 10; return acc < 38000; }); }

  const who = callerName || callerNumber || "unknown caller";
  const subject = "Elevate call: " + label(ses.outcome) + " — " + who;
  const text = L.join("\n") + "\n\nFULL TRANSCRIPT\n" + transcript + "\n\nSession " + ses.id + ".";

  // One line for the phone lock screen.
  let one = label(ses.outcome);
  if (ses.outcome === "booked" || ses.outcome === "booking_requested") {
    const q = i._quote && i._quote.total_cents != null ? money(i._quote.total_cents) : null;
    one = label(ses.outcome) + ": " + (city(i.pickup_address) || "pickup") + " → " + (city(i.delivery_address) || "drop-off") + (i.service_date ? ", " + i.service_date : "") + (i.time_window ? " " + i.time_window : "") + (q ? ", " + q : "");
  } else if (ses.outcome === "info_only") one = "Question call — no booking (" + who + ")";
  else one = label(ses.outcome) + " — " + who;
  const html = buildHtml({ outcome: label(ses.outcome), callerName: callerName, callerNumber: callerNumber, when: whenFmt(ses.started_at), length: dur(ses.seconds), next: nextStep(ses, callbacks, handoffs), rows: htmlRows, sessionId: ses.id, orgName: (org && org.name) || "" });
  return { subject: subject.slice(0, 150), text: text, html: html, oneLiner: one.slice(0, 140), transcriptLines: lines.length };
}

async function reportCall(orgId, sessionId) {
  try {
    if (!orgId || !S.UUID.test(String(sessionId || ""))) return { ok: false, why: "bad_ids" };
    // Exactly once per session, whoever gets here first (bridge end or status callback).
    if (!(await S.firstTime(orgId, sessionId, "ownerreport:" + sessionId, "owner_call_report", null))) return { ok: true, duplicate: true };
    const ses = await S.session(orgId, sessionId); if (!ses) return { ok: false, why: "no_session" };
    const hasTranscript = rows(await B.sb("voice_transcripts?session_id=eq." + sessionId + "&select=seq&limit=1")).length > 0;
    // A call that never connected (rang out, no answer, rejected before the bridge) is not a call
    // Elevate took — the missed-call callback row already covers it, and an email per robocall ring
    // would bury the real ones.
    if (!ses.answered_at && !hasTranscript && !(Number(ses.seconds) > 0) && !ses.outcome) return { ok: true, skipped: "never_connected" };
    const rep = await buildReport(orgId, ses);
    await T.notifyOwner(orgId, rep.subject, rep.text, rep.html);
    let pushed = null;
    try { pushed = await PUSH.pushToOwner(orgId, { title: "Elevate just took a call", body: rep.oneLiner, url: "/voice/", tag: "elevate-call-" + sessionId }); } catch (e) { /* push is best effort */ }
    return { ok: true, emailed: true, pushed: pushed };
  } catch (e) { console.error("owner-report", e && e.message); return { ok: false, why: "error" }; }
}

module.exports = { reportCall, buildReport, label };
