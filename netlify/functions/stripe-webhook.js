// netlify/functions/stripe-webhook.js
// Live at: https://potentoperations.netlify.app/.netlify/functions/stripe-webhook
//
// Receives Stripe event notifications. Stripe must be told to send events here:
// Stripe Dashboard -> Developers -> Webhooks -> add endpoint with this URL and
// these events: checkout.session.completed, payment_intent.succeeded,
// invoice.paid, invoice.payment_failed, customer.subscription.deleted.
//
// Required env vars in Netlify (Site settings -> Environment variables):
//   STRIPE_SECRET_KEY      - Stripe secret key (already used by the other functions)
//   STRIPE_WEBHOOK_SECRET  - signing secret shown on the Stripe webhook endpoint page
// Optional (for email alerts on each payment event):
//   MAILJET_API_KEY, MAILJET_SECRET_KEY - same Mailjet account as send-email.js
//   NOTIFY_EMAIL - where to send payment alerts (default: potentlogistics@pm.me)

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const HANDLED_EVENTS = [
  "checkout.session.completed",
  "payment_intent.succeeded",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.deleted",
];

function dollars(cents) {
  if (cents === null || cents === undefined) return "n/a";
  return "$" + (cents / 100).toFixed(2);
}

// Pull the human-useful fields out of each event type.
function summarize(type, obj) {
  const base = {
    event_id: obj.id || "",
    created: obj.created ? new Date(obj.created * 1000).toISOString() : "",
  };
  switch (type) {
    case "checkout.session.completed":
      return Object.assign(base, {
        amount: dollars(obj.amount_total),
        currency: (obj.currency || "").toUpperCase(),
        customer_email: obj.customer_email || obj.customer_details?.email || "",
        customer_name: obj.customer_details?.name || "",
        tier: (obj.metadata && obj.metadata.tier) || "",
        company: (obj.metadata && obj.metadata.company) || "",
        product: (obj.metadata && obj.metadata.product) || "POTENT OS License",
      });
    case "payment_intent.succeeded":
      return Object.assign(base, {
        amount: dollars(obj.amount),
        currency: (obj.currency || "").toUpperCase(),
        customer_email: obj.receipt_email || "",
        customer_name: (obj.metadata && obj.metadata.customer_name) || "",
        tier: (obj.metadata && obj.metadata.tier) || "",
        company: (obj.metadata && obj.metadata.company) || "",
        product: (obj.metadata && obj.metadata.product) || "",
      });
    case "invoice.paid":
    case "invoice.payment_failed":
      return Object.assign(base, {
        amount: dollars(obj.amount_due),
        currency: (obj.currency || "").toUpperCase(),
        customer_email: obj.customer_email || "",
        invoice: obj.number || "",
        subscription: obj.subscription || "",
      });
    case "customer.subscription.deleted":
      return Object.assign(base, {
        customer: obj.customer || "",
        plan: (obj.items && obj.items.data && obj.items.data[0] && obj.items.data[0].price.nickname) || "",
      });
    default:
      return base;
  }
}

async function notifyTony(type, summary) {
  const to = process.env.NOTIFY_EMAIL || "potentlogistics@pm.me";
  const key = process.env.MAILJET_API_KEY;
  const secret = process.env.MAILJET_SECRET_KEY;
  const lines = Object.entries(summary)
    .map(([k, v]) => k + ": " + v)
    .join("\n");
  const text = "POTENT Stripe event: " + type + "\n\n" + lines;
  console.log(text);
  if (!key || !secret) return; // no mail config -> log only

  try {
    const auth = Buffer.from(key + ":" + secret).toString("base64");
    await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + auth,
      },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: "potentlogistics@pm.me", Name: "POTENT Logistics" },
            To: [{ Email: to }],
            Subject: "POTENT payment: " + type,
            TextPart: text,
          },
        ],
      }),
    });
  } catch (e) {
    console.error("Payment alert email failed:", e.message);
  }
}

exports.handler = async function (event) {
  const headers = { "Content-Type": "application/json" };

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "POST only" }) };
  }

  const sig = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    if (!sig || !endpointSecret) throw new Error("Missing Stripe signature or STRIPE_WEBHOOK_SECRET");
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : event.body;
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid signature" }) };
  }

  if (!HANDLED_EVENTS.includes(stripeEvent.type)) {
    return { statusCode: 200, headers, body: JSON.stringify({ received: true, handled: false }) };
  }

  const summary = summarize(stripeEvent.type, stripeEvent.data.object);
  await notifyTony(stripeEvent.type, summary);

  return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
};
