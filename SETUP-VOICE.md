# POTENT VOICE — setup, architecture and honest status

POTENT VOICE answers company phone lines with an AI voice agent, collects shipment details, applies the company's own truck rules and prices,
and either books the job or hands the call to a person. It lives inside POTENT OS (`/voice/`) and bills as a monthly add-on matched to the OS license tier.

## 1. Architecture

```
 Caller ──phone──▶ Twilio number ──(1) POST signed webhook──▶ Netlify  voice-webhook  ──▶ TwiML <Connect><Stream wss://voice.<domain>/twilio>
                         │                                            │ checks: signature, number→company, subscription, call limits, emergency stop
                         └──(2) mu-law audio over WebSocket──▶ Hetzner VPS: voice-bridge (Node) ◀──WebSocket──▶ OpenAI Realtime (speech in/out)
                                                                   │  holds NO rules and NO data; only OPENAI_API_KEY
                                                                   ▼ (3) HTTPS + shared secret
                                                   Netlify  voice-tools  ──▶ lib/voice/tools.js (15 tools) ──▶ Supabase (service role only)
                                                                   │          intake · rules · pricing · availability · booking RPC (atomic)
 Staff ──browser──▶ /voice/ (Control Center) ──▶ Netlify voice-api / voice-billing ──▶ Supabase     Stripe ──webhook──▶ stripe-webhook ──▶ billing
```

Why a VPS: Netlify functions cannot hold a WebSocket. The bridge is a small Node process (`server-kit/voice-bridge`) behind Caddy at `voice.<your domain>`.
Every fact and action goes back through `voice-tools`, which re-validates it; the model cannot set a price, a company, a discount, or its own "caller said yes".

## 2. What is in the repo
| Area | Files |
|---|---|
| Billing / tiers | `netlify/functions/lib/voice/billing.js`, `voice-billing.js`, `stripe-webhook.js` (voice branches), `voice-billing.sql` |
| Core engine | `lib/voice/{intake,rules,pricing,route,availability,store,tools,prompt,outbound,auth}.js` |
| Provider adapters | `lib/voice/adapters/{twilio,realtime}.js` (replaceable) |
| Endpoints | `voice-webhook.js` (phone company → us), `voice-tools.js` (bridge → us), `voice-api.js` (Control Center), `voice-billing.js` |
| Bridge + installer | `server-kit/voice-bridge/*`, `server-kit/install-voice.sh` |
| Control Center | `voice/index.html` (also linked from the OS Partner Apps menu) |
| Database | `voice-billing.sql`, `voice-core.sql` (parity copies; both already applied to the live Supabase project) |
| Tests | `tests/voice{billing,engine,bridge}.test.js`, `tests/voice.test.js`, shared fake `tests/_voicemock.js` |

## 3. Environment variables
**Netlify:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM` (only for texting), `VOICE_BRIDGE_URL` (`wss://voice.<domain>/twilio`), `VOICE_BRIDGE_SECRET` (long random; the installer prints it),
`VOICE_WEBHOOK_URL` (optional; the exact public URL of `voice-webhook`, if a proxy changes it), `ROUTING_PROVIDER` (`ors` or `osrm`) with `ORS_API_KEY` or `OSRM_URL`, plus the existing `STRIPE_*`, `AUTH_SECRET`, `MAILJET_*`.
**Bridge host:** `OPENAI_API_KEY`, `VOICE_BRIDGE_SECRET` (same value), `SITE_URL`, optional `VOICE_AI_MODEL`. The installer writes these.

## 4. Webhooks and APIs
* Twilio number → Voice webhook (POST): `https://<site>/.netlify/functions/voice-webhook`. Status callback: same URL `?a=status`. Other routes (`fallback`, `xfer`, `dial`) are set by the code itself.
  Every request is rejected (403) unless the `X-Twilio-Signature` matches. Duplicate CallSids reuse the same session.
