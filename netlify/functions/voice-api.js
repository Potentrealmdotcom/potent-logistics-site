// POTENT VOICE control center backend. Company logins see only their own company; POTENT's owner may name any company.
// Reads: any staff role. Day-to-day actions: owner / dispatch. Settings, vehicles, knowledge approval, suppression removal: owner only.
const B = require("./lib/beats");
const A = require("./lib/voice/auth");
const S = require("./lib/voice/store");
const V = require("./lib/voice/billing");
const T = require("./lib/voice/tools");
const I = require("./lib/voice/intake");
const TN = require("./lib/voice/tenant");
const R = require("./lib/voice/rules");
const OUT = require("./lib/voice/outbound");
const rows = S.rows, UUID = S.UUID;
const clip = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n); };
const hits = {}; function tooMany(k, max) { const h = hits[k] = (hits[k] || []).filter(function (t) { return Date.now() - t < 6e4; }); h.push(Date.now()); return h.length > max; }
const iso = function (v, d) { const t = Date.parse(v); return isFinite(t) ? new Date(t).toISOString() : d; };
const bad = function (m) { return B.J(400, { error: m }); };
const count = async function (path) { const r = await B.sb(path + "&select=id&limit=10000"); return rows(r).length; };

async function dashboard(orgId, from, to) {
  const q = "org_id=eq." + orgId + "&test_mode=eq.false&started_at=gte." + encodeURIComponent(from) + "&started_at=lt." + encodeURIComponent(to);
  const ses = rows(await B.sb("voice_sessions?" + q + "&select=id,state,outcome,seconds,lead_id,direction,end_reason,quote,started_at&limit=10000"));
  const live = rows(await B.sb("voice_sessions?org_id=eq." + orgId + "&test_mode=eq.false&state=in.(ringing,active,handoff)&select=id,from_number,state,started_at&limit=50"));
  const done = ses.filter(function (s) { return s.state === "ended"; }), missed = ses.filter(function (s) { return s.state === "rejected" || s.state === "failed" || (s.state !== "ended" && s.seconds === 0); });
  const bk = rows(await B.sb("voice_bookings?org_id=eq." + orgId + "&created_at=gte." + encodeURIComponent(from) + "&created_at=lt." + encodeURIComponent(to) + "&select=status")), quotes = rows(await B.sb("voice_quotes?org_id=eq." + orgId + "&created_at=gte." + encodeURIComponent(from) + "&created_at=lt." + encodeURIComponent(to) + "&select=status"));
  const ho = rows(await B.sb("voice_handoffs?org_id=eq." + orgId + "&requested_at=gte." + encodeURIComponent(from) + "&requested_at=lt." + encodeURIComponent(to) + "&select=status"));
  const failedTools = rows(await B.sb("voice_tool_executions?org_id=eq." + orgId + "&ok=eq.false&created_at=gte." + encodeURIComponent(from) + "&created_at=lt." + encodeURIComponent(to) + "&select=id&limit=10000")).length;
  const failedNotes = rows(await B.sb("voice_notifications_sent?org_id=eq." + orgId + "&status=eq.failed&created_at=gte." + encodeURIComponent(from) + "&created_at=lt." + encodeURIComponent(to) + "&select=id&limit=10000")).length;
  const usage = rows(await B.sb("voice_usage_records?org_id=eq." + orgId + "&started_at=gte." + encodeURIComponent(from) + "&started_at=lt." + encodeURIComponent(to) + "&select=billable_minutes&limit=100000")).reduce(function (a, x) { return a + Number(x.billable_minutes || 0); }, 0);
  const cb = rows(await B.sb("voice_callbacks?org_id=eq." + orgId + "&status=eq.open&select=id&limit=1000")).length;
  const cfg = await S.cfgOf(orgId), st = await V.standing(orgId);
  const health = rows(await B.sb("voice_provider_health?or=(org_id.eq." + orgId + ",org_id.is.null)&select=provider,kind,ok,detail,created_at&order=created_at.desc&limit=30"));
  const recentBad = health.filter(function (h) { return !h.ok && Date.now() - new Date(h.created_at).getTime() < 15 * 60000; });
  const numbers = (cfg.settings && cfg.settings.numbers) || [];
  const needs = []; if (!st.active) needs.push(st.reason || "POTENT VOICE is not subscribed"); if (!numbers.length) needs.push("No phone number is connected"); if (!process.env.TWILIO_AUTH_TOKEN) needs.push("Twilio is not configured"); if (!process.env.VOICE_BRIDGE_URL || !process.env.VOICE_BRIDGE_SECRET) needs.push("The audio bridge is not connected"); if (!(await S.profileOf(orgId))) needs.push("No authorized vehicle profile");
  const status = cfg.emergency_stop || cfg.ai_enabled === false ? "offline" : needs.length ? "configuration_required" : recentBad.length ? "degraded" : "online";
  const costPer = cfg.settings && cfg.settings.cost_per_min_cents;
  const avg = done.length ? Math.round(done.reduce(function (a, s) { return a + (s.seconds || 0); }, 0) / done.length) : null;
  return { empty: !ses.length, status: status, needs: needs, live: live, calls: { total: ses.length, completed: done.length, missed: missed.length, avg_seconds: avg }, leads: ses.filter(function (s) { return s.lead_id; }).length,
    quotes: { created: quotes.length, accepted: quotes.filter(function (x) { return x.status === "accepted"; }).length, acceptance_rate: quotes.length ? quotes.filter(function (x) { return x.status === "accepted"; }).length / quotes.length : null },
    bookings: { requested: bk.length, confirmed: bk.filter(function (x) { return x.status === "confirmed"; }).length, pending: bk.filter(function (x) { return x.status === "pending_review"; }).length }, conversion: ses.length ? bk.filter(function (x) { return x.status === "confirmed"; }).length / ses.length : null,
    handoffs: { total: ho.length, missed: ho.filter(function (x) { return x.status === "missed"; }).length, open: ho.filter(function (x) { return x.status === "requested"; }).length }, callbacks_open: cb, failed_tool_calls: failedTools, failed_notifications: failedNotes,
    usage: { minutes: usage, est_cost_cents: costPer != null ? usage * costPer : null, cost_note: costPer != null ? "Estimated from your per-minute cost setting" : "Set a per-minute cost to see estimated cost", spend_alert_cents: cfg.spend_alert_cents }, health: health.slice(0, 10), standing: { tier: st.tier, status: st.status, used: st.usage && st.usage.used, included: st.usage && st.usage.included } };
}
const CFG_FIELDS = { agent_name: "s80", greeting: "s400", disclosure: "s400", voice: "s40", transfer_number: "phone", human_available: "bool", recording_enabled: "bool", recording_consent_confirmed: "bool", emergency_stop: "bool", ai_enabled: "bool", max_call_minutes: "int1", retention_days: "int1", spend_alert_cents: "intn", outbound_enabled: "bool", outbound_compliance_confirmed: "bool" };
async function saveConfig(orgId, patch, actor, st) {
  const cur = await S.cfgOf(orgId), out = {};
  for (const k of Object.keys(patch || {})) {
    if (k === "settings") continue; const t = CFG_FIELDS[k]; if (!t) return { error: "Cannot change " + k }; const v = patch[k];
    if (t === "bool") { if (typeof v !== "boolean") return { error: k + " must be on or off" }; out[k] = v; }
    else if (t === "phone") { if (v === "" || v === null) out[k] = null; else { const p = I.phone(v); if (!p) return { error: "Enter a 10-digit US number" }; out[k] = p; } }
    else if (t.charAt(0) === "s") out[k] = clip(v, Number(t.slice(1))) || null;
    else if (t === "int1") { const n = Number(v); if (!Number.isInteger(n) || n < 1 || n > 10000) return { error: k + " must be a whole number" }; out[k] = n; }
    else if (t === "intn") { if (v === null || v === "") out[k] = null; else { const n = Number(v); if (!Number.isInteger(n) || n < 0) return { error: k + " must be a whole number" }; out[k] = n; } }
  }
  if (out.recording_consent_confirmed === true && !(out.recording_enabled || cur.recording_enabled)) return { error: "Turn recording on before confirming consent" };
  if ((out.recording_enabled === true || cur.recording_enabled) && out.recording_enabled !== false && st.entitlements.recording !== true && out.recording_enabled === true) return { error: "Recording is not part of your plan" };
  if (out.recording_enabled === false) out.recording_consent_confirmed = false;
  if (out.outbound_enabled === true) { if (st.entitlements.outbound !== true) return { error: "Outbound calling is not part of your plan" }; if (!(out.outbound_compliance_confirmed || cur.outbound_compliance_confirmed)) return { error: "Confirm the calling-law checklist first" }; }
  if (out.outbound_compliance_confirmed === false) out.outbound_enabled = false;
  if (out.human_available === true && !(out.transfer_number || cur.transfer_number)) return { error: "Add the number to transfer to first" };
  if (patch.service_area) { const s = patch.service_area && Array.isArray(patch.service_area.states) ? patch.service_area.states.map(function (x) { return String(x).toUpperCase(); }).filter(function (x) { return /^[A-Z]{2}$/.test(x); }) : null; if (!s) return { error: "Service area needs a list of state codes" }; out.service_area = { states: s }; }
  if (patch.settings) {
    const s = Object.assign({}, cur.settings || {}), p = patch.settings;
    if (p.numbers !== undefined) { const nums = (Array.isArray(p.numbers) ? p.numbers : []).map(I.phone); if (nums.some(function (x) { return !x; })) return { error: "Phone numbers must be 10-digit US numbers" }; const taken = rows(await B.sb("voice_agent_config?select=org_id,settings&limit=500")).filter(function (c) { return c.org_id !== orgId && ((c.settings && c.settings.numbers) || []).some(function (n) { return nums.indexOf(n) >= 0; }); }); if (taken.length) return { error: "That number is already used by another company" }; s.numbers = nums; }
    if (p.intake !== undefined) { if (!p.intake || typeof p.intake !== "object") return { error: "Answers must be an object" }; s.intake = TN.sanitize(p.intake); }
    if (p.test_mode !== undefined) s.test_mode = p.test_mode === true;
    if (p.driver_check !== undefined) { if (["required", "owner_operator"].indexOf(p.driver_check) < 0) return { error: "driver_check must be required or owner_operator" }; s.driver_check = p.driver_check; }
    if (p.cost_per_min_cents !== undefined) { const n = Number(p.cost_per_min_cents); if (p.cost_per_min_cents !== null && (!Number.isInteger(n) || n < 0)) return { error: "Cost per minute must be whole cents" }; s.cost_per_min_cents = p.cost_per_min_cents === null ? null : n; }
    if (p.quote !== undefined) { const q = p.quote || {}, o = {}; [["included_miles", 0, 1000], ["per_mile_cents", 0, 100000], ["tax_bps", 0, 2000], ["deposit_pct", 0, 100], ["min_margin_pct", 0, 500], ["cost_per_mile_cents", 0, 100000]].forEach(function (f) { if (q[f[0]] !== undefined && q[f[0]] !== null) { const n = Number(q[f[0]]); if (!isFinite(n) || n < f[1] || n > f[2]) o.__bad = f[0]; else o[f[0]] = n; } }); if (o.__bad) return { error: o.__bad + " is out of range" }; if (q.size_tiers !== undefined) { const tiers = Array.isArray(q.size_tiers) ? q.size_tiers : null; let prev = 0; if (!tiers || !tiers.length || tiers.some(function (t) { const mx = Number(t && t.max_lb); const okk = isFinite(mx) && mx > prev && require("./lib/voice/pricing").SIZE_KEYS.indexOf(t.key) >= 0; if (okk) prev = mx; return !okk; })) return { error: "Load-size tiers need ascending weights (lb) and a price name from the list" }; o.size_tiers = tiers.map(function (t) { return { max_lb: Number(t.max_lb), key: t.key }; }); }
      if (q.payment_text !== undefined) o.payment_text = clip(q.payment_text, 400) || null; s.quote = Object.assign({}, s.quote || {}, o); }
    if (p.pricing !== undefined && cur.settings && true) { const pr = p.pricing || {}, o = {}; const ks = ["onetime_min", "sameday_min", "rush_min", "recurring_min", "small_load_min", "partial_load_min", "half_truck_min", "full_truck_min", "savannah_early", "savannah_fullday", "additional_stop_fee", "wait_detention_hourly", "additional_labor_hourly", "breakdown_hourly", "inside_delivery_min", "overnight_hold_nightly", "included_pickup_minutes", "included_delivery_minutes", "quote_expiration_minutes", "payload_limit_lbs"]; for (const k of Object.keys(pr)) { if (ks.indexOf(k) < 0) return { error: "Unknown price " + k }; const n = Number(pr[k]); if (!isFinite(n) || n < 0 || n > 1000000) return { error: k + " must be a number" }; o[k] = n; } s.pricing = Object.assign({}, s.pricing || {}, o); }
    out.settings = s;
  }
  if (!Object.keys(out).length) return { error: "Nothing to change" };
  out.updated_by = actor; out.updated_at = new Date().toISOString(); out.version = (cur.version || 0) + 1;
  const r = cur._default ? await B.sb("voice_agent_config", { method: "POST", prefer: "return=representation", body: Object.assign({ org_id: orgId }, out) }) : await B.sb("voice_agent_config?org_id=eq." + orgId, { method: "PATCH", prefer: "return=representation", body: out });
  if (!r.ok) return { error: "Could not save" };
  await V.audit(orgId, actor, "voice_config_changed", Object.keys(out).filter(function (k) { return k !== "updated_at" && k !== "version"; }).join(","), { emergency_stop: cur.emergency_stop, recording_enabled: cur.recording_enabled, outbound_enabled: cur.outbound_enabled }, out);
  return { ok: true, config: rows(r)[0] };
}
const PROFILE_NUM = ["max_payload_lb", "interior_l_in", "interior_w_in", "interior_h_in", "door_w_in", "door_h_in"];
async function saveProfile(orgId, p, actor) {
  const out = {}; const name = clip(p.name, 100); if (!p.id && !name) return { error: "Name the vehicle" }; if (name) out.name = name;
  for (const k of PROFILE_NUM) if (p[k] !== undefined) { const n = Number(p[k]); if (!(n > 0) || n > 100000) return { error: k + " must be a positive number" }; out[k] = k === "max_payload_lb" ? Math.floor(n) : n; }
  if (!p.id && !out.max_payload_lb) return { error: "Maximum payload is required" };
  if (p.equipment !== undefined) { const e = {}; ["dock_height", "liftgate", "pallet_jack", "crew_loads", "blankets", "e_track", "load_bars"].forEach(function (k) { e[k] = !!(p.equipment && p.equipment[k]); }); out.equipment = e; }
  if (p.service_area) { const s = Array.isArray(p.service_area.states) ? p.service_area.states.map(function (x) { return String(x).toUpperCase(); }).filter(function (x) { return /^[A-Z]{2}$/.test(x); }) : null; if (!s || !s.length) return { error: "Service area needs state codes" }; out.service_area = { states: s }; }
  if (p.interstate_authorized !== undefined) out.interstate_authorized = p.interstate_authorized === true;
  if (p.kind !== undefined) out.kind = p.kind === "contractor" ? "contractor" : "company";
  if (p.fleet_vehicle_id !== undefined) out.fleet_vehicle_id = clip(p.fleet_vehicle_id, 60) || null;
  // Any change to what the truck can do needs a fresh sign-off, so a profile never stays "verified" after its numbers move.
  out.authorized = false; out.verified_by = null; out.verified_at = null; out.updated_by = actor; out.updated_at = new Date().toISOString();
  let r;
  if (p.id) { if (!UUID.test(String(p.id))) return { error: "Bad vehicle" }; const cur = rows(await B.sb("voice_vehicle_profiles?org_id=eq." + orgId + "&id=eq." + p.id + "&select=version&limit=1"))[0]; if (!cur) return { error: "Vehicle not found" }; out.version = cur.version + 1; r = await B.sb("voice_vehicle_profiles?org_id=eq." + orgId + "&id=eq." + p.id, { method: "PATCH", prefer: "return=representation", body: out }); }
  else r = await B.sb("voice_vehicle_profiles", { method: "POST", prefer: "return=representation", body: Object.assign({ org_id: orgId, equipment: {}, service_area: { states: ["GA"] } }, out) });
  if (!r.ok) return { error: "Could not save" };
  await V.audit(orgId, actor, "vehicle_profile_changed", name || p.id, null, out);
  return { ok: true, profile: rows(r)[0] };
}
async function authorizeProfile(orgId, id, actor) {
  if (!UUID.test(String(id))) return { error: "Bad vehicle" };
  const r = await B.sb("voice_vehicle_profiles?org_id=eq." + orgId + "&id=eq." + id, { method: "PATCH", prefer: "return=representation", body: { authorized: true, verified_by: actor, verified_at: new Date().toISOString() } });
  if (!rows(r).length) return { error: "Vehicle not found" }; await V.audit(orgId, actor, "vehicle_authorized", id, null, { authorized: true }); return { ok: true };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  const tok = A.verify(A.bearer(event)); if (!tok) return B.J(401, { error: "Sign in first" });
  if (tooMany("u:" + tok.uid, 120)) return B.J(429, { error: "Slow down" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return bad("Bad request"); }
  const act = String(b.action || ""); let orgId = tok.orgId;
  if (tok.platform) { orgId = b.org_id ? String(b.org_id) : null; }
  if (!orgId || !UUID.test(orgId)) return bad("Pick a company");
  const actor = tok.uid, st = await V.standing(orgId);
  if (!st.ok) return B.J(404, { error: "Company not found" });
  const owner = A.can(tok, "owner"), op = A.can(tok, "operate");
  const need = function (ok, m) { return ok ? null : B.J(403, { error: m || "Not allowed for your role" }); };
  try {
    // ── reads ──
    if (act === "dashboard") { const to = iso(b.to, new Date(Date.now() + 864e5).toISOString()), from = iso(b.from, new Date(Date.now() - 30 * 864e5).toISOString()); return B.J(200, await dashboard(orgId, from, to)); }
    if (act === "calls") {
      let path = "voice_sessions?org_id=eq." + orgId + "&test_mode=eq.false&select=id,from_number,state,outcome,seconds,started_at,summary,direction&order=started_at.desc&limit=" + Math.min(200, Number(b.limit) || 50);
      if (b.outcome) path += "&outcome=eq." + encodeURIComponent(clip(b.outcome, 30)); if (b.from) path += "&started_at=gte." + encodeURIComponent(iso(b.from, "1970-01-01T00:00:00Z")); if (b.to) path += "&started_at=lt." + encodeURIComponent(iso(b.to, "2100-01-01T00:00:00Z"));
      let list = rows(await B.sb(path)); const qq = clip(b.q, 60).toLowerCase(); if (qq) list = list.filter(function (s) { return String(s.from_number || "").indexOf(qq.replace(/\D/g, "") || "~") >= 0 || String(s.summary || "").toLowerCase().indexOf(qq) >= 0; });
      return B.J(200, { calls: list });
    }
    if (act === "call") {
      if (!UUID.test(String(b.id))) return bad("Bad call"); const s = await S.session(orgId, b.id); if (!s) return B.J(404, { error: "Call not found" });
      const tr = rows(await B.sb("voice_transcripts?org_id=eq." + orgId + "&session_id=eq." + s.id + "&select=seq,role,text,created_at&order=seq.asc&limit=1000"));
      await V.audit(orgId, actor, "transcript_viewed", s.id, null, null);
      return B.J(200, { call: s, transcript: st.entitlements.transcripts ? tr : [], tools: rows(await B.sb("voice_tool_executions?org_id=eq." + orgId + "&session_id=eq." + s.id + "&select=tool,ok,error,ms,created_at&order=id.asc&limit=200")), handoffs: rows(await B.sb("voice_handoffs?org_id=eq." + orgId + "&session_id=eq." + s.id + "&select=*")), bookings: rows(await B.sb("voice_bookings?org_id=eq." + orgId + "&session_id=eq." + s.id + "&select=id,reference,status,review_reason,job_id,window_start,window_end")) });
    }
    if (act === "bookings") return B.J(200, { bookings: rows(await B.sb("voice_bookings?org_id=eq." + orgId + "&select=id,reference,status,review_reason,customer_name,customer_phone,window_start,window_end,job_id,created_at,snapshot&order=created_at.desc&limit=100")) });
    if (act === "handoffs") return B.J(200, { handoffs: rows(await B.sb("voice_handoffs?org_id=eq." + orgId + "&select=*&order=requested_at.desc&limit=100")) });
    if (act === "callbacks") return B.J(200, { callbacks: rows(await B.sb("voice_callbacks?org_id=eq." + orgId + "&select=*&order=created_at.desc&limit=100")) });
    if (act === "knowledge") return B.J(200, { docs: rows(await B.sb("voice_knowledge_documents?org_id=eq." + orgId + "&select=*&order=created_at.desc&limit=200")) });
    if (act === "config") { const c = await S.cfgOf(orgId); return B.J(200, { config: c, standing: { tier: st.tier, active: st.active, entitlements: st.entitlements } }); }
    if (act === "profiles") return B.J(200, { profiles: rows(await B.sb("voice_vehicle_profiles?org_id=eq." + orgId + "&select=*&order=updated_at.asc")), defaults: R.DEFAULT_PROFILE });
    if (act === "suppressions") return B.J(200, { suppressions: rows(await B.sb("voice_suppression_records?org_id=eq." + orgId + "&select=*&order=created_at.desc&limit=300")), consent: rows(await B.sb("voice_consent_records?org_id=eq." + orgId + "&select=*&order=created_at.desc&limit=100")) });
    if (act === "campaigns") return B.J(200, { campaigns: rows(await B.sb("voice_campaigns?org_id=eq." + orgId + "&select=*&order=created_at.desc&limit=100")) });
    if (act === "audit") { const r = await B.sb("voice_audit_logs?org_id=eq." + orgId + "&select=*&order=created_at.desc&limit=100"); return B.J(200, { logs: rows(r) }); }
    if (act === "export_calls") { if (st.entitlements.analytics_export !== true) return B.J(403, { error: "Exports are not part of your plan" }); const g = need(owner || op); if (g) return g; const l = rows(await B.sb("voice_sessions?org_id=eq." + orgId + "&test_mode=eq.false&select=started_at,from_number,state,outcome,seconds,summary&order=started_at.desc&limit=5000")); await V.audit(orgId, actor, "calls_exported", String(l.length), null, null); return B.J(200, { rows: l }); }

    // ── day-to-day (owner / dispatch) ──
    if (act === "handoff_set") { const g = need(op); if (g) return g; if (!UUID.test(String(b.id)) || ["accepted", "declined", "callback", "completed"].indexOf(b.status) < 0) return bad("Bad request"); const r = await B.sb("voice_handoffs?org_id=eq." + orgId + "&id=eq." + b.id, { method: "PATCH", prefer: "return=representation", body: { status: b.status, resolved_by: actor, resolved_at: new Date().toISOString() } }); return B.J(rows(r).length ? 200 : 404, { ok: rows(r).length > 0 }); }
    if (act === "callback_done") { const g = need(op); if (g) return g; if (!UUID.test(String(b.id))) return bad("Bad request"); const r = await B.sb("voice_callbacks?org_id=eq." + orgId + "&id=eq." + b.id, { method: "PATCH", prefer: "return=representation", body: { status: b.cancel ? "cancelled" : "done", done_by: actor, done_at: new Date().toISOString() } }); return B.J(rows(r).length ? 200 : 404, { ok: rows(r).length > 0 }); }
    if (act === "booking_confirm") { // a person confirms a pending request: the SAME checks run again; no override
      const g = need(op); if (g) return g; const bk = rows(await B.sb("voice_bookings?org_id=eq." + orgId + "&id=eq." + clip(b.id, 40) + "&select=session_id&limit=1"))[0]; if (!bk) return B.J(404, { error: "Not found" });
      const ses = await S.session(orgId, bk.session_id), cfg = await S.cfgOf(orgId); if (!ses) return B.J(404, { error: "Call record missing" });
      const live = Object.assign({}, ses, { state: "active" }); const r = await T.TOOLS.confirm_eligible_booking({ orgId: orgId, session: live, cfg: cfg }, { booking_id: b.id }); await V.audit(orgId, actor, "booking_confirm_attempt", String(b.id), null, { confirmed: !!r.confirmed, reason: r.reason || r.error }); return B.J(200, r);
    }
    if (act === "booking_cancel") { const g = need(op); if (g) return g; if (!UUID.test(String(b.id))) return bad("Bad request"); const own = rows(await B.sb("voice_bookings?org_id=eq." + orgId + "&id=eq." + b.id + "&select=id&limit=1"))[0]; if (!own) return B.J(404, { error: "Not found" }); const r = await B.rpc("voice_release_booking", { p_booking: b.id, p_reason: clip(b.reason, 200) || "Cancelled by " + actor }); await V.audit(orgId, actor, "booking_cancelled", b.id, null, null); return B.J(200, { ok: !!(r.ok && r.data && r.data.ok) }); }
    if (act === "suppress_add") { const g = need(op); if (g) return g; const p = I.phone(b.phone); if (!p) return bad("Enter a 10-digit US number"); await B.sb("voice_suppression_records", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { org_id: orgId, phone: p, reason: clip(b.reason, 200) || "opt-out", source: "staff:" + actor } }); await B.sb("voice_consent_records", { method: "POST", prefer: "return=minimal", body: { org_id: orgId, phone: p, kind: "call", granted: false, source: "suppression" } }); await B.sb("voice_campaign_contacts?org_id=eq." + orgId + "&phone=eq." + encodeURIComponent(p) + "&status=eq.queued", { method: "PATCH", prefer: "return=minimal", body: { status: "suppressed" } }); return B.J(200, { ok: true }); }
    if (act === "consent_add") { const g = need(op); if (g) return g; const p = I.phone(b.phone); if (!p || ["call", "recording", "sms", "email"].indexOf(b.kind) < 0 || typeof b.granted !== "boolean") return bad("Bad request"); if (b.granted && rows(await B.sb("voice_suppression_records?org_id=eq." + orgId + "&phone=eq." + encodeURIComponent(p) + "&select=id&limit=1")).length) return B.J(409, { error: "This number opted out. Remove it from the opt-out list first (owner)." }); await B.sb("voice_consent_records", { method: "POST", prefer: "return=minimal", body: { org_id: orgId, phone: p, kind: b.kind, granted: b.granted, source: clip(b.source, 120) || "staff:" + actor } }); return B.J(200, { ok: true }); }

    // ── simulator: runs the real tools with no phone and no AI (clearly marked TEST, never counted) ──
    if (act === "sim_start") { const g = need(owner); if (g) return g; const r = await B.sb("voice_sessions", { method: "POST", prefer: "return=representation", body: { org_id: orgId, provider: "sim", provider_call_id: "sim-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8), from_number: I.phone(b.from) || "+15555550100", state: "active", answered_at: new Date().toISOString(), test_mode: true } }); return B.J(r.ok ? 200 : 500, { session: rows(r)[0] }); }
    if (act === "sim_say") { const g = need(owner); if (g) return g; const s = await S.session(orgId, b.session_id); if (!s || !s.test_mode) return B.J(404, { error: "Not a test call" }); await S.transcript(orgId, s.id, b.role === "agent" ? "agent" : "caller", b.text); return B.J(200, { ok: true }); }
    if (act === "sim_tool") { const g = need(owner); if (g) return g; const s = await S.session(orgId, b.session_id); if (!s || !s.test_mode) return B.J(404, { error: "Not a test call" }); const cfg = await S.cfgOf(orgId); return B.J(200, { result: await T.execute({ orgId: orgId, session: s, cfg: cfg }, String(b.name || ""), b.args, "sim-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8)) }); }

    // ── owner only ──
    if (act === "config_set") { const g = need(owner, "Only the owner can change settings"); if (g) return g; const r = await saveConfig(orgId, b.patch || {}, actor, st); return B.J(r.error ? 400 : 200, r); }
    if (act === "profile_save") { const g = need(owner); if (g) return g; const r = await saveProfile(orgId, b.profile || {}, actor); return B.J(r.error ? 400 : 200, r); }
    if (act === "profile_seed_default") { const g = need(owner); if (g) return g; const d = R.DEFAULT_PROFILE; if (rows(await B.sb("voice_vehicle_profiles?org_id=eq." + orgId + "&select=id&limit=1")).length) return B.J(409, { error: "A vehicle already exists" }); const r = await saveProfile(orgId, { name: d.name, max_payload_lb: d.max_payload_lb, interior_l_in: d.interior_l_in, interior_w_in: d.interior_w_in, interior_h_in: d.interior_h_in, door_w_in: d.door_w_in, door_h_in: d.door_h_in, equipment: d.equipment, service_area: d.service_area }, actor); return B.J(r.error ? 400 : 200, r); }
    if (act === "profile_authorize") { const g = need(owner); if (g) return g; const r = await authorizeProfile(orgId, b.id, actor); return B.J(r.error ? 404 : 200, r); }
    if (act === "profile_active") { const g = need(owner); if (g) return g; if (!UUID.test(String(b.id)) || typeof b.active !== "boolean") return bad("Bad request"); await B.sb("voice_vehicle_profiles?org_id=eq." + orgId + "&id=eq." + b.id, { method: "PATCH", prefer: "return=minimal", body: { active: b.active } }); await V.audit(orgId, actor, "vehicle_active", b.id, null, { active: b.active }); return B.J(200, { ok: true }); }
    if (act === "intake_get") { const c = await S.cfgOf(orgId), a = (c.settings && c.settings.intake) || {}; return B.J(200, { groups: TN.GROUPS.map(function (g) { return { id: g.id, title: g.title, questions: g.q.map(function (x) { return { id: x[0], text: x[1], required: !!x[2] }; }) }; }), answers: a, missing: TN.missing(a), ready: TN.missing(a).length === 0 }); }
    if (act === "intake_save") { const g = need(owner, "Only the owner can change these answers"); if (g) return g; const r = await saveConfig(orgId, { settings: { intake: b.answers || {} } }, actor, st); if (r.error) return B.J(400, r); const a = TN.sanitize(b.answers || {}); return B.J(200, { ok: true, missing: TN.missing(a), ready: TN.missing(a).length === 0 }); }
    if (act === "kb_save") { const g = need(owner); if (g) return g; const cat = clip(b.category, 30), title = clip(b.title, 120), body = clip(b.body, 4000); if (!cat || !title || !body) return bad("Category, title and text are required"); const ver = b.id ? (rows(await B.sb("voice_knowledge_documents?org_id=eq." + orgId + "&id=eq." + clip(b.id, 40) + "&select=version&limit=1"))[0] || { version: 0 }).version + 1 : 1; const r = await B.sb("voice_knowledge_documents", { method: "POST", prefer: "return=representation", body: { org_id: orgId, category: cat, title: title, body: body, version: ver, status: "draft", effective_from: b.effective_from ? iso(b.effective_from, null) && String(b.effective_from).slice(0, 10) : null, created_by: actor } }); if (b.id && UUID.test(String(b.id))) await B.sb("voice_knowledge_documents?org_id=eq." + orgId + "&id=eq." + b.id + "&status=eq.draft", { method: "PATCH", prefer: "return=minimal", body: { status: "retired" } }); await V.audit(orgId, actor, "kb_saved", title, null, { version: ver }); return B.J(r.ok ? 200 : 500, { ok: r.ok, doc: rows(r)[0] }); }
    if (act === "kb_approve") { const g = need(owner); if (g) return g; if (!UUID.test(String(b.id))) return bad("Bad request"); const doc = rows(await B.sb("voice_knowledge_documents?org_id=eq." + orgId + "&id=eq." + b.id + "&select=category,title&limit=1"))[0]; if (!doc) return B.J(404, { error: "Not found" }); await B.sb("voice_knowledge_documents?org_id=eq." + orgId + "&title=eq." + encodeURIComponent(doc.title) + "&category=eq." + encodeURIComponent(doc.category) + "&status=eq.approved", { method: "PATCH", prefer: "return=minimal", body: { status: "retired" } }); await B.sb("voice_knowledge_documents?org_id=eq." + orgId + "&id=eq." + b.id, { method: "PATCH", prefer: "return=minimal", body: { status: "approved", approved_by: actor, approved_at: new Date().toISOString() } }); await V.audit(orgId, actor, "kb_approved", doc.title, null, null); return B.J(200, { ok: true }); }
    if (act === "kb_retire") { const g = need(owner); if (g) return g; if (!UUID.test(String(b.id))) return bad("Bad request"); await B.sb("voice_knowledge_documents?org_id=eq." + orgId + "&id=eq." + b.id, { method: "PATCH", prefer: "return=minimal", body: { status: "retired" } }); await V.audit(orgId, actor, "kb_retired", b.id, null, null); return B.J(200, { ok: true }); }
    if (act === "suppress_remove") { const g = need(owner); if (g) return g; const p = I.phone(b.phone); if (!p) return bad("Bad number"); await B.sb("voice_suppression_records?org_id=eq." + orgId + "&phone=eq." + encodeURIComponent(p), { method: "DELETE", prefer: "return=minimal" }); await V.audit(orgId, actor, "suppression_removed", p.replace(/\d(?=\d{4})/g, "*"), null, { reason: clip(b.reason, 200) }); return B.J(200, { ok: true }); }
    // campaigns: drafted by staff with outbound in their plan, approved by the owner, and still blocked by every gate in outbound.js at call time
    if (/^campaign_/.test(act)) {
      if (st.entitlements.campaigns !== true) return B.J(403, { error: "Campaigns are not part of your plan" });
      if (act === "campaign_create") { const g = need(op); if (g) return g; const name = clip(b.name, 100); if (!name) return bad("Name the campaign"); const kind = ["callback", "missed_call", "quote_followup", "reminder", "qualification"].indexOf(b.kind) >= 0 ? b.kind : "callback"; const att = Math.min(5, Math.max(1, Number(b.max_attempts) || 2)); const r = await B.sb("voice_campaigns", { method: "POST", prefer: "return=representation", body: { org_id: orgId, name: name, kind: kind, max_attempts: att, status: "draft", created_by: actor } }); return B.J(r.ok ? 200 : 500, { campaign: rows(r)[0] }); }
      const cid = clip(b.id, 40); if (!UUID.test(cid)) return bad("Bad campaign"); const camp = rows(await B.sb("voice_campaigns?org_id=eq." + orgId + "&id=eq." + cid + "&select=*&limit=1"))[0]; if (!camp) return B.J(404, { error: "Not found" });
      if (act === "campaign_contacts") { const g = need(op); if (g) return g; const list = (Array.isArray(b.contacts) ? b.contacts : []).slice(0, 500); let added = 0, skipped = 0; for (const c of list) { const p = I.phone(c.phone); const sup = p && rows(await B.sb("voice_suppression_records?org_id=eq." + orgId + "&phone=eq." + encodeURIComponent(p) + "&select=id&limit=1")).length; if (!p || sup || !clip(c.consent_ref, 160)) { skipped++; continue; } const r = await B.sb("voice_campaign_contacts", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: { campaign_id: camp.id, org_id: orgId, phone: p, name: clip(c.name, 80) || null, consent_ref: clip(c.consent_ref, 160) } }); if (rows(r).length) added++; else skipped++; } return B.J(200, { added: added, skipped: skipped, note: "Contacts without a consent record or on the opt-out list are skipped." }); }
      if (act === "campaign_approve") { const g = need(owner); if (g) return g; await B.sb("voice_campaigns?org_id=eq." + orgId + "&id=eq." + cid, { method: "PATCH", prefer: "return=minimal", body: { status: "approved", approved_by: actor } }); await V.audit(orgId, actor, "campaign_approved", camp.name, null, null); return B.J(200, { ok: true }); }
      if (act === "campaign_state") { const g = need(owner); if (g) return g; const to = ["running", "paused", "stopped"].indexOf(b.status) >= 0 ? b.status : null; if (!to) return bad("Bad state"); if (to === "running" && camp.status !== "approved" && camp.status !== "paused") return B.J(409, { error: "Approve the campaign first" }); await B.sb("voice_campaigns?org_id=eq." + orgId + "&id=eq." + cid, { method: "PATCH", prefer: "return=minimal", body: { status: to } }); await V.audit(orgId, actor, "campaign_" + to, camp.name, null, null); return B.J(200, { ok: true }); }
      if (act === "campaign_check") { const g = need(op); if (g) return g; const cfg = await S.cfgOf(orgId), cs = rows(await B.sb("voice_campaign_contacts?campaign_id=eq." + cid + "&select=*&limit=500")), out = []; for (const c of cs) out.push({ phone: c.phone.replace(/\d(?=\d{4})/g, "*"), blocked_by: await OUT.blockReason(cfg, st, camp, c, Date.now()) || null }); return B.J(200, { contacts: out }); }
    }
    return bad("Unknown action");
  } catch (e) { console.error("voice-api", act, e && e.message); return B.J(500, { error: "Something went wrong" }); }
};
