// Live availability: the answer comes from stored records only. If it cannot be proven, the result is "not verified", never "available".
const B = require("../beats");
const rows = function (r) { return r.ok && Array.isArray(r.data) ? r.data : []; };
const TZ = "America/New_York";
const WINDOWS = { early: ["05:00", "10:00"], morning: ["08:00", "12:00"], afternoon: ["12:00", "17:00"], evening: ["17:00", "21:00"], all_day: ["06:00", "20:00"] };
const INACTIVE_JOB = /^(cancel|complet|deliver|draft|void|refus|closed)/i;
// Wall-clock time in an IANA zone -> UTC instant (handles daylight saving).
function zonedToUtc(date, hhmm, tz) {
  const guess = Date.parse(date + "T" + hhmm + ":00Z"); let t = guess;
  for (let i = 0; i < 2; i++) {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: tz || TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(t)).reduce(function (o, x) { o[x.type] = x.value; return o; }, {});
    const shown = Date.parse(p.year + "-" + p.month + "-" + p.day + "T" + p.hour + ":" + p.minute + ":00Z");
    t += guess - shown;
  }
  return new Date(t);
}
// The time span the truck is committed for: the named window, or a specific start plus drive time and a 90-minute load/unload buffer.
function windowFor(d, routeMinutes) {
  const w = d.time_window;
  if (WINDOWS[w]) return { start: zonedToUtc(d.service_date, WINDOWS[w][0]), end: zonedToUtc(d.service_date, WINDOWS[w][1]), label: w };
  const s = zonedToUtc(d.service_date, w), mins = Math.ceil((Number(routeMinutes) || 0) * 2 + 90);       // out and back
  return { start: s, end: new Date(s.getTime() + mins * 60000), label: w };
}
async function check(orgId, profileId, win, cfg) {
  cfg = cfg || {}; const reasons = [], conflicts = [];
  if (!profileId) return { verified: false, available: false, reasons: ["no_vehicle_profile"], conflicts: [] };
  const iso = function (d) { return encodeURIComponent(d.toISOString()); };
  const h = await B.sb("voice_capacity_holds?org_id=eq." + orgId + "&vehicle_profile_id=eq." + profileId + "&status=eq.held&window_start=lt." + iso(win.end) + "&window_end=gt." + iso(win.start) + "&select=id,window_start,window_end&limit=5");
  if (!h.ok) return { verified: false, available: false, reasons: ["capacity_check_failed"], conflicts: [] };
  rows(h).forEach(function (x) { if (new Date(x.window_start) < win.end && new Date(x.window_end) > win.start) conflicts.push({ type: "voice_hold", id: x.id }); });
  const date = win.start.toLocaleDateString("en-CA", { timeZone: TZ });
  const j = await B.sb("jobs?org_id=eq." + orgId + "&date=eq." + date + "&select=id,status,scheduled_time,time_slot&limit=200");
  if (!j.ok) return { verified: false, available: false, reasons: ["jobs_check_failed"], conflicts: conflicts };
  rows(j).filter(function (x) { return !INACTIVE_JOB.test(String(x.status || "")); }).forEach(function (x) {
    if (x.scheduled_time) { const s = new Date(x.scheduled_time).getTime(); if (s - 3 * 36e5 < win.end.getTime() && s + 3 * 36e5 > win.start.getTime()) conflicts.push({ type: "existing_job", id: x.id }); }
    else reasons.push("job_without_time:" + x.id);                         // a job that day with no time: we cannot prove the truck is free
  });
  if ((cfg.settings && cfg.settings.driver_check) !== "owner_operator") {
    const dr = await B.sb("drivers?org_id=eq." + orgId + "&select=id,status&limit=100");
    const active = rows(dr).filter(function (x) { return /^(active|available|on.?duty)$/i.test(String(x.status || "")); });
    if (!dr.ok || !active.length) reasons.push("no_approved_driver_on_file");
  }
  if (conflicts.length) return { verified: true, available: false, reasons: ["conflict"], conflicts: conflicts };
  return { verified: !reasons.length, available: !reasons.length, reasons: reasons, conflicts: [] };
}
module.exports = { check, windowFor, zonedToUtc, WINDOWS };
