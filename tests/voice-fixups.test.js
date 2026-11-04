"use strict";
// Run: node tests/voice-fixups.test.js
// THE NOV 4, 2026 ANNOUNCEMENT DEFECT BUNDLE — enforcement proofs at the tool layer:
//  (1) a geocoder-verified address LOCKS: fragmentary replacements are ignored, the same address
//      re-sent in any dress changes nothing and can no longer void a live quote, while a genuine
//      caller change still goes through (the Oct 28 "changed address voids the quote" contract);
//  (2) an address the caller states twice in a form the format rule dislikes is accepted AS
//      STATED — the format problem can never be raised a third time (the ask-forever loop);
//  (3) a spelled email assembled by the system (email-capture.js, fed from caller transcript
//      lines) is ground truth and outranks the address the model formed by ear;
//  (4) end_call kind caller_done records caller_requested_end and sends NO abusive-caller alarm;
//  (5) the booking reference is announced ONCE, in spaced spoken form, at confirmation — a
//      duplicate confirm does not re-announce it;
//  (6) the §3.9 build-privacy line is in the prompt for every company, not just Potent.
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
  drivers: [{ id: "d1", org_id: OA, name: "Driver One", status: "active" }],
  b2b_pricing_settings: [SETTINGS]
});
const { T, EXT } = M;
const TL = require("../netlify/functions/lib/voice/tools"), S = require("../netlify/functions/lib/voice/store"), P = require("../netlify/functions/lib/voice/prompt.js");
const days = k => new Date(Date.now() + k * 864e5).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const DATE = days(5);
const full = (o) => Object.assign({ customer_name: "Pat Lee", callback_phone: "4045550142", pickup_address: "100 Peachtree St NE, Atlanta, GA 30303", delivery_address: "55 Roswell Rd, Marietta, GA 30060", service_date: DATE, time_window: "morning", service_level: "standard", freight_description: "boxed tile", piece_count: 4, total_weight_lb: 3000, pieces: [{ l: 48, w: 40, h: 50, qty: 4, weight_lb: 750 }], pickup_dock: true, delivery_dock: true, email: "pat@example.com" }, o || {});
let sn = 0;
const newSes = () => { const s = { id: "5e5e5e5e-0000-4000-8000-" + String(++sn).padStart(12, "0"), org_id: OA, provider: "twilio", provider_call_id: "CA" + sn, direction: "inbound", from_number: "+14045550142", to_number: "+14045550100", state: "active", intake: {}, test_mode: false, started_at: new Date().toISOString(), answered_at: new Date().toISOString(), confirmed_by_caller: false }; T.voice_sessions.push(s); return s; };
const run = async (s, name, args) => TL.execute({ orgId: s.org_id, session: T.voice_sessions.find(x => x.id === s.id), cfg: await S.cfgOf(s.org_id) }, name, args, "k" + (++sn));
const stored = s => (T.voice_sessions.find(x => x.id === s.id).intake || {});
async function toQuote(s, over) { await run(s, "collect_shipment_details", full(over)); const el = await run(s, "validate_shipment_eligibility"); if (el.status !== "eligible") return { el }; const q = await run(s, "calculate_quote"); return { el, q }; }

