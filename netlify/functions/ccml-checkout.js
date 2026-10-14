// POST { plan: "diy" | "dfy" | "mail", pack: "m1".."m4" }  (+ optional Bearer token of the signed-in buyer)
// Creates a Stripe Checkout Session on POTENT's Stripe account and returns { url }.
// Prices are set HERE, never trusted from the browser. Tagged product "CCML ..." so the shared webhook knows it is not a POTENT OS license.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const C = require("./lib/ccml");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return C.J(405, { error: "POST only" });
  let body; try { body = JSON.parse(event.body || "{}"); } catch (e) { return C.J(400, { error: "Bad request" }); }
  const plan = String(body.plan || "");
  const user = await C.userFromEvent(event);
  let item, md;

  if (plan === "diy" || plan === "dfy") {
    const p = C.PRODUCTS[plan];
    if (user) {
      const prof = await C.profileById(user.id);
      if (prof && (C.RANK[prof.plan] || 0) >= C.RANK[plan]) return C.J(409, { error: "You already have this plan." });
    }
    item = { name: p.name, amount: p.amount, description: plan === "dfy" ? "Document preparation service. Not a law firm. 2.5% funding-referral fee only if you receive funding, agreed in writing at intake." : "Self-paced course and templates. Not legal advice." };
    md = { product: p.product, plan: plan, userId: user ? user.id : "", email: user ? user.email : "" };
  } else if (plan === "mail") {
    const pack = C.MAIL_PACKS[String(body.pack || "")];
    if (!pack) return C.J(400, { error: "Unknown pack" });
    if (!user) return C.J(401, { error: "Sign in first" });
    const prof = await C.profileById(user.id);
    if (!prof || (C.RANK[prof.plan] || 0) < 1) return C.J(402, { error: "Unlock the course first" });
    item = { name: "Credit Changed My Life - " + pack.label, amount: pack.amount, description: "Certified mail credits, mailed by our team." };
    md = { product: "CCML Mail Pack", plan: "mail", qty: String(pack.qty), userId: user.id, email: user.email };
  } else return C.J(400, { error: "Unknown plan" });

  const h = event.headers || {};
  const origin = /^https:\/\/([a-z0-9-]+\.)*netlify\.app$/.test(String(h.origin || "")) || String(h.origin || "") === C.SITE ? String(h.origin) : C.SITE;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user && user.email ? user.email : undefined,
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: item.amount, product_data: { name: item.name, description: item.description } } }],
      metadata: md,
      allow_promotion_codes: true,
      custom_text: { submit: { message: "Credit Changed My Life is a document preparation service, not a law firm. No results are guaranteed." } },
      success_url: origin + "/ccml/?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: origin + "/ccml/?canceled=1"
    });
    return C.J(200, { url: session.url, sessionId: session.id });
  } catch (e) {
    console.error("ccml-checkout failed:", e.message);
    return C.J(500, { error: "Could not start checkout" });
  }
};
