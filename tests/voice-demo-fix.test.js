// Run: node tests/voice-demo-fix.test.js
// DEMO STALL FIX (Nov 9, 2026) — the 9:14 AM proof call, graded from the live console record:
// book_demo bounced 8×, every one "read_back_required", no demo saved, while she told the
// caller "I've set up your demo request" and looped "One second — I'm checking that for you."
// ROOT CAUSE (code, not feel): emailGate (tools.js) can only pass when the model sends
// email_confirmed:true for the address stored in intake._email_pending — but book_demo's own
// schema in defs() never declared email_confirmed and schemas are additionalProperties:false,
// so on a live call the flag could NEVER be sent; and _email_pending is only created BY a
// gated tool call, while the demo flow (EMAIL CAPTURE) does its read-back conversationally
// BEFORE any tool call. The gate was unsatisfiable by the demo flow, in two independent ways.
// Unit tests never caught it because they call execute() directly, bypassing defs().
// This suite proves the fix: (A) the schema now carries the flag; (B) a simulated replay of
// the failed call — same sequence — ends with exactly ONE saved demo record, ZERO
// read_back_required bounces and the announcement only after ok; (C) the classic two-call
// gate path still works; (D) a negative replay: email never confirmed → she is told to ask
// out loud ONCE, an identical repeat is refused server-side without re-running the gate, no
// silent retries, no false "set up" claim, nothing saved, nothing emailed; (E) the
// caller-spelled address (_email_candidate) satisfies the gate; (F) branding: Potent's own
// greeting says "powered by POTENT PRODUCT" and never "POTENT Logistics" — tenants untouched.
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
const days = k => new Date(Date.now() + k * 864e5).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const fmtDay = iso => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(new Date(iso + "T12:00:00Z"));
const HOLD = /one second|i'm checking that for you|let me check|hang on|still with me|bear with me|just a moment/i;
let sn = 0; const newSes = (org, o) => { const s = Object.assign({ id: "9d9d9d9d-0000-4000-8000-" + String(++sn).padStart(12, "0"), org_id: org || OA, provider: "twilio", provider_call_id: "CD" + sn, direction: "inbound", from_number: "+14704531616", to_number: "+14045550100", state: "active", intake: {}, test_mode: false, started_at: new Date().toISOString(), answered_at: new Date().toISOString(), confirmed_by_caller: false }, o || {}); T.voice_sessions.push(s); return s; };
const sesOf = (s) => T.voice_sessions.find(x => x.id === s.id);
const run = async (s, name, args) => TL.execute({ orgId: s.org_id, session: sesOf(s), cfg: await S.cfgOf(s.org_id) }, name, args, "k" + (++sn) + Math.random());
const say = (s, text) => S.transcript(s.org_id, s.id, "caller", text);
const demoCbs = (s) => T.voice_callbacks.filter(c => c.session_id === s.id && /OS DEMO REQUESTED/.test(c.reason || ""));
const demoExecs = (s) => T.voice_tool_executions.filter(e => e.session_id === s.id && e.tool === "book_demo");
const demoMails = (addr) => EXT.mail.filter(m => JSON.stringify(m.to).includes(addr) && /demo/i.test(m.subject || ""));
(async () => {
  // ── (A) the schema itself: the flag the gate demands must be sendable on a live call ──
  { const d = TL.defs().find(x => x.name === "book_demo");
    ok(d && d.parameters && d.parameters.properties && d.parameters.properties.email_confirmed && d.parameters.properties.email_confirmed.type === "boolean", "A: book_demo's live schema declares email_confirmed — the flag its gate requires is finally sendable (additionalProperties:false no longer makes the gate unsatisfiable)");
    ok(/ONCE/.test(d.description) && /never/i.test(d.description), "A: book_demo's description carries the new contract: call once, never repeat unchanged, announce only after ok");
  }
  // ── (B) REPLAY of the Nov 9, 9:14 AM failed demo call ──
  { const s = newSes(); EXT.mail.length = 0;
    await say(s, "This call may be recorded for quality and training purposes");
    await say(s, "Yes, it is");                                    // callback number = the one he's calling from
    await say(s, "I'd like a demo of POTENT OS");
    await say(s, "Tony Mendes");
    await say(s, "M-E-N-D-E-S");
    await say(s, "Potent Realm");                                  // corrected company name (she took the correction)
    await say(s, "Twelve trucks");
    await say(s, "pprdkt@gmail.com");
    await say(s, "P as in Peter, P as in Peter, R as in Romeo, D as in Delta, K as in Kilo, T as in Tango");   // spelled letter by letter — she reads it back…
    await say(s, "Yes");                                           // …caller yes #1 (email read-back confirmed)
    await say(s, "Thursday at 10 in the morning");                 // read back as Thursday, November 12th at 10 AM (days(3) from Mon Nov 9)
    await say(s, "Yes, that's correct");                           // caller yes #2 (full request read-back)
    const args = { name: "Tony Mendes", company: "Potent Realm", trucks: 12, email: "pprdkt@gmail.com", email_confirmed: true, notes: "Demo requested for " + fmtDay(days(3)) + " at 10 AM" };
    const r = await run(s, "book_demo", args);                     // the corrected talker calls it ONCE, after the yeses
    ok(r.ok === true && !r.error, "B REPLAY: the single book_demo call SUCCEEDS — no read_back_required bounce (the real call bounced 8×)");
    ok(r.link_emailed === true, "B REPLAY: the booking link was emailed");
    ok(demoCbs(s).length === 1, "B REPLAY: exactly ONE demo record saved (voice_callbacks, OS DEMO REQUESTED)");
    ok(demoMails("pprdkt@gmail.com").length === 1, "B REPLAY: exactly ONE demo email went to the caller");
    ok(demoExecs(s).filter(e => e.error === "read_back_required").length === 0, "B REPLAY: ZERO read_back_required results in the whole call");
    ok(demoExecs(s).length === 1, "B REPLAY: book_demo ran exactly once — the save machinery ran once, not eight times");
    ok(/emailed the booking link/.test(r.say) && !HOLD.test(r.say), "B REPLAY: her announcement comes from the ok result (link emailed) and carries no hold line");
    ok(!/set up your demo|I've set up/i.test(r.say), "B REPLAY: she never claims a set-up the tool did not return — the announcement follows the ok, it does not precede it");
    // an identical repeat (a model retry with a fresh call id) can never double-save
    const r2 = await run(s, "book_demo", args);
    ok(r2.ok === true && r2.duplicate === true, "B REPLAY: an identical repeat is answered as a duplicate from the stored outcome");
    ok(demoCbs(s).length === 1 && demoMails("pprdkt@gmail.com").length === 1, "B REPLAY: after the repeat there is STILL exactly one saved record and one email — the save ran exactly once");
  }
  // ── (C) the classic two-call gate path still works ──
  { const s = newSes(); EXT.mail.length = 0;
    const a1 = { name: "Pat", company: "Acme Hauling", trucks: 3, email: "pat@acme.com", notes: "wants a look" };
    let r = await run(s, "book_demo", a1);
    ok(!r.ok && r.error === "read_back_required" && demoCbs(s).length === 0, "C: a first call with no confirmation still bounces at the gate — nothing saved");
    ok(/Ask OUT LOUD/.test(r.say) && /p a t/.test(r.say) && !HOLD.test(r.say), "C: the bounce names the ONE question to ask out loud, spelled letter by letter — no hold line, no silent retry");
    await say(s, "Yes, that's right");                             // she asks, the caller confirms the read-back
    r = await run(s, "book_demo", Object.assign({}, a1, { email_confirmed: true }));
    ok(r.ok === true && demoCbs(s).length === 1, "C: the confirmed second call (flag + matching pending) passes the gate and saves exactly once");
  }
  // ── (D) NEGATIVE REPLAY: the email is never confirmed ──
  { const s = newSes(); EXT.mail.length = 0;
    const a1 = { name: "Sam", company: "Sam's Trucks", trucks: 5, email: "sam@trucks.com", notes: "demo" };
    let r = await run(s, "book_demo", a1);
    ok(!r.ok && r.error === "read_back_required", "D NEGATIVE: unconfirmed email → read_back_required, once");
    ok(/Ask OUT LOUD now, once/.test(r.say) && /Do NOT call book_demo again until you have heard that yes/.test(r.say), "D NEGATIVE: the result tells her to ask out loud once and wait — not to retry");
    ok(!/set up|is in\b/i.test(r.say.replace("NOT BOOKED YET", "")), "D NEGATIVE: no false 'set up' claim anywhere in the failure result");
    r = await run(s, "book_demo", a1);                             // the old call's move: the identical silent retry
    ok(!r.ok && r.duplicate === true && r.error === "duplicate_call", "D NEGATIVE: the identical repeat is REFUSED server-side as a duplicate — the gate does not re-run");
    ok(/will not confirm/.test(r.say) && /person will follow up/.test(r.say), "D NEGATIVE: the refusal's plain words give the honest path: ask once; if they won't confirm, a person follows up");
    ok(demoCbs(s).length === 0 && demoMails("sam@trucks.com").length === 0, "D NEGATIVE: nothing was saved and no demo email was sent — an unconfirmed address is never used");
    // and a confirmed flag for a DIFFERENT address than the one pending is still refused
    r = await run(s, "book_demo", { name: "Sam", company: "Sam's Trucks", trucks: 5, email: "other@trucks.com", email_confirmed: true, notes: "demo" });
    ok(!r.ok && r.error === "read_back_required" && r.gate === "pending_mismatch" && demoCbs(s).length === 0, "D NEGATIVE: a flag for a different address than the read-back one is refused (pending_mismatch) — the read-back protection survives the fix");
  }
  // ── (E) the caller-spelled address satisfies the gate on the first call ──
  { const s = newSes(); EXT.mail.length = 0;
    sesOf(s).intake._email_candidate = "lee@fleet.com";            // email-capture.js assembled it from the caller's own spelling
    const r = await run(s, "book_demo", { name: "Lee", company: "Lee Fleet", trucks: 8, email: "lee@fleet.com", email_confirmed: true, notes: "demo" });
    ok(r.ok === true && demoCbs(s).length === 1, "E: flag + the caller-spelled candidate address passes on the first call — the state the conversation actually produces");
  }
  // ── (F) branding: Potent's line says POTENT PRODUCT; tenants untouched ──
  { const gP = P.greeting({ agent_name: "Elevate" }, { name: "POTENT Logistics", slug: "potent-logistics" }, "+12125550100");
    ok(/powered by POTENT PRODUCT/.test(gP) && !/POTENT Logistics/.test(gP), "F: Potent's greeting says 'powered by POTENT PRODUCT' and never 'POTENT Logistics' (Tony, Nov 9)");
    const gT = P.greeting({ agent_name: "Elevate" }, { name: "Cutz Salon", slug: "cutz-salon" }, "+14045550142");
    ok(!/POTENT PRODUCT/.test(gT) && /Cutz Salon/.test(gT), "F: a tenant's greeting is unchanged — no Potent branding hard-coded into tenant lines");
    const bP = P.build({ agent_name: "Elevate" }, { name: "POTENT Logistics", slug: "potent-logistics" });
    ok(/powered by POTENT PRODUCT/.test(bP) && /DEMO BOOKING \(required\)/.test(bP) && /call book_demo ONCE/.test(bP) && /never tell the caller the demo is set up unless the tool returned ok/.test(bP), "F: Potent's instructions carry the branding and the aligned demo contract");
    ok(!/say you just emailed it and they pick the time/.test(bP), "F: the old contradictory demo instruction (announce the email before the tool runs) is gone");
    const bT = P.build({ agent_name: "Elevate" }, { name: "Cutz Salon", slug: "cutz-salon" });
    ok(!/POTENT PRODUCT/.test(bT) && !/DEMO BOOKING/.test(bT), "F: a tenant's instructions carry none of it — the change is Potent-gated, exactly where Potent's own greeting/book is defined");
  }
  console.log("\n" + n + " assertions passed — voice-demo-fix (Nov 9 demo stall: replay + negative replay)");
})().catch(e => { console.error("FAIL:", e && e.message); process.exit(1); });
