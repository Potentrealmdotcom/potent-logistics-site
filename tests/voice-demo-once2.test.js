// Run: node tests/voice-demo-once2.test.js
// DEMO CLAIM-FIRST FIX (Nov 10, 2026 — Fix 3) — Demo Call #3 (Nov 10, 12:31:39 PM, on the
// Fix 2 build 025e03f), graded from the live console record + Proton inbox:
// book_demo ran 5×, all OK. The booking dedupe HELD (exactly one voice_bookings row) but
// TWO owner alert emails went out, the booking saved with NO date/time (Bookings "When"
// blank, status pending_review), her announcement still claimed "I've emailed the booking
// link so you can pick the time that suits you" (no booking link exists — and she had just
// SET the time in the read-back), the owner email body said "Booking link sent: yes", the
// caller's "Yes, that's correct" appears TWICE in the transcript (turns 21–22), she asked
// "anything else" twice, said goodbye twice, and end_call ran 4×.
// ROOT CAUSE (code, not feel): Fix 2's one-shot stores _demo_done only AFTER the async
// save + email sequence completes, so invocations overlapping that sequence — a
// parallel/duplicate burst — all pass the check before any of them finishes; and the EMAIL
// path (caller confirmation + owner alert) was never claim-protected, only the booking row
// was (by its idempotency key). The demo form also captured no date/time at all.
// THE FIX: (1) CLAIM-FIRST — the first book_demo invocation claims the session
// synchronously (no await between check and claim) and only the claiming execution may
// insert, email or alert; overlapping invocations wait for the claim and answer from the
// stored outcome; a failed claiming save RELEASES the claim so a genuine retry can proceed,
// and never returns a success. (2) demo_when_text — the confirmed read-back time is stored
// where the console reads "When" (snapshot.intake.service_date/time_window + window_start/
// window_end on the row) and printed in the owner alert. (3) TRUTHFUL WORDING — no booking
// link exists and none is claimed anywhere: her announcement and the caller email confirm
// the SET time. (4) end_call gets the same session one-shot.
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
const Bmod = require("../netlify/functions/lib/beats");
const WHEN = "Thursday, November 12th at 10:00 AM";
let sn = 0; const newSes = (org, o) => { const s = Object.assign({ id: "7d7d7d7d-0000-4000-8000-" + String(++sn).padStart(12, "0"), org_id: org || OA, provider: "twilio", provider_call_id: "CF" + sn, direction: "inbound", from_number: "+14704531616", to_number: "+14045550100", state: "active", intake: {}, test_mode: false, started_at: new Date().toISOString(), answered_at: new Date().toISOString(), confirmed_by_caller: false }, o || {}); T.voice_sessions.push(s); return s; };
const sesOf = (s) => T.voice_sessions.find(x => x.id === s.id);
const run = async (s, name, args) => TL.execute({ orgId: s.org_id, session: sesOf(s), cfg: await S.cfgOf(s.org_id) }, name, args, "k" + (++sn) + Math.random());
const say = (s, text) => S.transcript(s.org_id, s.id, "caller", text);
const demoCbs = (s) => T.voice_callbacks.filter(c => c.session_id === s.id && /OS DEMO REQUESTED/.test(c.reason || ""));
const demoBookings = (s) => T.voice_bookings.filter(b => b.session_id === s.id && b.idem_key === s.id + ":os_demo");
const ownerAlerts = () => EXT.mail.filter(m => JSON.stringify(m.to).includes("owner@potent.test") && /OS demo requested/.test(m.subject || ""));
const callerMails = (addr) => EXT.mail.filter(m => JSON.stringify(m.to).includes(addr) && /demo/i.test(m.subject || ""));
const base = { name: "Tony Mendes", company: "Potent Realm", trucks: 12, email: "pprdkt@gmail.com", email_confirmed: true, demo_when_text: WHEN, notes: "Demo requested for Thursday, November 12 at 10 AM" };
(async () => {
  // ── (A) REPLAY of Demo Call #3: doubled yes + 5 book_demo calls, 2 of them a concurrent burst ──
  { const s = newSes(); EXT.mail.length = 0;
    await say(s, "This call is being recorded. Yes, I'd like a demo of KoboToolbox");
    await say(s, "Yes, that's what I said. I'd like a demo of Potent OS");
    await say(s, "Tony Mendes and my company is Potent Realm");
    await say(s, "Twelve trucks");
    await say(s, "pprdkt@gmail.com");
    await say(s, "Yes, that's correct");                            // email read-back yes
    await say(s, "Thursday at 10:00 in the morning");
    await say(s, "Yes, that's correct");                            // full read-back yes (turn 21)
    await say(s, "Yes, that's correct");                            // the doubled yes (turn 22) — the burst trigger
    const r1 = await run(s, "book_demo", base);
    ok(r1.ok === true && r1.done === true && !r1.duplicate, "A REPLAY: the first book_demo is the one real booking — terminal done, not a duplicate");
    ok(r1.say.includes("Your demo is set for " + WHEN + " — I've emailed your confirmation"), "A REPLAY: her announcement names the SET time and the confirmation — the words she actually says carry no link and no time to pick");
    ok(!/pick the time that suits you/.test(r1.say) && !/I've emailed the booking link to/.test(r1.say), "A REPLAY: the old false announcement ('emailed the booking link… pick the time') is gone from the result");
    ok(r1.demo_when_text === WHEN, "A REPLAY: the result carries the confirmed demo date/time");
    const r2 = await run(s, "book_demo", Object.assign({}, base, { notes: "Caller said yes twice — retrying the demo save" }));
    const burst = await Promise.all([
      run(s, "book_demo", Object.assign({}, base, { email: "PPRDKT@GMAIL.COM", notes: "parallel retry one" })),
      run(s, "book_demo", Object.assign({}, base, { notes: "parallel retry two, reworded" }))
    ]);
    const r5 = await run(s, "book_demo", Object.assign({}, base, { notes: "final retry" }));
    const all = [r1, r2].concat(burst, [r5]);
    ok(all.length === 5 && all.every(x => x.ok === true), "A REPLAY: all 5 book_demo invocations answer ok (like the live call) — but only the first did any work");
    ok(all.filter(x => !x.duplicate).length === 1 && all.slice(1).every(x => x.duplicate === true && x.already_booked === true && x.reference === r1.reference), "A REPLAY: invocations 2–5 return the STORED first outcome — same reference, marked duplicate");
    ok(demoCbs(s).length === 1, "A REPLAY: exactly ONE voice_callbacks demo record after 5 calls");
    ok(demoBookings(s).length === 1, "A REPLAY: exactly ONE voice_bookings demo record after 5 calls");
    ok(ownerAlerts().length === 1, "A REPLAY: exactly ONE owner alert email after 5 calls (the live call sent TWO; the 11:52 PM call sent 13)");
    ok(callerMails("pprdkt@gmail.com").length === 1, "A REPLAY: exactly ONE caller confirmation email after 5 calls");
    // ── the saved record carries the time, where the console actually reads it ──
    const bk = demoBookings(s)[0];
    ok(bk.snapshot && bk.snapshot.demo_when_text === WHEN, "A WHEN: the booking snapshot stores the confirmed demo date/time text");
    ok(bk.snapshot.intake && bk.snapshot.intake.service_date === "2026-11-12" && bk.snapshot.intake.time_window === "10:00 AM", "A WHEN: snapshot.intake.service_date/time_window — the exact fields the Bookings table renders as 'When' — carry 2026-11-12 / 10:00 AM (the live row was blank)");
    ok(bk.window_start === "2026-11-12T15:00:00.000Z" && bk.window_end === "2026-11-12T15:30:00.000Z", "A WHEN: window_start/window_end on the row itself hold the 30-minute demo window (10:00 AM ET = 15:00 UTC)");
    ok(/November 12th at 10:00 AM/.test(bk.review_reason || ""), "A WHEN: the review_reason names the set time");
    ok(/Demo set for Thursday, November 12th at 10:00 AM/.test(demoCbs(s)[0].reason || ""), "A WHEN: the callback record carries the set time too");
    // ── the owner alert tells the truth ──
    const alert = JSON.stringify(ownerAlerts()[0]);
    ok(alert.includes(WHEN), "A EMAIL: the owner alert body carries the demo date/time (the live one had none)");
    ok(!/Booking link/.test(alert) && /Confirmation emailed: yes/.test(alert), "A EMAIL: no 'Booking link sent' claim — it says 'Confirmation emailed: yes', and only because the send returned ok");
    const cm = JSON.stringify(callerMails("pprdkt@gmail.com")[0]);
    ok(/Your POTENT OS demo is set for Thursday, November 12th at 10:00 AM/.test(cm) && !/pick any time/i.test(cm) && !/calendly/i.test(cm), "A EMAIL: the caller email confirms the SET time — no pick-a-time link anywhere in it");
  }
  // ── (B) COLD CONCURRENT BURST: 5 book_demo calls fired at once on a fresh session ──
  { const s = newSes(); EXT.mail.length = 0;
    await say(s, "Yes, that's correct");
    const rs = await Promise.all([0, 1, 2, 3, 4].map(i => run(s, "book_demo", Object.assign({}, base, { notes: "burst call " + i, email: i % 2 ? "PPRDKT@GMAIL.COM" : "pprdkt@gmail.com" }))));
    ok(rs.every(x => x.ok === true), "B BURST: every invocation in the parallel burst answers ok — none errors, none hangs");
    ok(rs.filter(x => !x.duplicate).length === 1, "B BURST: exactly ONE invocation in the burst did the booking; the rest answered from its outcome");
    ok(demoCbs(s).length === 1 && demoBookings(s).length === 1, "B BURST: exactly one callback record and one booking record from a 5-way race");
    ok(ownerAlerts().length === 1 && callerMails("pprdkt@gmail.com").length === 1, "B BURST: exactly one owner alert and one caller email from a 5-way race — the emails are on the same claim as the save");
  }
  // ── (C) FAILURE RELEASES THE CLAIM: the claiming save throws → no success, retry succeeds once ──
  { const s = newSes(); EXT.mail.length = 0;
    await say(s, "Yes, that's correct");
    const origSb = Bmod.sb; let armed = true;
    Bmod.sb = async function (path, opts) { if (armed && /voice_callbacks/.test(path) && opts && opts.method === "POST") { armed = false; throw new Error("simulated save explosion"); } return origSb(path, opts); };
    let rF;
    try { rF = await run(s, "book_demo", base); } finally { Bmod.sb = origSb; }
    ok(rF.ok === false && rF.error === "save_failed" && !rF.done, "C FAILURE: a claiming save that throws returns an honest failure — never a success claim");
    ok(demoCbs(s).length === 0 && demoBookings(s).length === 0 && ownerAlerts().length === 0 && callerMails("pprdkt@gmail.com").length === 0, "C FAILURE: the exploded attempt saved nothing and emailed nothing");
    ok(!sesOf(s).intake._demo_claim && !sesOf(s).intake._demo_done, "C FAILURE: the claim was RELEASED — the session is not permanently blocked by the failed attempt");
    const rR = await run(s, "book_demo", base);
    ok(rR.ok === true && rR.done === true && !rR.duplicate, "C FAILURE: the genuine retry after the release succeeds as the one real booking");
    const rR2 = await run(s, "book_demo", Object.assign({}, base, { notes: "one more retry after the recovered save" }));
    ok(rR2.ok === true && rR2.duplicate === true && demoCbs(s).length === 1 && demoBookings(s).length === 1 && ownerAlerts().length === 1 && callerMails("pprdkt@gmail.com").length === 1, "C FAILURE: after recovery the totals are still exactly 1 record, 1 booking, 1 alert, 1 email");
  }
  // ── (D) END_CALL ONE-SHOT: 4 invocations, side effects once ──
  { const s = newSes(); EXT.mail.length = 0;
    const e1 = await run(s, "end_call", { reason: "caller kept cursing after a warning", kind: "abuse" });
    const e2 = await run(s, "end_call", { reason: "caller kept cursing after a warning", kind: "abuse" });
    const e3 = await run(s, "end_call", { reason: "caller said goodbye", kind: "caller_done" });
    const e4 = await run(s, "end_call", { reason: "caller said goodbye", kind: "caller_done" });
    const abuseAlerts = () => EXT.mail.filter(m => JSON.stringify(m.to).includes("owner@potent.test") && /caller abusive/.test(m.subject || ""));
    ok(e1.ok === true && e1.end_call === true && !e1.duplicate, "D END: the first end_call runs the ending");
    ok(e2.duplicate === true && e3.duplicate === true && e4.duplicate === true, "D END: end_call invocations 2–4 return the stored first outcome, flagged duplicate");
    ok(abuseAlerts().length === 1, "D END: exactly ONE owner abuse alert after 4 end_call invocations (side effects once)");
    ok(sesOf(s).outcome === "ended_abuse", "D END: the session outcome was written once, by the first invocation, and never overwritten by the repeats");
    const s2 = newSes(); EXT.mail.length = 0;
    const g = await Promise.all([0, 1, 2, 3].map(() => run(s2, "end_call", { reason: "caller said goodbye", kind: "caller_done" })));
    ok(g.every(x => x.ok === true && x.end_call === true) && sesOf(s2).outcome === "caller_requested_end", "D END: a 4-way caller_done burst ends the call cleanly with the polite outcome — no abuse stamp, no repeated writes that change it");
  }
  // ── (E) prompt + schema contract for Fix 3 ──
  { const d = TL.defs().find(x => x.name === "book_demo");
    ok(d.parameters.properties.demo_when_text && d.parameters.properties.demo_when_text.type === "string", "E: book_demo's live schema declares demo_when_text — the confirmed time is sendable on a live call");
    ok(!/emails them the booking link/.test(d.description) && /no booking link/.test(d.description), "E: the tool description makes no booking-link claim and says there is none");
    const bP = P.build({ agent_name: "Elevate" }, { name: "POTENT Logistics", slug: "potent-logistics" });
    ok(/demo_when_text/.test(bP) && /the time is set/.test(bP) && /never repeat the question, the goodbye, or the end_call/.test(bP), "E: Potent's demo contract carries the time into book_demo, announces the SET time, and ends the call exactly once");
    const bT = P.build({ agent_name: "Elevate" }, { name: "Cutz Salon", slug: "cutz-salon" });
    ok(!/DEMO BOOKING/.test(bT), "E: a tenant's instructions carry none of it — the contract stays Potent-gated");
  }
  console.log("\n" + n + " assertions passed — voice-demo-once2 (Nov 10 Demo Call #3: claim-first one-shot, date/time capture, truthful wording, end-call one-shot)");
})().catch(e => { console.error("FAIL:", e && e.message); process.exit(1); });