* Bridge → `voice-tools` (bearer `VOICE_BRIDGE_SECRET`): `health`, `context`, `tool`, `transcript`, `end`, `transfer`.
* Control Center → `voice-api` (staff login): reads (`dashboard`, `calls`, `call`, `bookings`, `handoffs`, `callbacks`, `knowledge`, `config`, `profiles`, `suppressions`, `campaigns`, `audit`, `export_calls`), staff actions, owner-only settings, and a test simulator.
* Stripe → existing `stripe-webhook`: add events `invoice.created`, `customer.subscription.updated` (plus the ones already listed). Idempotent per event.

## 5. Security model (summary)
Company staff are pinned to their own `orgId` on the server; only POTENT's owner login may name another company. Assist/customer/driver tokens are refused. Row-level security is on for every table with no policies, so only the server can read or write.
Transcripts redact card numbers and password-like text. Viewing a transcript, exporting, and every setting change are audit-logged with the person. Recording stays off until plan + setting + consent confirmation are all true, and the caller is told.
Outbound calling passes 14 gates (plan, owner checklist, approved running campaign, consent record, opt-out list, calling hours/weekday, attempt limit, emergency stop…).

## 6. Money rules (voice add-on)
Starter $199 / Growth $499 / Fleet $999 / Enterprise $1,999+ per month, matched automatically to the company's OS tier; OS license prices and support plans are untouched.
Included minutes / overage / concurrency / max length per tier are **proposed defaults the owner must confirm** (300/1000/3000/10000 min; 50/45/40/35¢ over; 2/5/15/50 calls; 15/20/30/60 min). Owner edits them in Control Center → Plan & usage (platform owner view).
No subscription is ever shown active unless Stripe reports it paid.

## 7. Tested live / tested with fakes / not built
**Tested against the real thing:** database migrations applied to the live Supabase project; Twilio signature algorithm checked against Twilio's published example.
**Tested with fakes (logic proven, provider behavior not):** all 324 voice assertions — tiers and billing, intake, eligibility, pricing, availability, booking race (second request refused), duplicate/replayed events, bad signature, emergency stop, cross-company access, plan gating, bridge barge-in/transfer/timeouts, outbound gates, the Control Center API. The Postgres booking function is emulated in tests; its SQL is live but has not been exercised by a real concurrent call.
**Not yet verified with real services (must be done by a person, see the checklist):** a real Twilio call; OpenAI Realtime event names for the model you choose (the adapter accepts both known naming styles); the bridge on a real server; a real Stripe subscription and webhooks; Census and routing lookups; Mailjet confirmations; SMS.
**Not built:** the automatic outbound dialer (`a=outbound` route) — campaigns can be drafted, approved and checked, but no calls are placed; SMS delivery needs Twilio A2P/10DLC registration before it works to US phones; call-recording playback; per-company bridge scaling beyond one VPS.

## 8. Known limits that affect real calls
* A booking only auto-confirms when the truck is provably free: needs an authorized vehicle profile, an active driver row (or "I drive myself" mode), and every other job that day has a time. Otherwise it stays a request for a person.
* Quotes need: load-size tiers set by the owner, and a routing provider. Without either the agent says a person will quote — it never guesses.
* Waiting-time rate: OS uses $75/hr; the original brief said $50. The code uses the OS value — decide which is right.

## 9. Readiness checklist
- [ ] Twilio account, number bought, number added to Agent settings, webhooks pointed at the site
- [ ] Hetzner server + `install.sh` then `install-voice.sh`; `voice.<domain>` A record; `/health` returns ok
- [ ] Netlify env vars set; site redeployed
- [ ] Stripe webhook events added; $1 test subscription works
- [ ] Vehicle profile seeded, checked against the real truck, authorized
- [ ] Load-size tiers + routing provider set; driver data or owner-operator mode set
- [ ] Transfer number set; test a transfer
- [ ] Control Center → Test simulator run end to end
- [ ] 5 real test calls (success, info-only, bad address, too heavy, hang-up) reviewed in Calls
- [ ] Emergency stop tested
