// Run: node tests/voiceengine.test.js  (POTENT VOICE: intake rules, truck eligibility, deterministic pricing, time windows)
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const I = require("../netlify/functions/lib/voice/intake"), R = require("../netlify/functions/lib/voice/rules"), P = require("../netlify/functions/lib/voice/pricing"), AV = require("../netlify/functions/lib/voice/availability");
const NOW = Date.parse("2026-10-18T15:00:00Z");
const good = () => ({ customer_name: "Pat Lee", callback_phone: "(404) 555-0142", pickup_address: "100 Peachtree St NE, Atlanta, GA 30303", delivery_address: "55 Roswell Rd, Marietta, GA 30060", service_date: "2026-10-22", time_window: "morning", freight_description: "boxed tile", piece_count: 4, total_weight_lb: 3000,
  pieces: [{ l: 48, w: 40, h: 50, qty: 4, weight_lb: 750 }], pickup_dock: true, delivery_dock: true });
const SET = { onetime_min: 175, sameday_min: 225, rush_min: 350, recurring_min: 150, small_load_min: 150, partial_load_min: 225, half_truck_min: 350, full_truck_min: 500, savannah_early: 750, savannah_fullday: 850, additional_stop_fee: 50, wait_detention_hourly: 75, additional_labor_hourly: 75, breakdown_hourly: 100,
  inside_delivery_min: 100, overnight_hold_nightly: 300, included_pickup_minutes: 30, included_delivery_minutes: 30, quote_expiration_minutes: 30, payload_limit_lbs: 4999, updated_at: "v1" };
