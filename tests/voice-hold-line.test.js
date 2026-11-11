// Run: node tests/voice-hold-line.test.js
// HOLD LINE FIRST (Nov 10, 2026 — Fix 5): the Demo Call #4 dead-air failure
// (4:47 PM). After the caller's final read-back yes there were ~11 seconds of
// silence, THEN her "One second, I'm checking that for you," then ~28 more
// seconds of silence (book_demo looped inside the window) before the
// announcement — ~42 s of mostly dead air. The old instructions asked for a
// checking line but never forced it BEFORE the tool call, so she emitted the
// save first and spoke second; and nothing told her what to do when a wait
// stretched or when the system handed her back the stored outcome — she
// re-called the tool instead of announcing.
// THE FIX (prompt guidance, DEMO BOOKING contract — the demo save is the slow
// synchronous one; the freight path keeps its keep-talking doctrine by design):
// (1) SPEAK BEFORE YOU SAVE — on the caller's yes she says one short hold line
// out loud as its own turn BEFORE calling book_demo, in Tony's approved
// wording family ("One second — let me get that set up for you" / "Hold on
// one moment, I'm looking this up for you"), and that order holds for any save
// fired right after a caller's yes. (2) BRIDGE, NEVER SILENCE — if the result
// says the booking is still being saved (demo_in_progress), she adds ONE more
// short bridge line and keeps the caller warm; one line per stretch, never a
// stack, never silence. (3) THE STOP RULE — a stored-outcome / duplicate /
// already-done result IS the finished answer: announce it and never re-call
// book_demo hoping for a different result.
// The system-side result texts (what the tools tell her to say) are NOT
// touched by this fix — the protected suites assert no hold line appears in
// them, and they still pass unchanged; this suite asserts the PROMPT layer.
process.env.TWILIO_ACCOUNT_SID = "ACtest"; process.env.TWILIO_AUTH_TOKEN = "twtoken"; process.env.TWILIO_SMS_FROM = "+14045550999"; process.env.VOICE_WEBHOOK_URL = "https://hooks.test/voice"; process.env.VOICE_BRIDGE_URL = "wss://voice.test/twilio"; process.env.VOICE_BRIDGE_SECRET = "bridgesecret";
process.env.ROUTING_PROVIDER = "osrm"; process.env.OSRM_URL = "https://osrm.test"; process.env.RESEND_API_KEY = "rk";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); console.log("ok -", m); n++; };
const P = require("../netlify/functions/lib/voice/prompt.js");

(async () => {
  const bP = P.build({ agent_name: "Elevate" }, { name: "POTENT Logistics", slug: "potent-logistics" });
  const bT = P.build({ agent_name: "Elevate" }, { name: "Cutz Salon", slug: "cutz-salon" });

  // ── (1) SPEAK BEFORE YOU SAVE: the hold line is its own turn, BEFORE the tool call ──
  ok(/SPEAK BEFORE YOU SAVE/.test(bP), "1 ORDER: the demo contract states the sequence rule — speak before you save");
  ok(/say one short hold line out loud as its own turn/.test(bP), "1 ORDER: the hold line is spoken as its own turn, not bundled into the tool call");
  ok(/One second — let me get that set up for you/.test(bP), "1 ORDER: Tony's approved hold line is the first wording offered");
  ok(/Hold on one moment, I'm looking this up for you/.test(bP), "1 ORDER: the alternate approved wording is offered too — wording flexes to the situation");
  ok(/your voice goes first, the tool call second/.test(bP), "1 ORDER: voice first, tool call second — the caller never sits in silence while the save runs");
  ok(/That order holds for any save you fire right after a caller's yes/.test(bP), "1 ORDER: the rule is general wait discipline, not demo-only — it holds for any save after a caller's yes");
  ok(bP.indexOf("SPEAK BEFORE YOU SAVE") < bP.indexOf("call book_demo ONCE"), "1 ORDER: the hold-line rule is stated BEFORE the book_demo call instruction it governs");
  ok(!/SPEAK BEFORE YOU SAVE/.test(bT) && !/DEMO BOOKING/.test(bT), "1 ORDER: the rule lives in the Potent-gated demo contract — a tenant's instructions carry none of it");

  // ── (2) BRIDGE, NEVER SILENCE: a stretched wait gets ONE more line ──
  ok(/still being saved \(demo_in_progress\)/.test(bP), "2 BRIDGE: the contract names the still-being-saved result she may get");
  ok(/say ONE more short bridge line/.test(bP) && /Still setting that up for you — just one more moment/.test(bP), "2 BRIDGE: a stretched wait gets one more short bridge line, with approved wording");
  ok(/do not go quiet and do not call again/.test(bP), "2 BRIDGE: on a stretched wait she neither goes quiet nor re-calls the tool");
  ok(/one bridge line per stretch, never a stack of them and never silence/.test(bP), "2 BRIDGE: one line per stretch — never a stack of hold lines, never silence");

  // ── (3) THE STOP RULE: a stored-outcome result is the finished answer ──
  ok(/A result that hands you back the stored outcome — already booked, a duplicate, done — IS the finished answer/.test(bP), "3 STOP: a stored-outcome / duplicate / already-done result IS the finished answer");
  ok(/announce it the way it tells you and stop; never call book_demo again hoping for a different one/.test(bP), "3 STOP: announce it and stop — never re-call hoping for a different result");
  ok(/never call book_demo again on that call for any reason; the booking step does not reopen/.test(bP), "3 STOP: Fix 3's never-again rule survives alongside the explicit stop rule");

  // ── (4) NOTHING ELSE MOVED: the surrounding contract reads as before, no name planted ──
  ok(/call book_demo ONCE/.test(bP) && /announce the result ONCE/.test(bP) && /never tell the caller the demo is set up unless the tool returned ok/.test(bP), "4 UNCHANGED: the Fix 1–3 demo contract lines survive (call ONCE, announce ONCE, no false set-up claim)");
  ok(/never say a hold line over it/.test(bP), "4 UNCHANGED: the refusal path still forbids covering a read_back_required bounce with a hold line — the hold line belongs to the save, not the refusal");
  ok(!/Mendes/.test(bP) && !/Mendez/.test(bP) && !/Mendies/.test(bP) && !/Mendis/.test(bP), "4 UNCHANGED: no caller's name — spelled, drifted, or pronounced — is hard-coded in the new wording");

  console.log("\n" + n + " assertions passed — voice-hold-line (Fix 5: hold line spoken first as its own turn, one bridge line on a stretched wait, stored outcome announced and never re-called)");
})().catch(e => { console.error("FAIL:", e && e.message); process.exit(1); });
