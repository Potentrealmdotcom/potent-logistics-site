# POTENT MUSIC: setup and deploy guide

One entry in the OS app (Partner Apps → "POTENT MUSIC") opens `/music/`. Everything else is linked from there.

## What lives where
| Path | What it is |
|---|---|
| `/music/` | Public home, search, releases, account, coins, projects/splits, receipts, signing |
| `/beats/` | Exclusive-master beat store |
| `/studio/` | Creator studio, owner admin tools, staff (moderator/support) sign-in |
| `/beatman/` | Beat Man: seller earnings, payouts, owner beat tools |
| `netlify/functions/music-*.js`, `beat-*.js` | The API (see list below) |

## Netlify environment variables
Set under Site configuration → Environment variables. Never commit these.

| Variable | Needed for |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Database (server only) |
| `AUTH_SECRET` | Signs login tokens and signed links |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Card checkout, coupons, refunds |
| `MAILJET_API_KEY`, `MAILJET_SECRET_KEY` | Optional. Emails for orders/payments/payouts (same Mailjet account as Logistics). Sender `potentrealm@proton.me` must be a verified sender in Mailjet; override with `MUSIC_FROM_EMAIL` |
| `GEMINI_API_KEY` | Optional. AI helper. Everything works without it |
| `AI_MODEL` | Optional. Defaults to `gemini-flash-latest` |

## Stripe webhook events to enable
`checkout.session.completed`, `invoice.paid`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`
Find them: Stripe Dashboard → Developers → Webhooks → your endpoint → Select events. The signing secret (whsec_…) is on the same page → `STRIPE_WEBHOOK_SECRET`.
Endpoint: `https://<your-site>/.netlify/functions/stripe-webhook`

## Database
Run the SQL files in this order on a fresh project (they are additive): `beats-schema.sql`, `beat-market.sql`, `beat-tags.sql`, `beat-uploads.sql`, `music-schema.sql`, `music-batch2.sql`, then the migrations applied through the Supabase tool (`music_rights_splits`, `music_ai_usage_cache_mode`, `ace_sales`, `beat_featured`, `music_coins_contracts`, `music_platform_completion`). The live project already has all of them.

## Fee rules (fixed)
POTENT 1% on beat sales. Seller keeps 91% or more. The rest is unassigned until a written agreement names who gets it (Studio → Admin tools → Remainder). Music downloads: 1% POTENT, 99% seller. Pricing is not editable from the UI.

## Turning things on
* **Coins:** On by default. 1 coin = $1. Buyers top up by card on /music/coins.html (Stripe Checkout, product `MUSICCOIN`, coins added by the webhook). Every $1,000 bought earns a $100 coin reward; a refund or lost chargeback takes the coins (and the reward they earned) back. Coins have no cash-out and no transfers. Switch off: Studio → Coins & contracts. Coins are spent in POTENT Music; spending them on logistics services is NOT built.
* **Staff:** Studio → Admin tools → Staff. The person signs up for a normal Music account first, then you grant Moderator or Support. They sign in on the Studio "Staff" tab.
* **Feature switches:** Studio → Admin tools → Controls (AI, sign-ups, cart, downloads per purchase).
* **Coupons:** Studio → Admin tools → Coupons (created in your Stripe account).

## Not built in (integration points)
* Email: order/payment/payout notices send through Mailjet once keys are set (free plan = 200/day). Marketing blasts are not built (the email list downloads as CSV).
* Stripe Connect payouts (sellers are paid from the wallet by hand with the payout code).
* Distribution / PRO / publishing-admin registration (records and checklists only; nothing is submitted for you).
* Large-video hosting (links and direct files up to 50 MB; connect a video host for bigger files).
* Audio watermarking of previews (previews are 30-second clips cut in the browser).

## Demo data
Nothing in the app is seeded demo data. Anything you add for testing, name it "TEST" and delete it before launch.

## Beat Lab, Smoke Sessions, Breeze, LEGIT Weddings
* **Beat Lab** (/music/lab.html): owner grants engineers (owner action `o_eng_set`). Private bucket `lab-files`, 2 GB per engineer, 50 MB per file. Export is WAV only. Needs `music-lab-smoke.sql` (already applied live).
* **Smoke Sessions / LIVE 360°** (/music/live.html): polling based (no media server), so live voice/video is a stream link only. Recording is off unless the host turns it on; POTENT stores no audio.
* **Breeze**: one Beat Man login (`/beatman/`, user `breeze`). Store admin is ON. He sees Earnings (one wallet for beats + AceHeals), Store and AceHeals tabs, and no payout controls. Change his password on first sign-in (the old SQL file's hash is in git history).
* **Staff roles** (moderator/support/store admin) can never reach money actions; only the owner token can. Payouts need the owner's payout code.
* **LEGIT Weddings** (/legit/weddings.html): Georgia-only consultation requests and package catalogue ($10,000 Signature, $25,000 VIP; guest limits are editable placeholders). A request is not a booking and nothing is charged. NOT built: contracts, payments, vendor marketplace, logistics job orders, guest/RSVP tools, wedding financials.
