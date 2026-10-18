// netlify/functions/stripe-webhook.js
// Live at: https://potentoperations.netlify.app/.netlify/functions/stripe-webhook
//
// Verifies the Stripe signature, then:
//  - AUTO-PROVISIONS the company on first license payment (Shopify-style):
//    creates the organizations row, unique slug, owner login with temp password,
//    sets license_status, and EMAILS the buyer their login + page link.
//    Idempotent: Stripe retries never create two companies for the same buyer.
//  - records every license / support / Flex payment as a row in license_invoices
//  - unlocks the license (os_licenses) and updates the company's license /
//    support / Flex status (organizations)
//  - after the first license payment, creates the RECURRING subscriptions that
//    the sign-up page promised: Monthly Support (monthly) and Flex installments (x12)
//  - keeps status in sync when a monthly payment succeeds, fails or is cancelled
//  - notifies POTENT of every payment event
//
// Env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY
//   MAILJET_API_KEY, MAILJET_SECRET_KEY, MAILJET_FROM_EMAIL (for buyer + owner emails)
// Stripe events to send to this endpoint:
//   checkout.session.completed, payment_intent.succeeded,
//   invoice.paid, invoice.payment_failed, customer.subscription.deleted

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { fulfillSession: fulfillCcml } = require("./lib/ccml");
const { fulfillSession: fulfillPlaybook } = require("./lib/playbook");
const { fulfillSession: fulfillBeat, handleRefund: refundBeat, handleDispute } = require("./lib/beats");
const { fulfillProduct: fulfillMusic, refundProduct: refundMusic } = require("./lib/music");
const { deriveStatus } = require("./lib/billing");
const { provisionCompany } = require("./lib/provision");

const SUPABASE_URL = "https://ymvsatlrkzgxwzxybwmk.supabase.co";

function sb(path, opts) {
  opts = opts || {};
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method: opts.method || "GET",
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: opts.prefer || "return=representation" },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  }).then(function (r) { return r.text().then(function (t) { var d; try { d = JSON.parse(t); } catch (e) { d = t; } return { ok: r.ok, status: r.status, data: d }; }); });
}

// Email the buyer their new company login. Temp password is emailed once and
// never stored in plain text anywhere.
async function emailBuyerWelcome(email, companyName, slug, tempPassword, tier) {
  const key = process.env.MAILJET_API_KEY, secret = process.env.MAILJET_SECRET_KEY;
  const from = process.env.MAILJET_FROM_EMAIL || "potentlogistics@proton.me";
  if (!key || !secret || !email || !tempPassword) { console.error("Buyer welcome email skipped (missing config)"); return false; }
  const pageLink = "https://potentoperations.netlify.app/?c=" + slug;
  const text =
    "Welcome to POTENT OS, " + companyName + "!\n\n" +
    "Your company page is live: " + pageLink + "\n\n" +
    "Your owner login:\n" +
    "  Email: " + email + "\n" +
    "  Temporary password: " + tempPassword + "\n\n" +
    "Please sign in and change your password right away (Settings inside the app).\n\n" +
    "Your " + tier + " license is active. If you need help, reply to this email.\n\n" +
    "- POTENT Logistics";
  try {
    const auth = Buffer.from(key + ":" + secret).toString("base64");
    const res = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Basic " + auth },
      body: JSON.stringify({ Messages: [{ From: { Email: from, Name: "POTENT Logistics" }, To: [{ Email: email }], Subject: "Your POTENT OS company is ready — sign in here", TextPart: text }] })
    });
    return res.ok;
  } catch (e) { console.error("Buyer welcome email failed:", e.message); return false; }
}

