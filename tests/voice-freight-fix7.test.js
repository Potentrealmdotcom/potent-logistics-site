// Run: node tests/voice-freight-fix7.test.js
// FIX 7 (Nov 11, 2026) — the freight save path gets the demo path's protections.
// Replay modeled on the ACTUAL failed call (Slang/Mumble Call #1, Nov 11, 9:47 AM,
// graded in goals/potent-voice-master-checklist-go-live/hidden_files/slang-call1-grade-2026-11-11.md):
// submit_job_packet fired 33× (one "unknown_service" on "boxes of clothes"), NO booking
// was created, and the auto-saved callback wrote the name as "Tony Mandis" with the
// FIRST-heard freight facts (6 pieces / "spa boxes") instead of the caller's corrected
// values (5 boxes of clothes, 500 lb total) and his spelled name (M-E-N-D-E-S).
// Proofs:
//  (a) unknown_service finishes the packet ONCE: one callback, stored exit outcome,
//      every repeat (identical or re-dressed) returns the stored outcome — the loop
//      that produced 33 executions now produces one callback and no quote, no booking;
//  (b) a completed freight packet is claimed on the session: repeats in any dressing
//      return the stored outcome with zero new quotes; a core-changed packet still
//      updates the same one job (split doctrine preserved), and the worker still
//      completes exactly one booking;
//  (c) the name is bound to the spelled letters on the packet: "Tony Mandis" +
//      M-E-N-D-E-S saves as Tony Mendes on the intake, on the worker's booking, on
//      the graceful-exit callback AND on the end-of-call auto-save;
//  (d) corrected values stand: a correction=true packet replaces the first hearings,
//      and a later packet (or collect) carrying the first-heard values cannot
//      overwrite them — the auto-save carries 5 pieces / boxes of clothes;
//  (e) the claim itself: an overlapping invocation waits and answers from the stored
//      outcome; a claim that is never released answers packet_in_progress, once,
//      with no side effects.
process.env.TWILIO_ACCOUNT_SID = "ACtest"; process.env.TWILIO_AUTH_TOKEN = "twtoken"; process.env.TWILIO_SMS_FROM = "+14045550999"; process.env.VOICE_WEBHOOK_URL = "https://hooks.test/voice"; process.env.VOICE_BRIDGE_URL = "wss://voice.test/twilio"; process.env.VOICE_BRIDGE_SECRET = "bridgesecret";
process.env.ROUTING_PROVIDER = "osrm"; process.env.OSRM_URL = "https://osrm.test"; process.env.RESEND_API_KEY = "rk"; process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); console.log("ok -", m); n++; };
const OA = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const ENT_ALL = { inbound: true, quotes: true, booking: true, handoff: true, callbacks: true, notifications: true, transcripts: true, recording: true, analytics_export: true, custom_knowledge: true, multi_vehicle: true, outbound: true, campaigns: true, contractors: true, api_access: true, priority_support: false };
const plan = (tier, price, inc, ov, conc, mins, ent) => ({ tier, label: "POTENT VOICE " + tier, os_label: "x", price_cents: price, price_is_minimum: tier === "enterprise", included_minutes: inc, overage_enabled: true, overage_cents_per_min: ov, overage_cap_minutes: null, max_concurrent_calls: conc, max_call_minutes: mins, entitlements: ent, active: true, stripe_product_id: null, version: 1 });
const PROFILE_ID = "99999999-0000-4000-8000-000000000001";
const SETTINGS = { id: "default", onetime_min: 175, sameday_min: 225, rush_min: 350, recurring_min: 150, small_load_min: 250, partial_load_min: 225, half_truck_min: 350, full_truck_min: 500, savannah_early: 750, savannah_fullday: 850, additional_stop_fee: 50, wait_detention_hourly: 75, additional_labor_hourly: 75, breakdown_hourly: 100, inside_delivery_min: 100, overnight_hold_nightly: 300, included_pickup_minutes: 30, included_delivery_minutes: 30, quote_expiration_minutes: 30, payload_limit_lbs: 4500, updated_at: "s1" };
const M = require("./_voicemock.js")({
  organizations: [{ id: OA, name: "POTENT Logistics", slug: "potent-logistics", plan: "fleet", owner_email: "owner@potent.test", license_status: "paid" }],
  voice_plans: [plan("fleet", 99900, 3000, 40, 15, 30, ENT_ALL)],
  voice_subscriptions: [{ org_id: OA, tier: "fleet", os_plan: "fleet", status: "internal" }],
  voice_agent_config: [{ org_id: OA, human_available: false, transfer_number: null, settings: { numbers: ["+14045550100"], driver_check: "required", price_book: { flat_total_cents: 40000 } } }],
  voice_vehicle_profiles: [Object.assign({ id: PROFILE_ID, org_id: OA, name: "2022 Ford E350 16-ft Morgan box truck", kind: "company", max_payload_lb: 4500, interior_l_in: 190, interior_w_in: 94, interior_h_in: 80, door_w_in: 86.5, door_h_in: 71, equipment: { dock_height: true, liftgate: false, pallet_jack: false }, service_area: { states: ["GA"] }, authorized: true, active: true, version: 1, updated_at: "2026-01-01" })],
  drivers: [{ id: "d1", org_id: OA, name: "Driver One", status: "active" }], b2b_pricing_settings: [SETTINGS] });
