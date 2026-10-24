// POST { email, items: [{ handle, qty }] }
// Creates a Stripe Checkout Session for a POTENT Bodega purchase and returns { url, sessionId }.
// Prices are set HERE from the server catalog, never trusted from the browser.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const B = require("./lib/bodega");
const CAT = require("./lib/bodega-catalog");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  let body; try { body = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  if (!CAT.isLoaded()) return B.J(500, { error: "Catalog not loaded" });

  const email = B.safeEmail(body.email);
  if (!email) return B.J(400, { error: "Valid email required" });
  if (!Array.isArray(body.items) || !body.items.length) return B.J(400, { error: "Cart is empty" });

  // Validate + merge the cart against the server catalog. Cap: 20 distinct items, qty 1-99.
  const merged = {};
  for (let i = 0; i < body.items.length; i++) {
    const it = body.items[i] || {};
    const handle = String(it.handle || "");
    if (!handle || !CAT.CATALOG[handle]) return B.J(400, { error: "Unknown item: " + handle });
    let qty = Math.floor(Number(it.qty));
    if (!isFinite(qty) || qty < 1 || qty > 99) return B.J(400, { error: "Bad quantity for " + handle });
    merged[handle] = (merged[handle] || 0) + qty;
    if (merged[handle] > 99) return B.J(400, { error: "Bad quantity for " + handle });
  }
  const handles = Object.keys(merged);
  if (handles.length > 20) return B.J(400, { error: "Cart is limited to 20 distinct items" });
  const items = handles.map(function (handle) { return { handle: handle, qty: merged[handle] }; });
  const encoded = CAT.encodeItems(items);
  if (!encoded || encoded.length > 500) return B.J(400, { error: "Cart is too large" });

  const lineItems = items.map(function (it) {
    const c = CAT.CATALOG[it.handle];
    return { quantity: it.qty, price_data: { currency: "usd", unit_amount: c.priceCents, product_data: { name: c.title + " — POTENT Bodega", description: "ALL SALES FINAL." } } };
  });

  const origin = B.originFromEvent(event);
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: lineItems,
      metadata: { product: "BODEGA", email: email, items: encoded },
      custom_text: { submit: { message: "All sales are final." } },
      success_url: origin + "/bodega/?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: origin + "/bodega/?canceled=1"
    });
    return B.J(200, { url: session.url, sessionId: session.id });
  } catch (e) {
    console.error("bodega-checkout failed:", e.message);
    return B.J(500, { error: "Could not start checkout" });
  }
};
