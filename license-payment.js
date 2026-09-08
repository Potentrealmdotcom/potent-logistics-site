stripe = require(“stripe”)(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
if (event.httpMethod !== “POST”) {
return { statusCode: 405, body: “Method Not Allowed” };
}

const headers = {
“Access-Control-Allow-Origin”: “*”,
“Access-Control-Allow-Headers”: “Content-Type”,
“Content-Type”: “application/json”
};

try {
const body = JSON.parse(event.body || “{}”);
const { amount, tier, company, name, email, phone } = body;

```
if (!amount || amount < 1000) {
  return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid amount" }) };
}

// Create PaymentIntent with card + ACH instant verify
const paymentIntent = await stripe.paymentIntents.create({
  amount: amount * 100, // cents
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
});

return {
  statusCode: 200,
  headers,
  body: JSON.stringify({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  }),
};
```

} catch (err) {
console.error(“Payment intent error:”, err);
return {
statusCode: 500,
headers,
body: JSON.stringify({ error: err.message }),
};
}
};
