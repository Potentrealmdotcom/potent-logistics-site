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
- Transfer fix (Fix 8, this push): `twimlDial` now takes a callerId and every
  person-dial (xfer, fallback, rejected-call rescue) goes out under the number
  the customer called (the org's own number) instead of defaulting to the
  caller's number — Call 14's dials were refused in ~5s ("failed") because the
  leg claimed the caller's Google Voice number. And a transfer that does not
  connect no longer ends in silence: the dial-result handler speaks "Sorry, no
  one could take the call. We will call you back." (callback already saved).
  Full hand-back to the assistant after a missed transfer rides with the
  warm-transfer build (next upgrade).

## Suites (all green at this state)
voice 318 · voice-schema 648 · voicebridge 67 · elevate 52 · elevate-phone 34 ·
voiceengine 63 · voice-owner-report 35. Run them before and after any change.

## Known limits (do not re-litigate)
- Google transcribes BOTH sides and sometimes garbles (names, numbers). Our code
  cannot fix Google's ears; recording-based transcripts are the parked cure.
- Response latency during back-to-back tool calls is the open investigation;
  the hold-on line covers the caller's experience meanwhile.

## Canonical transcripts (built Oct 30, 2026 — pending push)
- Tony's rule: the transcript must be word for word or the product is pointless. The
  parked cure is built: `lib/voice/canonical.js` parks the owner report when a Twilio
  recording exists (bounded by CANONICAL_WAIT_MIN, default 10 min, live transcript as
  fallback); the bridge-host worker in `server-kit/voice-bridge/transcriber/`
  (faster-whisper, per-channel on dual-channel recordings, role-anchored on mono) posts
  the recording's lines back, they REPLACE the live rows in voice_transcripts (same
  {role, text, seq} shape), and only then does the report go out.
- Proof on Call 16 (Oct 30): canonical caller line reads "1200 Peachtree Street" (live
  storage had the agent's "1,500" mishearing saved as the caller's words), the callback
  number line is complete ("ending in 1-6-1-6"), and the "St" / "tarde" / "¿Aló?"
  artifacts are gone. Suite: tests/voice-canonical.test.js (11 assertions).

## Announcement defect bundle 2026-11-04a (built Nov 4, 2026 — pending push)

Adapter stamp 2026-11-04a. Fixes the six retest-2/retest-3 defects with system
enforcement, not prompt wording:
- Address loop: geocoder-verified addresses lock (intake._addr_lock, keyed by
  normalized identity in intake.normAddr); fragmentary replacements are ignored,
  same-address re-sends change nothing and can no longer invalidate a quote, and
  a format-failed address is accepted as stated after two collects
  (_addr_as_stated). Eligibility geocodes both addresses in parallel.
- Email: deterministic spelled-letter assembler (lib/voice/email-capture.js) fed
  from caller transcript lines; the assembled address (_email_candidate) is
  ground truth in collect_shipment_details.
- Stall cap: the hold line's own audio no longer disarms HOLD_RECOVERY
  (per-check ownHoldAt window in bridge.js runTool).
- Latency: caller turns flush to the bridge within ~1–2 s (adapter flushCaller,
  1 s poll / 1.2 s fuse); collect saves intake once per call; tool execute runs
  the duplicate check and plan check in parallel; routing has an overall ~10 s
  deadline so a quote answer always lands inside the bridge's tool window.
- Goodbye: bridge GOODBYE_RE + watchdog fuse ends the call after a caller
  goodbye; end_call kind caller_done records outcome caller_requested_end
  (owner report label "Ended (caller finished)"), no abusive-caller alarm.
- Reference: confirm returns reference_spoken in spaced groups exactly once
  (_ref_announced); prompt closing and the bridge close-nudge no longer order
  a repeat. Prompt also carries the §3.9 build-privacy answer.
Suites: tests/email-capture.test.js, tests/voice-fixups.test.js,
tests/voicebridge-fixups.test.js plus the full voice/voicebridge set.
