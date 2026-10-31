// CANONICAL TRANSCRIPTS (Tony, Oct 30, 2026: "the transcript must be word for word, or this is
// pointless"). The live transcript is Gemini Live's in-call transcription and it errs — it stored
// the CALLER as saying "1,500 Peachtree Street" when he said 1200 (the agent's mishearing saved
// as his words), dropped digits mid-line, and kept stray fragments. Calls are recorded on Twilio
// whenever recording is on (setting + consent + plan entitlement, the same gate that starts the
// recording in voice-tools "context"). After the call, the bridge-host transcriber fetches the
// recording THROUGH THIS MODULE (the canonical_recording action below: the site holds the Twilio
// credentials and proxies the media, so the bridge host never carries the account-wide Twilio
// token), transcribes it with faster-whisper per channel (caller vs agent), and posts the lines
// here; they REPLACE the live rows in voice_transcripts, in the same {role, text, seq} shape every
// reader (dashboard, owner email) already uses, so nobody downstream changes.
//
// This module owns the timing: the owner report WAITS for the canonical transcript, bounded by
// CANONICAL_WAIT_MIN (default 10 minutes after the call ends). If transcription lands in time,
// the report carries the recording's words; if it fails, times out, or no recording exists, the
// report goes out with the live transcript exactly as it did before this module existed.
// The live transcript stays the fallback — it is only replaced once a canonical set is stored.
const B = require("../beats");
const S = require("./store");
const V = require("./billing");
const OR = require("./owner-report");
const TW = require("./adapters/twilio");
const rows = S.rows;

const waitMs = function () { const m = Number(process.env.CANONICAL_WAIT_MIN); return (isFinite(m) && m > 0 ? m : 10) * 60000; };
const key = function (kind, sessionId) { return kind + ":" + sessionId; };
async function hasEvent(orgId, sessionId, kind) {
  return rows(await B.sb("voice_events?org_id=eq." + orgId + "&session_id=eq." + sessionId + "&event_key=eq." + encodeURIComponent(key(kind, sessionId)) + "&select=id&limit=1")).length > 0;
}
// Same gate that starts the Twilio recording when the bridge connects (voice-tools "context").
async function recordingExpected(orgId) {
  try {
    const cfg = await S.cfgOf(orgId), st = await V.standing(orgId);
    return !!(cfg.recording_enabled && cfg.recording_consent_confirmed && st.entitlements && st.entitlements.recording);
  } catch (e) { return false; }
}
async function health(orgId, kind, ok, detail) {
  try { await B.sb("voice_provider_health", { method: "POST", prefer: "return=minimal", body: { org_id: orgId || null, provider: "canonical", kind: kind, ok: !!ok, detail: detail ? String(detail).slice(0, 300) : null } }); } catch (e) { /* ignore */ }
}

// The one door every report trigger now walks through (bridge end in voice-tools finish(), the
// Twilio status-callback backstop in voice-webhook). Returns what reportCall returns when the
// report goes out now, or { deferred: true } when the canonical pipeline owns it.
async function settleReport(orgId, sessionId) {
  const ses = await S.session(orgId, sessionId);
  if (!ses) return OR.reportCall(orgId, sessionId);
  // No recording can exist for a call that never reached the bridge, or a non-Twilio provider:
  // report immediately, exactly as before.
  if (!ses.answered_at || ses.provider !== "twilio" || !ses.provider_call_id) return OR.reportCall(orgId, sessionId);
  if (!(await recordingExpected(orgId))) return OR.reportCall(orgId, sessionId);
  if (await hasEvent(orgId, sessionId, "canonical")) return OR.reportCall(orgId, sessionId);   // already stored: report (once-guarded inside)
  const endedAt = ses.ended_at ? new Date(ses.ended_at).getTime() : 0;
  if (endedAt && Date.now() - endedAt > waitMs()) {   // the bounded wait already ran out (e.g. the worker was down): fall back to the live transcript
    await health(orgId, "canonical_timeout", false, sessionId);
    return OR.reportCall(orgId, sessionId);
  }
  // Defer: claim the pending slot so the transcriber picks the job up; the report goes out from
  // the canonical_transcript / canonical_giveup actions, or from a later settleReport call that
  // finds the deadline passed.
  await S.firstTime(orgId, sessionId, key("canonical_pending", sessionId), "canonical_pending", { deadline: new Date((endedAt || Date.now()) + waitMs()).toISOString() });
  return { ok: true, deferred: true };
}

// Jobs for the bridge-host transcriber: sessions whose report is parked on the canonical pipeline
// (pending claimed, canonical not yet stored), newest first. The live lines ride along so a mono
// recording can be role-anchored against them; dual-channel recordings ignore them.
async function jobs(limit) {
  const pend = rows(await B.sb("voice_events?kind=eq.canonical_pending&select=org_id,session_id,created_at&order=created_at.desc&limit=" + (limit || 20)));
  const out = [];
  for (const p of pend) {
    if (await hasEvent(p.org_id, p.session_id, "canonical")) continue;
    const ses = await S.session(p.org_id, p.session_id);
    if (!ses || !ses.provider_call_id) continue;
    const live = rows(await B.sb("voice_transcripts?session_id=eq." + ses.id + "&select=role,text,seq&order=seq.asc&limit=600"));
    out.push({ session_id: ses.id, org_id: ses.org_id, call_sid: ses.provider_call_id, from_number: ses.from_number, to_number: ses.to_number, direction: ses.direction, ended_at: ses.ended_at, deadline: new Date((ses.ended_at ? new Date(ses.ended_at).getTime() : Date.now()) + waitMs()).toISOString(), live_lines: live.map(function (t) { return { role: t.role, text: t.text }; }) });
  }
  return out;
}

