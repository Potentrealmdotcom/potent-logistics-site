# Əlevate — your private assistant

Open `/elevate/` (installs to a phone home screen). Type or tap the mic and talk.

## What works today (tested with mocks; voice not yet tried against real Gemini)
- Sign in with Google (only emails in `ELEVATE_OWNER_EMAILS`) or "Continue as POTENT owner" if you are already signed in to POTENT OS.
- Text chat that can save notes, add tasks/reminders, mark tasks done, remember facts, list and search them.
- Voice: the browser talks straight to Gemini Live with a one-use key minted by `elevate-api`; the same tools run through `voice_tool`. Auto-stops at 15 minutes.
- Tasks / Notes / Memory tabs: add, tick off, delete (you can see and delete everything the assistant saved).

## What it deliberately cannot do yet
Send email or texts, place calls, book, spend or move money, change POTENT business records. It says so instead of pretending.
Those come later and will each need your tap to approve.

## Setup (Netlify env, then redeploy)
| Variable | What |
|---|---|
| `ELEVATE_OWNER_EMAILS` | your Gmail(s), comma separated. Also sets which account the OS-owner sign-in maps to |
| `GEMINI_API_KEY` | already set; Əlevate chat and voice use it |
| `GOOGLE_CLIENT_ID` | optional, from Google Cloud; shared with Continue-with-Google everywhere |
| `ELEVATE_OWNER_PHONES` | your cell number(s), like +14045550100 (phone line) |
| `ELEVATE_PHONE_NUMBERS` | the Twilio number bought for Əlevate (not the logistics one) |
| `ELEVATE_PIN_HASH` | output of `node server-kit/elevate-pin.js` |
| `ELEVATE_CHAT_MODEL` | optional, default `gemini-3.8-flash` |
| `ELEVATE_VOICE_MODEL` / `ELEVATE_VOICE` | optional, default `gemini-3.8-live` / `Kore` |

Database: `elevate.sql` (already applied to the live POTENT project; table `elevate_items`, RLS on, server-only).

## Safety design
- Tokens are signed with a different key than POTENT staff tokens and cannot be swapped either way.
- Every read/write is scoped to the signed-in owner key. Tools cannot reach other people's rows.
- Saved notes/memory are passed to the model as data, never instructions; unknown tool names are refused.
- Rate limits: chat 40/hour, voice starts 6/hour.

## Phone line (built; needs real-world testing)
A SECOND Twilio number calls Əlevate. Same audio-bridge server as logistics; separate webhook (`elevate-phone`), separate table (`elevate_calls`), separate rules.
1. The call must arrive on a number in `ELEVATE_PHONE_NUMBERS`, from a phone in `ELEVATE_OWNER_PHONES` (E.164, comma separated).
2. Twilio asks you to key a 6-digit PIN on the keypad; the server checks it against `ELEVATE_PIN_HASH` (make it with `node server-kit/elevate-pin.js`). The AI never hears or handles the PIN.
3. 3 wrong PINs from a phone, or 10 from anyone, in an hour = locked out. Max 40 calls a day. Calls end at `ELEVATE_PHONE_MAX_MIN` (default 15).
4. Words and audio are not stored. Only who/when/how long (`elevate_calls`).
Twilio: Voice URL `https://<site>/.netlify/functions/elevate-phone` (POST), Status callback `...elevate-phone?a=status`.
Limits: caller ID can be faked, so the PIN is the real lock; the PIN digits pass through Twilio's logs. Choose a PIN you use nowhere else.

## Not built yet
Email/calendar connections, approved outward actions,
native Android/desktop apps, offline local model, end-to-end encrypted messaging. The Griffin spec calls for independent
security review before any "private/untraceable" claims, so none are made.

Tests: `node tests/elevate.test.js` (44), `node tests/elevate-phone.test.js` (34).

