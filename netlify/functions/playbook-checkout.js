// POST { items: ["regular"|"deluxe","themes","calendar","calculator","techpack","vault"] }  (+ optional Bearer token of the signed-in buyer)
// Creates a Stripe Checkout Session on POTENT's Stripe account and returns { url }.
// Prices are set HERE, never trusted from the browser. Tagged product "PLAYBOOK ..." so the shared webhook knows it is not a POTENT OS license.
// All sales final. No refunds.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const C = require("./lib/playbook");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return C.J(405, { error: "POST only" });
  let body; try { body = JSON.parse(event.body || "{}"); } catch (e) { return C.J(400, { error: "Bad request" }); }
  const raw = Array.isArray(body.items) ? body.items : [];
  const items = [];
  raw.forEach(function (r) { const s = String(r).trim().toLowerCase(); if (C.PRODUCTS[s] && items.indexOf(s) === -1) items.push(s); });
  if (!items.length) return C.J(400, { error: "Pick at least one item" });
  const user = await C.userFromEvent(event);

  if (user) {
    const ent = await C.entitlementsFor({ userId: user.id, email: user.email });
    if (ent.tier === "deluxe" && (items.indexOf("deluxe") > -1 || items.indexOf("regular") > -1)) return C.J(409, { error: "You already own the Deluxe playbook." });
    if (ent.tier === "regular" && items.indexOf("regular") > -1 && items.indexOf("deluxe") === -1) return C.J(409, { error: "You already own this." });
  }

  const line_items = items.map(function (id) {
    const p = C.PRODUCTS[id];
    return { quantity: 1, price_data: { currency: "usd", unit_amount: p.amount, product_data: { name: p.name, description: "All sales final. No refunds." } } };
  });
  const md = { product: "PLAYBOOK Bundle", items: items.join(","), userId: user ? user.id : "", email: user ? user.email : "" };

  const h = event.headers || {};
  const origin = /^https:\/\/([a-z0-9-]+\.)*netlify\.app$/.test(String(h.origin || "")) || String(h.origin || "") === C.SITE ? String(h.origin) : C.SITE;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user && user.email ? user.email : undefined,
      line_items: line_items,
      metadata: md,
      allow_promotion_codes: true,
      custom_text: { submit: { message: "All sales final. No refunds. The Potent Playbook is an educational product; no results are guaranteed." } },
      success_url: origin + "/playbook/course/?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: origin + "/playbook/?canceled=1"
    });
    return C.J(200, { url: session.url, sessionId: session.id });
  } catch (e) {
    console.error("playbook-checkout failed:", e.message);
    return C.J(500, { error: "Could not start checkout" });
  }
};
