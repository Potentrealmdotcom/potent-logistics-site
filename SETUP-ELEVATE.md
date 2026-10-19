# Əlevate — your private assistant

Open `/elevate/` (installs to a phone home screen). Type or tap the mic and talk.

## What works today (tested with mocks; voice not yet tried against real OpenAI)
- Sign in with Google (only emails in `ELEVATE_OWNER_EMAILS`) or "Continue as POTENT owner" if you are already signed in to POTENT OS.
- Text chat that can save notes, add tasks/reminders, mark tasks done, remember facts, list and search them.
- Voice: the browser talks straight to OpenAI Realtime with a 2-minute key minted by `elevate-api`; the same tools run through `voice_tool`. Auto-stops at 15 minutes.
- Tasks / Notes / Memory tabs: add, tick off, delete (you can see and delete everything the assistant saved).

## What it deliberately cannot do yet
Send email or texts, place calls, book, spend or move money, change POTENT business records. It says so instead of pretending.
Those come later and will each need your tap to approve.

## Setup (Netlify env, then redeploy)
| Variable | What |
|---|---|
| `ELEVATE_OWNER_EMAILS` | your Gmail(s), comma separated. Also sets which account the OS-owner sign-in maps to |
| `OPENAI_API_KEY` | already set for other tools; Əlevate uses it too |
| `GOOGLE_CLIENT_ID` | optional, from Google Cloud; shared with Continue-with-Google everywhere |
| `ELEVATE_OWNER_PHONES` | your cell number(s), like +14045550100 (phone line) |
| `ELEVATE_PHONE_NUMBERS` | the Twilio number bought for Əlevate (not the logistics one) |
| `ELEVATE_PIN_HASH` | output of `node server-kit/elevate-pin.js` |
| `ELEVATE_CHAT_MODEL` | optional, default `gpt-4o-mini` |
| `ELEVATE_VOICE_MODEL` / `ELEVATE_VOICE` | optional, default `gpt-realtime-2.1` / `marin` |

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
