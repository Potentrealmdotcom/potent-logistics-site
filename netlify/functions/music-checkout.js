// POST { product_id, agree:true } (+ optional buyer token) -> Stripe Checkout for a digital product.
// Price always comes from the database. Fulfillment happens only from the verified Stripe webhook.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const B = require("./lib/beats");
const M = require("./lib/music");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  let body; try { body = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  if (!/^[0-9a-f-]{36}$/i.test(String(body.product_id || ""))) return B.J(400, { error: "Bad request" });
  if (body.agree !== true) return B.J(400, { error: "Please accept the purchase terms first" });
  const r = await B.sb("music_products?id=eq." + body.product_id + "&select=*,beat_producers(active)");
  const p = r.ok && Array.isArray(r.data) && r.data[0];
  const live = p && p.status === "published" && (!p.publish_at || new Date(p.publish_at).getTime() <= Date.now());
  if (!p || !live || !p.beat_producers || !p.beat_producers.active) return B.J(404, { error: "That product is not available" });
  if (p.limited_qty != null && (p.sold_count || 0) >= p.limited_qty) return B.J(409, { error: "Sold out" });
  if (!p.file_ref || !(p.price_cents >= 100)) return B.J(409, { error: "That product is not ready" });
  const u = M.verifyUser(B.bearer(event));
  const h = event.headers || {};
  const origin = /^https:\/\/([a-z0-9-]+\.)*netlify\.app$/.test(String(h.origin || "")) || String(h.origin || "") === B.SITE ? String(h.origin) : B.SITE;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment", allow_promotion_codes: true,
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: p.price_cents, product_data: { name: p.title, description: "Digital download. " + p.kind.replace("_", " ") } } }],
      metadata: { product: "MUSIC", item_id: p.id, user_id: u ? u.uid : "", agreement_version: B.AGREEMENT_VERSION, agreed_at: new Date().toISOString() },
      custom_text: { submit: { message: "Digital product. By paying you accept the purchase terms and the listing's rights. Your download appears right after payment." } },
      success_url: origin + "/music/?paid=1&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: origin + "/music/?canceled=1"
    });
    return B.J(200, { url: session.url });
  } catch (e) { console.error("music-checkout failed:", e.message); return B.J(500, { error: "Could not start checkout" }); }
};