// Payment alert to Tony (every event). Log-only if mail isn't configured.
async function notifyTony(type, summary) {
  const to = process.env.NOTIFY_EMAIL || "potentlogistics@proton.me";
  const key = process.env.MAILJET_API_KEY, secret = process.env.MAILJET_SECRET_KEY;
  const from = process.env.MAILJET_FROM_EMAIL || "potentlogistics@proton.me";
  const lines = Object.entries(summary || {}).map(function (kv) { return kv[0] + ": " + kv[1]; }).join("\n");
  console.log("POTENT Stripe event: " + type + "\n\n" + lines);
  if (!key || !secret) return;
  try {
    const auth = Buffer.from(key + ":" + secret).toString("base64");
    await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Basic " + auth },
      body: JSON.stringify({ Messages: [{ From: { Email: from, Name: "POTENT Logistics" }, To: [{ Email: to }], Subject: "POTENT payment: " + type, TextPart: "POTENT Stripe event: " + type + "\n\n" + lines }] })
    });
  } catch (e) { console.error("Payment alert email failed:", e.message); }
}

// Pull the human-useful fields out of each event type for the alert.
function summarize(type, obj) {
  const base = { event_id: obj.id || "" };
  if (type === "checkout.session.completed") return Object.assign(base, {
    amount: obj.amount_total ? "$" + (obj.amount_total / 100).toFixed(2) : "n/a",
    email: obj.customer_email || (obj.customer_details && obj.customer_details.email) || "",
    name: (obj.customer_details && obj.customer_details.name) || "",
    tier: (obj.metadata && obj.metadata.tier) || "", company: (obj.metadata && obj.metadata.company) || ""
  });
  if (type === "payment_intent.succeeded") return Object.assign(base, {
    amount: obj.amount ? "$" + (obj.amount / 100).toFixed(2) : "n/a",
    email: obj.receipt_email || "", tier: (obj.metadata && obj.metadata.tier) || "", company: (obj.metadata && obj.metadata.company) || ""
  });
  return base;
}

// Find the company (organizations row) this email belongs to, if one exists yet.
async function findOrg(email, customerId) {
  const em = String(email || "").trim().toLowerCase();
  if (customerId) {
    const c = await sb("organizations?stripe_customer_id=eq." + encodeURIComponent(customerId) + "&select=*");
    if (c.ok && Array.isArray(c.data) && c.data[0]) return c.data[0];
  }
  if (!em) return null;
  const o = await sb("organizations?owner_email=ilike." + encodeURIComponent(em) + "&select=*");
  if (o.ok && Array.isArray(o.data) && o.data[0]) return o.data[0];
  const u = await sb("org_users?email=ilike." + encodeURIComponent(em) + "&role=eq.owner&select=org_id");
  if (u.ok && Array.isArray(u.data) && u.data[0]) {
    const o2 = await sb("organizations?id=eq." + encodeURIComponent(u.data[0].org_id) + "&select=*");
    if (o2.ok && Array.isArray(o2.data) && o2.data[0]) return o2.data[0];
  }
  return null;
}

// Insert an invoice row once (provider_ref is unique). Returns false when it already existed.
async function recordInvoice(row) {
  if (row.provider_ref) {
    const ex = await sb("license_invoices?provider=eq.stripe&provider_ref=eq." + encodeURIComponent(row.provider_ref) + "&select=id,status");
    if (ex.ok && Array.isArray(ex.data) && ex.data[0]) {
      if (ex.data[0].status !== row.status) {
        await sb("license_invoices?id=eq." + ex.data[0].id, { method: "PATCH", prefer: "return=minimal", body: { status: row.status, paid_at: row.paid_at || null } });
      } else {
        return false;
      }
      return true;
    }
  }
  const r = await sb("license_invoices", { method: "POST", prefer: "return=minimal", body: Object.assign({ provider: "stripe" }, row) });
  return r.ok;
}

// Recompute a company's status from its invoices and save it.
async function refreshOrgStatus(org, email) {
  const em = String(email || org.owner_email || "").toLowerCase();
  let q = "license_invoices?select=*&order=created_at.asc";
  q += org ? "&org_id=eq." + encodeURIComponent(org.id) : "&email=ilike." + encodeURIComponent(em);
  const inv = await sb(q);
  const list = inv.ok && Array.isArray(inv.data) ? inv.data : [];
  const st = deriveStatus(list);
  if (!org) return st;
  const patch = { license_status: st.license_status, support_status: st.support_status, flex_status: st.flex_status, flex_paid: st.flex_paid };
  if (st.flex_total) patch.flex_total = st.flex_total;
  if (st.support_status === "active" && !org.support_started_at) patch.support_started_at = new Date().toISOString();
  await sb("organizations?id=eq." + encodeURIComponent(org.id), { method: "PATCH", prefer: "return=minimal", body: patch });
  return st;
}

