// Run: node tests/voice-name-confirm.test.js
// NAME CONFIRMATION GATE (Nov 10, 2026 — Fix 4): Tony's rule — if Elevate doesn't
// know a name's spelling she must ASK and confirm it. On Demo Call #3 the caller's
// last name (spelled M-E-N-D-E-S, pronounced "Mendies") risked being recorded as
// "Mendis": the prompt had a NAMES rule but book_demo had NO tool-level gate — the
// email is refused until email_confirmed, a name was saved on nothing but guidance.
// THE FIX, reusing the email gate's own plumbing (no parallel system): book_demo's
// schema now declares name_confirmed (the original demo-gate bug was an undeclared
// flag a live call could never send); an explicitly unconfirmed name — or any call
// while a name question is outstanding on the session — is refused with
// read_back_required naming the one question to ask out loud ("How do you spell
// that for me?"), zero inserts, zero emails; the refusal is stored in _demo_last
// so an unchanged repeat is answered by the duplicate guard, never re-run. A
// spell-back + yes (name_confirmed:true) records the caller's spelling on the
// intake as _name_spelling and EVERY record — the voice_callbacks row, the
// voice_bookings row, the caller email, the owner alert — is written from it, so
// later argument drift to a different spelling cannot overwrite the confirmed
// one (Fix 3's claim-first one-shot carries it from there). Pronunciation is
// prompt-level: she says the name the way the CALLER says it, and a correction
// is adopted immediately — asserted below at the prompt level, with no personal
// name hard-coded anywhere in the prompt or the gate.
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
let sn = 0; const newSes = (org, o) => { const s = Object.assign({ id: "4e4e4e4e-0000-4000-8000-" + String(++sn).padStart(12, "0"), org_id: org || OA, provider: "twilio", provider_call_id: "CE" + sn, direction: "inbound", from_number: "+14704531616", to_number: "+14045550100", state: "active", intake: {}, test_mode: false, started_at: new Date().toISOString(), answered_at: new Date().toISOString(), confirmed_by_caller: false }, o || {}); T.voice_sessions.push(s); return s; };
const sesOf = (s) => T.voice_sessions.find(x => x.id === s.id);
const run = async (s, name, args) => TL.execute({ orgId: s.org_id, session: sesOf(s), cfg: await S.cfgOf(s.org_id) }, name, args, "k" + (++sn) + Math.random());
const say = (s, text) => S.transcript(s.org_id, s.id, "caller", text);
const demoCbs = (s) => T.voice_callbacks.filter(c => c.session_id === s.id && /OS DEMO REQUESTED/.test(c.reason || ""));
const demoBookings = (s) => T.voice_bookings.filter(b => b.session_id === s.id && b.idem_key === s.id + ":os_demo");
const ownerAlerts = () => EXT.mail.filter(m => JSON.stringify(m.to).includes("owner@potent.test") && /OS demo requested/.test(m.subject || ""));
const callerMails = (addr) => EXT.mail.filter(m => JSON.stringify(m.to).includes(addr) && /demo/i.test(m.subject || ""));
(async () => {
  // ── (A) UNCONFIRMED NAME → REFUSED, zero side effects, and the question stays open ──
  const sA = newSes(); EXT.mail.length = 0;
  await say(sA, "I'd like a demo of POTENT OS");
  await say(sA, "Tony Mendis");                                    // as HEARD — never spelled
  await say(sA, "pprdkt@gmail.com");
  await say(sA, "Yes, that's correct");                            // email read-back confirmed
  const heard = { name: "Tony Mendis", company: "Potent Realm", trucks: 12, email: "pprdkt@gmail.com", email_confirmed: true, name_confirmed: false, demo_when_text: WHEN, notes: "Demo requested for Thursday, November 12 at 10 AM" };
  { const r = await run(sA, "book_demo", heard);
    ok(r.ok === false && r.error === "read_back_required" && r.gate === "name_not_confirmed", "A REFUSAL: an explicitly unconfirmed name spelling is refused — read_back_required / name_not_confirmed, no save");
    ok(/How do you spell that for me\?/.test(r.say) && /letter by letter/.test(r.say) && /name_confirmed true/.test(r.say), "A REFUSAL: the result names the one question to ask out loud and the flag the confirming re-call must carry");
    ok(!/M-E-N-D/.test(r.say), "A REFUSAL: the gate's words carry no specific name or spelling — the rule is general, for every caller");
    ok(demoCbs(sA).length === 0 && demoBookings(sA).length === 0, "A REFUSAL: zero callback rows, zero booking rows — nothing was saved under the unconfirmed spelling");
    ok(ownerAlerts().length === 0 && callerMails("pprdkt@gmail.com").length === 0, "A REFUSAL: zero owner alerts, zero caller emails");
    ok(sesOf(sA).intake._name_pending === "Tony Mendis" && !sesOf(sA).intake._name_spelling, "A REFUSAL: the heard spelling is parked as _name_pending — the question is OPEN on the session, nothing is confirmed");
    const r2 = await run(sA, "book_demo", heard);
    ok(r2.ok === false && r2.duplicate === true && /How do you spell that for me\?/.test(r2.say), "A REFUSAL: an identical repeat is answered by the duplicate guard with the same marching orders — the gate does not re-run");
    const r3 = await run(sA, "book_demo", Object.assign({}, heard, { name_confirmed: undefined, notes: "reworded retry, flag dropped" }));
    ok(r3.ok === false && r3.gate === "name_not_confirmed", "A REFUSAL: dropping the flag does not sneak past — while the name question is outstanding, only a confirmed spelling closes it");
    ok(demoCbs(sA).length === 0 && demoBookings(sA).length === 0 && ownerAlerts().length === 0 && callerMails("pprdkt@gmail.com").length === 0, "A REFUSAL: after three attempts the totals are still zero records and zero emails");
  }
  // ── (B) SPELL-BACK M-E-N-D-E-S + YES → saves once, and every record carries "Mendes" ──
  { await say(sA, "M as in Mike, E as in Echo, N as in November, D as in Delta, E as in Echo, S as in Sierra");
    await say(sA, "Yes, that's right");                            // spell-back confirmed
    const r = await run(sA, "book_demo", Object.assign({}, heard, { name: "Tony Mendes", name_confirmed: true, notes: "Name spelled back and confirmed" }));
    ok(r.ok === true && r.done === true && !r.duplicate, "B SAVE: after the spell-back and the yes, the demo saves — terminal done");
    ok(demoCbs(sA).length === 1 && demoBookings(sA).length === 1, "B SAVE: exactly one callback record and one booking record");
    ok(demoCbs(sA)[0].name === "Tony Mendes", "B SAVE: the voice_callbacks row carries the CONFIRMED spelling");
    ok(demoBookings(sA)[0].customer_name === "Tony Mendes", "B SAVE: the voice_bookings row carries the CONFIRMED spelling");
    ok(sesOf(sA).intake._name_spelling === "Tony Mendes" && !sesOf(sA).intake._name_pending, "B SAVE: the confirmed spelling is recorded on the intake and the pending question is closed");
    ok(ownerAlerts().length === 1 && /Tony Mendes/.test(JSON.stringify(ownerAlerts()[0])), "B SAVE: the owner alert names the caller by the confirmed spelling");
    ok(callerMails("pprdkt@gmail.com").length === 1 && /Hi Tony Mendes,/.test(JSON.stringify(callerMails("pprdkt@gmail.com")[0])), "B SAVE: the caller confirmation greets the confirmed spelling");
    const everything = JSON.stringify(demoCbs(sA)) + JSON.stringify(demoBookings(sA)) + JSON.stringify(EXT.mail);
    ok(!/Mendis/.test(everything), "B SAVE: the heard misspelling 'Mendis' appears in NO record and NO email — the confirmed spelling is the only one that landed");
  }
  // ── (C) DRIFT CANNOT OVERWRITE THE CONFIRMED SPELLING ──
  { const r = await run(sA, "book_demo", Object.assign({}, heard, { name: "Tony Mendis", name_confirmed: true, notes: "late retry with the old heard spelling" }));
    ok(r.ok === true && r.duplicate === true && r.already_booked === true, "C DRIFT: a post-save call drifting back to the heard spelling returns the stored outcome");
    ok(demoCbs(sA).length === 1 && demoBookings(sA).length === 1 && demoBookings(sA)[0].customer_name === "Tony Mendes", "C DRIFT: totals unchanged and the booking still carries the confirmed spelling");
  }
  { const s = newSes(); EXT.mail.length = 0;
    await say(s, "Yes, that's correct");
    const origSb = Bmod.sb; let armed = true;
    Bmod.sb = async function (path, opts) { if (armed && /voice_callbacks/.test(path) && opts && opts.method === "POST") { armed = false; throw new Error("simulated save explosion"); } return origSb(path, opts); };
    let rF;
    try { rF = await run(s, "book_demo", { name: "Tony Mendes", company: "Potent Realm", trucks: 12, email: "pprdkt@gmail.com", email_confirmed: true, name_confirmed: true, demo_when_text: WHEN, notes: "confirmed, then the save explodes" }); } finally { Bmod.sb = origSb; }
    ok(rF.ok === false && rF.error === "save_failed", "C DRIFT: the confirmed attempt whose save explodes fails honestly");
    ok(sesOf(s).intake._name_spelling === "Tony Mendes", "C DRIFT: the confirmed spelling was recorded BEFORE the save — a failed save does not lose it");
    const rR = await run(s, "book_demo", { name: "Tony Mendis", company: "Potent Realm", trucks: 12, email: "pprdkt@gmail.com", email_confirmed: true, name_confirmed: true, demo_when_text: WHEN, notes: "retry — model drifted back to the heard spelling" });
    ok(rR.ok === true && rR.done === true, "C DRIFT: the genuine retry succeeds");
    ok(demoBookings(s).length === 1 && demoBookings(s)[0].customer_name === "Tony Mendes" && demoCbs(s)[0].name === "Tony Mendes", "C DRIFT: the retry saved under the CONFIRMED spelling — its own drifted argument did not overwrite it");
    ok(!/Mendis/.test(JSON.stringify(demoBookings(s)) + JSON.stringify(demoCbs(s))), "C DRIFT: no record from the retry carries the drifted spelling");
  }
  // ── (D) SCHEMA + PROMPT: the flag is sendable, pronunciation mirrors the caller, no name is hard-coded ──
  { const d = TL.defs().find(x => x.name === "book_demo");
    ok(d.parameters.properties.name_confirmed && d.parameters.properties.name_confirmed.type === "boolean", "D SCHEMA: book_demo's live schema declares name_confirmed — the flag its gate requires is sendable on a live call");
    ok(/without it the save is refused/.test(d.description), "D SCHEMA: the tool description states the refusal up front");
    const bP = P.build({ agent_name: "Elevate" }, { name: "POTENT Logistics", slug: "potent-logistics" });
    const bT = P.build({ agent_name: "Elevate" }, { name: "Cutz Salon", slug: "cutz-salon" });
    ok(/name_confirmed true/.test(bP) && /the save is refused/.test(bP), "D PROMPT: the demo contract sends name_confirmed only after the spell-back yes and knows the save refuses without it");
    for (const [tag, b] of [["P", bP], ["T", bT]]) {
      ok(/say it back the way they say it/.test(b) && /say their name their way for the rest of the call/.test(b), tag + " PROMPT: pronunciation mirrors the caller — say it their way, all call");
      ok(/corrects how you SAID their name/.test(b) && /adopt their way immediately/.test(b) && /thank them briefly/.test(b) && /never repeat the wrong pronunciation once corrected/.test(b), tag + " PROMPT: a pronunciation correction is adopted immediately, thanked briefly, and the wrong version is never repeated");
      ok(/never argue/.test(b), tag + " PROMPT: she never argues a name correction");
      ok(!/Mendes/.test(b) && !/Mendies/.test(b) && !/Mendis/.test(b), tag + " PROMPT: no caller's name — first, last, or pronounced — is hard-coded in the instructions; the rule is for every caller");
    }
  }
  console.log("\n" + n + " assertions passed — voice-name-confirm (Fix 4: unconfirmed name refused with zero side effects, spell-back + yes saves the confirmed spelling everywhere, drift cannot overwrite it, pronunciation mirrors the caller)");
})().catch(e => { console.error("FAIL:", e && e.message); process.exit(1); });
