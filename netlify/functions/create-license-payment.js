// netlify/functions/create-license-payment.js
// The server decides every amount. The browser only says which tier, which
// plan (full / flex) and whether Monthly Support was elected.
//
// What gets charged TODAY: license (or Flex down payment) + first month of
// support if elected. The stripe-webhook then creates the recurring
// subscriptions (support monthly; Flex installments x12) using the card or
// bank account saved here (setup_future_usage = off_session).

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Dollars. Must match the sign-up page and the tiers in create-checkout-session.js.
const PRICES = { starter: 4995, growth: 9995, fleet: 19995, enterprise: 34995 };
// Flex Pay: Fleet and Enterprise. 20% down, 12 equal monthly payments, 0% interest.
//   Fleet:      3,999 + 12 x 1,333 = 19,995     Enterprise: 6,999 + 12 x 2,333 = 34,995
const FLEX = { fleet: { down: 3999, monthly: 1333, term: 12 }, enterprise: { down: 6999, monthly: 2333, term: 12 } };
// Monthly Support (optional), dollars per month.
const SUPPORT = { starter: 149, growth: 249, fleet: 399, enterprise: 599 };
const KEY_BY_NAME = { Starter: "starter", Growth: "growth", Fleet: "fleet", Enterprise: "enterprise" };

exports.PRICES = PRICES; exports.FLEX = FLEX; exports.SUPPORT = SUPPORT;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { tier, company, name, email, phone } = body;
    const key = KEY_BY_NAME[tier] || String(tier || "").toLowerCase();
    const plan = body.plan === "flex" ? "flex" : "full";
    const wantsSupport = body.support === true || body.support === "true";

    if (!PRICES[key]) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Unknown tier" }) };
    }
    if (!email || String(email).indexOf("@") < 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "A valid email is required" }) };
    }
    let licenseDollars = PRICES[key];
    if (plan === "flex") {
      if (!FLEX[key]) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Flex Pay is only available on Fleet and Enterprise" }) };
      }
      licenseDollars = FLEX[key].down;
    }
    const supportDollars = wantsSupport ? SUPPORT[key] : 0;
    const total = licenseDollars + supportDollars;
    const em = String(email).trim().toLowerCase();

    // A Customer lets us bill the saved payment method later (support, Flex installments).
    const needsFuture = wantsSupport || plan === "flex";
    let customerId;
    if (needsFuture) {
      const customer = await stripe.customers.create({
        email: em, name: company || name || undefined, phone: phone || undefined,
        metadata: { company: company || "", contact: name || "", tier: key, product: "POTENT OS License" }
      });
      customerId = customer.id;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: total * 100,
      currency: "usd",
      customer: customerId,
      setup_future_usage: needsFuture ? "off_session" : undefined,
      payment_method_types: ["card", "us_bank_account"],
      payment_method_options: {
        us_bank_account: {
          financial_connections: { permissions: ["payment_method", "balances"] },
          verification_method: "instant",
        },
      },
      metadata: {
        tier: key,
        plan,
        company: company || "",
        customer_name: name || "",
        customer_email: em,
        customer_phone: phone || "",
        product: "POTENT OS License",
        license_amount: String(licenseDollars),
        support_monthly: String(supportDollars),
        flex_monthly: plan === "flex" ? String(FLEX[key].monthly) : "0",
        flex_term: plan === "flex" ? String(FLEX[key].term) : "0",
        flex_total: plan === "flex" ? String(PRICES[key]) : "0",
      },
      receipt_email: em,
      description: `POTENT OS License (${plan === "flex" ? "Flex Pay down payment" : "full"}${wantsSupport ? " + Monthly Support month 1" : ""}) - ${key} - ${company || ""}`,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id, amount: total }),
    };
  } catch (err) {
    console.error("Payment intent error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Could not start payment" }) };
  }
};