function addMonths(d, n) { const x = new Date(d.getTime()); x.setMonth(x.getMonth() + n); return x; }

async function startSubscriptions(pi, md) {
  if (!pi.customer || !pi.payment_method) return;
  const supportMonthly = Number(md.support_monthly || 0);
  const flexMonthly = Number(md.flex_monthly || 0);
  const flexTerm = Number(md.flex_term || 0);
  const now = new Date();
  const common = { customer: pi.customer, default_payment_method: pi.payment_method, collection_method: "charge_automatically" };

  if (supportMonthly > 0) {
    const prod = await stripe.products.create({ name: "Monthly Support (" + md.tier + ")", metadata: { company: md.company || "" } }, { idempotencyKey: "prod-support-" + pi.id });
    await stripe.subscriptions.create(Object.assign({}, common, {
      items: [{ price_data: { currency: "usd", product: prod.id, unit_amount: supportMonthly * 100, recurring: { interval: "month" } } }],
      trial_end: Math.floor(addMonths(now, 1).getTime() / 1000), // month 1 was charged today
      metadata: { kind: "support", email: md.customer_email || "", company: md.company || "", tier: md.tier || "" }
    }), { idempotencyKey: "sub-support-" + pi.id });
  }
  if (md.plan === "flex" && flexMonthly > 0 && flexTerm > 0) {
    const prod2 = await stripe.products.create({ name: "POTENT OS License - Flex Pay installments (" + md.tier + ")", metadata: { company: md.company || "" } }, { idempotencyKey: "prod-flex-" + pi.id });
    const first = addMonths(now, 1);
    await stripe.subscriptions.create(Object.assign({}, common, {
      items: [{ price_data: { currency: "usd", product: prod2.id, unit_amount: flexMonthly * 100, recurring: { interval: "month" } } }],
      trial_end: Math.floor(first.getTime() / 1000),
      cancel_at: Math.floor((addMonths(first, flexTerm - 1).getTime() + 24 * 3600 * 1000) / 1000), // after the 12th payment
      metadata: { kind: "flex", email: md.customer_email || "", company: md.company || "", tier: md.tier || "", flex_total: md.flex_total || "" }
    }), { idempotencyKey: "sub-flex-" + pi.id });
  }
}

