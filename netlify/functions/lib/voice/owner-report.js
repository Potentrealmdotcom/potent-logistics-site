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

// Everything the owner reads, built from the finished session + its records. Exported for tests.
async function buildReport(orgId, ses) {
  const i = ses.intake || {}, inbound = ses.direction !== "outbound";
  const callerNumber = (inbound ? ses.from_number : ses.to_number) || i.callback_phone || null;
  const callerName = i.customer_name || null;
  const bookings = rows(await B.sb("voice_bookings?org_id=eq." + orgId + "&session_id=eq." + ses.id + "&select=reference,status,job_id&order=created_at.asc&limit=5"));
  const callbacks = rows(await B.sb("voice_callbacks?org_id=eq." + orgId + "&session_id=eq." + ses.id + "&select=id&limit=5"));
  const handoffs = rows(await B.sb("voice_handoffs?org_id=eq." + orgId + "&session_id=eq." + ses.id + "&select=status&limit=5"));
  const tr = rows(await B.sb("voice_transcripts?session_id=eq." + ses.id + "&select=role,text,seq&order=seq.asc&limit=600"));

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

  const lines = tr.map(function (t) { return (t.role === "caller" ? "Caller: " : t.role === "agent" ? "Elevate: " : "[system] ") + String(t.text || "").trim(); }).filter(function (x) { return x.length > 9; });
  let transcript = lines.length ? lines.join("\n") : "(No transcript was recorded for this call.)";
  if (transcript.length > 38000) transcript = transcript.slice(0, 38000) + "\n[Transcript cut here — the full transcript is in the app under Voice → Calls.]";

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
  return { subject: subject.slice(0, 150), text: text, oneLiner: one.slice(0, 140), transcriptLines: lines.length };
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
    await T.notifyOwner(orgId, rep.subject, rep.text);
    let pushed = null;
    try { pushed = await PUSH.pushToOwner(orgId, { title: "Elevate just took a call", body: rep.oneLiner, url: "/voice/", tag: "elevate-call-" + sessionId }); } catch (e) { /* push is best effort */ }
    return { ok: true, emailed: true, pushed: pushed };
  } catch (e) { console.error("owner-report", e && e.message); return { ok: false, why: "error" }; }
}

module.exports = { reportCall, buildReport, label };
