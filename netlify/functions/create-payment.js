// netlify/functions/create-payment.js
//
// This file runs on Netlify's server, NEVER in the customer's browser.
// This is where the secret key lives safely — it's never sent to anyone visiting the site.

exports.handler = async function (event) {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    var body = JSON.parse(event.body);
    var amountInCents = Math.round(body.amount * 100); // Stripe needs cents, not dollars
    var jobId = body.jobId || "unknown";
    var customerName = body.customerName || "Customer";

    var stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Stripe secret key not configured on server." }),
      };
    }

    // Create a PaymentIntent using Stripe's API directly via fetch
    // (no SDK needed — keeps this function lightweight and dependency-free)
    var params = new URLSearchParams();
    params.append("amount", amountInCents);
    params.append("currency", "usd");
    params.append("description", "Potent Logistics — Job " + jobId);
    params.append("metadata[job_id]", jobId);
    params.append("metadata[customer_name]", customerName);
    params.append("automatic_payment_methods[enabled]", "true");

    var stripeRes = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + stripeSecretKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    var stripeData = await stripeRes.json();

    if (stripeData.error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: stripeData.error.message }),
      };
    }

    // Send back the client secret — this is safe to send to the browser,
    // it's a one-time token that only works for this specific payment.
    return {
      statusCode: 200,
      body: JSON.stringify({ clientSecret: stripeData.client_secret }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
