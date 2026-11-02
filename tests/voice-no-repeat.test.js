"use strict";
// Run: node tests/voice-no-repeat.test.js
// NEVER ASK TWICE (Tony, Nov 2, 2026 — the morning call, session 86ac437e, "super fail"): the callback
// number was locked in and then confirmed AGAIN as a question; the opening freight question repeated
// after the number detour; "is that 500 pounds total or each?" was asked twice back-to-back after the
// caller had already answered "Total". The Nov 1 fix was prompt wording and it did not hold live, so
// these sequences are now enforced in the tool/intake layer and proven here against the real collect
// tool: sticky weight basis, callback read-back emitted at most once, and every collect result naming
// what is already answered (already_have / ask_only / do_not_reask).
process.env.AUTH_SECRET = "t"; process.env.TWILIO_ACCOUNT_SID = "ACtest"; process.env.TWILIO_AUTH_TOKEN = "twtoken"; process.env.TWILIO_SMS_FROM = "+14045550999";
process.env.VOICE_WEBHOOK_URL = "https://hooks.test/voice"; process.env.VOICE_BRIDGE_URL = "wss://voice.test/twilio"; process.env.VOICE_BRIDGE_SECRET = "bridgesecret";
process.env.ROUTING_PROVIDER = "osrm"; process.env.OSRM_URL = "https://osrm.test"; process.env.RESEND_API_KEY = "rk";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); console.log("ok -", m); n++; };
const OA = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const ENT_ALL = { inbound: true, quotes: true, booking: true, handoff: true, callbacks: true, notifications: true, transcripts: true, recording: true, analytics_export: true, custom_knowledge: true, multi_vehicle: true, outbound: true, campaigns: true, contractors: true, api_access: true, priority_support: false };
const plan = (tier, price, inc, ov, conc, mins, ent) => ({ tier, label: "POTENT VOICE " + tier, os_label: "x", price_cents: price, price_is_minimum: tier === "enterprise", included_minutes: inc, overage_enabled: true, overage_cents_per_min: ov, overage_cap_minutes: null, max_concurrent_calls: conc, max_call_minutes: mins, entitlements: ent, active: true, stripe_product_id: null, version: 1 });
const TIERS = [{ max_lb: 1000, key: "small_load_min" }, { max_lb: 2500, key: "partial_load_min" }, { max_lb: 3500, key: "half_truck_min" }, { max_lb: 4999, key: "full_truck_min" }];
const SETTINGS = { id: "default", onetime_min: 175, sameday_min: 225, rush_min: 350, recurring_min: 150, small_load_min: 250, partial_load_min: 225, half_truck_min: 350, full_truck_min: 500, savannah_early: 750, savannah_fullday: 850, additional_stop_fee: 50, wait_detention_hourly: 75, additional_labor_hourly: 75, breakdown_hourly: 100, inside_delivery_min: 100, overnight_hold_nightly: 300, included_pickup_minutes: 30, included_delivery_minutes: 30, quote_expiration_minutes: 30, payload_limit_lbs: 4500, updated_at: "s1" };
const M = require("./_voicemock.js")({
  organizations: [{ id: OA, name: "POTENT Logistics", slug: "potent-logistics", plan: "fleet", owner_email: "owner@potent.test", license_status: "paid" }],
  voice_plans: [plan("fleet", 99900, 3000, 40, 15, 30, ENT_ALL)],
  voice_subscriptions: [{ org_id: OA, tier: "fleet", os_plan: "fleet", status: "internal" }],
  voice_agent_config: [{ org_id: OA, human_available: false, transfer_number: null, settings: { numbers: ["+14045550100"], quote: { size_tiers: TIERS }, driver_check: "required" } }],
  voice_vehicle_profiles: [{ id: "99999999-0000-4000-8000-000000000001", org_id: OA, name: "Box truck", kind: "company", max_payload_lb: 4500, interior_l_in: 190, interior_w_in: 94, interior_h_in: 80, door_w_in: 86.5, door_h_in: 71, equipment: { liftgate: false, pallet_jack: false }, service_area: { states: ["GA"] }, authorized: true, active: true, version: 1, updated_at: "2026-01-01" }],
  b2b_pricing_settings: [SETTINGS]
});
const { T } = M;
const TL = require("../netlify/functions/lib/voice/tools"), S = require("../netlify/functions/lib/voice/store"), I = require("../netlify/functions/lib/voice/intake"), P = require("../netlify/functions/lib/voice/prompt.js");
const days = k => new Date(Date.now() + k * 864e5).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
let sn = 0;
const newSes = () => { const s = { id: "5e5e5e5e-0000-4000-8000-" + String(++sn).padStart(12, "0"), org_id: OA, provider: "twilio", provider_call_id: "CA" + sn, direction: "inbound", from_number: "+14704531616", to_number: "+14045550100", state: "active", intake: {}, test_mode: false, started_at: new Date().toISOString(), answered_at: new Date().toISOString(), confirmed_by_caller: false }; T.voice_sessions.push(s); return s; };
const run = async (s, name, args) => TL.execute({ orgId: s.org_id, session: T.voice_sessions.find(x => x.id === s.id), cfg: await S.cfgOf(s.org_id) }, name, args, "k" + (++sn));
const stored = s => (T.voice_sessions.find(x => x.id === s.id).intake || {});
// Tony's fixture freight, recorded the way the model recorded it on the Nov 2 call: 500 lb on EACH box
// and 500 lb as the total — the exact shape that used to re-open the total-or-each question forever.
const BOXES = { freight_description: "Five boxes of clothing", piece_count: 5, total_weight_lb: 500, pieces: [{ l: 24, w: 24, h: 24, qty: 5, weight_lb: 500 }] };
(async () => {
  // ── (a) callback number: confirmed once, never re-confirmed as a question ──
  let s = newSes();
  let r = await run(s, "collect_shipment_details", { use_caller_id: true });
  ok(r.number_ends_in === "1616" && /I'll use the number you're calling from, ending in 1 6 1 6/.test(r.say || ""), "first caller-id yes: she states the number ONCE, as a fact, digit by digit");
  ok(/not a question/.test(r.say || "") && /Never raise the callback number again/.test(r.say || ""), "the one read-back is framed as a statement, with an explicit never-again instruction");
  r = await run(s, "collect_shipment_details", { use_caller_id: true, freight_description: "boxes" });
  ok(!/I'll use the number you're calling from/.test(r.say || "") && stored(s)._cb_said === true, "second collect with use_caller_id: NO second read-back is emitted — the number is never re-confirmed");
  ok(r.already_have.indexOf("callback_phone") >= 0 && /callback_phone/.test(r.do_not_reask || ""), "the callback number rides in already_have/do_not_reask on every later result");
  const built = P.build({ agent_name: "Elevate" }, { name: "Acme", slug: "acme" });
  ok(/state the last four digits ONCE as a plain fact/.test(built) && !/then say the last four digits to confirm/.test(built), "the prompt's caller-id rule matches the tool: state it once as a fact, never as a confirmation question");

  // ── (b1) freight + weight-with-"total" in ONE answer: the question is never asked at all ──
  s = newSes();
  r = await run(s, "collect_shipment_details", Object.assign({}, BOXES, { weight_basis: "total" }));
  ok(r.problems.indexOf("piece_weights_do_not_match_total") < 0, "weight stated as a total (weight_basis total): the mismatch problem never surfaces");
  ok(!/total for everything, or for each piece/.test(r.say || ""), "…and she is never told to ask total-or-each");
  ok(r.already_have.indexOf("total_weight_lb") >= 0 && /weight_basis \(total\)/.test((r.already_have || []).join(" ")), "the settled basis itself is listed as already-answered");
  const vb = I.validate({ total_weight_lb: 500, pieces: [{ l: 24, w: 24, h: 24, qty: 5, weight_lb: 500 }], _weight_basis: "total" });
  ok(vb.problems.indexOf("piece_weights_do_not_match_total") < 0 && vb.data.pieces.every(p => !p.weight_lb), "intake level: basis 'total' makes the stated total authoritative and drops the contradicting per-piece weights");
  const ve = I.validate({ total_weight_lb: 800, pieces: [{ l: 24, w: 24, h: 24, qty: 2, weight_lb: 800 }], _weight_basis: "each" });
  ok(ve.problems.indexOf("piece_weights_do_not_match_total") < 0 && ve.data.total_weight_lb === 1600, "intake level: basis 'each' makes the per-piece weights authoritative and the total their sum");

  // ── (b2) asked once and answered: never again — even when the model re-sends the same bad shape ──
  s = newSes();
  r = await run(s, "collect_shipment_details", Object.assign({}, BOXES));
  ok(r.problems.indexOf("piece_weights_do_not_match_total") >= 0 && /total for everything, or for each piece/.test(r.say || ""), "no basis recorded yet: the question may be asked — once (the pre-existing ask-once behavior is preserved)");
  ok(/record it with weight_basis/.test(r.say || ""), "the one allowed ask now instructs her to record the answer as weight_basis");
  r = await run(s, "collect_shipment_details", Object.assign({}, BOXES));   // caller answered "Total."; the model re-sends the identical misrecorded shape, exactly as on Nov 2
  ok(r.problems.indexOf("piece_weights_do_not_match_total") < 0, "the caller's answer sticks: the mismatch can never surface a second time");
  ok(/Weight settled: 500 lb is the total for everything/.test(r.say || "") && /never ask it again/.test(r.say || ""), "the server settles it (stated total is authoritative) and tells her the question is closed");
  ok(stored(s)._weight_basis === "total" && (stored(s).pieces || []).every(p => p.weight_lb === undefined), "the stored intake carries the settled basis and the normalized pieces, so later tools see the same settled state");
  r = await run(s, "collect_shipment_details", { pickup_address: "1200 Peachtree Street, Atlanta, GA" });
  ok(r.problems.indexOf("piece_weights_do_not_match_total") < 0 && !/total for everything, or for each piece/.test(r.say || ""), "a later collect in the same call: total-or-each stays closed");

  // ── (c) answered before a tool call: not re-asked after the tool result returns ──
  s = newSes();
  r = await run(s, "collect_shipment_details", { customer_name: "Tony", callback_phone: "4704531616", email: "pprdkt@gmail.com", freight_description: "Five boxes of clothing", piece_count: 5, total_weight_lb: 500, weight_basis: "total", pieces: [{ l: 24, w: 24, h: 24, qty: 5, weight_lb: 500 }], pickup_address: "1200 Peachtree Street, Atlanta, GA", delivery_address: "500 Roswell Street, Marietta, GA", time_window: "evening" });
  ok(r.missing.join(",") === "service_date", "fixture check: only the service date remains open (email is collected here; it is hard-gated at booking, not in collect's missing list)");
  ok(r.ask_only === "service_date" && /starting with service_date/.test(r.do_not_reask || ""), "the result pins the single next question (ask_only) — the service date, the very thing Tony was mid-answer on when the Nov 2 call died");
  r = await run(s, "collect_shipment_details", { service_date: days(1) });
  ok(r.complete === true && r.missing.length === 0, "the date answer completes the intake — nothing re-opens");
  ok(["freight_description", "total_weight_lb", "piece_count", "pickup_address", "delivery_address", "customer_name", "callback_phone", "email", "service_date"].every(k => r.missing.indexOf(k) < 0), "after the tool result returns, nothing already answered re-appears as missing");
  ok(["freight_description", "total_weight_lb", "pickup_address", "delivery_address", "customer_name", "callback_phone", "email"].every(k => r.already_have.indexOf(k) >= 0), "the result names everything already answered (already_have) so the resume continues instead of restarting");
  ok(/NEVER ask about any of those again/.test(r.do_not_reask || ""), "the no-re-ask rule rides in the tool result itself, not only in prompt wording");
  console.log("voice-no-repeat:", n, "assertions passed");
})().catch(e => { console.error(e); process.exit(1); });
