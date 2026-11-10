// Run: node tests/voice-name-spell.test.js
// NAME-SPELLING FIX (Nov 10, 2026 — Fix 4) — Tony's rule (Oct 29 2026, re-raised
// Nov 10): Elevate must ASK and CONFIRM a name's spelling when she doesn't know
// it, and confirm spellings generally instead of guessing — a caller's name was
// captured as "Mendis" when it is MENDES (M-E-N-D-E-S). Code facts on the Fix 3
// base (HEAD 71c7f962): the prompt's STYLE line said "Spell back phone numbers,
// addresses and dates to confirm" — names not covered; the email capture has a
// hard spelled-letter gate but names had no equivalent in the demo flow (the
// general NAMES paragraph existed but lacked the letter-by-letter spell-back +
// yes + ground-truth treatment in the style line and the demo contract), and
// book_demo took the name as a free string with an empty description.
// THE FIX (guidance text only — no save logic, claims, gates or schemas move):
// (1) STYLE line: names spelled back letter by letter when spelling is
// uncertain + any unsure detail gets asked and confirmed, never guessed.
// (2) DEMO BOOKING: the name gets the same treatment as the email — ask "How do
// you spell that for me?", spell it back letter by letter, wait for a yes; the
// caller-spelled version is ground truth and outranks the ear; the final
// read-back includes the name EXACTLY AS SPELLED. (3) NAMES paragraph hardened
// to the same letter-by-letter + yes + ground-truth wording. (4) book_demo's
// description and its name parameter now say the name must be the confirmed
// spelling. SCOPE ADDITION (Tony, Nov 10, minutes later): pronunciation counts
// too — his name is spelled M-E-N-D-E-S but pronounced "Mendies" (men-DEEZ);
// when she is unsure how a name is SAID she asks, says it back the caller's
// way, and waits for a yes; spelling AND pronunciation are ground truth.
// Everything else — Fix 3's claim-first, date/time capture, truthful
// wording, end_call one-shot — must read exactly as before.
process.env.TWILIO_ACCOUNT_SID = "ACtest"; process.env.TWILIO_AUTH_TOKEN = "twtoken"; process.env.TWILIO_SMS_FROM = "+14045550999"; process.env.VOICE_WEBHOOK_URL = "https://hooks.test/voice"; process.env.VOICE_BRIDGE_URL = "wss://voice.test/twilio"; process.env.VOICE_BRIDGE_SECRET = "bridgesecret";
process.env.ROUTING_PROVIDER = "osrm"; process.env.OSRM_URL = "https://osrm.test"; process.env.RESEND_API_KEY = "rk";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); console.log("ok -", m); n++; };
const TL = require("../netlify/functions/lib/voice/tools"), P = require("../netlify/functions/lib/voice/prompt.js");

