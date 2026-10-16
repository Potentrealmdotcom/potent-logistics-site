// POST { beat_id, license: "lease"|"exclusive" } -> Stripe Checkout Session on POTENT's Stripe account. Returns { url }.
// Price comes from the database, never from the browser. The shared stripe-webhook credits the producer automatically.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const B = require("./lib/beats");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  let body; try { body = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  const license = body.license === "exclusive" ? "exclusive" : "lease";
  if (!/^[0-9a-f-]{36}$/i.test(String(body.beat_id || ""))) return B.J(400, { error: "Bad request" });
  const r = await B.sb("beat_items?id=eq." + body.beat_id + "&active=eq.true&select=*,beat_producers(active)");
  const beat = r.ok && Array.isArray(r.data) && r.data[0];
  if (!beat || !beat.beat_producers || !beat.beat_producers.active) return B.J(404, { error: "That beat is not available" });
  const cents = license === "exclusive" ? beat.exclusive_cents : beat.lease_cents;
  if (!cents) return B.J(400, { error: "That license is not offered for this beat" });
  if (license === "exclusive" && beat.exclusive_sold) return B.J(409, { error: "This beat has already been sold exclusively" });

  const h = event.headers || {};
  const origin = /^https:\/\/([a-z0-9-]+\.)*netlify\.app$/.test(String(h.origin || "")) || String(h.origin || "") === B.SITE ? String(h.origin) : B.SITE;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: cents, product_data: { name: beat.title + " — " + (license === "exclusive" ? "Exclusive rights" : "Lease"), description: "Digital beat. All sales final." } } }],
      metadata: { product: "BEAT", beat_id: beat.id, sale_type: license },
      custom_text: { submit: { message: "Digital product. All sales final. Your download link appears right after payment." } },
      success_url: origin + "/beats/?paid=1&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: origin + "/beats/?canceled=1"
    });
    return B.J(200, { url: session.url });
  } catch (e) {
    console.error("beat-checkout failed:", e.message);
    return B.J(500, { error: "Could not start checkout" });
  }
};
