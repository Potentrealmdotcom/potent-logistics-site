// Deterministic quote. All money is integer cents. Numbers come from the company's existing b2b_pricing_settings (dollars) plus the voice add-on settings; the AI only repeats the result.
const intake = require("./intake");
const OS = require("./ospricing");
const cents = function (d) { return Math.round(Number(d) * 100); };
// One-time freight is priced from POTENT's existing price list (see ospricing.js, which a test keeps identical to app.js). per_mile_cents and size_tiers are no longer used.
const DEFAULTS = { included_miles: 25, per_mile_cents: null, tax_bps: 0, deposit_pct: 0, payment_text: null, cost_per_mile_cents: null, min_margin_pct: null, size_tiers: null };
const SIZE_KEYS = ["small_load_min", "partial_load_min", "half_truck_min", "full_truck_min"];
const SPEED_KEY = { standard: "onetime_min", same_day: "sameday_min", rush: "rush_min", recurring: "recurring_min" };

// quote(d, miles, S, cfg, o) -> { ok, needs_review?, reason?, lines, total_cents, ... }
function quote(d, miles, S, cfg, o) {
  o = o || {}; cfg = Object.assign({}, DEFAULTS, cfg || {}); const now = o.now || Date.now(), lines = [], excl = [];
  if (!S) return { ok: false, needs_review: true, reason: "No approved pricing settings were found." };
  const L = function (code, label, c) { if (c > 0) lines.push({ code: code, label: label, cents: c }); };
  const level = d.service_level || "standard";
  if (/^savannah/.test(level)) {
    if (!/savannah/i.test(intake.cityOf(d.delivery_address))) return { ok: false, needs_review: true, reason: "Savannah service applies only to deliveries in Savannah." };
    L(level, level === "savannah_early" ? "Savannah dedicated run, 5 a.m. option" : "Savannah dedicated run, all-day option", cents(level === "savannah_early" ? S.savannah_early : S.savannah_fullday));
  } else if (level === "recurring") {
    return { ok: false, needs_review: true, reason: "Recurring service is priced with quote_special_service (by load size or dedicated route), not this tool." };
  } else {
    // One-time freight = the app's Quote tab: a flat price by distance zone, plus the speed adjustment. No per-mile charge.
    const f = OS.freight(miles, level);
    if (!f) return { ok: false, needs_review: true, reason: "Route distance could not be verified, so a price cannot be given." };
    const floor = cents(S[SPEED_KEY[level]] || S.onetime_min), base = Math.max(cents(f.total), floor);
    L("base", "Freight, " + f.zoneLabel + (f.speedAdj ? ", " + level.replace("_", "-") + " adjustment (" + (f.speedAdj > 0 ? "+" : "-") + "$" + Math.abs(f.speedAdj) + ")" : ""), base);
  }
  L("stops", d.extra_stops + " additional stop(s)", Math.round(d.extra_stops) * cents(S.additional_stop_fee));
  if (d.labor_helpers && d.labor_hours) L("labor", d.labor_helpers + " helper(s) x " + d.labor_hours + " h", Math.round(d.labor_helpers * d.labor_hours * cents(S.additional_labor_hourly)));
  if (d.inside_delivery) L("inside", "Inside delivery (minimum)", cents(S.inside_delivery_min));
  if (d.holding_nights) L("holding", d.holding_nights + " night(s) holding", Math.round(d.holding_nights) * cents(S.overnight_hold_nightly));
  const incl = (Number(S.included_pickup_minutes) || 0) + (Number(S.included_delivery_minutes) || 0);
  if (d.expected_wait_minutes > incl) L("waiting", "Expected waiting beyond " + incl + " min included", Math.round(Math.ceil((d.expected_wait_minutes - incl) / 15) * cents(S.wait_detention_hourly) / 4));
  excl.push("Waiting beyond the included time is billed at $" + Number(S.wait_detention_hourly).toFixed(2) + "/hour.", "Extra labor is $" + Number(S.additional_labor_hourly).toFixed(2) + "/hour per person; breakdown service is $" + Number(S.breakdown_hourly).toFixed(2) + "/hour.", "Changes to the pickup, delivery, freight or access may change the price.");
  let sub = lines.reduce(function (a, l) { return a + l.cents; }, 0);
  // Discounts and overrides only with a named authorizer; the model cannot supply either.
  if (o.discount_cents) { if (!o.authorized_by) return { ok: false, needs_review: true, reason: "A discount needs an authorized person." }; lines.push({ code: "discount", label: "Approved discount (" + o.authorized_by + ")", cents: -Math.min(Math.round(o.discount_cents), sub) }); sub = lines.reduce(function (a, l) { return a + l.cents; }, 0); }
  if (o.override_total_cents != null) { if (!o.authorized_by || !o.override_reason) return { ok: false, needs_review: true, reason: "A price override needs a named authorizer and a reason." }; const diff = Math.round(o.override_total_cents) - sub; lines.push({ code: "override", label: "Authorized override (" + o.authorized_by + "): " + o.override_reason, cents: diff }); sub = Math.round(o.override_total_cents); }
  if (sub <= 0) return { ok: false, needs_review: true, reason: "Quote total is not positive." };
  const tax = Math.round(sub * (cfg.tax_bps || 0) / 10000), total = sub + tax;
  if (!cfg.tax_bps) excl.push("Taxes, if any apply, are not included.");
  if (cfg.cost_per_mile_cents != null && cfg.min_margin_pct != null && miles != null) { const cost = Math.round(miles * cfg.cost_per_mile_cents); if (sub < cost * (1 + cfg.min_margin_pct / 100)) return { ok: false, needs_review: true, reason: "Price is below the minimum margin safeguard." }; }
  return { ok: true, lines: lines, subtotal_cents: sub, tax_cents: tax, total_cents: total, deposit_cents: Math.round(total * (cfg.deposit_pct || 0) / 100), payment_text: cfg.payment_text || "Payment instructions will be sent by dispatch.",
    exclusions: excl, miles: miles, expires_at: new Date(now + (Number(S.quote_expiration_minutes) || 30) * 60000).toISOString(), settings_version: String(S.updated_at || "") };
}
const money = function (c) { return "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
module.exports = { quote, money, DEFAULTS, SIZE_KEYS };