(async () => {
  const bP = P.build({ agent_name: "Elevate" }, { name: "POTENT Logistics", slug: "potent-logistics" });
  const bT = P.build({ agent_name: "Elevate" }, { name: "Cutz Salon", slug: "cutz-salon" });

  // ── (A) STYLE line carries the name-spelling rule (all orgs — the line is unconditional) ──
  for (const [tag, b] of [["P", bP], ["T", bT]]) {
    ok(/Spell back phone numbers, addresses and dates to confirm, and spell names back too/.test(b), tag + ": STYLE spells names back alongside numbers, addresses and dates");
    ok(/letter by letter whenever you are not certain of a name's spelling/.test(b), tag + ": STYLE: a name's spelling is spelled back letter by letter when uncertain (the wait-for-yes is in the STYLE pronunciation clause, section G)");
    ok(/Any detail you are not sure of, ask about it and confirm it; never guess at one/.test(b), tag + ": STYLE: any unsure detail is asked and confirmed, never guessed");
  }

  // ── (B) NAMES paragraph: letter-by-letter spell-back + yes + ground truth (all orgs) ──
  for (const [tag, b] of [["P", bP], ["T", bT]]) {
    ok(/NAMES \(required\)/.test(b), tag + ": the NAMES rule is present");
    ok(/spell it back letter by letter and wait for a clear yes — exactly the way you confirm an email/.test(b), tag + ": NAMES: spell the name back letter by letter and wait for a clear yes, like the email");
    ok(/The spelling the caller gives you is the ground truth: it outranks what you heard by ear/.test(b), tag + ": NAMES: the caller-spelled version is ground truth and outranks the ear");
    ok(/use ONLY that spelling — in the final read-back, in every tool call, and in every record/.test(b), tag + ": NAMES: the confirmed spelling is used in the read-back, tool calls and records");
  }

  // ── (C) DEMO BOOKING flow (Potent-gated): name gets the email's treatment, read-back as spelled ──
  ok(/THE NAME GETS THE SAME TREATMENT AS THE EMAIL/.test(bP), "P: DEMO BOOKING gives the name the same treatment as the email");
  ok(/ask "How do you spell that for me\?", spell it back letter by letter, and wait for a clear yes/.test(bP), "P: DEMO BOOKING: ask the spelling, spell it back letter by letter, wait for a yes");
  ok(/their name EXACTLY AS SPELLED, company, trucks, the demo/.test(bP), "P: the final demo read-back includes the name EXACTLY AS SPELLED");
  ok(!/DEMO BOOKING/.test(bT), "T: a tenant's instructions carry no DEMO BOOKING — the demo contract stays Potent-gated");

  // ── (D) no wrong spelling is ever planted in her instructions ──
  ok(!/Mendis/.test(bP) && !/Mendis/.test(bT), "the mishearing 'Mendis' appears nowhere in either build's instructions");

  // ── (E) book_demo guidance text: name = confirmed spelling; schema/gates untouched ──
  const d = TL.defs().find(x => x.name === "book_demo");
  ok(/The name you pass must be the caller's name in the spelling THEY confirmed letter by letter/.test(d.description), "book_demo description: the name passed is the caller-confirmed spelling");
  ok(/the caller's name in the spelling they confirmed letter by letter on this call/.test(d.parameters.properties.name.description), "book_demo name parameter: described as the confirmed spelling");
  ok(d.parameters.properties.name.type === "string" && d.parameters.required.join(",") === "name,email", "book_demo schema unchanged: name still a plain string, required still name+email");
  ok(d.parameters.properties.demo_when_text && d.parameters.properties.email_confirmed, "book_demo schema unchanged: Fix 3's demo_when_text + email_confirmed still declared");
  ok(/no booking link/.test(d.description) && !/emails them the booking link/.test(d.description), "book_demo description unchanged on wording: no booking-link claim (Fix 3)");

  // ── (F) Fix 3 prompt contract survives apart from the intended additions ──
  ok(/powered by POTENT PRODUCT/.test(bP) && /call book_demo ONCE/.test(bP) && /announce the result ONCE/.test(bP), "P: Fix 1–3 demo contract lines survive (branding, call ONCE, announce ONCE)");
  ok(/demo_when_text/.test(bP) && /the time is set/.test(bP) && /never repeat the question, the goodbye, or the end_call/.test(bP), "P: Fix 3 contract survives (time into book_demo, SET time announced, one-shot ending)");
  ok(/EMAIL READ-BACK \(required\)/.test(bP) && /spelled it back letter by letter \(say "at" and "dot"\)/.test(bP), "P: the email read-back gate reads exactly as before");

  // ── (G) PRONUNCIATION (Tony's scope addition, Nov 10): ask how to SAY it too ──
  for (const [tag, b] of [["P", bP], ["T", bT]]) {
    ok(/whenever you are not sure how a name is SAID, ask how to pronounce it and say it back the caller's way; wait for the caller to say yes to both/.test(b), tag + ": STYLE: an unsure pronunciation is asked, said back the caller's way, and confirmed with a yes");
    ok(/Pronunciation gets the same respect: if you are not sure how their name is said, ask how to say it, say it back the way they say it, and wait for a yes/.test(b), tag + ": NAMES: pronunciation is asked, echoed the caller's way, and confirmed");
    ok(/Spelling and pronunciation are both ground truth once the caller confirms them/.test(b), tag + ": NAMES: spelling AND pronunciation are both ground truth once confirmed");
  }
  ok(/ask "And how do you say it for me\?", say the name back the way they say it, and wait for a yes on that too/.test(bP), "P: DEMO BOOKING asks how the name is said, echoes it their way, and waits for a yes");
  ok(/their pronunciation is ground truth the same way, so say their name their way every time you use it on this call/.test(bP), "P: DEMO BOOKING: caller pronunciation is ground truth and is used all call");
  ok(/pronounce it the way THEY confirmed it is said: spelling and pronunciation are both theirs, not your guess/.test(d.description), "book_demo description: speak the name the way the caller confirmed it is said");

  console.log("\n" + n + " assertions passed — voice-name-spell (names asked + spelled back + confirmed, pronunciation asked + echoed + confirmed; caller's spelling and saying are ground truth)");
})().catch(e => { console.error("FAIL:", e && e.message); process.exit(1); });
