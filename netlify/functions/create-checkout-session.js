// netlify/functions/create-checkout-session.js
// Upload to: potent-logistics-site/netlify/functions/create-checkout-session.js
//
// Real Stripe Checkout Session — Stripe's own hosted, polished payment
// page. Automatically includes Apple Pay, Google Pay, and card entry
// with zero extra code. Replaces the embedded PaymentIntent form for
// POTENT OS licensing specifically.

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Real current tiers, matching the actual pricing sheet exactly.
const REAL_TIERS = {
  starter: { label: "POTENT OS — Starter (1-10 Trucks)", amount: 499500 },
  growth: { label: "POTENT OS — Growth (11-50 Trucks)", amount: 999500 },
  fleet: { label: "POTENT OS — Fleet (51-150 Trucks)", amount: 1999500 },
  enterprise: { label: "POTENT OS — Enterprise (151-300+ Trucks)", amount: 3499500 },
};

// Optional Monthly Support, monthly, in cents. Priced by tier, decided here on the server.
const SUPPORT = {
  starter: { label: "Monthly Support - Starter (24/7 support, system help, customization help)", amount: 14900 },
  growth: { label: "Monthly Support - Growth (24/7 support, system help, customization help)", amount: 24900 },
  fleet: { label: "Monthly Support - Fleet (24/7 support, system help, customization help)", amount: 39900 },
  enterprise: { label: "Monthly Support - Enterprise (24/7 support, system help, customization help)", amount: 59900 },
};

exports.handler = async function (event) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: headers, body: JSON.stringify({ error: "POST only" }) };
  }

  var body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  var tierKey = body.tier;
  var tier = REAL_TIERS[tierKey];
  if (!tier) {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "Real tier required: starter, growth, fleet, or enterprise" }) };
  }

  var siteUrl = process.env.URL || "https://potentoperations.netlify.app";

  var wantSupport = !!body.support || !!body.supportOnly;
  var supportOnly = !!body.supportOnly; // Flex Pay customers: the down payment was already taken separately
  var sup = SUPPORT[tierKey];

  try {
    var lineItems = [];
    if (!supportOnly) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: tier.label, description: "One-time license. You own it forever." },
          unit_amount: tier.amount,
        },
        quantity: 1,
      });
    }
    if (wantSupport) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: sup.label },
          unit_amount: sup.amount,
          recurring: { interval: "month" },
        },
        quantity: 1,
      });
    }

    var meta = {
      tier: tierKey,
      company: body.company || "",
      customer_name: body.name || "",
      customer_phone: body.phone || "",
      customer_email: body.email ? String(body.email).trim().toLowerCase() : "",
      product: supportOnly ? "Monthly Support" : "POTENT OS License",
      license_amount: supportOnly ? "0" : String(tier.amount / 100),
      support_plan: wantSupport ? "care_" + tierKey : "none",
      support_monthly: wantSupport ? String(sup.amount / 100) : "0",
    };
    var params = {
      // A subscription Checkout can bill the one-time license and the first month of support together.
      mode: wantSupport ? "subscription" : "payment",
      payment_method_types: ["card", "us_bank_account"],
      line_items: lineItems,
      customer_email: body.email || undefined,
      metadata: meta,
      success_url: siteUrl + "/POTENT-License-Signup.html?session_id={CHECKOUT_SESSION_ID}&step=success",
      cancel_url: siteUrl + "/POTENT-License-Signup.html?step=cancelled",
    };
    // kind:"support" lets the webhook track every monthly renewal (paid / failed / cancelled)
    if (wantSupport) params.subscription_data = { metadata: Object.assign({}, meta, { kind: "support", email: body.email ? String(body.email).trim().toLowerCase() : "" }) };
    var session = await stripe.checkout.sessions.create(params);

    return { statusCode: 200, headers: headers, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error("Real Checkout Session creation failed:", err.message);
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: err.message }) };
  }
};
