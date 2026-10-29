# POTENT VOICE / Elevate — build state (updated Oct 29, 2026)

Single source of truth: this repo, branch `main`. If you are Claude or any other builder:
pull main before touching anything, and verify every claim against code, tests, or
live call records before reporting. Do not work from old checkouts or summaries.

## Shipped and live (Oct 29, 2026)
- Transcript fidelity (main `6129896`): the stored transcript holds only words the
  caller actually heard. Adapter `gemini-live.js` is version **2026-10-29a** and
  counts audio chunks per line; the bridge truncates cut-off lines at the played
  fraction and drops lines with no audio. The watchdog check-in wording matches
  the prompt's one allowed check-in ("still with you").
- Deaf lane (main `6163c89`, bridge.js): caller audible (loudness) but never
  transcribed → stage 1 she says she can't hear them, stage 2 the bridge rebuilds
  the AI session mid-call (`caller_not_transcribed`), stage 3 she saves a callback
  and closes warm. Never arms once any caller words transcribe.
- Persona + pause fix (this push): prompt.js carries the hold-on line before any
  check (NO DEAD AIR rule), voice-steadiness, thick Southern persona, backchannel,
  slang/mumble handling, and the NAMES rule (if a name's spelling is unsure, ASK —
  never save a guessed name).
- 50-cent test charge: REMOVED (Netlify env var deleted Oct 29). Keypad payment
  charges the real quote.
- Do-not-contact: Fix 6 outcome `ended_do_not_contact`; Control Center has a
  working Remove button; the DNC list was emptied Oct 29.

## Suites (all green at this state)
voice 318 · voice-schema 648 · voicebridge 67 · elevate 52 · elevate-phone 34 ·
voiceengine 63 · voice-owner-report 35. Run them before and after any change.

## Known limits (do not re-litigate)
- Google transcribes BOTH sides and sometimes garbles (names, numbers). Our code
  cannot fix Google's ears; recording-based transcripts are the parked cure.
- Response latency during back-to-back tool calls is the open investigation;
  the hold-on line covers the caller's experience meanwhile.
