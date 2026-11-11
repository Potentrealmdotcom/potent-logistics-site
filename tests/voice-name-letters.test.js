// Run: node tests/voice-name-letters.test.js
// LETTERS-BOUND NAME (Nov 10, 2026 — Fix 6): the Demo Call #4 failure (4:47 PM).
// Fix 4's gate worked as designed — she ASKED "How do you spell that for me?",
// the caller dictated M-E-N-D-E-S, name_confirmed came back true — and the
// booking AND the callback still saved the model's more common variant of the
// surname, with a Z: the gate verified a confirmation HAPPENED, but the saved
// STRING stayed model-generated and drifted S→Z. Unit tests passed because the
// harness handed the gate the correct string; the live model did not.
// THE FIX: the spelled letters themselves ride the call as a dedicated argument
// (name_spelled_letters). Whenever they are supplied, the SAVED surname is
// BUILT from them (nameWithSpelledSurname in tools.js) and recorded as the
// confirmed spelling — a model string that disagrees with the letters loses,
// so drift is impossible on any save that carries the letters. The letters
// also join the demoHash fingerprint (a call carrying them is new state, like
// the nameconf bit), and create_callback_task carries the same argument with
// the same binding (it is the path that wrote the drifted spelling on the call).
// DOCUMENTED DECISION — a confirmed save with NO letters keeps the Fix 4 path
// exactly (the confirmed call's own string is recorded): the protected suites'
// confirming calls carry no letters and must pass unchanged, and a
// letters-required refusal would make the gate unsatisfiable by those flows.
// The prompt now instructs her to pass the letters on every confirmed save.
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
let sn = 0; const newSes = (org, o) => { const s = Object.assign({ id: "6e6e6e6e-0000-4000-8000-" + String(++sn).padStart(12, "0"), org_id: org || OA, provider: "twilio", provider_call_id: "CE" + sn, direction: "inbound", from_number: "+14704531616", to_number: "+14045550100", state: "active", intake: {}, test_mode: false, started_at: new Date().toISOString(), answered_at: new Date().toISOString(), confirmed_by_caller: false }, o || {}); T.voice_sessions.push(s); return s; };
const sesOf = (s) => T.voice_sessions.find(x => x.id === s.id);
const run = async (s, name, args) => TL.execute({ orgId: s.org_id, session: sesOf(s), cfg: await S.cfgOf(s.org_id) }, name, args, "k" + (++sn) + Math.random());
const say = (s, text) => S.transcript(s.org_id, s.id, "caller", text);
const demoCbs = (s) => T.voice_callbacks.filter(c => c.session_id === s.id && /OS DEMO REQUESTED/.test(c.reason || ""));
const demoBookings = (s) => T.voice_bookings.filter(b => b.session_id === s.id && b.idem_key === s.id + ":os_demo");
const ownerAlerts = () => EXT.mail.filter(m => JSON.stringify(m.to).includes("owner@potent.test") && /OS demo requested/.test(m.subject || ""));
const callerMails = (addr) => EXT.mail.filter(m => JSON.stringify(m.to).includes(addr) && /demo/i.test(m.subject || ""));
const base = { company: "Potent Realm", trucks: 12, email: "pprdkt@gmail.com", email_confirmed: true, name_confirmed: true, demo_when_text: WHEN, notes: "Demo requested for Thursday, November 12 at 10 AM" };
(async () => {
  // ── (A) THE LIVE FAILURE, REPLAYED: string drifts to Z, letters say S → the LETTERS land ──
  const sA = newSes(); EXT.mail.length = 0;
  await say(sA, "I'd like a demo of POTENT OS");
  await say(sA, "Tony as it sounds, and Mendee, M-E-N-D-E-S");   // the caller DICTATED the letters
  await say(sA, "Yes, that's correct");                          // read-back confirmed
  { const r = await run(sA, "book_demo", Object.assign({}, base, { name: "Tony Mendez", name_spelled_letters: "M-E-N-D-E-S", notes: "live replay: string drifted to Z, letters are S" }));
    ok(r.ok === true && r.done === true && !r.duplicate, "A LETTERS: the confirmed save carrying the caller's letters succeeds — terminal done");
    ok(demoCbs(sA).length === 1 && demoBookings(sA).length === 1, "A LETTERS: exactly one callback record and one booking record");
    ok(demoBookings(sA)[0].customer_name === "Tony Mendes", "A LETTERS: the booking row's surname is BUILT from the letters — Mendes, not the drifted string");
    ok(demoCbs(sA)[0].name === "Tony Mendes", "A LETTERS: book_demo's own callback row carries the letters-built spelling too");
    ok(sesOf(sA).intake._name_spelling === "Tony Mendes", "A LETTERS: the recorded confirmed spelling comes from the letters");
    ok(ownerAlerts().length === 1 && /Tony Mendes/.test(JSON.stringify(ownerAlerts()[0])), "A LETTERS: the owner alert names the caller by the letters-built spelling");
    ok(callerMails("pprdkt@gmail.com").length === 1 && /Hi Tony Mendes,/.test(JSON.stringify(callerMails("pprdkt@gmail.com")[0])), "A LETTERS: the caller confirmation greets the letters-built spelling");
    const everything = JSON.stringify(demoCbs(sA)) + JSON.stringify(demoBookings(sA)) + JSON.stringify(EXT.mail);
    ok(!/Mendez/.test(everything), "A LETTERS: the drifted Z spelling appears in NO record and NO email — the letters ruled");
    const r2 = await run(sA, "book_demo", Object.assign({}, base, { name: "Tony Mendez", name_spelled_letters: "M-E-N-D-E-Z", notes: "post-save duplicate, string AND letters drifted" }));
    ok(r2.ok === true && r2.duplicate === true && r2.already_booked === true, "A LETTERS: a post-save duplicate returns the stored outcome");
    ok(demoCbs(sA).length === 1 && demoBookings(sA).length === 1 && demoBookings(sA)[0].customer_name === "Tony Mendes", "A LETTERS: the duplicate saved nothing and overwrote nothing — the record still carries the letters-built spelling");
  }
  // ── (B) LETTERS RULE BOTH WAYS: string says S, letters say Z → the record carries Z ──
  { const s = newSes(); EXT.mail.length = 0;
    const r = await run(s, "book_demo", Object.assign({}, base, { name: "Tony Mendes", name_spelled_letters: "M-E-N-D-E-Z" }));
    ok(r.ok === true && r.done === true, "B BOTH WAYS: the confirmed save succeeds");
    ok(demoBookings(s)[0].customer_name === "Tony Mendez" && demoCbs(s)[0].name === "Tony Mendez", "B BOTH WAYS: when the letters say Z the record carries Z — the letters are ground truth, not a spell-checker for one name");
    ok(sesOf(s).intake._name_spelling === "Tony Mendez", "B BOTH WAYS: the recorded spelling follows the letters");
  }
  // ── (C) LETTERS AS AN ARRAY land the same way ──
  { const s = newSes(); EXT.mail.length = 0;
    const r = await run(s, "book_demo", Object.assign({}, base, { name: "Tony Mendez", name_spelled_letters: ["M", "E", "N", "D", "E", "S"] }));
    ok(r.ok === true && demoBookings(s)[0].customer_name === "Tony Mendes", "C ARRAY: letters supplied as an array build the surname the same way");
  }
  // ── (D) EXPLODED SAVE → RETRY: the letters recorded before the failure still rule ──
  { const s = newSes(); EXT.mail.length = 0;
    const origSb = Bmod.sb; let armed = true;
    Bmod.sb = async function (path, opts) { if (armed && /voice_callbacks/.test(path) && opts && opts.method === "POST") { armed = false; throw new Error("simulated save explosion"); } return origSb(path, opts); };
    let rF;
    try { rF = await run(s, "book_demo", Object.assign({}, base, { name: "Tony Mendez", name_spelled_letters: "M-E-N-D-E-S", notes: "confirmed with letters, then the save explodes" })); } finally { Bmod.sb = origSb; }
    ok(rF.ok === false && rF.error === "save_failed", "D RETRY: the confirmed attempt whose save explodes fails honestly");
    ok(sesOf(s).intake._name_spelling === "Tony Mendes", "D RETRY: the letters-built spelling was recorded BEFORE the save — a failed save does not lose it");
    const rR = await run(s, "book_demo", Object.assign({}, base, { name: "Tony Mendis", name_spelled_letters: "M-E-N-D-E-S", notes: "genuine retry — string drifted again, letters resent" }));
    ok(rR.ok === true && rR.done === true, "D RETRY: the genuine retry succeeds");
    ok(demoBookings(s).length === 1 && demoBookings(s)[0].customer_name === "Tony Mendes" && demoCbs(s)[0].name === "Tony Mendes", "D RETRY: the retry saved under the letters-built spelling — its drifted string did not overwrite it");
    ok(!/Mendis|Mendez/.test(JSON.stringify(demoBookings(s)) + JSON.stringify(demoCbs(s))), "D RETRY: no record from either attempt carries a drifted spelling");
  }
  // ── (E) LETTER-LESS PATHS: the documented Fix 4 behavior, unchanged ──
  { const s = newSes(); EXT.mail.length = 0;
    const r = await run(s, "book_demo", Object.assign({}, base, { name: "Tony Mendes" }));
    ok(r.ok === true && r.done === true && demoBookings(s)[0].customer_name === "Tony Mendes", "E NO LETTERS: a confirmed save without letters lands the confirmed call's spelling, exactly as Fix 4 left it");
    const s2 = newSes();
    const r2 = await run(s2, "book_demo", Object.assign({}, base, { name: "Tony Mendez", name_confirmed: false, name_spelled_letters: "M-E-N-D-E-S" }));
    ok(r2.ok === false && r2.gate === "name_not_confirmed" && demoBookings(s2).length === 0, "E NO LETTERS: letters never bypass the gate — an explicitly unconfirmed save carrying letters is still refused, nothing saved");
    ok(/name_spelled_letters/.test(r2.say), "E NO LETTERS: the refusal now tells her to pass the spelled letters on the confirming re-call");
    const s3 = newSes();
    const r3 = await run(s3, "book_demo", Object.assign({}, base, { name: "Tony Mendes", name_spelled_letters: "123" }));
    ok(r3.ok === true && demoBookings(s3)[0].customer_name === "Tony Mendes", "E NO LETTERS: unusable letters (no A-Z spelling in them) are treated as absent — the Fix 4 path saves the confirmed string");
  }
  // ── (F) THE STANDALONE CALLBACK PATH: same argument, same binding ──
  { const s = newSes();
    const before = T.voice_callbacks.filter(c => c.session_id === s.id).length;
    const r = await run(s, "create_callback_task", { name: "Tony Mendez", phone: "4704531616", reason: "LIST ADD: demo follow-up", name_spelled_letters: "M-E-N-D-E-S" });
    ok(r.ok === true && r.callback_id, "F CALLBACK: the standalone callback saves");
    const row = T.voice_callbacks.find(c => c.id === r.callback_id);
    ok(row && row.name === "Tony Mendes", "F CALLBACK: its row's surname is built from the letters — the path that drifted on the live call is bound too");
    const r2 = await run(s, "create_callback_task", { name: "Tony Mendez", phone: "4704531616", reason: "LIST ADD: no letters this time" });
    const row2 = T.voice_callbacks.find(c => c.id === r2.callback_id);
    ok(r2.ok === true && row2 && row2.name === "Tony Mendez", "F CALLBACK: without letters the name saves exactly as passed, as it always has");
    ok(T.voice_callbacks.filter(c => c.session_id === s.id).length === before + 2, "F CALLBACK: both callbacks recorded, nothing else changed");
  }
  // ── (G) SCHEMA + PROMPT CONTRACT ──
  { const d = TL.defs().find(x => x.name === "book_demo");
    ok(d.parameters.properties.name_spelled_letters && d.parameters.properties.name_spelled_letters.type === "string", "G SCHEMA: book_demo declares name_spelled_letters — the letters are sendable on a live call");
    ok(d.parameters.required.join(",") === "name,email", "G SCHEMA: the letters stay optional — required is still name+email, so the confirming flows are unchanged");
    ok(/the saved surname is built from those letters/.test(d.description), "G SCHEMA: book_demo's description states the binding up front");
    const dc = TL.defs().find(x => x.name === "create_callback_task");
    ok(dc.parameters.properties.name_spelled_letters && dc.parameters.properties.name_spelled_letters.type === "string", "G SCHEMA: create_callback_task declares the same letters argument");
    const bP = P.build({ agent_name: "Elevate" }, { name: "POTENT Logistics", slug: "potent-logistics" });
    const bT = P.build({ agent_name: "Elevate" }, { name: "Cutz Salon", slug: "cutz-salon" });
    ok(/name_spelled_letters carrying the surname's letters exactly as the caller spelled them out/.test(bP) && /built FROM those letters/.test(bP), "G PROMPT: the demo contract sends the spelled letters on the confirming call and knows the surname is built from them");
    for (const [tag, b] of [["P", bP], ["T", bT]]) ok(/LETTERS GO WITH THE NAME/.test(b) && /also pass name_spelled_letters/.test(b), tag + " PROMPT: NAMES sends the letters with the name into every tool, for every org");
    ok(!/Mendes/.test(bP) && !/Mendez/.test(bP) && !/Mendies/.test(bP), "G PROMPT: no caller's name or spelling is hard-coded in the instructions — the rule is for every caller");
  }
  console.log("\n" + n + " assertions passed — voice-name-letters (Fix 6: the saved surname is built from the letters the caller spelled — drift impossible on lettered saves, letters rule both ways, callback path bound, letter-less saves keep the Fix 4 path)");
})().catch(e => { console.error("FAIL:", e && e.message); process.exit(1); });