## Life OS home screen (built; see what is real and what is not)
Open `/elevate/`: the home screen has a world map, the voice orb, a Today panel and the section list. The name and the upside-down e are unchanged.
- **Map**: Equal Earth projection (a real equal-area projection) over Natural Earth country outlines. The outlines load in the browser from `cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json` and are cached for offline reuse. If that source cannot be reached the map says so, offers Retry, and the saved-places list still works. Pan, zoom (buttons, wheel, pinch, keyboard), pick a country from the list, tap to choose a spot.
- **Layers**: only "My saved places" is real (your own pins, rounded to about 1 km, labelled "saved by you, not live tracking"). Logistics jobs, projects and opportunities are shown as planned and switched off. Nothing on the map is animated to look like live tracking.
- **Orb**: states come from real events only: mic and speech events from the voice connection, tool calls, text-chat requests, the network. Audio level comes from the real microphone / speech audio. "Working" is a spinner, not a percentage, because there is no real progress number to show. "Waiting for approval" exists but nothing triggers it yet because nothing needs approval yet.
- **Today**: counts come from your real tasks. Calendar is shown as "not connected yet". "Organize my day" asks the assistant to suggest an order; it changes nothing.
- **Settings**: Map home or Classic list home, voice (names from the speech provider's list), reduce motion (also follows the device), hide sections. These live in the browser only.
- **Sections not built yet** (shown as "Planned" and greyed out): Life, Calendar and routines, Family and household, Health and wellness, Business, Logistics and operations, Projects, Research and creation, Agents and skills, Communications, Devices and integrations, Activity and audit.
- Database: `elevate.sql` now allows kind `place` with `lat`/`lon` (already applied live as migration `elevate_places`).
- Tests: `node tests/elevate.test.js` (server) and `node tests/elevate-ui.test.js` (real Chromium, stubbed API and map file).
- Not tried against the real world-atlas file, real Gemini voice, or a real phone yet.

## Offline (Ghost Mode style)
Install `/elevate/` to the home screen (Android: browser menu > Install app; iPhone: Share > Add to Home Screen), open it once with a connection, and from then on it opens with no signal.
- **Works offline**: the whole app opens; your last-loaded tasks, notes, memory and saved places are readable; the map outlines come from the saved copy; you can add, tick off and delete tasks, notes, memory and places. Those changes wait in an outbox on the device ("N waiting to sync" at the top) and go to the server, in order, when the connection returns (and every 30 seconds while online).
- **Needs a connection** (cannot be offline): the AI assistant (text and voice), the phone line, first sign-in, and anything you have never loaded before. The orb says "Not connected" with this note instead of pretending.
- **Honest limits**: the outbox lives in this browser, so clearing site data or signing out before it syncs loses those changes (sign-out warns you first). If the connection drops at the exact moment a save is confirmed, that one item can be saved twice. Offline changes made on two devices are applied in the order they arrive; there is no merge.
- Files: `elevate/sw.js` (service worker, caches the app and the map file), outbox code in `elevate/index.html`. Tested in a real browser with the network cut: `node tests/elevate-ui.test.js`.

## Pricing (decided Oct 20, 2026; nothing in the app charges yet)
- **Əlevate alone** (people who do not own POTENT OS): **$50 a month**. Covers the AI assistant, voice and offline app.
- **With a POTENT OS license**: the Əlevate app (offline notes, tasks, map) is included at no extra charge. License prices are the v12 grid: $4,995 (1–10 trucks), $9,995 (11–50), $19,995 (51–150), $34,995 (151–300), custom above 300.
- **AI assistant and voice for license holders**: part of the optional annual support (v12: $1,788 / $2,988 / $4,788 / $7,188 a year), or they use their own Gemini key.
- Check the real Gemini cost per person after a week of use; $50 should leave a healthy margin over that.
- **Not built**: billing. There is no checkout, no subscription, and no plan check inside Əlevate yet. Today the owner's allow-list (`ELEVATE_OWNER_EMAILS`) is the only gate.

## Billing: Əlevate AI $50/month + voice credits (built; NOT yet tried with a real Stripe payment)
- **Plan**: $50 a month = 120 voice minutes per billing month, plus text chat, offline notes/tasks/map. **Credit packs** (always $0.25 a minute): $10 = 40 min, $25 = 100 min, $50 = 200 min; credits last 12 months. Constants are at the top of `netlify/functions/lib/elevate-billing.js`.
- **Who is never blocked**: the emails in `ELEVATE_OWNER_EMAILS`, the POTENT OS owner, and anyone the owner marks "comped" (`o_account_set`). Their calls are still logged. Owner can also give free minutes (`o_credit_grant`, 1 to 600 minutes).
- **How minutes are counted**: the server times each voice session itself (starts when the voice key is made; the page pings each minute; ends when the page says so; if the page vanishes it is charged up to the last ping plus one minute). One voice session at a time per person. A call can run at most 15 minutes and never longer than the minutes left. The phone line is logged too.
- **Buying**: on the login screen pick Subscribe or a pack, then Continue with Google (Google proves the email, so the purchase lands on that person's own account). Signed-in people use Settings, Plan and voice minutes.
- **Needs set up by you**: Netlify env `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (already used by POTENT). The existing Stripe webhook must send: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed` (most are on already for POTENT OS and POTENT VOICE).
- **Honest limits**: tested only with fake Stripe and fake Gemini. Please do one real $10 test purchase and one real call before selling. Settings has a "Manage or cancel plan" button (Stripe portal; turn the portal on in Stripe settings once). Not built: invoices/receipts screen, minutes top-up reminders, and a per-person cost report (compare each person's logged minutes with your OpenAI bill after a week).
- Tests: `node tests/elevate-billing.test.js`. Database: `elevate.sql` (applied live as migration `elevate_billing`).
