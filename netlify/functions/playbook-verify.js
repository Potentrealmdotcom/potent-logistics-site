// POST { sessionId }  (+ Bearer token if signed in). The buyer's browser lands here after Stripe; we confirm with Stripe
// that the session is really paid, apply it (the shared webhook may already have), and report the buyer's entitlements.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const C = require("./lib/playbook");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return C.J(405, { error: "POST only" });
  let body; try { body = JSON.parse(event.body || "{}"); } catch (e) { return C.J(400, { error: "Bad request" }); }
  const id = String(body.sessionId || "");
  if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(id)) return C.J(400, { error: "Bad session" });
  try {
    const session = await stripe.checkout.sessions.retrieve(id);
    if (!session.metadata || String(session.metadata.product || "").indexOf("PLAYBOOK") !== 0) return C.J(400, { error: "Not a playbook purchase" });
    if (session.payment_status !== "paid") return C.J(402, { error: "Payment not confirmed yet" });
    const r = await C.fulfillSession(session);
    if (r.error) return C.J(500, { error: r.error });
    return C.J(200, { success: true, tier: r.tier || "none", addons: r.addons || [] });
  } catch (e) {
    console.error("playbook-verify failed:", e.message);
    return C.J(500, { error: "Could not verify" });
  }
};