// The recording itself, proxied to the bridge-secret caller. The gate is queue membership —
// the exact set jobs() hands out: the session's report is parked (canonical_pending claimed)
// and no canonical transcript is stored yet. Anyone else, and any other session, is refused:
// there is no public or guessable URL for a recording, ever. The media is served in bounded
// chunks (base64 JSON), because a whole dual-channel WAV for a long call exceeds what one
// function response may carry; the caller reassembles it byte for byte, channels untouched.
const CHUNK = 3 * 1024 * 1024;
let mediaCache = { key: "", buf: null, at: 0 };   // warm-function best-effort: only used when Twilio ignores the Range and sends the whole file
async function mediaSlice(recSid, off) {
  if (mediaCache.buf && mediaCache.key === recSid && Date.now() - mediaCache.at < 600000) return { ok: true, buf: mediaCache.buf.slice(off, off + CHUNK), total: mediaCache.buf.length };
  const r = await TW.recordingRange(recSid, off, off + CHUNK - 1);
  if (!r.ok) return r;
  if (r.partial) return { ok: true, buf: r.buf, total: r.total != null ? r.total : off + r.buf.length };
  if (r.buf.length <= 96 * 1024 * 1024) mediaCache = { key: recSid, buf: r.buf, at: Date.now() };
  return { ok: true, buf: r.buf.slice(off, off + CHUNK), total: r.total != null ? r.total : r.buf.length };
}
async function recording(orgId, sessionId, offset) {
  const ses = await S.session(orgId, sessionId);
  if (!ses) return { ok: false, error: "no_session" };
  if (ses.provider !== "twilio" || !ses.provider_call_id || !(await hasEvent(orgId, sessionId, "canonical_pending")) || (await hasEvent(orgId, sessionId, "canonical"))) return { ok: false, error: "not_queued" };
  const best = await TW.callRecording(ses.provider_call_id);
  if (!best.ok) { await health(orgId, "canonical_recording", false, sessionId + " " + best.reason); return { ok: false, error: best.reason === "recording_not_ready" ? "recording_not_ready" : "twilio_error", retry: true, detail: best.detail || best.reason }; }
  const off = Math.max(0, Math.floor(Number(offset) || 0)), sl = await mediaSlice(best.recording.sid, off);
  if (!sl.ok) { await health(orgId, "canonical_recording", false, sessionId + " " + sl.reason); return { ok: false, error: "twilio_error", retry: true, detail: sl.reason }; }
  return { ok: true, session_id: sessionId, recording_sid: best.recording.sid, offset: off, total: sl.total, bytes: sl.buf.length, data_b64: sl.buf.toString("base64"), next_offset: off + sl.buf.length < sl.total ? off + sl.buf.length : null };
}

// Replace the session's live transcript rows with the canonical lines, then send the owner report.
// Idempotent: the first delivery claims the session; later ones are duplicates and change nothing.
async function store(orgId, sessionId, lines, meta) {
  const ses = await S.session(orgId, sessionId);
  if (!ses) return { ok: false, error: "no_session" };
  const clean = (Array.isArray(lines) ? lines : []).filter(function (l) { return l && ["caller", "agent", "system"].indexOf(l.role) >= 0 && String(l.text || "").trim(); })
    .slice(0, 800).map(function (l) { return { role: l.role, text: String(l.text).slice(0, 2000) }; });
  if (!clean.length) return { ok: false, error: "no_lines" };
  if (!(await S.firstTime(orgId, sessionId, key("canonical", sessionId), "canonical_transcript", { engine: (meta && meta.engine) || null, source: (meta && meta.source) || null, lines: clean.length }))) return { ok: true, duplicate: true };
  await B.sb("voice_transcripts?session_id=eq." + sessionId, { method: "DELETE", prefer: "return=minimal" });
  for (const l of clean) await S.transcript(orgId, sessionId, l.role, l.text);   // S.transcript redacts (cards/SSNs) and assigns the next seq, so the shape matches live rows exactly
  await health(orgId, "canonical_stored", true, sessionId + " " + clean.length + " lines " + ((meta && meta.engine) || ""));
  const rep = await OR.reportCall(orgId, sessionId);
  return { ok: true, lines: clean.length, report: rep };
}

// Transcription failed or the deadline passed with no recording: the report goes out with the
// live transcript, as it always did before this pipeline existed.
async function giveUp(orgId, sessionId, why) {
  if (await hasEvent(orgId, sessionId, "canonical")) return { ok: true, already: true };
  await health(orgId, "canonical_fallback", false, sessionId + " " + String(why || "").slice(0, 120));
  const rep = await OR.reportCall(orgId, sessionId);
  return { ok: true, report: rep };
}

module.exports = { settleReport, jobs, store, giveUp, recordingExpected, waitMs, recording };
