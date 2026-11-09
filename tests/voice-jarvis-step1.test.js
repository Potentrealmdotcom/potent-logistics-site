// Run: node tests/voice-jarvis-step1.test.js
// JARVIS STEP 1 (Nov 9, 2026) — Tony's ruling: she talks, the worker works behind her; NOTHING
// may run as a check she waits on mid-conversation. Proofs:
// (a) an incomplete packet is ACCEPTED and comes back as plain words to ASK OUT LOUD — never
//     the old packet_incomplete error she silently retried on the graded Nov 9 proof call;
// (b) the same tool may not be retried with identical arguments: an unchanged resubmit is
//     answered from the stored outcome and collect does not run again;
// (c) the price is speakable from the tenant's book BEFORE the packet is complete — the packet
//     files the booking, it does not gate the quote ($400 Potent test total preserved);
// (d) the worker checks completeness BEFORE its exactly-once claim: a shortfall returns
//     needs_details (date problems included) without burning the claim or flagging the owner,
//     and the same session still completes for real once the pieces are in.
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
  voice_agent_config: [{ org_id: OA, human_available: false, transfer_number: null, settings: { numbers: ["+14045550100"], driver_check: "required", price_book: { flat_total_cents: 40000 } } }, { org_id: OB, settings: { numbers: ["+14045550200"], price_book: { flat_total_cents: 62500 } } }],
  voice_vehicle_profiles: [Object.assign({ id: PROFILE_ID, org_id: OA, name: "2022 Ford E350 16-ft Morgan box truck", kind: "company", max_payload_lb: 4500, interior_l_in: 190, interior_w_in: 94, interior_h_in: 80, door_w_in: 86.5, door_h_in: 71, equipment: { dock_height: true, liftgate: false, pallet_jack: false }, service_area: { states: ["GA"] }, authorized: true, active: true, version: 1, updated_at: "2026-01-01" }), Object.assign({ id: "99999999-0000-4000-8000-000000000002", org_id: OB, name: "Bravo truck", kind: "company", max_payload_lb: 4500, interior_l_in: 190, interior_w_in: 94, interior_h_in: 80, door_w_in: 86.5, door_h_in: 71, equipment: {}, service_area: { states: ["GA"] }, authorized: true, active: true, version: 1, updated_at: "2026-01-01" })],
  drivers: [{ id: "d1", org_id: OA, name: "Driver One", status: "active" }, { id: "d2", org_id: OB, name: "Bravo Driver", status: "active" }], b2b_pricing_settings: [SETTINGS] });