exports.handler = async function (event) {
  const headers = { "Content-Type": "application/json" };

  const sig = event.headers["stripe-signature"];
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid signature" }) };
  }

  const type = stripeEvent.type;
  const obj = stripeEvent.data.object;

  await notifyTony(type, summarize(type, obj));

  try {
    // ── monthly payments (support, Flex installments) ──────────────
    if (type === "invoice.paid" || type === "invoice.payment_failed") {
      if (type === "invoice.paid") { // AceHeals: Breeze earns $2 per monthly payment (same Stripe account)
        const ar = await require("./lib/aceheals").onInvoice(obj);
        if (ar && ar.error) return { statusCode: 500, headers, body: JSON.stringify({ error: "AceHeals credit failed, retry" }) };
        if (ar && (ar.ok || ar.duplicate)) return { statusCode: 200, headers, body: JSON.stringify({ received: true, ace: true }) };
      }
      const subId = obj.subscription || (obj.parent && obj.parent.subscription_details && obj.parent.subscription_details.subscription);
      if (!subId) return { statusCode: 200, headers, body: JSON.stringify({ received: true, ignored: "not a subscription invoice" }) };
      const sub = await stripe.subscriptions.retrieve(subId);
      const smd = sub.metadata || {};
      if (smd.kind !== "support" && smd.kind !== "flex") return { statusCode: 200, headers, body: JSON.stringify({ received: true, ignored: "not ours" }) };
      const paid = type === "invoice.paid";
      // The first invoice of a subscription is handled when the license payment itself is recorded
      if (obj.billing_reason === "subscription_create") return { statusCode: 200, headers, body: JSON.stringify({ received: true, ignored: "initial invoice" }) };
      if (paid && !(obj.amount_paid > 0)) return { statusCode: 200, headers, body: JSON.stringify({ received: true, ignored: "$0 invoice" }) };
      const org = await findOrg(smd.email, sub.customer);
      await recordInvoice({
        org_id: org ? String(org.id) : null, email: smd.email || null, company: smd.company || null,
        kind: smd.kind === "flex" ? "flex_installment" : "support",
        description: smd.kind === "flex" ? "Flex Pay installment" : "Monthly Support",
        amount: (paid ? obj.amount_paid : obj.amount_due) / 100, status: paid ? "paid" : "failed", provider_ref: obj.id,
        paid_at: paid ? new Date().toISOString() : null,
        meta: { flex_total: smd.flex_total ? Number(smd.flex_total) : undefined, tier: smd.tier, subscription: subId }
      });
      await refreshOrgStatus(org, smd.email);
      return { statusCode: 200, headers, body: JSON.stringify({ received: true, recorded: type }) };
    }

    if (type === "customer.subscription.deleted") {
      const smd = obj.metadata || {};
      if (smd.kind === "support") {
        const org = await findOrg(smd.email, obj.customer);
        await recordInvoice({
          org_id: org ? String(org.id) : null, email: smd.email || null, company: smd.company || null, kind: "support",
          description: "Monthly Support cancelled", amount: 0, status: "void", provider_ref: "subdel_" + obj.id
        });
        await refreshOrgStatus(org, smd.email);
      }
      return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
    }

    // ── LEGIT: identity check result ──
    if (type === "identity.verification_session.verified") {
      const lr = await require("./lib/legit").applyIdentity(obj);
      return { statusCode: lr && lr.ok === false ? 500 : 200, headers, body: JSON.stringify({ received: true, legitIdentity: true }) };
    }
    if (type.indexOf("identity.verification_session.") === 0) return { statusCode: 200, headers, body: JSON.stringify({ received: true, ignored: type }) };

    // ── AceHeals: Breeze earns $2 per monthly payment and $12 per lifetime sale (same Stripe account) ──
    if (type === "checkout.session.completed" && ["MUSIC", "BEAT", "MUSICSVC", "MUSICCOLL", "MUSICCOIN"].indexOf((obj.metadata || {}).product) < 0) {
      try {
        const li = await stripe.checkout.sessions.listLineItems(obj.id, { limit: 20 });
        const ar = await require("./lib/aceheals").onCheckout(obj, (li.data || []).map(function (x) { return x.price && x.price.id; }));
        if (ar && ar.error) return { statusCode: 500, headers, body: JSON.stringify({ error: "AceHeals credit failed, retry" }) };
        if (ar && (ar.ok || ar.duplicate)) return { statusCode: 200, headers, body: JSON.stringify({ received: true, ace: true }) };
      } catch (e) { console.error("aceheals lookup failed", e.message); }
    }

    // ── chargebacks on beat / music sales ──
    if (type === "charge.dispute.created" || type === "charge.dispute.closed") {
      if (type === "charge.dispute.created") { const ad = await require("./lib/aceheals").onDispute(obj); if (ad && ad.error) return { statusCode: 500, headers, body: JSON.stringify({ error: "AceHeals chargeback failed, retry" }) }; }
      const cd = type === "charge.dispute.created" ? await require("./lib/coinbuy").onDispute(obj) : await require("./lib/coinbuy").onDisputeClosed(obj); if (cd && cd.error) return { statusCode: 500, headers, body: JSON.stringify({ error: "Coin chargeback failed, retry" }) };
      const dr = await handleDispute(obj, type === "charge.dispute.created" ? "created" : "closed");
      if (dr && dr.error) return { statusCode: 500, headers, body: JSON.stringify({ error: "Dispute handling failed, retry" }) };
      return { statusCode: 200, headers, body: JSON.stringify({ received: true, dispute: !!(dr && dr.ok) }) };
    }
    // ── Beat Man: a refund takes back the producer's share automatically ──
    if (type === "charge.refunded") {
      const ar2 = await require("./lib/aceheals").onRefund(obj); if (ar2 && ar2.error) return { statusCode: 500, headers, body: JSON.stringify({ error: "AceHeals refund failed, retry" }) };
      const cr0 = await require("./lib/coinbuy").onRefund(obj); if (cr0 && cr0.error) return { statusCode: 500, headers, body: JSON.stringify({ error: "Coin refund failed, retry" }) };
      const rr = await refundBeat(obj);
      if (rr && rr.error) return { statusCode: 500, headers, body: JSON.stringify({ error: "Beat refund failed, retry" }) };
      const sr = await require("./lib/svc").onRefund(obj); if (sr && sr.error) return { statusCode: 500, headers, body: JSON.stringify({ error: "Services refund failed, retry" }) };
      const mr = await refundMusic(obj);
      if (mr && mr.error) return { statusCode: 500, headers, body: JSON.stringify({ error: "Music refund failed, retry" }) };
      return { statusCode: 200, headers, body: JSON.stringify({ received: true, beatRefund: !!(rr && rr.ok) }) };
    }

    // ── first payment: license, Flex down payment, or checkout ─────
    const isCheckoutSession = type === "checkout.session.completed";
    const isPaymentIntent = type === "payment_intent.succeeded";
    if (!isCheckoutSession && !isPaymentIntent) {
      return { statusCode: 200, headers, body: JSON.stringify({ received: true, ignored: type }) };
    }

    const md = obj.metadata || {};
    const product = md.product || "";
    const cents = isCheckoutSession ? obj.amount_total : obj.amount;
    const realCustomerEmail = md.customer_email || (isCheckoutSession && obj.customer_details && obj.customer_details.email) || "";

    if (product === "POTENT OS License") {
      const licenseAmount = md.license_amount ? Number(md.license_amount) : cents / 100;
      const supportFirst = Number(md.support_monthly || 0);
      const isFlex = md.plan === "flex";
      let org = await findOrg(realCustomerEmail, obj.customer);

      // ── AUTO-PROVISION: no company yet for this buyer -> create it now ──
      // Idempotent: provisionCompany returns the existing org if one is found,
      // so Stripe retries can never create a duplicate.
      let freshTempPw = null;
      if (!org) {
        try {
          const prov = await provisionCompany(sb, {
            companyName: md.company || realCustomerEmail.split("@")[0],
            ownerEmail: realCustomerEmail,
            ownerName: md.customer_name || "",
            tier: md.tier || "starter",
            licenseStatus: isFlex ? "flex_active" : "paid",
            stripeCustomerId: obj.customer || null,
            planPrice: licenseAmount
          });
          org = prov.org;
          freshTempPw = prov.tempPassword;
          console.log("Auto-provisioned company:", org.slug, "for", realCustomerEmail);
        } catch (e) {
          console.error("Auto-provision failed:", e.message);
          // fall through: invoice is still recorded below, Tony can create manually
        }
      }
      // Welcome email with login (only on a genuinely new company)
      if (freshTempPw) {
        await emailBuyerWelcome(realCustomerEmail, org.name || md.company || "your company", org.slug, freshTempPw, md.tier || "starter");
      }

      const fresh = await recordInvoice({
        org_id: org ? String(org.id) : null, email: realCustomerEmail, company: md.company || null,
        kind: isFlex ? "flex_down" : "license",
        description: isFlex ? "POTENT OS " + md.tier + " license - Flex Pay down payment" : "POTENT OS " + md.tier + " license",
        amount: licenseAmount, status: "paid", provider_ref: obj.id, paid_at: new Date().toISOString(),
        meta: { tier: md.tier, flex_total: isFlex ? Number(md.flex_total) : undefined }
      });
      if (fresh) {
        if (supportFirst > 0) {
          await recordInvoice({
            org_id: org ? String(org.id) : null, email: realCustomerEmail, company: md.company || null, kind: "support",
            description: "Monthly Support - month 1", amount: supportFirst, status: "paid", provider_ref: obj.id + ":support", paid_at: new Date().toISOString(),
            meta: { tier: md.tier }
          });
        }
        // license unlock record (service role — table is no longer open to anon)
        await sb("os_licenses", {
          method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
          body: { company: md.company, email: realCustomerEmail, tier: md.tier, amount_paid: licenseAmount, payment_intent_id: obj.id, status: "active", unlocked_at: new Date().toISOString() }
        });
        // recurring billing promised on the sign-up page (card/ACH saved on the first payment)
        if (isPaymentIntent) {
          try { await startSubscriptions(obj, md); }
          catch (e) { console.error("Subscription setup failed — create it manually in Stripe:", e.message, obj.id); }
        }
      }
      await refreshOrgStatus(org, realCustomerEmail);
    } else if (product === "Flex Pay Installment") {
      await sb("flex_pay_installments", { method: "POST", prefer: "return=minimal", body: { company: md.company, amount: obj.amount / 100, payment_intent_id: obj.id, paid_at: new Date().toISOString() } });
    } else if (product === "Recurring Route Payment") {
      await sb("recurring_routes?id=eq." + encodeURIComponent(md.route_id), { method: "PATCH", prefer: "return=minimal", body: { last_payment_confirmed_at: new Date().toISOString() } });
    } else if (String(product).indexOf("CCML") === 0 && isCheckoutSession) {
      // Credit Changed My Life (separate purchase): unlock the plan / add letter credits. Idempotent per Stripe session.
      const res = await fulfillCcml(obj);
      if (res && res.error) return { statusCode: 500, headers, body: JSON.stringify({ error: "CCML fulfillment failed, retry" }) };
    } else if (product === "LEGIT" && isCheckoutSession) {
      const lp = await require("./lib/legit").applyPayment(obj);
      if (lp && lp.error) return { statusCode: 500, headers, body: JSON.stringify({ error: "LEGIT fulfillment failed, retry" }) };
    } else if (product === "MUSIC" && isCheckoutSession) {
      // POTENT Music digital product: record the sale (1% POTENT fee), credit the seller. Idempotent per Stripe session.
      const res = await fulfillMusic(obj);
      if (res && res.error) return { statusCode: 500, headers, body: JSON.stringify({ error: "Music fulfillment failed, retry" }) };
    } else if (product === "MUSICCOIN" && isCheckoutSession) {
      const res = await require("./lib/coinbuy").onCheckout(obj);
      if (res && res.error) return { statusCode: 500, headers, body: JSON.stringify({ error: "Coin top-up failed, retry" }) };
    } else if ((product === "MUSICSVC" || product === "MUSICCOLL") && isCheckoutSession) {
      const res = await require("./lib/svc").onCheckout(obj);
      if (res && res.error) return { statusCode: 500, headers, body: JSON.stringify({ error: "Services fulfillment failed, retry" }) };
    } else if (product === "BEAT" && isCheckoutSession) {
      // Beat Man: record the sale and credit the producer's wallet right now. Idempotent per Stripe session.
      const res = await fulfillBeat(obj);
      if (res && res.error) return { statusCode: 500, headers, body: JSON.stringify({ error: "Beat fulfillment failed, retry" }) };
    } else if (String(product).indexOf("PLAYBOOK") === 0 && isCheckoutSession) {
      // Potent Playbook (separate purchase): record purchase rows, raise the buyer's tier. Idempotent per Stripe session.
      const res = await fulfillPlaybook(obj);
      if (res && res.error) return { statusCode: 500, headers, body: JSON.stringify({ error: "Playbook fulfillment failed, retry" }) };
    }
  } catch (err) {
    console.error("Webhook handling failed after payment:", err.message);
    // Return 200 so Stripe does not retry into a duplicate charge; the failure is logged above.
  }

  return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
};

// SETUP: Stripe Dashboard > Developers > Webhooks > endpoint
//   https://potentoperations.netlify.app/.netlify/functions/stripe-webhook
//   events: checkout.session.completed, payment_intent.succeeded, charge.refunded, charge.dispute.created, charge.dispute.closed, invoice.paid,
//           invoice.payment_failed, customer.subscription.deleted
//   Netlify env: STRIPE_WEBHOOK_SECRET (whsec_...), STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY
