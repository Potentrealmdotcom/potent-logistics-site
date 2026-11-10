// Run: node tests/voice-demo-once.test.js
// DEMO REPEAT LOOP FIX (Nov 10, 2026) — the Nov 9, 11:52:58 PM proof call, graded from the
// live console record + Proton inbox, on main a0dcfa3f (the read-back gate fix):
// book_demo ran 13×, ALL marked OK, zero errors — saving 13 voice_callbacks rows, sending
// 13 owner alert emails ("OS demo requested: Tony Mendes (Potent Realm)"), while the
// console Bookings tab showed ZERO bookings and she looped "One second — I'm checking
// that for you" 7× after the caller's final yes without ever announcing a result.
// ROOT CAUSE (code, not feel): the a0dcfa3f duplicate guard (_demo_last) keys on
// demoHash() — a fingerprint of the tool ARGUMENTS whose free-text `notes` field the model
// rewords on every retry (and whose phone/trucks fields appear and vanish between
// retries). Live retries are never byte-identical, so the guard missed all 12 repeats and
// the full save + email machinery re-ran every time. Two more defects rode along:
// book_demo persisted ONLY to voice_callbacks (the Bookings tab reads voice_bookings
// alone), and its success result was a non-terminal errand with no done marker and no
// reference, so the model kept re-calling hunting for a finished state.
// THE FIX: (1) a SESSION one-shot — the first success stores its outcome on the intake as
// _demo_done; every later book_demo on that call returns it instantly, arguments
// irrelevant; (2) the demo record also lands in voice_bookings with the worker's own
// idempotency key (session + ":os_demo", ignore-duplicates) — exactly one booking row,
// where the console Bookings tab reads; (3) the success result is terminal: BOOKING DONE,
// reference, what was sent, announce once and close.
process.env.TWILIO_ACCOUNT_SID = "ACtest"; process.env.TWILIO_AUTH_TOKEN = "twtoken"; process.env.TWILIO_SMS_FROM = "+14045550999"; process.env.VOICE_WEBHOOK_URL = "https://hooks.test/voice"; process.env.VOICE_BRIDGE_URL = "wss://voice.test/twilio"; process.env.VOICE_BRIDGE_SECRET = "bridgesecret";
process.env.ROUTING_PROVIDER = "osrm"; process.env.OSRM_URL = "https://osrm.test"; process.env.RESEND_API_KEY = "rk";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); console.log("ok -", m); n++; };
const OA = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa", OC = "cccccccc-3333-4333-8333-cccccccccccc";
const ENT_ALL = { inbound: true, quotes: true, booking: true, handoff: true, callbacks: true, notifications: true, transcripts: true, recording: true, analytics_export: true, custom_knowledge: true, multi_vehicle: true, outbound: true, campaigns: true, contractors: true, api_access: true, priority_support: false };
const plan = (tier, price, inc, ov, conc, mins, ent) => ({ tier, label: "POTENT VOICE " + tier, os_label: "x", price_cents: price, price_is_minimum: tier === "enterprise", included_minutes: inc, overage_enabled: true, overage_cents_per_min: ov, overage_cap_minutes: null, max_concurrent_calls: conc, max_call_minutes: mins, entitlements: ent, active: true, stripe_product_id: null, version: 1 });
const M = require("./_voicemock.js")({
  organizations: [{ id: OA, name: "POTENT Logistics", slug: "potent-logistics", plan: "fleet", owner_email: "owner@potent.test", license_status: "paid" },
    { id: OC, name: "Cutz Salon", slug: "cutz-salon", plan: "fleet", owner_email: "owner@cutz.test", license_status: "paid" }],
  voice_plans: [plan("fleet", 99900, 3000, 40, 15, 30, ENT_ALL)],
  voice_subscriptions: [{ org_id: OA, tier: "fleet", os_plan: "fleet", status: "internal" }, { org_id: OC, tier: "fleet", os_plan: "fleet", status: "active" }],
  voice_agent_config: [{ org_id: OA, settings: { numbers: ["+14045550100"] } }, { org_id: OC, settings: { numbers: ["+14045550300"] } }] });