// ── intake ──
let v = I.validate(good(), NOW); ok(v.ok && v.data.callback_phone === "+14045550142" && v.data.pickup_state === "GA", "complete intake passes and normalizes the phone");
v = I.validate({}, NOW); ok(!v.ok && ["customer_name", "callback_phone", "pickup_address", "delivery_address", "service_date", "time_window", "freight_description", "piece_count", "total_weight_lb", "dimensions", "pickup_dock", "delivery_dock"].every(k => v.missing.includes(k)), "empty intake lists everything missing");
v = I.validate(Object.assign(good(), { pickup_address: "Peachtree" }), NOW); ok(!v.ok && v.problems.some(p => /pickup_address_ambiguous/.test(p)), "address without number is ambiguous");
v = I.validate(Object.assign(good(), { delivery_address: "55 Roswell Rd" }), NOW); ok(v.problems.some(p => /delivery_address_ambiguous/.test(p)), "address without city/state is ambiguous");
v = I.validate(Object.assign(good(), { delivery_address: good().pickup_address }), NOW); ok(v.problems.includes("pickup_and_delivery_are_the_same"), "same pickup and delivery is a conflict");
v = I.validate(Object.assign(good(), { service_date: "2026-10-01" }), NOW); ok(v.problems.includes("service_date_in_the_past"), "past date refused");
v = I.validate(Object.assign(good(), { callback_phone: "555" }), NOW); ok(v.missing.includes("callback_phone"), "bad phone counts as missing");
v = I.validate(Object.assign(good(), { total_weight_lb: 0 }), NOW); ok(v.missing.includes("total_weight_lb"), "missing weight is never defaulted");
v = I.validate(Object.assign(good(), { pieces: [{ l: 48, w: 40, h: 50, qty: 4, weight_lb: 100 }] }), NOW); ok(v.problems.includes("piece_weights_do_not_match_total"), "piece weights that contradict the total are flagged");
v = I.validate(Object.assign(good(), { pickup_dock: undefined }), NOW); ok(v.missing.includes("pickup_dock"), "loading method must be answered");
v = I.validate(Object.assign(good(), { pieces: [{ l: -1, w: 40, h: 50 }] }), NOW); ok(v.problems.includes("a_piece_has_bad_dimensions"), "negative dimension flagged");
ok(I.phone("14045550142") === "+14045550142" && I.phone("0045550142") === null, "phone normalization");
ok(I.stateOf("1 A St, Savannah, GA 31401") === "GA" && I.stateOf("1 A St, Columbia, SC 29201") === "SC" && I.stateOf("nothing") === null, "state extraction");
// ── eligibility (E350 defaults) ──
const el = d => R.evaluate(I.validate(Object.assign(good(), d), NOW).data, R.DEFAULT_PROFILE);
ok(el({}).status === "eligible", "ordinary 3,000 lb shipment is eligible");
ok(el({ total_weight_lb: 4999, pieces: [{ l: 48, w: 40, h: 50, qty: 4, weight_lb: 1249.75 }] }).status === "eligible", "exactly 4,999 lb is allowed");
let e = el({ total_weight_lb: 5000, pieces: [{ l: 48, w: 40, h: 50, qty: 4, weight_lb: 1250 }] }); ok(e.status === "blocked" && e.blocks[0].code === "over_payload", "5,000 lb is blocked");
e = el({ pieces: [{ l: 100, w: 80, h: 75, qty: 1 }], piece_count: 1 }); ok(e.status === "blocked" && e.blocks.some(b => b.code === "too_big_for_door"), "item too tall for the 71 in door is blocked");
e = el({ pieces: [{ l: 200, w: 40, h: 40, qty: 1 }], piece_count: 1 }); ok(e.blocks.some(b => b.code === "too_big_for_interior"), "item longer than the 190 in cargo area is blocked");
e = el({ pieces: [{ l: 96, w: 48, h: 70, qty: 1 }], piece_count: 1 }); ok(e.status === "eligible", "96x48x70 pallet-sized item fits (rotated through the door)");
e = el({ needs_liftgate: true }); ok(e.status === "blocked" && e.blocks.some(b => b.code === "liftgate_required"), "liftgate required: blocked, truck has none");
e = el({ needs_pallet_jack: true }); ok(e.blocks.some(b => b.code === "pallet_jack_required"), "pallet jack required: blocked");
e = el({ needs_pallet_jack: true, site_has_pallet_jack: true }); ok(e.status === "eligible", "site-provided pallet jack is accepted");
e = el({ delivery_address: "9 Main St, Columbia, SC 29201" }); ok(e.status === "blocked" && e.blocks.some(b => b.code === "outside_service_area"), "South Carolina delivery is outside the Georgia area");
e = el({ pickup_dock: false }); ok(e.status === "review" && e.reviews.some(r => r.code === "pickup_not_dock"), "no dock and no forklift needs a person");
e = el({ pickup_dock: false, forklift_pickup: true }); ok(e.status === "eligible", "forklift at a non-dock pickup is fine");
e = el({ hazmat: true }); ok(e.status === "blocked", "hazmat blocked");
e = el({ special_handling: "fragile glass" }); ok(e.status === "review", "special handling goes to a person");
e = R.evaluate({ total_weight_lb: 0, pieces: [], pickup_state: "GA", delivery_state: "GA" }, R.DEFAULT_PROFILE); ok(e.status === "review", "cannot decide -> human review, never eligible");
e = R.evaluate(I.validate(good(), NOW).data, Object.assign({}, R.DEFAULT_PROFILE, { authorized: false })); ok(e.status === "blocked", "unauthorized vehicle blocks everything");
e = R.evaluate(I.validate(good(), NOW).data, Object.assign({}, R.DEFAULT_PROFILE, { kind: "contractor" })); ok(e.blocks.some(b => b.code === "contractor_unverified"), "unverified contractor is never auto-assigned");
e = R.evaluate(I.validate(Object.assign(good(), { delivery_address: "9 Main St, Columbia, SC 29201" }), NOW).data, Object.assign({}, R.DEFAULT_PROFILE, { service_area: { states: ["GA", "SC"] }, interstate_authorized: true })); ok(e.status === "eligible", "an administrator can widen the area and interstate authority");
// ── pricing ──
const D = o => I.validate(Object.assign(good(), o), NOW).data;
const TIERS = [{ max_lb: 1000, key: "small_load_min" }, { max_lb: 2500, key: "partial_load_min" }, { max_lb: 3500, key: "half_truck_min" }, { max_lb: 4999, key: "full_truck_min" }];
const C0 = { size_tiers: TIERS };
let q = P.quote(D({}), 20, SET, {}, { now: NOW }); ok(!q.ok && q.needs_review && /tiers have not been set up/.test(q.reason), "no load-size tiers configured -> goes to a person, no invented price");
q = P.quote(D({}), 20, SET, C0, { now: NOW }); ok(q.ok && q.total_cents === 35000 && q.lines.length === 1 && /half truck/.test(q.lines[0].label), "3,000 lb = half-truck $350 minimum (beats $175 one-time minimum)");
q = P.quote(D({ total_weight_lb: 800, pieces: [{ l: 40, w: 40, h: 40, qty: 4, weight_lb: 200 }] }), 20, SET, C0, { now: NOW }); ok(q.total_cents === 17500, "800 lb: small $150 vs one-time $175 -> $175 (the higher minimum)");
q = P.quote(D({ service_level: "rush", total_weight_lb: 800, pieces: [{ l: 40, w: 40, h: 40, qty: 4, weight_lb: 200 }] }), 20, SET, C0, { now: NOW }); ok(q.total_cents === 35000, "rush delivery starts at $350");
q = P.quote(D({ total_weight_lb: 800, pieces: [{ l: 40, w: 40, h: 40, qty: 4, weight_lb: 200 }], extra_stops: 2, inside_delivery: true }), 20, SET, C0, { now: NOW }); ok(q.total_cents === 17500 + 10000 + 10000, "2 extra stops ($50 each) + inside delivery ($100) added");
q = P.quote(D({ total_weight_lb: 800, pieces: [{ l: 40, w: 40, h: 40, qty: 4, weight_lb: 200 }], labor_helpers: 2, labor_hours: 1.5, holding_nights: 1 }), 20, SET, C0, { now: NOW }); ok(q.total_cents === 17500 + 2 * 1.5 * 7500 + 30000, "labor $75/h/person and holding $300/night");
q = P.quote(D({ total_weight_lb: 800, pieces: [{ l: 40, w: 40, h: 40, qty: 4, weight_lb: 200 }], expected_wait_minutes: 120 }), 20, SET, C0, { now: NOW }); ok(q.total_cents === 17500 + 7500, "120 min wait, 60 included -> 60 min at $75/h");
q = P.quote(D({}), null, SET, C0, { now: NOW }); ok(!q.ok && /distance could not be verified/.test(q.reason), "no verified miles -> no price (never fabricated)");
q = P.quote(D({}), 60, SET, C0, { now: NOW }); ok(!q.ok && /No per-mile rate/.test(q.reason), "trip over the included miles without a rate -> person");
q = P.quote(D({}), 60, SET, { size_tiers: TIERS, per_mile_cents: 200 }, { now: NOW }); ok(q.ok && q.total_cents === 35000 + 35 * 200, "extra distance charged at the configured per-mile rate");
q = P.quote(D({ service_level: "savannah_early", delivery_address: "1 Dock Rd, Savannah, GA 31401" }), null, SET, C0, { now: NOW }); ok(q.ok && q.total_cents === 75000, "Savannah early dedicated = $750");
q = P.quote(D({ service_level: "savannah_full", delivery_address: "1 Dock Rd, Savannah, GA 31401" }), null, SET, C0, { now: NOW }); ok(q.total_cents === 85000, "Savannah all-day dedicated = $850");
q = P.quote(D({ service_level: "savannah_early" }), 20, SET, C0, { now: NOW }); ok(!q.ok, "Savannah price only for Savannah deliveries");
q = P.quote(D({}), 20, SET, C0, { now: NOW, discount_cents: 5000 }); ok(!q.ok && /authorized/.test(q.reason), "a discount with no named authorizer is refused");
q = P.quote(D({}), 20, SET, C0, { now: NOW, discount_cents: 5000, authorized_by: "owner" }); ok(q.ok && q.total_cents === 30000 && q.lines.some(l => l.code === "discount"), "authorized discount is itemized");
q = P.quote(D({}), 20, SET, C0, { now: NOW, override_total_cents: 20000 }); ok(!q.ok, "override needs authorizer and reason");
q = P.quote(D({}), 20, SET, C0, { now: NOW, override_total_cents: 20000, authorized_by: "owner", override_reason: "contract rate" }); ok(q.ok && q.total_cents === 20000 && q.lines.some(l => l.code === "override"), "authorized override is itemized and logged in the quote");
q = P.quote(D({}), 20, SET, Object.assign({ tax_bps: 700, deposit_pct: 25, payment_text: "Pay by card on pickup" }, C0), { now: NOW }); ok(q.tax_cents === 2450 && q.total_cents === 37450 && q.deposit_cents === Math.round(37450 * 0.25) && q.payment_text === "Pay by card on pickup", "tax, deposit and payment text come from configuration");
ok(new Date(q.expires_at).getTime() === NOW + 30 * 60000, "quote valid 30 minutes (existing setting)");
q = P.quote(D({}), 20, SET, Object.assign({ cost_per_mile_cents: 400, min_margin_pct: 30 }, C0), { now: NOW }); ok(q.ok, "margin safeguard passes when price covers cost"); q = P.quote(D({}), 20, SET, Object.assign({ cost_per_mile_cents: 90000, min_margin_pct: 30 }, C0), { now: NOW }); ok(!q.ok && /margin/.test(q.reason), "margin safeguard stops a money-losing price");
q = P.quote(D({}), 20, null, C0, {}); ok(!q.ok && q.needs_review, "no approved pricing -> person");
ok(P.money(35000) === "$350.00" && P.money(123456) === "$1,234.56", "money formatting");
// ── time windows (daylight saving aware) ──
let w = AV.windowFor({ service_date: "2026-10-22", time_window: "early" }); ok(w.start.toISOString() === "2026-10-22T09:00:00.000Z" && w.end.toISOString() === "2026-10-22T14:00:00.000Z", "5 a.m.-10 a.m. Eastern in October (EDT)");
w = AV.windowFor({ service_date: "2026-12-15", time_window: "early" }); ok(w.start.toISOString() === "2026-12-15T10:00:00.000Z", "same window in December (EST)");
w = AV.windowFor({ service_date: "2026-10-22", time_window: "13:30" }, 30); ok(w.start.toISOString() === "2026-10-22T17:30:00.000Z" && w.end - w.start === (30 * 2 + 90) * 60000, "a start time holds the truck for drive there and back plus 90 minutes");
console.log("PASS: " + n + " assertions");
