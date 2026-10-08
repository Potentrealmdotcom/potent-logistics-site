# POTENT OS update: do these in order

Everything below is new since your last deploy (the PNG rename fix). One upload covers all of it.

## 1. Security first (5 minutes)
Your Mailjet key and secret were typed inside the old send-email.js. Treat them as exposed.
1. In Mailjet, create a NEW API key and secret, then delete the old ones.
2. In Netlify > Site configuration > Environment variables, add or confirm:
   - MAILJET_API_KEY and MAILJET_SECRET_KEY  (the NEW ones)
   - AUTH_SECRET, SUPABASE_SERVICE_ROLE_KEY, STAFF_PASSWORDS_JSON  (you already have these)
   - STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
   - OPENAI_API_KEY  (document scanning, already set)
   - ANTHROPIC_API_KEY  (full-app translation; optional TRANSLATE_DAILY_MAX, default 4000 new phrases a day)
   - RESEND_API_KEY and MAIL_FROM_ADDRESS  (company-branded customer email; optional until you set up Resend)
3. Make sure the old send-email.js is NOT in GitHub with the keys (the new one in this zip has none).

## 2. Supabase: FIRST paste STEP-0-PRECHECK.sql and Run (changes nothing; every row must say yes). THEN run SQL-PART-A.sql, then SQL-PART-B.sql (one at a time; each ends with a 'DONE' message), then STEP-2-VERIFY.sql (every row true). Do this BEFORE you upload, so the new columns exist. ONE file (SQL Editor > paste ALL > Run). Safe to run twice.
RUN-THIS-ONCE.sql  (it already contains 68, 70, 71, 72, 73, 74, 75, 76, 77, 78 and 69 in the right order; you do not need the separate files)
It stops with a clear message and changes nothing if the company-accounts tables are missing.
The check at the bottom should show 0 in every row.

## 3. Stripe
- Developers > Webhooks: endpoint https://potentoperations.netlify.app/.netlify/functions/stripe-webhook
  events: checkout.session.completed, payment_intent.succeeded, invoice.paid, invoice.payment_failed, customer.subscription.deleted
- Connect > turn on Connect (Standard accounts), so customers can connect their own payouts.

## 4. Upload (ONE deploy, same folder layout as this zip)
- Root: app.js, sw.js (cache v18), package.json, the .html pages (License-Signup, Driver-Onboarding, Landing), terms.html, privacy.html, legal.json, guide.html, os-guide.html, team.html, training.html, potent-data.json, hero images and videos, mi-*.jpg
- netlify/functions/: auth.js, data-api.js, company-data.js, company-mail.js, translate.js, send-email.js, extract-document.js, leads-api.js, create-license-payment.js, create-checkout-session.js, stripe-webhook.js, team-content.js (staff-only pages), estimate-load.js (NEW: AI photo estimate of load and dumpsters; optional env ESTIMATE_MODEL)
- netlify/functions/lib/billing.js (keep the path)
Keep your other existing functions (geocode, get-fuel-prices, get-login-location, send-push, create-payment...) as they are.

## 5. After it is live, check
- Sign in as POTENT: trucks load, chat sends, the dispatch map shows drivers.
- More > Team > Get Started, Data & Imports, Customers & Licenses all open.
- Switch language to Spanish: whole screens translate (give it a few seconds the first time).
- Apply as a test partner, approve it, then log in with DOT/MC + password.
- Open any job: Job clock, Scope difference and Route legs panels show. Tap Calculate & save legs.
- More > Fleet > Vendors & Disposal opens (add one test vendor, then delete nothing; it stays).
- Quote screen: Profit Guard card shows miles, gas, profit and covers/short. Heavy items add a charge.
- Live pages (no login): yoursite/guide.html (customers, businesses) and yoursite/os-guide.html (POTENT OS buyers). Prices there come from the app itself.
- Staff pages: yoursite/team.html and yoursite/training.html. Log in with a staff ID + password; without a login no content loads.
- More > Jobs > Command Center shows today, this month, profit, short jobs, scope differences and vendors to confirm.
- More > Fleet > Properties: add one test property (name + address), then pick it on the quote screen.
- Book a test job as a customer: open the job; "Terms accepted" shows the version, time and IP.
- Open a customer tracking link: the driver dot still shows.
- Book a test job: you get the confirmation email, and "How did we do" emails still send.
- Customers & Licenses: open each existing paying customer and set License = Paid.
- Test purchase on the sign-up page (Monthly Support ticked, then Flex Pay) and confirm in Stripe.

