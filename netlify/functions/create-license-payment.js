// netlify/functions/create-license-payment.js
// Upload to: potent-logistics-site/netlify/functions/create-license-payment.js
//
// CHANGES (license-page rebuild, Nov 5 2026 — staged, not yet deployed):
//  1. Amount floor lowered $1,000 -> $50. The old floor rejected the
//     canon Starter Flex Pay down payment ($999 = 20% of $4,995).
//  2. Flex Pay pass-through: when the page sends plan:'flex', the
//     PaymentIntent now carries the metadata the Stripe webhook's
//     license branch reads (plan, license_amount, flex_monthly,
//     flex_term, flex_total, support_monthly, customer_email) so the
//     webhook provisions the company as flex_active at the FULL
//     license amount instead of mistaking the down payment for a
//     paid-in-full license at the down-payment amount.
//  3. Flex only: a Stripe Customer is created and put on the intent,
//     with setup_future_usage 'off_session', so the saved card can be
//     charged monthly and the webhook's startSubscriptions() can
//     create the 12-month Flex subscription it was built to create
//     (it returns early when the intent has no customer).
// Everything else is the original function, unchanged.

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
if (event.httpMethod !== "POST") {
return { statusCode: 405, body: "Method Not Allowed" };
}

const headers = {
"Access-Control-Allow-Origin": "*",
"Access-Control-Allow-Headers": "Content-Type",
"Content-Type": "application/json"
};

try {
const body = JSON.parse(event.body || "{}");
const { amount, tier, company, name, email, phone } = body;

if (!amount || amount < 50) {
  return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid amount" }) };
}

const isFlex = body.plan === "flex";

const piParams = {
  amount: Math.round(amount * 100), // cents
  currency: "usd",
  payment_method_types: ["card", "us_bank_account"],
  payment_method_options: {
    us_bank_account: {
      financial_connections: {
        permissions: ["payment_method", "balances"],
      },
      verification_method: "instant", // Plaid instant verify
    },
  },
  metadata: {
    tier,
    company,
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
    product: "POTENT OS License",
  },
  receipt_email: email,
  description: `POTENT OS License — ${tier} — ${company}`,
};

if (isFlex) {
  // Webhook license-branch metadata (stripe-webhook.js reads these).
  piParams.metadata.plan = "flex";
  piParams.metadata.license_amount = String(body.license_amount || "");
  piParams.metadata.flex_monthly = String(body.flex_monthly || "");
  piParams.metadata.flex_term = String(body.flex_term || "");
  piParams.metadata.flex_total = String(body.flex_total || "");
  piParams.metadata.support_monthly = String(body.support_monthly || 0);
  // Saved-card customer so the webhook can start the installment subscription.
  const customer = await stripe.customers.create({
    email: email || undefined,
    name: name || undefined,
    phone: phone || undefined,
    metadata: { company: company || "", tier: tier || "", product: "POTENT OS License" },
  });
  piParams.customer = customer.id;
  piParams.setup_future_usage = "off_session";
}

// Create PaymentIntent with card + ACH instant verify
const paymentIntent = await stripe.paymentIntents.create(piParams);

return {
  statusCode: 200,
  headers,
  body: JSON.stringify({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  }),
};

} catch (err) {
console.error("Payment intent error:", err);
return {
statusCode: 500,
headers,
body: JSON.stringify({ error: err.message }),
};
}
};