const { T, EXT } = M;
const TL = require("../netlify/functions/lib/voice/tools"), S = require("../netlify/functions/lib/voice/store"), P = require("../netlify/functions/lib/voice/prompt.js");
const HOLD = /one second|i'm checking that for you|let me check|hang on|still with me|bear with me|just a moment/i;
let sn = 0; const newSes = (org, o) => { const s = Object.assign({ id: "8e8e8e8e-0000-4000-8000-" + String(++sn).padStart(12, "0"), org_id: org || OA, provider: "twilio", provider_call_id: "CE" + sn, direction: "inbound", from_number: "+14704531616", to_number: "+14045550100", state: "active", intake: {}, test_mode: false, started_at: new Date().toISOString(), answered_at: new Date().toISOString(), confirmed_by_caller: false }, o || {}); T.voice_sessions.push(s); return s; };
const sesOf = (s) => T.voice_sessions.find(x => x.id === s.id);
const run = async (s, name, args) => TL.execute({ orgId: s.org_id, session: sesOf(s), cfg: await S.cfgOf(s.org_id) }, name, args, "k" + (++sn) + Math.random());
const say = (s, text) => S.transcript(s.org_id, s.id, "caller", text);
const demoCbs = (s) => T.voice_callbacks.filter(c => c.session_id === s.id && /OS DEMO REQUESTED/.test(c.reason || ""));
const demoBookings = (s) => T.voice_bookings.filter(b => b.session_id === s.id && b.idem_key === s.id + ":os_demo");
const demoExecs = (s) => T.voice_tool_executions.filter(e => e.session_id === s.id && e.tool === "book_demo");
const ownerAlerts = () => EXT.mail.filter(m => JSON.stringify(m.to).includes("owner@potent.test") && /OS demo requested/.test(m.subject || ""));
const callerMails = (addr) => EXT.mail.filter(m => JSON.stringify(m.to).includes(addr) && /demo/i.test(m.subject || ""));
(async () => {
  // ── (A) REPLAY of the Nov 9, 11:52 PM call: read-back yes → ok → 12 VARIED retries ──
  { const s = newSes(); EXT.mail.length = 0;
    await say(s, "This call may be recorded for quality and training purposes");
    await say(s, "I'd like a demo of POTENT OS");
    await say(s, "Tony Mendes");
    await say(s, "Potent Realm");
    await say(s, "Twelve trucks");
    await say(s, "pprdkt@gmail.com");
    await say(s, "P as in Peter, P as in Peter, R as in Romeo, D as in Delta, K as in Kilo, T as in Tango");
    await say(s, "Yes");                                            // email read-back confirmed
    await say(s, "Thursday at 10 in the morning");
    await say(s, "Yes, that's correct");                            // full request read-back confirmed
    const base = { name: "Tony Mendes", company: "Potent Realm", trucks: 12, email: "pprdkt@gmail.com", email_confirmed: true, notes: "Demo requested for Thursday, November 12 at 10 AM" };
    const r1 = await run(s, "book_demo", base);
    ok(r1.ok === true && r1.done === true && !r1.error, "A REPLAY: the first book_demo succeeds and its result is TERMINAL (done:true — the live call's ok carried no done marker)");
    ok(!!r1.reference && !!r1.booking_id, "A REPLAY: the result carries the booking reference and id — a finished state she can announce");
    ok(/BOOKING DONE/.test(r1.say) && /emailed the booking link/.test(r1.say) && !HOLD.test(r1.say), "A REPLAY: the announcement text says DONE + what was sent, with no hold line");
    ok(demoBookings(s).length === 1 && demoBookings(s)[0].status === "pending_review" && demoBookings(s)[0].customer_email === "pprdkt@gmail.com", "A REPLAY: exactly ONE demo record in voice_bookings (the store the console Bookings tab reads) — the live call left ZERO there");
    // the 12 retries, each one reworded the way a live model's retries actually are
    const retries = [
      Object.assign({}, base, { notes: "Wants the demo Thursday Nov 12, 10:00 in the morning" }),
      Object.assign({}, base, { name: "TONY MENDES", company: "POTENT REALM", notes: "Demo for Thursday at 10 AM" }),
      Object.assign({}, base, { notes: "Caller confirmed demo, Thursday 10:00 AM, 12 trucks" }),
      Object.assign({}, base, { phone: "+1 (470) 453-1616", notes: "OS demo — Thu, November 12th at 10 in the morning" }),
      Object.assign({}, base, { phone: "4704531616", notes: "Demo requested for Thursday, November 12 at 10 AM" }),
      Object.assign({}, base, { notes: "He runs twelve trucks and wants to see POTENT OS; demo Thu 10 AM" }),
      { email: "pprdkt@gmail.com", email_confirmed: true, name: "Tony Mendes", company: "Potent Realm", trucks: 12, notes: "field order shuffled, same demo, Thursday 10:00" },
      Object.assign({}, base, { email: "PPRDKT@GMAIL.COM", notes: "Demo requested for Thursday, November 12 at 10 AM" }),
      Object.assign({}, base, { notes: "Retrying the demo booking for Tony at Potent Realm" }),
      { name: "Tony Mendes", company: "Potent Realm", trucks: 12, email: "pprdkt@gmail.com", notes: "no confirmation flag this time — the one-shot must still answer from the stored outcome" },
      Object.assign({}, base, { trucks: 12, notes: "Demo Thu Nov 12 10 AM — final retry" }),
      Object.assign({}, base, { notes: "Demo requested for Thursday, November 12 at 10 AM" })
    ];
    for (let i = 0; i < retries.length; i++) {
      const rr = await run(s, "book_demo", retries[i]);
      ok(rr.ok === true && rr.duplicate === true && rr.already_booked === true && rr.reference === r1.reference && rr.booking_id === r1.booking_id, "A REPLAY: retry #" + (i + 2) + " (varied args) returns the STORED first result — same reference, no new save");
    }
    ok(demoExecs(s).length === 13 && demoExecs(s).filter(e => e.error).length === 0, "A REPLAY: book_demo executed 13× like the live call — and unlike the live call, only the first one did any work");
    ok(demoCbs(s).length === 1, "A REPLAY: exactly ONE voice_callbacks demo record after 13 calls (the live call saved 13)");
    ok(demoBookings(s).length === 1, "A REPLAY: exactly ONE voice_bookings demo record after 13 calls");
    ok(ownerAlerts().length === 1, "A REPLAY: exactly ONE owner alert email after 13 calls (the live call sent 13)");
    ok(callerMails("pprdkt@gmail.com").length === 1, "A REPLAY: exactly ONE booking-link email to the caller after 13 calls");
  }
  // ── (B) NEGATIVE REPLAY (carried from the stall fix): unconfirmed email saves nothing ──
  { const s = newSes(); EXT.mail.length = 0;
    const a1 = { name: "Sam", company: "Sam's Trucks", trucks: 5, email: "sam@trucks.com", notes: "demo" };
    let r = await run(s, "book_demo", a1);
    ok(!r.ok && r.error === "read_back_required", "B NEGATIVE: unconfirmed email → read_back_required, once");
    r = await run(s, "book_demo", a1);
    ok(!r.ok && r.duplicate === true && r.error === "duplicate_call", "B NEGATIVE: the identical unconfirmed repeat is refused server-side — the gate does not re-run");
    ok(demoCbs(s).length === 0 && demoBookings(s).length === 0 && callerMails("sam@trucks.com").length === 0 && ownerAlerts().length === 0, "B NEGATIVE: nothing saved in either store, nothing emailed — an unconfirmed address is never used");
    // and a success in this session still works exactly once (the one-shot arms only on success)
    await say(s, "Yes, that's right");
    const r2 = await run(s, "book_demo", Object.assign({}, a1, { email_confirmed: true }));
    const r3 = await run(s, "book_demo", Object.assign({}, a1, { email_confirmed: true, notes: "reworded retry notes" }));
    ok(r2.ok === true && r3.ok === true && r3.duplicate === true && demoBookings(s).length === 1 && demoCbs(s).length === 1, "B NEGATIVE: after the caller confirms, the demo saves exactly once and a reworded retry is answered from the stored outcome");
  }
  // ── (C) the one-shot is keyed on the SESSION — a different call books its own demo ──
  { const s2 = newSes(); EXT.mail.length = 0;
    const r = await run(s2, "book_demo", { name: "Jo", company: "Jo's Fleet", trucks: 4, email: "jo@fleet.com", email_confirmed: true, notes: "demo" });
    sesOf(s2).intake._email_candidate = "jo@fleet.com";
    ok(r.ok === true || demoBookings(s2).length === 1, "C: a fresh session is not blocked by another session's booking");
    ok(demoBookings(s2).length === 1 && demoBookings(s2)[0].customer_email === "jo@fleet.com", "C: the second session's demo lands as its OWN single booking record");
  }
  // ── (D) prompt contract: announce once, never re-call ──
  { const bP = P.build({ agent_name: "Elevate" }, { name: "POTENT Logistics", slug: "potent-logistics" });
    ok(/announce the result ONCE/.test(bP) && /never call book_demo again on that call for any reason/.test(bP), "D: Potent's demo contract now says announce ONCE and never call book_demo again on that call");
    ok(/call book_demo ONCE/.test(bP) && /never tell the caller the demo is set up unless the tool returned ok/.test(bP), "D: the a0dcfa3f demo contract lines survive intact");
    const bT = P.build({ agent_name: "Elevate" }, { name: "Cutz Salon", slug: "cutz-salon" });
    ok(!/DEMO BOOKING/.test(bT), "D: a tenant's instructions carry none of it — the contract stays Potent-gated");
  }
  console.log("\n" + n + " assertions passed — voice-demo-once (Nov 9 11:52 PM demo repeat loop: 13 ok calls → 1 record, 1 booking, 1 email)");
})().catch(e => { console.error("FAIL:", e && e.message); process.exit(1); });