## 6. Only after step 5 works, run these 2 lockdown files, in order
LOCKDOWN-RUN-LAST.sql, then LOCKDOWN-2-RUN-LAST.sql
These close public-key access to leads, passwords, trucks, chat, driver locations and partner records.
If something stops working after a lockdown, tell me which screen. Nothing is deleted.

Never put STAFF_PASSWORDS_JSON.txt or POTENT-leads-backup.json in GitHub.


## 6. New in this round: check after upload
- Signed out: a customer booking (?book=1) works; terms.html and privacy.html open; the sign-up page loads the agreement.
- Driver: cannot clock out of a stage without its photo. Driver job requests show in Command Center > Job requests for admin approval.
- Junk quote: heavy items need their real weight; load over 4,300 lbs adds a trip or suggests a dumpster.
- Tenant emails use the tenant's company name (needs RESEND_API_KEY and MAIL_FROM_ADDRESS).

- More > Money > Growth Tools opens: Accounts, Alerts, Rate cards, Zones, Repeat jobs. Add one zone and one template to test.
- Quote screen Profit Guard: open its settings, enter stops and minutes per stop, and the last job's gas cost and miles, then tap Set gas rate. Time and Profit per hour rows appear.

- Customer portal (the My Jobs page): sign in as a customer; only that email's jobs, photos, rate card and properties show. Tap Repeat this job and send a request; it appears in your job list as Pending Quote. Pay a test invoice: the job is marked paid only after Stripe confirms.
- Book a test job from the public booking page, then sign in as staff: it shows up in your job list within two minutes with a "new web booking" note.
- Growth Tools > Repeat jobs: save a weekly template and tap Create due jobs. Growth Tools > Insights shows averages once jobs have miles and clock events.
- STRIPE_SECRET_KEY must be set in Netlify (the customer payment check uses it). Already needed by the webhook.

## 7. Wallets, notes and office tables: check after upload
- More > Money > Wallets (owner): pick a customer, add money with a note (cash/check). The balance and a ledger line appear. A customer sees the same balance in the My Jobs page.
- Customer portal: every customer account gets a wallet automatically (zero balance). "Add money" charges the card through Stripe and credits only what Stripe collected. "Pay from wallet" marks the job paid.
- Recurring route: Book run charges the customer's wallet through the server; a short balance blocks the booking.
- Job with payment on file: when the job is marked Completed the wallet is charged automatically if the balance covers it.
- Customer portal: add a note to a job; it shows on the job in the office (Communication log). Internal notes never show to the customer.
- Signed out: leave a review with a real Job ID, join the waitlist, submit a recurring request (its day-capacity bars still show), upload a BOL.
- Offline: book a job with no signal, reconnect; the "waiting to sync" banner clears and the job appears.

## 7b. New in the final round: check after upload
- More > Money > Growth Tools > Rules: change a number (owner only), save. Detention on a job uses the on-site minutes and charge you set.
- Growth Tools > Payout method: pick Zelle, enter an email, save. Typing a bank or routing number is refused. Drivers see the same card on their Profile tab; the owner sees everyone's list.
- Growth Tools > Quotes & invoices: tap Send quote / Send invoice on a test job with your own email. Marking a job Completed sends the invoice automatically (not if the wallet already paid it).
- Quote screen: with a zone set up in Growth Tools > Zones, a quote whose miles fall in that band shows "Zone ... is included in the price".
- Data & Imports > QuickBooks export downloads an invoice file for QuickBooks Online.

## 8. LAST: run the lockdown files, in order
LOCKDOWN-3-RUN-LAST.sql (jobs, job photos, jobs backup, wallets), then LOCKDOWN-4-RUN-LAST.sql (expenses, claims, audit log, documents, prospects and the rest of the office tables; public forms can only ADD rows).
Run each only after steps 6 and 7 pass.
