// Run: node tests/voice-split.test.js
// TALKER/WORKER SPLIT v1 (Nov 8, 2026) — master list §2I. Proofs:
// (a) one capture produces exactly ONE booking save, even if the model submits/confirms again;
// (b) no window-check / quote-verify / eligibility / save tool is callable from the talk path;
// (c) the worker job completes end to end and the owner report carries the booking.
process.env.TWILIO_ACCOUNT_SID = "ACtest"; process.env.TWILIO_AUTH_TOKEN = "twtoken"; process.env.TWILIO_SMS_FROM = "+14045550999"; process.env.VOICE_WEBHOOK_URL = "https://hooks.test/voice"; process.env.VOICE_BRIDGE_URL = "wss://voice.test/twilio"; process.env.VOICE_BRIDGE_SECRET = "bridgesecret";
process.env.TWILIO_ACCOUNT_SID = "ACtest"; process.env.TWILIO_AUTH_TOKEN = "twtoken"; process.env.TWILIO_SMS_FROM = "+14045550999"; process.env.VOICE_WEBHOOK_URL = "https://hooks.test/voice"; process.env.VOICE_BRIDGE_URL = "wss://voice.test/twilio"; process.env.VOICE_BRIDGE_SECRET = "bridgesecret";
process.env.ROUTING_PROVIDER = "osrm"; process.env.OSRM_URL = "https://osrm.test"; process.env.RESEND_API_KEY = "rk";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); console.log("ok -", m); n++; };
const OA = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa", OB = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const ENT_ALL = { inbound: true, quotes: true, booking: true, handoff: true, callbacks: true, notifications: true, transcripts: true, recording: true, analytics_export: true, custom_knowledge: true, multi_vehicle: true, outbound: true, campaigns: true, contractors: true, api_access: true, priority_support: false };
const ENT_START = { inbound: true, quotes: true, booking: true, handoff: true, callbacks: true, notifications: true, transcripts: true, recording: false, outbound: false, campaigns: false };
const plan = (tier, price, inc, ov, conc, mins, ent) => ({ tier, label: "POTENT VOICE " + tier, os_label: "x", price_cents: price, price_is_minimum: tier === "enterprise", included_minutes: inc, overage_enabled: true, overage_cents_per_min: ov, overage_cap_minutes: null, max_concurrent_calls: conc, max_call_minutes: mins, entitlements: ent, active: true, stripe_product_id: null, version: 1 });
const PROFILE_ID = "99999999-0000-4000-8000-000000000001";
const SETTINGS = { id: "default", onetime_min: 175, sameday_min: 225, rush_min: 350, recurring_min: 150, small_load_min: 250, partial_load_min: 225, half_truck_min: 350, full_truck_min: 500, savannah_early: 750, savannah_fullday: 850, additional_stop_fee: 50, wait_detention_hourly: 75, additional_labor_hourly: 75, breakdown_hourly: 100, inside_delivery_min: 100, overnight_hold_nightly: 300, included_pickup_minutes: 30, included_delivery_minutes: 30, quote_expiration_minutes: 30, payload_limit_lbs: 4500, updated_at: "s1" };
const M = require("./_voicemock.js")({
  organizations: [{ id: OA, name: "POTENT Logistics", slug: "potent-logistics", plan: "fleet", owner_email: "owner@potent.test", license_status: "paid" }, { id: OB, name: "Bravo Haul", slug: "bravo", plan: "starter", owner_email: "b@x.com", license_status: "paid" }],
  voice_plans: [plan("starter", 19900, 300, 50, 2, 15, ENT_START), plan("fleet", 99900, 3000, 40, 15, 30, ENT_ALL)],
  voice_subscriptions: [{ org_id: OA, tier: "fleet", os_plan: "fleet", status: "internal" }, { org_id: OB, tier: "starter", os_plan: "starter", status: "active", current_period_start: null }],
  voice_agent_config: [{ org_id: OA, human_available: false, transfer_number: null, settings: { numbers: ["+14045550100"], driver_check: "required" } }, { org_id: OB, settings: { numbers: ["+14045550200"], price_book: { flat_total_cents: 62500 } } }],
  voice_vehicle_profiles: [Object.assign({ id: PROFILE_ID, org_id: OA, name: "2022 Ford E350 16-ft Morgan box truck", kind: "company", max_payload_lb: 4500, interior_l_in: 190, interior_w_in: 94, interior_h_in: 80, door_w_in: 86.5, door_h_in: 71, equipment: { dock_height: true, liftgate: false, pallet_jack: false }, service_area: { states: ["GA"] }, authorized: true, active: true, version: 1, updated_at: "2026-01-01" }), Object.assign({ id: "99999999-0000-4000-8000-000000000002", org_id: OB, name: "Bravo truck", kind: "company", max_payload_lb: 4500, interior_l_in: 190, interior_w_in: 94, interior_h_in: 80, door_w_in: 86.5, door_h_in: 71, equipment: {}, service_area: { states: ["GA"] }, authorized: true, active: true, version: 1, updated_at: "2026-01-01" })],
  drivers: [{ id: "d1", org_id: OA, name: "Driver One", status: "active" }, { id: "d2", org_id: OB, name: "Bravo Driver", status: "active" }], b2b_pricing_settings: [SETTINGS] });