const { T } = M;
const TL = require("../netlify/functions/lib/voice/tools"), S = require("../netlify/functions/lib/voice/store"), W = require("../netlify/functions/lib/voice/worker"), P = require("../netlify/functions/lib/voice/prompt.js");
const days = k => new Date(Date.now() + k * 864e5).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const full = (o) => Object.assign({ customer_name: "Pat Lee", callback_phone: "4045550142", pickup_address: "100 Peachtree St NE, Atlanta, GA 30303", delivery_address: "55 Roswell Rd, Marietta, GA 30060", service_date: days(5), time_window: "morning", service_level: "standard", freight_description: "boxes of clothing", piece_count: 4, total_weight_lb: 500, email: "pat@example.com" }, o || {});
const partial = (o) => { const p = full(); delete p.freight_description; delete p.piece_count; delete p.total_weight_lb; return Object.assign(p, o || {}); };   // the Nov 9 shape: addresses + date + name captured, the freight never asked
let sn = 0; const newSes = (org, o) => { const s = Object.assign({ id: "5e5e5e5e-0000-4000-8000-" + String(++sn).padStart(12, "0"), org_id: org || OA, provider: "twilio", provider_call_id: "CA" + sn, direction: "inbound", from_number: "+14045550142", to_number: "+14045550100", state: "active", intake: {}, test_mode: false, started_at: new Date().toISOString(), answered_at: new Date().toISOString(), confirmed_by_caller: false }, o || {}); T.voice_sessions.push(s); return s; };
const sesOf = (s) => T.voice_sessions.find(x => x.id === s.id);
const run = async (s, name, args) => TL.execute({ orgId: s.org_id, session: sesOf(s), cfg: await S.cfgOf(s.org_id) }, name, args, "k" + (++sn) + Math.random());
const say = (s, who, text) => S.transcript(s.org_id, s.id, who, text);
const bookingsOf = (s) => T.voice_bookings.filter(b => b.session_id === s.id);
const quotesOf = (s) => T.voice_quotes.filter(q => q.session_id === s.id);
(async () => {
  // ── (a)+(c) Potent: an incomplete packet is accepted, names the pieces in plain words,
  //    and the $400 book price is speakable BEFORE the packet is complete ──
  const s = newSes();
  let r = await run(s, "submit_job_packet", partial());
  ok(r.ok === true && r.submitted === true && r.accepted === true && !r.error, "incomplete packet is ACCEPTED — no packet_incomplete error (the Nov 9 stall loop's fuel is gone)");
  ok(Array.isArray(r.missing) && r.missing.join(",") === "freight_description,piece_count,total_weight_lb", "the result names exactly the pieces still missing");
  ok(/what you're moving/.test(r.say) && /OUT LOUD/.test(r.say), "the say orders her to ASK for the next piece out loud, in plain words ('what you're moving')");
  ok(/total weight/.test(r.say), "the still-needed list speaks plain words, not field names (the total weight of everything)");
  ok(r.total === "$400.00", "the book price is speakable BEFORE the packet completes: $400.00 (Potent test total preserved)");
  ok(bookingsOf(s).length === 0 && quotesOf(s).length === 0, "an accepted-but-incomplete packet saves no booking and writes no formal quote");

  // ── (b) an identical resubmit is refused as a retry: stored outcome, no re-run ──
  r = await run(s, "submit_job_packet", partial());
  ok(r.ok === true && r.duplicate === true, "the SAME packet submitted again unchanged is a duplicate — answered from the stored outcome");
  ok(/already submitted exactly this packet/.test(r.say) && /OUT LOUD/.test(r.say), "the duplicate answer's marching orders: ask out loud for the next piece, never re-submit");
  ok(r.missing.join(",") === "freight_description,piece_count,total_weight_lb", "the duplicate still names the same missing pieces");
  ok(bookingsOf(s).length === 0 && quotesOf(s).length === 0, "the identical retry created nothing: no booking, no quote, no second save");

  // ── a resubmit carrying a NEW piece is not a retry: it updates the same packet ──
  r = await run(s, "submit_job_packet", partial({ total_weight_lb: 180 }));
  ok(r.ok === true && !r.duplicate && r.accepted === true, "a packet carrying a newly collected piece is accepted (not refused as a retry)");
  ok(r.missing.join(",") === "freight_description,piece_count", "the needs list shrinks to what is actually still missing");

  // ── (d) the worker gates on completeness BEFORE the claim: needs_details, claim unburned ──
  let out = await W.runCompletion({ orgId: s.org_id, session: sesOf(s), cfg: await S.cfgOf(s.org_id) }, {});
  ok(out.ok === true && out.status === "needs_details", "worker_run on a short packet returns needs_details — a conversation outcome, not a failure flag");
  ok(/still needs/.test(out.say_for_agent) && /OUT LOUD/.test(out.say_for_agent), "the worker's note names the pieces and orders the out-loud ask");
  ok(bookingsOf(s).length === 0, "needs_details saved no booking");
  r = await run(s, "submit_job_packet", full());
  ok(r.ok && r.submitted && r.total === "$400.00", "once the pieces are in, the complete packet prices at $400.00 as before");
  await say(s, "caller", "yes, book it");
  out = await W.runCompletion({ orgId: s.org_id, session: sesOf(s), cfg: await S.cfgOf(s.org_id) }, {});
  ok(out.ok && out.status === "confirmed" && out.booking_id, "the SAME session's worker still completes after needs_details (the claim was not burned)");
  ok(bookingsOf(s).length === 1, "exactly ONE booking exists after the whole arc");
  const out2 = await W.runCompletion({ orgId: s.org_id, session: sesOf(s), cfg: await S.cfgOf(s.org_id) }, {});
  ok(out2.ok && out2.already === true, "after the real completion, a repeated worker_run returns the stored outcome");

  // ── (c) tenant book: Bravo's $625 is speakable with pieces still missing ──
  { const sb = newSes(OB);
    const rb = await run(sb, "submit_job_packet", partial());
    ok(rb.ok && rb.accepted && rb.total === "$625.00" && rb.missing.length === 3, "tenant packet: $625.00 from the TENANT's own book, speakable before completion");
  }

  // ── the date check is conversational too: a past date is accepted and handed back as a question ──
  { const sd = newSes();
    const rd = await run(sd, "submit_job_packet", full({ service_date: days(-1) }));
    ok(rd.ok === true && rd.accepted === true && !rd.error, "a packet with a past date is accepted — the date is not a blocking check on her talk path");
    ok((rd.problems || []).includes("service_date_in_the_past") && /in the past/.test(rd.say), "the date problem comes back in plain words: ask which day they actually mean");
    const od = await W.runCompletion({ orgId: sd.org_id, session: sesOf(sd), cfg: await S.cfgOf(sd.org_id) }, {});
    ok(od.ok && od.status === "needs_details" && bookingsOf(sd).length === 0, "the worker's back-office date check answers needs_details into the call — no booking on a past date");
  }

  // ── prompt contract: the hand-off framing is in her instructions ──
  { const prompt = P.build({ agent_name: "Elevate" }, { name: "POTENT Logistics", slug: "potent-logistics" });
    ok(/HAND-OFF, NOT A GATE/.test(prompt) && /NEVER submit the same packet again unchanged/.test(prompt), "prompt: the packet is a hand-off, not a gate; an identical resubmit is forbidden in her own instructions");
    ok(/YOUR TWO SYSTEM STEPS/.test(prompt) && /DETAILS CONFIRM \(required\)/.test(prompt), "prompt: the standing blocks survive (two system steps, details confirm)");
  }
  console.log("\n" + n + " assertions passed — voice-jarvis-step1");
})().catch(e => { console.error("FAIL:", e && e.message); process.exit(1); });
