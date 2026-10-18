// Database helpers shared by the voice functions. Every query is scoped by org_id.
const B = require("../beats");
const rows = function (r) { return r.ok && Array.isArray(r.data) ? r.data : []; };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_CFG = { agent_name: "POTENT AI Assistant", greeting: null, disclosure: null, voice: "marin", business_hours: {}, transfer_number: null, human_available: false, recording_enabled: false, recording_consent_confirmed: false,
  outbound_enabled: false, outbound_compliance_confirmed: false, emergency_stop: false, ai_enabled: true, max_call_minutes: null, retention_days: 30, spend_alert_cents: null, service_area: { states: ["GA"] }, settings: {} };
async function cfgOf(orgId) { const c = rows(await B.sb("voice_agent_config?org_id=eq." + orgId + "&select=*&limit=1"))[0]; return c ? Object.assign({}, DEFAULT_CFG, c) : Object.assign({}, DEFAULT_CFG, { org_id: orgId, _default: true }); }
async function profileOf(orgId, id) { const q = "voice_vehicle_profiles?org_id=eq." + orgId + "&active=eq.true&authorized=eq.true" + (id ? "&id=eq." + id : "") + "&select=*&order=updated_at.asc&limit=1"; return rows(await B.sb(q))[0] || null; }
async function session(orgId, id) { if (!UUID.test(String(id))) return null; return rows(await B.sb("voice_sessions?org_id=eq." + orgId + "&id=eq." + id + "&select=*&limit=1"))[0] || null; }
async function patchSession(orgId, id, patch) { return B.sb("voice_sessions?org_id=eq." + orgId + "&id=eq." + id, { method: "PATCH", prefer: "return=minimal", body: patch }); }
// True the first time an event key is seen; provider retries and duplicate deliveries return false.
async function firstTime(orgId, sessionId, key, kind, detail) { const r = await B.sb("voice_events", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: { org_id: orgId, session_id: sessionId || null, event_key: String(key).slice(0, 160), kind: kind, detail: detail || null } }); return r.ok && rows(r).length === 1; }
// Keep card numbers, SSNs, security codes and spoken passwords out of stored transcripts.
function redact(t) {
  return String(t || "").slice(0, 2000).replace(/\b(?:\d[ -]?){13,19}\b/g, "[card number removed]").replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, "[SSN removed]")
    .replace(/\b(cvv|cvc|security code)\D{0,12}\d{3,4}\b/gi, "[security code removed]").replace(/\b(password|passcode|pin)\b[^.,;]{0,20}\b(is|was)\b[^.,;]{1,40}/gi, "$1 [removed]");
}
async function transcript(orgId, sessionId, role, text) {
  const clean = redact(text); if (!clean.trim()) return false;
  for (let i = 0; i < 4; i++) {
    const last = rows(await B.sb("voice_transcripts?session_id=eq." + sessionId + "&select=seq&order=seq.desc&limit=1"))[0];
    const r = await B.sb("voice_transcripts", { method: "POST", prefer: "return=minimal", body: { org_id: orgId, session_id: sessionId, seq: (last ? last.seq : 0) + 1, role: role, text: clean } });
    if (r.ok) return true;
  }
  return false;
}
const id4 = function () { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 4; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };
const ymd = function (d) { const x = new Date(d || Date.now()); return String(x.getUTCFullYear()).slice(2) + String(x.getUTCMonth() + 1).padStart(2, "0") + String(x.getUTCDate()).padStart(2, "0"); };
const ref = function (p) { return p + "-" + ymd() + "-" + id4(); };
// Approved rates: a company's own voice pricing if set; otherwise POTENT's own company uses the existing POTENT OS pricing row. Other companies never inherit POTENT's prices.
async function pricingSettings(orgId, cfg) {
  const own = cfg && cfg.settings && cfg.settings.pricing; if (own && typeof own === "object" && Object.keys(own).length) return Object.assign({ updated_at: "company" }, own);
  const o = rows(await B.sb("organizations?id=eq." + orgId + "&select=slug&limit=1"))[0];
  if (!o || o.slug !== (process.env.POTENT_ORG_SLUG || "potent-logistics")) return null;
  return rows(await B.sb("b2b_pricing_settings?id=eq.default&select=*&limit=1"))[0] || null;
}
module.exports = { rows, UUID, DEFAULT_CFG, cfgOf, profileOf, session, patchSession, firstTime, transcript, redact, ref, pricingSettings };