const { T } = M;
const TL = require("../netlify/functions/lib/voice/tools"), S = require("../netlify/functions/lib/voice/store"), W = require("../netlify/functions/lib/voice/worker"), OR = require("../netlify/functions/lib/voice/owner-report"), P = require("../netlify/functions/lib/voice/prompt.js");
const days = k => new Date(Date.now() + k * 864e5).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const full = (o) => Object.assign({ customer_name: "Pat Lee", callback_phone: "4045550142", pickup_address: "100 Peachtree St NE, Atlanta, GA 30303", delivery_address: "55 Roswell Rd, Marietta, GA 30060", service_date: days(5), time_window: "morning", service_level: "standard", freight_description: "boxes of clothing", piece_count: 4, total_weight_lb: 500, email: "pat@example.com" }, o || {});
let sn = 0; const newSes = (org, o) => { const s = Object.assign({ id: "5e5e5e5e-0000-4000-8000-" + String(++sn).padStart(12, "0"), org_id: org || OA, provider: "twilio", provider_call_id: "CA" + sn, direction: "inbound", from_number: "+14045550142", to_number: "+14045550100", state: "active", intake: {}, test_mode: false, started_at: new Date().toISOString(), answered_at: new Date().toISOString(), confirmed_by_caller: false }, o || {}); T.voice_sessions.push(s); return s; };
const sesOf = (s) => T.voice_sessions.find(x => x.id === s.id);
const run = async (s, name, args) => TL.execute({ orgId: s.org_id, session: sesOf(s), cfg: await S.cfgOf(s.org_id) }, name, args, "k" + (++sn) + Math.random());
const runModel = async (s, name, args) => TL.execute({ orgId: s.org_id, session: sesOf(s), cfg: await S.cfgOf(s.org_id), modelFacing: true }, name, args, "m" + (++sn) + Math.random());
const say = (s, who, text) => S.transcript(s.org_id, s.id, who, text);
const bookingsOf = (s) => T.voice_bookings.filter(b => b.session_id === s.id);
(async () => {
  // ── (b) the talk path cannot call the removed steps ──
  { const names = TL.defs().map(d => d.name);
    const removed = ["collect_shipment_details", "validate_shipment_eligibility", "calculate_quote", "check_live_availability", "create_pending_booking", "confirm_eligible_booking"];
    ok(removed.every(x => !names.includes(x)), "defs() served to the model contains NONE of the six removed talk-path tools");
    ok(names.includes("submit_job_packet") && names.includes("confirm_job_packet"), "defs() carries exactly the two packet tools for shipments");
    const s = newSes();
    let r = await runModel(s, "calculate_quote", {}); ok(r && r.error === "moved_to_worker", "model-facing calculate_quote is refused: moved_to_worker");
    r = await runModel(s, "collect_shipment_details", full()); ok(r && r.error === "moved_to_worker", "model-facing collect_shipment_details is refused: moved_to_worker");
    r = await runModel(s, "create_pending_booking", {}); ok(r && r.error === "moved_to_worker", "model-facing create_pending_booking is refused: moved_to_worker");
    r = await run(s, "collect_shipment_details", full()); ok(r && r.error !== "moved_to_worker", "the worker's internal calls are NOT refused (same implementations, internal flag)");
    const prompt = P.build({ agent_name: "Elevate" }, { name: "POTENT Logistics", slug: "potent-logistics" });
    ok(!removed.some(x => prompt.includes(x)), "the talker prompt never names a removed tool");
    ok(prompt.includes("submit_job_packet") && prompt.includes("confirm_job_packet"), "the talker prompt runs on the two packet steps");
    ok(prompt.includes("I appreciate you bringing that up") && prompt.includes("What would need to happen for this to make sense?"), "the prompt carries the three A's VERBATIM from the Sales Book (Acknowledge / Associate / Ask)");
    const g = P.greeting({ agent_name: "Elevate" }, { name: "POTENT Logistics", slug: "potent-logistics" }, "+14045550142", { first: "Sam" });
    ok(/Welcome back, Sam/.test(g), "known-caller greeting says 'Welcome back, <name>' (restored behaviour, prompt side)");
  }
  // ── (a)+(c) Potent: one packet, one booking, worker completes, report carries it ──
  { const s = newSes();
    let r = await run(s, "submit_job_packet", full());
    ok(r.ok && r.submitted && r.total === "$400.00", "packet submits and prices instantly from the Potent book: $400.00 (test total preserved)");
    r = await run(s, "submit_job_packet", full());
    ok(r.ok && r.duplicate === true && r.total === "$400.00", "the SAME packet submitted again is recognised — duplicate, no second save, same total");
    r = await run(s, "submit_job_packet", full({ piece_count: 5 }));
    ok(r.ok && r.submitted && !r.duplicate, "a CHANGED packet (a correction) is accepted and updates the same one job");
    await run(s, "submit_job_packet", full());   // model tries the original again after the correction: still no new booking machinery
    await say(s, "caller", "yes, book it");
    const jobsBefore = (T.jobs || []).length;
    const out = await W.runCompletion({ orgId: s.org_id, session: sesOf(s), cfg: await S.cfgOf(s.org_id) }, {});
    ok(out.ok && out.status === "confirmed" && out.booking_id, "worker completes the job end to end: booking CONFIRMED");
    ok(bookingsOf(s).length === 1, "exactly ONE booking exists for the session after submit x4 + worker completion");
    ok((T.jobs || []).length === jobsBefore + 1, "exactly ONE job was created");
    const out2 = await W.runCompletion({ orgId: s.org_id, session: sesOf(s), cfg: await S.cfgOf(s.org_id) }, {});
    ok(out2.ok && out2.already === true && out2.booking_id === out.booking_id, "worker_run a second time returns the stored outcome — it does not run again");
    ok(bookingsOf(s).length === 1, "still exactly ONE booking after the repeated worker_run");
    const rep = await OR.buildReport(s.org_id, sesOf(s));
    ok(JSON.stringify(rep).includes(out.reference), "the owner report (full Elevate design path) carries the confirmed booking's reference");
    const pay = await run(s, "take_card_payment", {});
    ok(pay.error !== "bad_booking", "take_card_payment resolves this session's confirmed booking with NO booking_id (split flow)");
    const conf = await run(s, "send_approved_confirmation", { channel: "email", email: "pat@example.com", email_confirmed: true });
    ok(conf.error !== "booking_not_found", "send_approved_confirmation resolves this session's booking with NO booking_id (split flow)");
  }
  // ── (c) tenant book: Bravo Haul flat book $625 ──
  { const s = newSes(OB);
    let r = await run(s, "submit_job_packet", full());
    ok(r.ok && r.submitted && r.total === "$625.00", "tenant packet prices from the TENANT's own book: $625.00");
    await say(s, "caller", "yeah go ahead");
    const out = await W.runCompletion({ orgId: s.org_id, session: sesOf(s), cfg: await S.cfgOf(s.org_id) }, {});
    ok(out.ok && out.status === "confirmed" && bookingsOf(s).length === 1, "tenant worker completion CONFIRMS and saves exactly one booking");
  }
  // ── worker refuses to run without a packet (and does not burn the completion claim) ──
  { const s = newSes();
    const out = await W.runCompletion({ orgId: s.org_id, session: sesOf(s), cfg: await S.cfgOf(s.org_id) }, {});
    ok(!out.ok && out.error === "no_packet", "worker_run with no packet returns no_packet");
    await run(s, "submit_job_packet", full({ service_date: days(6) })); await say(s, "caller", "yes");   // a different day: the first block's confirmed booking honestly holds the days(5) morning slot
    const out2 = await W.runCompletion({ orgId: s.org_id, session: sesOf(s), cfg: await S.cfgOf(s.org_id) }, {});
    ok(out2.ok && out2.status === "confirmed", "after a real packet the same session's worker still completes (claim was not burned)");
  }
  console.log("\n" + n + " assertions passed — voice-split");
})().catch(e => { console.error("FAIL:", e && e.message); process.exit(1); });
