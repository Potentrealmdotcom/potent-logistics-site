# Everything made since your last deploy (the PNG rename fix)

## A. Deploy bundle: POTENT-DEPLOY-BUNDLE.zip (one upload, follow DEPLOY-STEPS.md)
Site files: app.js, sw.js (v14), package.json, POTENT-License-Signup.html, POTENT-OS-Landing-Page.html,
  potent-griffin-hero.png, potent-hero-poster.jpg, potent-hero-1080.mp4, potent-hero-4k.mp4,
  mi-offline-orange.jpg, mi-syncing-blue.jpg, mi-synced-green.jpg
Functions (netlify/functions): auth.js, data-api.js, company-data.js, company-mail.js, translate.js,
  send-email.js, extract-document.js, leads-api.js, create-license-payment.js, create-checkout-session.js,
  stripe-webhook.js, lib/billing.js
SQL: RUN-THIS-ONCE.sql (run FIRST, before uploading), then LOCKDOWN-RUN-LAST.sql and LOCKDOWN-2-RUN-LAST.sql (LAST, after checks)
Guide: DEPLOY-STEPS.md

## B. Documents and slides: POTENT-DOCS-AND-SLIDES.zip
POTENT-OS-Master-Inventory-v16.pdf, POTENT-OS-Sales-Book-v2.pdf, POTENT-OS-Sales-Emails-v2.pdf/.txt
9 slides: slide-os-beforeafter, ransom, statslab, comparison, receipt, terminal, meme, appmockup, urgency (.png)

## C. Correct order
1. Security (Mailjet key rotation, env vars)   2. Run RUN-THIS-ONCE.sql   3. Stripe webhook + Connect
4. Upload the bundle (one deploy)   5. Check   6. Lockdown 1 then Lockdown 2


## Added in this round
- guide.html, os-guide.html: live public guides (customers/businesses, POTENT OS buyers)
- team.html, training.html + netlify/functions/team-content.js: staff help and training (login required, content sent only after login)
- potent-data.json: the numbers the pages show
- app.js (new: terms records, Properties, Command Center, route legs, job clock, scope difference, vendors/disposal, Profit Guard, heavy-item pricing), sw.js v15
- netlify/functions/data-api.js (new tables + rules)
- RUN-THIS-ONCE.sql now includes SQL 73 (properties, terms records)

## Latest round
app.js, sw.js (v16), data-api.js, company-mail.js, estimate-load.js (new), POTENT-License-Signup.html, POTENT-Driver-Onboarding.html, terms.html, privacy.html, legal.json, guide.html, os-guide.html, team.html, training.html, potent-data.json, team-content.js.
SQL: RUN-THIS-ONCE.sql (first), LOCKDOWN-3-RUN-LAST.sql (last).

Also in this round: RUN-THIS-SQL-75.sql (rate cards, service zones, job templates; already inside RUN-THIS-ONCE.sql), Growth Tools screen in app.js, updated data-api.js.

Also: customer portal now loads from the server (data-api.js ?portal=data/repeat/paid), web bookings import into the staff job list, repeat-job scheduler, Insights tab, SQL 75 now includes job_templates.next_run. sw.js is v17.


## Update: wallets, customer portal, growth tools, full audit
Changed since the PNG rename (all in the deploy zip): app.js, sw.js (v18), netlify/functions/data-api.js, auth.js (unchanged logic), team-content.js, legal.json, terms.html, privacy.html, team.html, training.html, guide.html, os-guide.html.
SQL: RUN-THIS-ONCE.sql (now includes 76 wallets and 77 office-table company columns) then LOCKDOWN-3 and LOCKDOWN-4 last.
