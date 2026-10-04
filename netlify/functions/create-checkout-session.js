// netlify/functions/create-checkout-session.js
// Upload to: potent-logistics-site/netlify/functions/create-checkout-session.js
//
// Real Stripe Checkout Session — Stripe’s own hosted, polished payment
// page. Automatically includes Apple Pay, Google Pay, and card entry
// with zero extra code. Replaces the embedded PaymentIntent form for
// POTENT OS licensing specifically.

const stripe = require(“stripe”)(process.env.STRIPE_SECRET_KEY);

// Real current tiers, matching the actual pricing sheet exactly.
const REAL_TIERS = {
starter: { label: “POTENT OS — Starter (1-10 Trucks)”, amount: 499500 },
growth: { label: “POTENT OS — Growth (11-50 Trucks)”, amount: 999500 },
fleet: { label: “POTENT OS — Fleet (51-150 Trucks)”, amount: 1999500 },
enterprise: { label: “POTENT OS — Enterprise (151-300+ Trucks)”, amount: 3499500 },
};

exports.handler = async function (event) {
var headers = {
“Access-Control-Allow-Origin”: “*”,
“Access-Control-Allow-Headers”: “Content-Type”,
“Content-Type”: “application/json”
};

if (event.httpMethod !== “POST”) {
return { statusCode: 405, headers: headers, body: JSON.stringify({ error: “POST only” }) };
}

var body;
try { body = JSON.parse(event.body || “{}”); } catch (e) {
return { statusCode: 400, headers: headers, body: JSON.stringify({ error: “Invalid JSON” }) };
}

var tierKey = body.tier;
var tier = REAL_TIERS[tierKey];
if (!tier) {
return { statusCode: 400, headers: headers, body: JSON.stringify({ error: “Real tier required: starter, growth, fleet, or enterprise” }) };
}

var siteUrl = process.env.URL || “https://potentoperations.netlify.app”;

try {
var session = await stripe.checkout.sessions.create({
mode: “payment”,
payment_method_types: [“card”, “us_bank_account”],
line_items: [{
price_data: {
currency: “usd”,
product_data: { name: tier.label, description: “One-time license. No monthly fee. You own it forever.” },
unit_amount: tier.amount,
},
quantity: 1,
}],
customer_email: body.email || undefined,
metadata: {
tier: tierKey,
company: body.company || “”,
customer_name: body.name || “”,
customer_phone: body.phone || “”,
product: “POTENT OS License”,
},
// Real success/cancel redirects — this is what Checkout Sessions
// genuinely adds over the embedded form: a real server-confirmed
// redirect, not just a client-side “it probably worked.”
success_url: siteUrl + “/POTENT-License-Signup.html?session_id={CHECKOUT_SESSION_ID}&step=success”,
cancel_url: siteUrl + “/POTENT-License-Signup.html?step=cancelled”,
});

```
return { statusCode: 200, headers: headers, body: JSON.stringify({ url: session.url }) };
```

} catch (err) {
console.error(“Real Checkout Session creation failed:”, err.message);
return { statusCode: 500, headers: headers, body: JSON.stringify({ error: err.message }) };
}
};
