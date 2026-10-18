// Outbound calling rules. Disabled by default. A call is placed only if EVERY gate below passes; there is no way around them from the model.
const B = require("../beats");
const S = require("./store");
const rows = S.rows;
function inWindow(win, now, tz) {
  const w = win || { start: "09:00", end: "17:00", tz: "America/New_York" }, parts = new Intl.DateTimeFormat("en-US", { timeZone: w.tz || tz || "America/New_York", hourCycle: "h23", hour: "2-digit", minute: "2-digit", weekday: "short" }).formatToParts(new Date(now || Date.now())).reduce(function (o, x) { o[x.type] = x.value; return o; }, {});
  const hm = parts.hour + ":" + parts.minute; if (parts.weekday === "Sun") return false;       // no Sunday calls unless the owner widens it later in code review
  return hm >= w.start && hm < w.end;
}
// Why a call may NOT be placed to this contact right now ("" when it may).
async function blockReason(cfg, standing, campaign, contact, now) {
  if (!standing.active || standing.entitlements.outbound !== true || standing.entitlements.campaigns !== true) return "plan_does_not_include_outbound";
  if (cfg.emergency_stop || cfg.ai_enabled === false) return "emergency_stop";
  if (!cfg.outbound_enabled) return "outbound_disabled";
  if (!cfg.outbound_compliance_confirmed) return "compliance_not_confirmed";
  if (campaign.status !== "running") return "campaign_not_running";
  if (!campaign.approved_by) return "campaign_not_approved";
  if (!inWindow(campaign.call_window, now)) return "outside_call_window";
  if (contact.status !== "queued") return "contact_not_queued";
  if (contact.attempts >= campaign.max_attempts) return "attempt_limit";
  if (!contact.consent_ref) return "no_consent_on_record";
  if (rows(await B.sb("voice_suppression_records?org_id=eq." + contact.org_id + "&phone=eq." + encodeURIComponent(contact.phone) + "&select=id&limit=1")).length) return "suppressed";
  const c = rows(await B.sb("voice_consent_records?org_id=eq." + contact.org_id + "&phone=eq." + encodeURIComponent(contact.phone) + "&kind=eq.call&select=granted,created_at&order=created_at.desc&limit=1"))[0];
  if (!c || c.granted !== true) return "no_call_consent";
  if (contact.last_attempt_at && Date.now() - new Date(contact.last_attempt_at).getTime() < 4 * 3600e3) return "too_soon_since_last_attempt";
  return "";
}
module.exports = { blockReason, inWindow };
