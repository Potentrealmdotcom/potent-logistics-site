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
// FRESHNESS WINDOW (traffic fix list, Nov 8, 2026): a pending canonical job older than 45 minutes
// is crossed off — durably — never chased forever. The window is measured from the pending CLAIM,
// which always carries a timestamp, never from the session's ended_at: a session whose ended_at
// was never stamped used to be invisible to every deadline test and was re-served forever.
const FRESH_MS = 45 * 60000;
// The session's canonical state in ONE read. This replaces one hasEvent round trip per kind per
// check: the per-job status checks (settleReport ×3, the recording gate ×3, on every poll) were
// the chaser's heartbeat and a real slice of the database's busiest route.
async function canonicalState(orgId, sessionId) {
  const evs = rows(await B.sb("voice_events?org_id=eq." + orgId + "&session_id=eq." + sessionId + "&kind=in.(canonical_pending,canonical_transcript,canonical_closed,canonical_job_done)&select=kind,created_at"));
  const st = { pending: null, stored: false, closed: false, done: false };
  evs.forEach(function (e) { if (e.kind === "canonical_pending") st.pending = e; else if (e.kind === "canonical_transcript") st.stored = true; else if (e.kind === "canonical_closed") st.closed = true; else if (e.kind === "canonical_job_done") st.done = true; });
  return st;
}
// The durable terminal marker: once a session is stored, given up, or crossed off as stale, this
// claim exists and every reader (jobs, settleReport, the recording gate) treats the session as
// finished business. Once-only, like every firstTime gate.
async function terminalMark(orgId, sessionId, why) { return S.firstTime(orgId, sessionId, key("canonical_job_done", sessionId), "canonical_job_done", { why: String(why || "").slice(0, 120) }); }
// Same gate that starts the Twilio recording when the bridge connects (voice-tools "context").
async function recordingExpected(orgId) {
  try {
    const cfg = await S.cfgOf(orgId), st = await V.standing(orgId);
    return !!(cfg.recording_enabled && cfg.recording_consent_confirmed && st.entitlements && st.entitlements.recording);
  } catch (e) { return false; }
}
const _healthSeen = new Map();
async function health(orgId, kind, ok, detail) {
  // Throttle (traffic fix, 2026-11-08): a stuck transcription job is retried on every poll and
  // every attempt used to write another identical health row — thousands a day of noise that also
  // burned database traffic. The same org+kind+detail now lands at most once per 10 minutes per
  // warm function instance; the first occurrence (the one that matters) always goes through.
  const hk = (orgId || "") + "|" + kind + "|" + (detail ? String(detail).slice(0, 80) : "");
  const now = Date.now();
  if (_healthSeen.get(hk) && now - _healthSeen.get(hk) < 600000) return;
  _healthSeen.set(hk, now);
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
  const st = await canonicalState(orgId, sessionId);
  if (st.stored || st.closed || st.done) return OR.reportCall(orgId, sessionId);   // terminal (stored / given up / crossed off): report (once-guarded inside), never re-claim the pending slot
  const endedAt = ses.ended_at ? new Date(ses.ended_at).getTime() : 0;
  if (endedAt && Date.now() - endedAt > waitMs()) {   // the bounded wait already ran out (e.g. the worker was down): fall back to the live transcript
    await health(orgId, "canonical_timeout", false, sessionId);
    return OR.reportCall(orgId, sessionId);
  }
  // Freshness cross-off: the pending claim itself is older than the 45-minute window — waiting
  // longer will not produce a recording, so the job is finished and the report goes out with the
  // live transcript. This also rescues sessions whose ended_at was never stamped: the deadline
  // test above cannot see them, and the old code deferred them on every settle, forever.
  if (st.pending && st.pending.created_at && Date.now() - new Date(st.pending.created_at).getTime() > FRESH_MS) {
    await terminalMark(orgId, sessionId, "stale_pending");
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
// (pending claimed, canonical not yet stored), OLDEST first inside the freshness window (jobs
// cleanup, Nov 12, 2026 — see below). The live lines ride along so a mono recording can be
// role-anchored against them; dual-channel recordings ignore them.
async function jobs(limit) {
  const lim = limit || 20;
  const cutoff = new Date(Date.now() - FRESH_MS).toISOString();
  // STALE-CLAIM SWEEP (jobs cleanup, Nov 12, 2026): pending claims past the freshness window are
  // finished business, but the claim row is never deleted, so an age-bounded main query alone
  // would never see them again and nothing would ever cross them off. Sweep them here in bulk —
  // the same done-set technique as the main batch below, so already-finished sessions cost no
  // write — and terminal-mark the rest. Bounded per poll (lim rows, oldest first), so a backlog
  // drains over a few polls instead of in one write burst; once drained this is two narrow reads.
  const stalePend = rows(await B.sb("voice_events?kind=eq.canonical_pending&select=org_id,session_id,created_at&created_at=lte." + cutoff + "&order=created_at.asc&limit=" + lim));
  if (stalePend.length) {
    const sids = stalePend.map(function (p) { return p.session_id; }).filter(Boolean);
    if (sids.length) {
      const sdRows = rows(await B.sb("voice_events?kind=in.(canonical_transcript,canonical_closed,canonical_job_done)&session_id=in.(" + sids.join(",") + ")&select=session_id"));
      const sd = {}; sdRows.forEach(function (r) { sd[r.session_id] = true; });
      for (const p of stalePend) { if (!sd[p.session_id]) await terminalMark(p.org_id, p.session_id, "stale_pending"); }
    }
  }
  // FAIR WINDOW (jobs cleanup, Nov 12, 2026): the working set is claims inside the freshness
  // window, OLDEST first. Newest-first starved real jobs: a burst of 20+ newer claims pushed an
  // older unfinished job out of the limit-20 window on every poll, so it was never fetched,
  // never marked, never transcribed — silently. Oldest-first is FIFO: the job that has waited
  // longest is served first, and newer jobs queue behind it inside the same bounded window.
  const pend = rows(await B.sb("voice_events?kind=eq.canonical_pending&select=org_id,session_id,created_at&created_at=gt." + cutoff + "&order=created_at.asc&limit=" + lim));
  if (!pend.length) return [];
  // Resolve the batch in ONE query (traffic fix, 2026-11-08). The pending claim is never deleted,
  // so every stored or given-up session used to stay in this list forever and cost its own
  // per-session lookup on EVERY poll — that per-session lookup was the single busiest route in
  // the database. Now finished sessions are filtered out in bulk, up front.
  // THE KINDS MUST BE THE ONES ACTUALLY WRITTEN (root-cause fix, Nov 8, 2026): store() claims
  // kind "canonical_transcript", giveUp() claims "canonical_closed", and both now also claim
  // "canonical_job_done". The earlier filter listed kind "canonical" — a kind NOTHING ever
  // writes (it exists only inside event_key strings) — so the done-set read came back EMPTY on
  // every poll, no stored session was ever crossed off, and the transcriber re-checked finished
  // sessions around the clock (one stored session: 8,599 status checks in 24 h). An exclusion
  // read that returns empty must never be the reason the chase continues.
  const ids = pend.map(function (p) { return p.session_id; }).filter(Boolean);
  if (!ids.length) return [];
  const doneRows = rows(await B.sb("voice_events?kind=in.(canonical_transcript,canonical_closed,canonical_job_done)&session_id=in.(" + ids.join(",") + ")&select=session_id"));
  const done = {}; doneRows.forEach(function (r) { done[r.session_id] = true; });
  const out = [];
  for (const p of pend) {
    if (done[p.session_id]) continue;
    // Freshness cross-off: a pending claim older than the window is finished business. It is
    // crossed off DURABLY (the terminal claim lands once), not merely skipped per poll — and
    // the test is the claim's own age, so it holds even when the session's ended_at is missing.
    if (p.created_at && Date.now() - new Date(p.created_at).getTime() > FRESH_MS) { await terminalMark(p.org_id, p.session_id, "stale_pending"); continue; }
    const ses = await S.session(p.org_id, p.session_id);
    // Never-possible cross-off (traffic hardening, Nov 9, 2026): a pending claim whose session
    // row is gone, or which never carried a provider call id, can NEVER become a transcription
    // job — no recording can exist for it. These used to be skipped silently on every poll
    // forever, occupying the 20-claim window and costing a session lookup per poll for eternity.
    // Cross them off durably, same terminal marker as every other finished state.
    if (!ses) { await terminalMark(p.org_id, p.session_id, "no_session"); continue; }
    if (!ses.provider_call_id) { await terminalMark(p.org_id, p.session_id, "no_call_recording"); continue; }
    // Past the bounded wait this is no longer transcription work — settleReport's deadline path
    // (or giveUp) owns the report. Handing dead jobs to the transcriber made it retry them, and
    // re-fetch their full transcripts, on every poll around the clock. Cross the job off DURABLY
    // (jobs cleanup, Nov 12, 2026): a bare continue left no terminal mark, so the session was
    // re-looked-up — session row — on every poll until the 45-minute stale check finally caught
    // it (~35 minutes of pointless polls). The mark waits one FULL extra wait window past the
    // deadline (2 × waitMs, still well inside the freshness window) on purpose: the recording
    // gate refuses sessions carrying the done marker, and recordings are fetched in chunks, so
    // marking at the deadline itself could cut off a slow in-flight download that started
    // inside the wait. Two windows in, no live download is still fetching — the job is dead
    // work by any measure. Downstream is unchanged: settleReport already reports at once when
    // it sees the done claim, store() still accepts a late canonical delivery exactly as it
    // does after giveUp, and giveUp's own marker write is once-only, so the two never conflict.
    if (ses.ended_at && Date.now() - new Date(ses.ended_at).getTime() > waitMs()) { if (Date.now() - new Date(ses.ended_at).getTime() > 2 * waitMs()) await terminalMark(p.org_id, p.session_id, "wait_expired"); continue; }
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
  const st = await canonicalState(orgId, sessionId);   // ONE read for the whole gate (was three)
  if (ses.provider !== "twilio" || !ses.provider_call_id || !st.pending || st.stored || st.closed || st.done) return { ok: false, error: "not_queued" };
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
  await terminalMark(orgId, sessionId, "stored");   // durable terminal marker: jobs() crosses this session off from this moment on
  await B.sb("voice_transcripts?session_id=eq." + sessionId, { method: "DELETE", prefer: "return=minimal" });
  for (const l of clean) await S.transcript(orgId, sessionId, l.role, l.text);   // S.transcript redacts (cards/SSNs) and assigns the next seq, so the shape matches live rows exactly
  await health(orgId, "canonical_stored", true, sessionId + " " + clean.length + " lines " + ((meta && meta.engine) || ""));
  const rep = await OR.reportCall(orgId, sessionId);
  return { ok: true, lines: clean.length, report: rep };
}

// Transcription failed or the deadline passed with no recording: the report goes out with the
// live transcript, as it always did before this pipeline existed.
async function giveUp(orgId, sessionId, why) {
  const st = await canonicalState(orgId, sessionId);
  if (st.stored) return { ok: true, already: true };
  // Close the claim (traffic fix, 2026-11-08): a given-up session used to stay "canonical_pending"
  // forever, so the job list kept handing it back on every poll and its transcript kept being
  // re-fetched. canonical_closed + the canonical_job_done terminal marker are the states jobs()
  // and settleReport() check for; claiming them is once-only, like every firstTime gate, so a
  // repeat giveUp is a cheap no-op (and a pre-fix closed session still gets its marker).
  const claimed = await S.firstTime(orgId, sessionId, key("canonical_closed", sessionId), "canonical_closed", { why: String(why || "").slice(0, 120) });
  await terminalMark(orgId, sessionId, "giveup");
  if (!claimed) return { ok: true, already: true };
  await health(orgId, "canonical_fallback", false, sessionId + " " + String(why || "").slice(0, 120));
  const rep = await OR.reportCall(orgId, sessionId);
  return { ok: true, report: rep };
}

module.exports = { settleReport, jobs, store, giveUp, recordingExpected, waitMs, recording };
