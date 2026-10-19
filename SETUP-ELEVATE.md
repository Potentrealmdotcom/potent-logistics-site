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
| `ELEVATE_CHAT_MODEL` | optional, default `gpt-4o-mini` |
| `ELEVATE_VOICE_MODEL` / `ELEVATE_VOICE` | optional, default `gpt-realtime-2.1` / `marin` |

Database: `elevate.sql` (already applied to the live POTENT project; table `elevate_items`, RLS on, server-only).

## Safety design
- Tokens are signed with a different key than POTENT staff tokens and cannot be swapped either way.
- Every read/write is scoped to the signed-in owner key. Tools cannot reach other people's rows.
- Saved notes/memory are passed to the model as data, never instructions; unknown tool names are refused.
- Rate limits: chat 40/hour, voice starts 6/hour.

## Not built yet (phase 2+)
Phone line into Əlevate (caller-ID + spoken PIN, reusing the voice bridge), email/calendar connections, approved outward actions,
native Android/desktop apps, offline local model, end-to-end encrypted messaging. The Griffin spec calls for independent
security review before any "private/untraceable" claims, so none are made.

Tests: `node tests/elevate.test.js` (44 assertions).
