# Carrier vetting + LEGIT onboarding (what changed, what to turn on)

## Carrier vetting (replaces trusting the browser)
- On every carrier application the SERVER now looks up FMCSA and the phone's line type (Twilio Lookup v2), scores it, and saves the evidence in `carrier_vetting` (migration: `vetting.sql`, already applied).
- Staff see a "Vetting recommendation" panel on each pending application: status, risk score, plain-English reasons, buttons "Live person, ID matches" / "Does not match" / "Re-run checks".
- It is a RECOMMENDATION. Approving something the engine rejected or held asks for an explicit confirm and is recorded.
- Statuses: APPROVED (needs verified authority AND a confirmed ID match), MANUAL_REVIEW, REJECTED (inactive authority / out-of-service), HOLD_REQUIRES_LIVENESS (VOIP line without confirmed ID).
- FMCSA down, or carrier not found (e.g. intrastate-only) goes to a person; it never auto-rejects.
- ELD: wired as a labelled placeholder. It has NO effect on the score until a partner feed sets `eld.status = "connected"` with real unit counts.

Netlify env vars: `FMCSA_WEBKEY` (the same FMCSA key already in app.js), plus the existing `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`. Without them, checks show "could not be checked" and everything goes to manual review. Twilio Lookup line-type costs roughly a cent per application.

Not built (needs a vendor, would be faked otherwise): automated liveness/ID-vs-FMCSA matching. Today a person records the match; Stripe Identity (already used in LEGIT) is the natural vendor to plug into `partneridv`.

## LEGIT onboarding
New members go: sign up -> ID verify -> 11 one-question screens (gender, who, what for, photos, then optional drinking/smoking/kids/pets/activity, bio, who you see). Lifestyle and bio steps have Skip. Only the five lifestyle keys are ever stored; religion/politics/ethnicity/health are deliberately not collected. Answers are shown to others only if given, editable in Profile, and deleted with the account. Migration: end of `legit-schema.sql` (already applied).
