// Private API for the audio bridge (server-kit/voice-bridge). The bridge holds the Gemini key and the phone audio; this function holds the data and the rules.
// Auth: shared secret. The model never reaches this endpoint directly: the bridge forwards tool calls and the server re-checks everything.
const crypto = require("crypto");
const B = require("./lib/beats");
const TW = require("./lib/voice/adapters/twilio");
const S = require("./lib/voice/store");
const V = require("./lib/voice/billing");
const T = require("./lib/voice/tools");
const OR = require("./lib/voice/owner-report");
const P = require("./lib/voice/prompt");
const PR = require("./lib/voice/pricing");
const EP = require("./lib/elevate-phone");   // Əlevate phone calls: separate table, separate rules
const rows = S.rows;
const secret = function () { return process.env.VOICE_BRIDGE_SECRET || ""; };
const base = function () { return process.env.VOICE_WEBHOOK_URL || ((process.env.URL || B.SITE) + "/.netlify/functions/voice-webhook"); };
function authed(event) { const h = (event.headers || {}), m = String(h.authorization || h.Authorization || "").match(/^Bearer\s+(.+)$/i); const a = Buffer.from(m ? m[1] : ""), b = Buffer.from(secret()); return !!secret() && a.length === b.length && crypto.timingSafeEqual(a, b); }
async function sessionById(id) { if (!S.UUID.test(String(id || ""))) return null; return rows(await B.sb("voice_sessions?id=eq." + id + "&select=*&limit=1"))[0] || null; }
function summarize(ses) {
  const i = ses.intake || {}, q = i._quote, bits = [];
  bits.push((i.customer_name || "Caller") + (ses.from_number ? " (" + ses.from_number.replace(/\d(?=\d{4})/g, "*") + ")" : ""));
  if (i.pickup_address || i.delivery_address) bits.push((i.pickup_address || "?") + " to " + (i.delivery_address || "?") + (i.service_date ? " on " + i.service_date : ""));
  if (i.piece_count || i.total_weight_lb) bits.push((i.piece_count || "?") + " pc, " + (i.total_weight_lb || "?") + " lb" + (i.freight_description ? ", " + i.freight_description : ""));
  if (i._elig) bits.push("eligibility: " + i._elig.status + (i._elig.blocks && i._elig.blocks.length ? " (" + i._elig.blocks.map(function (b) { return b.code; }).join(", ") + ")" : ""));
  // Self-updating v1: each finished call leaves a structured note on its own session row (the store the Calls screens read), so what she
  // ran into accumulates as reference: why a job could not be taken (in words, not just codes), what else the caller wanted, who they were.
  // It is a record, not training: nothing here is fed back into her instructions, and objections in the caller's own words live in the transcript.
  if (i._elig && i._elig.status !== "eligible") { const why = (i._elig.blocks || []).concat(i._elig.reviews || []).map(function (b) { return b.text || b.code; }).filter(Boolean); if (why.length) bits.push("why: " + why.join("; ").slice(0, 240)); }
  if (i.recurring) bits.push("wanted recurring service");
  if (i.special_handling) bits.push("special handling: " + String(i.special_handling).slice(0, 80));
  if (ses.customer_id) bits.push("known customer");
  if (i._lang && i._lang !== "en") bits.push("language: " + i._lang);
  if (q) bits.push("quote " + q.number + " " + PR.money(q.total_cents));
  bits.push("outcome: " + (ses.outcome || "information only"));
  return bits.join(". ").slice(0, 900);
}
// A returning customer: the number matches a saved customer or a confirmed booking on this line. Only the first name is used (warmth), never any job detail: caller ID is not proof of identity.
async function knownCaller(ses) {
  try {
    const want = String(ses.from_number || "").replace(/\D/g, "").slice(-10); if (want.length < 10) return null;
    const hit = rows(await B.sb("customers?org_id=eq." + ses.org_id + "&select=name,phone&limit=500")).find(function (x) { return String(x.phone || "").replace(/\D/g, "").slice(-10) === want; })
      || rows(await B.sb("voice_bookings?org_id=eq." + ses.org_id + "&status=eq.confirmed&customer_phone=like.*" + want + "&select=customer_name&limit=1"))[0];
    const nm = hit && String(hit.name || hit.customer_name || "").trim().split(/\s+/)[0];
    return nm ? { first: nm.slice(0, 24) } : null;
  } catch (e) { return null; }
}
// SAFETY NET: a call that ends holding something from the caller but no booking, callback or handoff must never vanish.
// Whatever she said she would do ("someone will follow up"), the site makes it true: a callback on the caller-id number plus what we have, and the owner is emailed.
async function unfinishedNet(ses, reason) {
  try {
    if (!ses || ses.test_mode || ["pay_handoff", "ended_abuse", "ended_do_not_contact"].indexOf(String(reason || "")) >= 0 || ses.outcome === "ended_abuse" || ses.outcome === "ended_do_not_contact") return false;
    const sid = ses.id, fresh = rows(await B.sb("voice_sessions?id=eq." + sid + "&select=intake,outcome,from_number,end_reason&limit=1"))[0] || ses, i = fresh.intake || {};
    if (["booked", "callback", "handoff", "ended_abuse", "ended_do_not_contact"].indexOf(fresh.outcome) >= 0) return false;
    const n = async function (q) { return rows(await B.sb(q + "&select=id&limit=1")).length; };
    if (await n("voice_bookings?session_id=eq." + sid) || await n("voice_callbacks?session_id=eq." + sid) || await n("voice_handoffs?session_id=eq." + sid)) return false;
    const say = rows(await B.sb("voice_transcripts?session_id=eq." + sid + "&role=eq.caller&select=text&order=seq.desc&limit=4")).map(function (x) { return String(x.text || "").trim(); }).filter(Boolean).reverse();
    const keys = ["pickup_address", "delivery_address", "service_date", "time_window", "freight_description", "piece_count", "total_weight_lb", "company", "email"];
    const got = keys.filter(function (k) { return i[k] !== undefined && i[k] !== null && i[k] !== "" && i[k] !== false; });
    if (!got.length && !say.length) return false;                                  // hung up before saying anything: nothing to follow up
    const phone = fresh.from_number || ses.from_number || null, who = i.customer_name || null;
    const have = [i.pickup_address && "pickup " + i.pickup_address, i.delivery_address && "drop-off " + i.delivery_address, i.service_date && "date " + i.service_date + (i.time_window ? " " + i.time_window : ""), i.piece_count && i.piece_count + " pieces", i.total_weight_lb && i.total_weight_lb + " lb", i.freight_description].filter(Boolean);
    const need = ["pickup_address", "delivery_address", "service_date", "freight_description", "piece_count", "total_weight_lb"].filter(function (k) { return !i[k]; }).map(function (k) { return k.replace(/_/g, " "); });
    const blocked = i._elig && i._elig.status === "blocked", declined = /\b(neither|no,? thanks?|no thank you|not interested|nope)\b/i.test(say[say.length - 1] || "");
    if (blocked && declined) {   // we could not take it and they said no to a follow-up: do not make a callback they refused; the owner still hears about the lost job
      await S.patchSession(ses.org_id, sid, { outcome: "declined" });
      await T.notifyOwner(ses.org_id, "Job we could not take: " + (who || phone || "caller"), "A caller asked for a job we cannot take as described (" + (i._elig.blocks || []).map(function (b) { return b.text; }).join("; ") + ") and declined a follow-up.\n\nCaller: " + (who || "name not given") + (phone ? "  " + phone : "") + "\n" + (have.length ? "Details: " + have.join("; ") + "\n" : "") + "Nothing was saved for follow-up because they said no. Session " + sid + ".");
      return false;
    }
    const line = (blocked ? "AUTO-SAVED LEAD (we could not take it: " + (i._elig.blocks || []).map(function (b) { return b.text; }).join("; ").slice(0, 80) + "). " : "AUTO-SAVED: call ended before booking. ") + (have.length ? "Has: " + have.join("; ") + ". " : "") + (!have.length && say.length ? "Caller said: \"" + say[say.length - 1].slice(0, 120) + "\". " : "");
    await B.sb("voice_callbacks", { method: "POST", prefer: "return=minimal", body: { org_id: ses.org_id, session_id: sid, name: who ? String(who).slice(0, 80) : null, phone: phone, reason: line.slice(0, 300) } });
    await S.patchSession(ses.org_id, sid, { outcome: "callback" });
    await T.notifyOwner(ses.org_id, "Unfinished call saved: " + (who || phone || "caller"), "A caller hung up before the booking was finished, so a callback was saved automatically.\n\nCaller: " + (who || "name not given") + (phone ? "  " + phone : "") + "\n" + (have.length ? "Details we have: " + have.join("; ") + "\n" : "") + (need.length ? "Still missing: " + need.join(", ") + "\n" : "") + (say.length ? "Last things they said: " + say.map(function (x) { return "\"" + x.slice(0, 140) + "\""; }).join(" / ") + "\n" : "") + "\nCall back to finish it. Session " + sid + ".");
    return true;
  } catch (e) { console.error("unfinishedNet", e && e.message); return false; }
}
async function finish(ses, reason, seconds) {
  if (["ended", "failed", "rejected"].indexOf(ses.state) >= 0 && ses.ended_at) { if (ses.seconds == null && seconds) await V.recordUsage(ses.org_id, ses.id, seconds, ses.direction === "outbound" ? "outbound" : "call", ses.started_at); await OR.reportCall(ses.org_id, ses.id); return { ok: true, already: true }; }
  const secs = seconds != null ? Math.max(0, Math.floor(seconds)) : Math.max(0, Math.round((Date.now() - new Date(ses.answered_at || ses.started_at).getTime()) / 1000));
  await S.patchSession(ses.org_id, ses.id, { state: "ended", ended_at: new Date().toISOString(), seconds: secs, end_reason: String(reason || "hangup").slice(0, 60), summary: summarize(ses), outcome: ses.outcome || "info_only" });
  if (secs > 0) await V.recordUsage(ses.org_id, ses.id, secs, ses.direction === "outbound" ? "outbound" : "call", ses.started_at);
  const saved = ses.direction === "outbound" ? false : await unfinishedNet(ses, reason);
  // The owner's copy of the call (summary + full transcript email + push). Runs AFTER the safety net so
  // the report sees the final outcome; reportCall is once-per-session, so the status callback can't re-send it.
  await OR.reportCall(ses.org_id, ses.id);
  return { ok: true, seconds: secs, auto_callback: saved || undefined };
}
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  if (!authed(event)) return B.J(401, { error: "Not authorized" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  try {
    const act = String(b.action || "");
    if (act === "health") { await B.sb("voice_provider_health", { method: "POST", prefer: "return=minimal", body: { provider: String(b.provider || "bridge").slice(0, 40), kind: String(b.kind || "ping").slice(0, 40), ok: b.ok !== false, detail: b.detail ? String(b.detail).slice(0, 300) : null } }); return B.J(200, { ok: true }); }
    if (EP.rowId(b.session_id)) { const r = await EP.handle(act, b); return B.J(r.status, r.body); }          // an Əlevate call: never touches voice_* tables
    if (act === "context") {
      const tok = TW.readStreamToken(secret(), b.token); if (!tok) return B.J(403, { error: "Bad or expired stream token" });
      if (tok.o === "elevate") { const r = await EP.context(tok); return B.J(r.status, r.body); }
      const ses = rows(await B.sb("voice_sessions?org_id=eq." + tok.o + "&provider=eq.twilio&provider_call_id=eq." + encodeURIComponent(tok.c) + "&select=*&limit=1"))[0];
      if (!ses) return B.J(404, { error: "No such call" });
      if (ses.state !== "ringing" && ses.state !== "active") return B.J(409, { error: "Call is not open" });
      const cfg = await S.cfgOf(ses.org_id), st = await V.standing(ses.org_id);
      if (!st.active) return B.J(402, { error: st.reason || "Not subscribed" });
      if (cfg.emergency_stop || cfg.ai_enabled === false) return B.J(423, { error: "AI calling is switched off" });
      const first = ses.state === "ringing";
      if (first) await S.patchSession(ses.org_id, ses.id, { state: "active", answered_at: new Date().toISOString() });
      const rec = !!(cfg.recording_enabled && cfg.recording_consent_confirmed && st.entitlements.recording);
      if (first && rec) await TW.startRecording(ses.provider_call_id);
      const allowed = T.defs().filter(function (d) { return st.entitlements[T.FEATURE[d.name]] === true; });
      const cap = Math.min(st.plan.max_call_minutes, cfg.max_call_minutes || 1e9) * 60;
      const org = { name: st.org.name, slug: st.org.slug };
      let resume = null;
      if (tok.r) {   // the call is coming back from the keypad payment: tell the AI exactly what happened, plus what was said before, so she carries on without a new greeting
        const tr = rows(await B.sb("voice_transcripts?session_id=eq." + ses.id + "&role=in.(caller,agent)&select=role,text,seq&order=seq.desc&limit=24")).reverse();
        resume = { code: String(tok.r).slice(0, 80), recap: tr.map(function (t) { return (t.role === "caller" ? "Caller: " : "You: ") + t.text; }).join("\n").slice(0, 3000) };
      }
      return B.J(200, { resume: resume, session_id: ses.id, org_id: ses.org_id, call_sid: ses.provider_call_id, instructions: P.build(cfg, org, await knownCaller(ses)), greeting: P.greeting(cfg, org, ses.from_number), voice: cfg.voice || "marin", tools: allowed, max_seconds: cap, recording: rec });
    }
    const ses = await sessionById(b.session_id); if (!ses) return B.J(404, { error: "No such call" });
    if (act === "tool") {
      const used = rows(await B.sb("voice_tool_executions?session_id=eq." + ses.id + "&select=id&limit=100")).length;
      if (used >= 80) return B.J(429, { ok: false, error: "too_many_tool_calls" });
      const cfg = await S.cfgOf(ses.org_id);
      const r = await T.execute({ orgId: ses.org_id, session: ses, cfg: cfg }, String(b.name || ""), b.args, String(b.call_key || ""));
      return B.J(200, { result: r });
    }
    if (act === "transcript") {
      const role = ["caller", "agent", "system"].indexOf(b.role) >= 0 ? b.role : "system";
      if (b.key && !(await S.firstTime(ses.org_id, ses.id, "tr:" + ses.id + ":" + String(b.key).slice(0, 100), "transcript", null))) return B.J(200, { ok: true, duplicate: true });
      return B.J(200, { ok: await S.transcript(ses.org_id, ses.id, role, b.text) });
    }
    if (act === "end") return B.J(200, await finish(ses, b.reason, b.seconds));
    if (act === "pay") {   // the bridge asks to move the live call to the keypad payment. Everything is re-checked here; the model supplies nothing but a booking id we already own.
      if (process.env.VOICE_PAY !== "on" || !process.env.VOICE_PAY_CONNECTOR) return B.J(200, { ok: false, error: "keypad_not_live" });
      const JP = require("./lib/voice/jobpay"), bk = rows(await B.sb("voice_bookings?org_id=eq." + ses.org_id + "&id=eq." + encodeURIComponent(String(b.booking_id || "")) + "&session_id=eq." + ses.id + "&select=id,status,job_id,snapshot&limit=1"))[0];
      if (!bk || bk.status !== "confirmed" || !bk.job_id || !JP.payableCents(bk)) return B.J(200, { ok: false, error: "not_payable" });
      const r = await TW.transfer(ses.provider_call_id, base() + "?a=pay&s=" + ses.id + "&b=" + bk.id);
      if (!r.ok) { try { await T.notifyOwner(ses.org_id, "PAYMENT NEEDED by phone (keypad could not start)", "Booking " + bk.id + ": the call could not be moved to the keypad (" + (r.reason || "failed") + "). Call the customer" + (ses.from_number ? " at " + ses.from_number : "") + " to take payment. No link was sent."); } catch (e) { /* ignore */ } }
      return B.J(200, r.ok ? { ok: true } : { ok: false, error: r.reason || "transfer_failed" });
    }
    if (act === "hangup") {   // the agent ended the call (genuine abuse after one warning). The bridge only asks after the tool succeeded.
      const done = rows(await B.sb("voice_tool_executions?session_id=eq." + ses.id + "&tool=eq.end_call&select=id&limit=1"))[0];
      if (!done) return B.J(200, { ok: false, error: "no_end_call_requested" });
      const r = await TW.hangup(ses.provider_call_id); return B.J(200, { ok: !!r.ok, error: r.ok ? undefined : (r.reason || "hangup_failed") });
    }
    if (act === "transfer") {
      const cfg = await S.cfgOf(ses.org_id), h = rows(await B.sb("voice_handoffs?org_id=eq." + ses.org_id + "&session_id=eq." + ses.id + "&status=eq.requested&select=id&limit=1"))[0];
      if (!h) return B.J(409, { ok: false, error: "no_handoff_requested" });
      if (!cfg.human_available || !cfg.transfer_number || cfg.emergency_stop) { await B.sb("voice_handoffs?id=eq." + h.id, { method: "PATCH", prefer: "return=minimal", body: { status: "missed", resolved_at: new Date().toISOString(), resolved_by: "system:unavailable" } }); return B.J(200, { ok: false, error: "no_one_available" }); }
      const r = await TW.transfer(ses.provider_call_id, base() + "?a=xfer&s=" + ses.id);
      if (!r.ok) { await B.sb("voice_handoffs?id=eq." + h.id, { method: "PATCH", prefer: "return=minimal", body: { status: "missed", resolved_at: new Date().toISOString(), resolved_by: "system:" + (r.reason || "failed") } }); return B.J(200, { ok: false, error: r.reason || "transfer_failed" }); }
      return B.J(200, { ok: true, requested: true });      // "requested" only: the phone company reports whether anyone picked up
    }
    return B.J(400, { error: "Unknown action" });
  } catch (e) { console.error("voice-tools", e && e.message); return B.J(500, { error: "Server error" }); }
};
