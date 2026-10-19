// Private API for the audio bridge (server-kit/voice-bridge). The bridge holds the OpenAI key and the phone audio; this function holds the data and the rules.
// Auth: shared secret. The model never reaches this endpoint directly: the bridge forwards tool calls and the server re-checks everything.
const crypto = require("crypto");
const B = require("./lib/beats");
const TW = require("./lib/voice/adapters/twilio");
const S = require("./lib/voice/store");
const V = require("./lib/voice/billing");
const T = require("./lib/voice/tools");
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
  if (q) bits.push("quote " + q.number + " " + PR.money(q.total_cents));
  bits.push("outcome: " + (ses.outcome || "information only"));
  return bits.join(". ").slice(0, 900);
}
async function finish(ses, reason, seconds) {
  if (["ended", "failed", "rejected"].indexOf(ses.state) >= 0 && ses.ended_at) { if (ses.seconds == null && seconds) await V.recordUsage(ses.org_id, ses.id, seconds, ses.direction === "outbound" ? "outbound" : "call", ses.started_at); return { ok: true, already: true }; }
  const secs = seconds != null ? Math.max(0, Math.floor(seconds)) : Math.max(0, Math.round((Date.now() - new Date(ses.answered_at || ses.started_at).getTime()) / 1000));
  await S.patchSession(ses.org_id, ses.id, { state: "ended", ended_at: new Date().toISOString(), seconds: secs, end_reason: String(reason || "hangup").slice(0, 60), summary: summarize(ses), outcome: ses.outcome || "info_only" });
  if (secs > 0) await V.recordUsage(ses.org_id, ses.id, secs, ses.direction === "outbound" ? "outbound" : "call", ses.started_at);
  return { ok: true, seconds: secs };
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
      const org = { name: st.org.name };
      return B.J(200, { session_id: ses.id, org_id: ses.org_id, call_sid: ses.provider_call_id, instructions: P.build(cfg, org), greeting: P.greeting(cfg, org), voice: cfg.voice || "marin", tools: allowed, max_seconds: cap, recording: rec });
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
      if (b.key && !(await S.firstTime(ses.org_id, ses.id, "tr:" + String(b.key).slice(0, 100), "transcript", null))) return B.J(200, { ok: true, duplicate: true });
      return B.J(200, { ok: await S.transcript(ses.org_id, ses.id, role, b.text) });
    }
    if (act === "end") return B.J(200, await finish(ses, b.reason, b.seconds));
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