(async () => {
  // ── (1a) re-sending the SAME details after a quote changes nothing — the quote survives ──
  let s = newSes(); let out = await toQuote(s); ok(out.q && out.q.ok, "fixture: quote built ($400 test total untouched)");
  let r = await run(s, "collect_shipment_details", full());
  ok(!r.reset && stored(s)._quote && stored(s)._elig, "model re-sends the identical details (its habit): NO reset — the quote and checks stand");
  r = await run(s, "collect_shipment_details", { delivery_address: "55 Roswell Road, Marietta, Georgia" });
  ok(!r.reset && stored(s)._quote && stored(s).delivery_address === "55 Roswell Rd, Marietta, GA 30060", "the same address in different dress (Road/Georgia spelled out): kept as recorded, quote still stands");

  // ── (1b) a verified address is locked against fragments, open to a genuine change ──
  ok(stored(s)._addr_lock && stored(s)._addr_lock.delivery, "fixture: eligibility recorded the delivery lock");
  r = await run(s, "collect_shipment_details", { delivery_address: "Roswell Rd" });
  ok((r.locked || []).indexOf("delivery_address") >= 0 && stored(s).delivery_address === "55 Roswell Rd, Marietta, GA 30060" && stored(s)._quote, "a fragmentary replacement for the verified address is IGNORED — recorded address and quote untouched");
  r = await run(s, "collect_shipment_details", { delivery_address: "77 Cobb Pkwy, Marietta, GA 30060" });
  ok(r.reset && !stored(s)._quote && stored(s).delivery_address === "77 Cobb Pkwy, Marietta, GA 30060", "a complete new address still goes through and voids the old quote (the mid-call change contract holds)");

  // ── (2) format cap: the same as-stated address can only fail the format check twice ──
  s = newSes();
  r = await run(s, "collect_shipment_details", full({ delivery_address: "Roswell Rd, Marietta, GA" }));
  ok((r.problems || []).some(p => /delivery_address_ambiguous/.test(p)), "first collect: the number-less address is flagged ambiguous");
  r = await run(s, "collect_shipment_details", full({ delivery_address: "Roswell Rd, Marietta, GA" }));
  ok(!(r.problems || []).some(p => /delivery_address_ambiguous/.test(p)) && stored(s)._addr_as_stated && stored(s)._addr_as_stated.delivery === true, "second identical collect: accepted AS STATED — the format problem can never be raised again, so she can never ask a third time");

  // ── (3) spelled candidate outranks the model's by-ear address ──
  s = newSes();
  T.voice_sessions.find(x => x.id === s.id).intake = { _email_candidate: "pprdkt@gmail.com" };
  r = await run(s, "collect_shipment_details", full({ email: "pprdkt@gmal.com" }));
  ok(r.email_spelled === "pprdkt@gmail.com" && stored(s).email === "pprdkt@gmail.com", "the system-assembled spelled email replaces the model's mis-heard one");
  ok(/p p r d k t at gmail dot com/.test(r.say || ""), "the result hands her the grouped read-back form of the spelled address");

  // ── (4) caller_done: the polite ending gets its own outcome and NO alarm ──
  s = newSes(); EXT.mail.length = 0;
  r = await run(s, "end_call", { kind: "caller_done", reason: "caller said goodbye" });
  ok(r.ok && r.end_call === true, "caller_done ends the call");
  ok(T.voice_sessions.find(x => x.id === s.id).outcome === "caller_requested_end", "the outcome is caller_requested_end — not ended_abuse");
  ok(!EXT.mail.some(m => /abusive/i.test((m.subject || "") + (m.text || ""))), "no abusive-caller alarm email for a polite goodbye");
  s = newSes(); EXT.mail.length = 0;
  r = await run(s, "end_call", { kind: "abuse", reason: "caller kept swearing after a warning" });
  ok(T.voice_sessions.find(x => x.id === s.id).outcome === "ended_abuse" && EXT.mail.some(m => /abusive/i.test((m.subject || "") + (m.text || ""))), "contrast: real abuse still records ended_abuse and still alarms the owner");

  // ── (5) the reference is spoken once, grouped — never re-announced ──
  s = newSes(); out = await toQuote(s); ok(out.q && out.q.ok, "fixture: second quote built");
  r = await run(s, "check_live_availability"); ok(r.ok && r.available === true, "fixture: availability checked (create_pending requires it first)");
  await S.transcript(s.org_id, s.id, "caller", "yes, go ahead and book it");
  r = await run(s, "create_pending_booking"); ok(r.ok && r.booking_id, "fixture: pending booking created"); const BID = r.booking_id;
  r = await run(s, "confirm_eligible_booking", { booking_id: BID });
  ok(r.ok && r.confirmed && /^PV-/.test(r.reference), "booking confirmed");
  ok(typeof r.reference_spoken === "string" && r.reference_spoken !== r.reference && r.reference_spoken.indexOf(r.reference) < 0 && /, /.test(r.reference_spoken), "the spoken form is the reference re-rendered in spaced groups, not the raw blob");
  ok(stored(s)._ref_announced === r.reference, "the announcement is recorded on the intake");
  r = await run(s, "confirm_eligible_booking", { booking_id: BID });
  ok(r.confirmed && !r.reference_spoken && /already given/.test(r.say || ""), "a second confirm does NOT re-announce the reference — she is told it was already given");

  // ── (6) §3.9: the build-privacy line is unconditional ──
  const builtOther = P.build({ agent_name: "Elevate" }, { name: "Bravo Haul", slug: "bravo" });
  ok(/keep the details of how I'm built private/.test(builtOther) && /No tech specs, no model names/.test(builtOther), "prompt: the what-do-you-run-on answer is present for a non-Potent company too");
  const builtPotent = P.build({ agent_name: "Elevate" }, { name: "POTENT Logistics", slug: "potent-logistics" });
  ok(/job reference is given ONCE/.test(builtPotent) && /end_call with kind caller_done/.test(builtPotent), "prompt: closing gives the reference once, and a caller goodbye ends the call via caller_done");

  console.log("voice-fixups:", n, "assertions passed");
})().catch(e => { console.error(e); process.exit(1); });
