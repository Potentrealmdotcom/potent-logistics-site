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
| `GEMINI_API_KEY` | Optional. AI helper. Everything works without it |
| `AI_MODEL` | Optional. Defaults to `gemini-flash-latest` |

## Stripe webhook events to enable
`checkout.session.completed`, `invoice.paid`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`
Endpoint: `https://<your-site>/.netlify/functions/stripe-webhook`

## Database
Run the SQL files in this order on a fresh project (they are additive): `beats-schema.sql`, `beat-market.sql`, `beat-tags.sql`, `beat-uploads.sql`, `music-schema.sql`, `music-batch2.sql`, then the migrations applied through the Supabase tool (`music_rights_splits`, `music_ai_usage_cache_mode`, `ace_sales`, `beat_featured`, `music_coins_contracts`, `music_platform_completion`). The live project already has all of them.

## Fee rules (fixed)
POTENT 1% on beat sales. Seller keeps 91% or more. The rest is unassigned until a written agreement names who gets it (Studio → Admin tools → Remainder). Music downloads: 1% POTENT, 99% seller. Pricing is not editable from the UI.

## Turning things on
* **Coin payments:** Studio (owner) → Coins & contracts → "Turn coin payments on". Off by default. Coins are ledger-only: no transfers, no cash-out, no card top-up.
* **Staff:** Studio → Admin tools → Staff. The person signs up for a normal Music account first, then you grant Moderator or Support. They sign in on the Studio "Staff" tab.
* **Feature switches:** Studio → Admin tools → Controls (AI, sign-ups, cart, downloads per purchase).
* **Coupons:** Studio → Admin tools → Coupons (created in your Stripe account).

## Not built in (integration points)
* Email sending (no provider connected; the email list downloads as CSV with unsubscribe links).
* Stripe Connect payouts (sellers are paid from the wallet by hand with the payout code).
* Distribution / PRO / publishing-admin registration (records and checklists only; nothing is submitted for you).
* Large-video hosting (links and direct files up to 50 MB; connect a video host for bigger files).
* Audio watermarking of previews (previews are 30-second clips cut in the browser).

## Demo data
Nothing in the app is seeded demo data. Anything you add for testing, name it "TEST" and delete it before launch.