const { T } = M;
const TL = require("../netlify/functions/lib/voice/tools"), S = require("../netlify/functions/lib/voice/store"), W = require("../netlify/functions/lib/voice/worker");
const VT = require("../netlify/functions/voice-tools");
const vt = async (b) => { const r = await VT.handler({ httpMethod: "POST", headers: { authorization: "Bearer bridgesecret" }, body: JSON.stringify(b) }); return { s: r.statusCode, j: JSON.parse(r.body) }; };
const days = k => new Date(Date.now() + k * 864e5).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
let sn = 0; const newSes = (o) => { const s = Object.assign({ id: "9f7f7f7f-0000-4000-8000-" + String(++sn).padStart(12, "0"), org_id: OA, provider: "twilio", provider_call_id: "CF" + sn, direction: "inbound", from_number: "+14704531616", to_number: "+14045550100", state: "active", intake: {}, test_mode: false, started_at: new Date().toISOString(), answered_at: new Date().toISOString(), confirmed_by_caller: false }, o || {}); T.voice_sessions.push(s); return s; };
const sesOf = (s) => T.voice_sessions.find(x => x.id === s.id);
const run = async (s, name, args) => TL.execute({ orgId: s.org_id, session: sesOf(s), cfg: await S.cfgOf(s.org_id) }, name, args, "k" + (++sn) + Math.random());
const say = (s, text) => S.transcript(s.org_id, s.id, "caller", text);
const cbsOf = (s) => T.voice_callbacks.filter(c => c.session_id === s.id);
const quotesOf = (s) => T.voice_quotes.filter(q => q.session_id === s.id);
const bookingsOf = (s) => T.voice_bookings.filter(b => b.session_id === s.id);
// The slang call's job, as the caller actually settled it: Peachtree -> Roswell, tonight
// evening, five boxes of clothes, 500 lb total, name spelled M-E-N-D-E-S.
const slang = (o) => Object.assign({ customer_name: "Tony Mandis", name_spelled_letters: "M-E-N-D-E-S", use_caller_id: true, email: "pprdkt@gmail.com", pickup_address: "1200 Peachtree Street, Atlanta, GA", delivery_address: "500 Roswell Street, Marietta, GA", service_date: days(0), time_window: "evening", freight_description: "boxes of clothes", piece_count: 5, total_weight_lb: 500 }, o || {});
(async () => {
  // ── schema: the packet carries the spelled letters ──
  { const d = TL.defs().find(x => x.name === "submit_job_packet");
    ok(d && d.parameters.properties.name_spelled_letters, "defs: submit_job_packet declares name_spelled_letters (the Fix 6 argument, now on the freight path)");
    ok(/name_spelled_letters/.test(d.description) && /finished ONCE/.test(d.description), "defs: the packet description carries the letters rule and the finish-once rule");
  }
  // ── (a)+(c) REPLAY of the failed call's failure point: a service the book does not hold ──
  { const s = newSes();
    let r = await run(s, "submit_job_packet", slang({ service: "freight_delivery" }));   // the model's classification on the live call: a service id Potent's book does not hold
    ok(!r.ok && r.error === "unknown_service" && r.exit === true && r.callback_saved === true, "REPLAY: the first unknown_service packet finishes gracefully — error shape kept, ONE callback saved, exit stored");
    ok(cbsOf(s).length === 1, "REPLAY: exactly ONE callback exists after the failed packet (the live call's auto-save was the only record, and it was wrong)");
    ok(cbsOf(s)[0].name === "Tony Mendes", "REPLAY: the exit callback's name is built from the spelled letters — Mendes, never Mandis");
    ok(/1200 Peachtree/.test(cbsOf(s)[0].reason) && /500 Roswell/.test(cbsOf(s)[0].reason) && /boxes of clothes/.test(cbsOf(s)[0].reason), "REPLAY: the exit callback carries what she had: both addresses and the freight");
    ok(/close warmly|call them back/i.test(r.say) && /Do NOT submit it again/.test(r.say), "REPLAY: the exit result closes the step in plain words — warm close, no resubmit");
    ok(sesOf(s).intake.customer_name === "Tony Mendes", "REPLAY: the intake name is the letters-built name");
    // the loop itself: 10 more submits, identical and re-dressed — the live call had 33
    for (let i = 0; i < 5; i++) { r = await run(s, "submit_job_packet", slang({ service: "freight_delivery" })); ok(!r.ok && r.error === "unknown_service" && r.duplicate === true, "REPLAY loop " + (i + 1) + ": identical resubmit answered from the stored exit"); }
    r = await run(s, "submit_job_packet", slang({ service: "Freight_Delivery", special_instructions: "please hurry", piece_count: 5 }));
    ok(!r.ok && r.duplicate === true, "REPLAY loop: a re-dressed resubmit (service re-cased, a note added) is still the stored exit");
    r = await run(s, "submit_job_packet", slang({ service: "moving" }));
    ok(!r.ok && r.duplicate === true, "REPLAY loop: even a differently-named unknown service returns the stored exit — the exit is final for the call");
    ok(cbsOf(s).length === 1 && quotesOf(s).length === 0 && bookingsOf(s).length === 0, "REPLAY: after 8 submits the record is still exactly ONE callback — no quote, no booking, no second callback (live call: 33 executions, no booking, wrong auto-save)");
  }
  // ── (b)+(c) the completed freight packet: session one-shot, worker completes once ──
  { const s = newSes();
    let r = await run(s, "submit_job_packet", slang());
    ok(r.ok && r.submitted && r.total === "$400.00", "complete freight packet prices instantly from the book: $400.00");
    ok(sesOf(s).intake.customer_name === "Tony Mendes", "the packet's saved name is built from the spelled letters (the argument said Mandis; the record says Mendes)");
    ok(quotesOf(s).length === 1, "one formal quote written by the completing submit");
    r = await run(s, "submit_job_packet", slang());
    ok(r.ok && r.duplicate === true && quotesOf(s).length === 1, "the completed packet resubmitted identically: stored outcome, no second quote");
    r = await run(s, "submit_job_packet", slang({ customer_name: "TONY MANDIS", special_instructions: "gate code 4", total_dims: { l: 36, w: 24, h: 24 } }));
    ok(r.ok && r.duplicate === true && quotesOf(s).length === 1, "the completed packet resubmitted re-dressed (name re-cased, a note and dims added): SAME core packet — stored outcome, no second quote");
    ok(sesOf(s).intake.customer_name === "Tony Mendes", "the re-dressed resubmit did not drift the saved name");
    r = await run(s, "submit_job_packet", slang({ piece_count: 6 }));
    ok(r.ok && r.submitted && !r.duplicate && r.total === "$400.00", "a core-changed packet (a correction to 6 pieces) still updates the same one job — split doctrine preserved");
    await say(s, "yes, book it");
    const out = await W.runCompletion({ orgId: s.org_id, session: sesOf(s), cfg: await S.cfgOf(s.org_id) }, {});
    ok(out.ok && out.status === "confirmed" && bookingsOf(s).length === 1, "the worker completes exactly ONE booking for the session");
    ok(bookingsOf(s)[0].customer_name === "Tony Mendes", "the booking itself carries the letters-built name");
    ok(bookingsOf(s)[0].snapshot.intake.piece_count === 6, "the booking carries the caller's latest core facts (6 pieces, as last settled)");
  }
  // ── (d) corrected values stand — in the packet, and in the end-of-call auto-save ──
  { const s = newSes();
    let r = await run(s, "submit_job_packet", slang({ customer_name: "Tony Mendes", name_spelled_letters: undefined, piece_count: 6, freight_description: "spa boxes" }));
    ok(r.ok && r.total === "$400.00" && sesOf(s).intake.piece_count === 6, "the first hearings land first (6 pieces / 'spa boxes') — the live call's starting state");
    r = await run(s, "submit_job_packet", slang({ customer_name: "Tony Mendes", correction: true, piece_count: 5, freight_description: "boxes of clothes" }));
    ok(r.ok && sesOf(s).intake.piece_count === 5 && sesOf(s).intake.freight_description === "boxes of clothes", "the caller's correction (correction=true) replaces the first hearings");
    r = await run(s, "submit_job_packet", slang({ customer_name: "Tony Mendes", name_spelled_letters: undefined, piece_count: 6, freight_description: "spa boxes" }));
    ok(sesOf(s).intake.piece_count === 5 && sesOf(s).intake.freight_description === "boxes of clothes", "a later packet carrying the FIRST-heard values cannot overwrite the correction — corrected values stand");
    const rc = await run(s, "collect_shipment_details", { piece_count: 6, freight_description: "spa boxes" });
    ok(Array.isArray(rc.corrected_kept) && rc.corrected_kept.includes("piece_count") && rc.corrected_kept.includes("freight_description") && /CORRECTED VALUES STAND/.test(rc.say || ""), "a direct collect with first-heard values is told, in the result, that the corrected values stand");
    // the caller hangs up with no booking: the safety net auto-saves what the intake holds
    const e = await vt({ action: "end", session_id: s.id, reason: "caller_hangup", seconds: 282 });
    ok(e.j.ok && e.j.auto_callback === true && cbsOf(s).length === 1, "the unfinished call auto-saves exactly one callback");
    ok(cbsOf(s)[0].name === "Tony Mendes", "AUTO-SAVE: the name is Tony Mendes — the letters-bound spelling, not Mandis");
    ok(/5 pieces/.test(cbsOf(s)[0].reason) && /boxes of clothes/.test(cbsOf(s)[0].reason) && !/6 pieces|spa boxes/.test(cbsOf(s)[0].reason), "AUTO-SAVE: the details are the CORRECTED values (5 pieces, boxes of clothes) — the first hearings are gone from the record");
  }
  // ── letters are new state (demoHash doctrine), and bind a drifted string ──
  { const s = newSes();
    let r = await run(s, "submit_job_packet", slang({ customer_name: "Tony Mendes", name_spelled_letters: undefined }));
    ok(r.ok && r.total === "$400.00", "an unlettered complete packet lands");
    r = await run(s, "submit_job_packet", slang({ customer_name: "Tony Mandis" }));
    ok(r.ok && !r.duplicate && sesOf(s).intake.customer_name === "Tony Mendes", "the same packet WITH the spelled letters is new state, runs, and binds the drifted string to Mendes");
  }
  // ── (e) the claim: overlap waits for the stored outcome; an unreleased claim answers once ──
  { const s = newSes();
    const row = sesOf(s); row.intake._packet_claim = { at: new Date().toISOString(), hash: "x", token: "other-execution" };
    setTimeout(() => { const rr = sesOf(s); delete rr.intake._packet_claim; rr.intake._packet_done = { core_fp: "z", total: "$400.00", price_pending: false, say_again: "That job is already in with the back office at $400.00 — do not submit it again and do not restate the price. Ask: shall I book it? On a clear yes, call confirm_job_packet." }; }, 200);
    const r = await run(s, "submit_job_packet", slang());
    ok(r.ok && r.duplicate === true && r.total === "$400.00", "an overlapping submit waits for the claiming execution and answers from its stored outcome");
    ok(quotesOf(s).length === 0 && cbsOf(s).length === 0, "the overlapping submit produced zero side effects of its own");
    const s2 = newSes(); const row2 = sesOf(s2); row2.intake._packet_claim = { at: new Date().toISOString(), hash: "x", token: "stuck-execution" };
    const r2 = await run(s2, "submit_job_packet", slang());
    ok(!r2.ok && r2.error === "packet_in_progress" && r2.duplicate === true, "a claim that never releases answers packet_in_progress — a single honest in-progress result, not a retry loop");
    ok(quotesOf(s2).length === 0 && cbsOf(s2).length === 0 && bookingsOf(s2).length === 0, "the in-progress answer has zero side effects");
  }
  console.log("\n" + n + " assertions passed — voice-freight-fix7 (Fix 7: claim-first one-shot, graceful single exit, letters-bound freight name, corrected values stand)");
})().catch(e => { console.error("FAIL:", e && e.message); process.exit(1); });
