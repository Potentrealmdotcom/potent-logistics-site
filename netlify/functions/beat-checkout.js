// POST { beat_id, license: "lease"|"exclusive" } -> Stripe Checkout Session on POTENT's Stripe account. Returns { url }.
// Price comes from the database, never from the browser. The shared stripe-webhook credits the producer automatically.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const B = require("./lib/beats");
const M = require("./lib/music");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  let body; try { body = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  const license = "exclusive"; // POTENT Beats sells the master exclusively; leases are not offered
  if (body.pack) return packCheckout(body, event); // mystery packs: { pack: "pack3"|"pack5", agree: true }
  if (!/^[0-9a-f-]{36}$/i.test(String(body.beat_id || ""))) return B.J(400, { error: "Bad request" });
  if (body.agree !== true) return B.J(400, { error: "Please accept the purchase agreement first" });
  const r = await B.sb("beat_items?id=eq." + body.beat_id + "&active=eq.true&select=*,beat_producers(active)");
  const beat = r.ok && Array.isArray(r.data) && r.data[0];
  if (!beat || !beat.beat_producers || !beat.beat_producers.active) return B.J(404, { error: "That beat is not available" });
  const live = beat.status === "published" || (beat.status === "approved" && beat.publish_at && new Date(beat.publish_at).getTime() <= Date.now());
  if (beat.exclusive_sold || beat.status === "sold") return B.J(409, { error: "This beat has already been sold exclusively" });
  if (!live) return B.J(404, { error: "That beat is not available" });
  const cents = license === "exclusive" ? beat.exclusive_cents : beat.lease_cents;
  if (!cents) return B.J(400, { error: "That license is not offered for this beat" });

  // Exclusive: hold the beat for this buyer. The database allows only one holder at a time.
  const token = require("crypto").randomBytes(12).toString("hex");
  if (license === "exclusive") {
    const hold = await B.rpc("beat_reserve", { p_beat: beat.id, p_token: token, p_minutes: 33 });
    if (!hold.ok) return B.J(500, { error: "Could not start checkout" });
    if (hold.data !== true) return B.J(409, { error: "Someone else is checking out with this beat right now. Try again in a few minutes." });
  }

  const h = event.headers || {};
  const origin = /^https:\/\/([a-z0-9-]+\.)*netlify\.app$/.test(String(h.origin || "")) || String(h.origin || "") === B.SITE ? String(h.origin) : B.SITE;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment", allow_promotion_codes: true,
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: cents, product_data: { name: beat.title + " — " + (license === "exclusive" ? "Exclusive rights" : "Lease"), description: "Digital beat. All sales final." } } }],
      metadata: { product: "BEAT", beat_id: beat.id, sale_type: license, user_id: (M.verifyUser(B.bearer(event)) || {}).uid || "", agreement_version: B.AGREEMENT_VERSION, agreed_at: new Date().toISOString() },
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      custom_text: { submit: { message: "By paying you accept the Exclusive Purchase Agreement. Digital product, all sales final. Your download link appears right after payment." } },
      success_url: origin + "/beats/?paid=1&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: origin + "/beats/?canceled=1"
    });
    return B.J(200, { url: session.url });
  } catch (e) {
    if (license === "exclusive") await B.rpc("beat_release", { p_beat: beat.id, p_token: token });
    console.error("beat-checkout failed:", e.message);
    return B.J(500, { error: "Could not start checkout" });
  }
};

// Mystery packs: one Stripe session for the whole pack at the fixed pack price. The pack's beats
// are picked at random from the available catalog and held for this buyer under ONE reservation
// token (the same per-beat hold singles use, so a beat in a pack checkout can't be sold elsewhere).
// The webhook fulfillment assigns the beats to the buyer — or refunds in full if the pack can no
// longer be filled. Contents are revealed after purchase.
async function packCheckout(body, event) {
  const pack = B.PACKS[body.pack];
  if (!pack) return B.J(400, { error: "Unknown pack" });
  if (body.agree !== true) return B.J(400, { error: "Please accept the purchase agreement first" });
  const now = Date.now();
  const pool = (await B.listAvailableBeats(300)).filter(function (b) { return !(b.reserved_until && new Date(b.reserved_until).getTime() > now); });
  if (pool.length < pack.size) return B.J(409, { error: "There are not enough exclusive beats in the store to fill this pack right now." });
  pool.sort(function () { return Math.random() - 0.5; });
  const token = require("crypto").randomBytes(12).toString("hex");
  const held = [];
  for (const b of pool) {
    if (held.length >= pack.size) break;
    const hold = await B.rpc("beat_reserve", { p_beat: b.id, p_token: token, p_minutes: 33 });
    if (!hold.ok) { for (const x of held) await B.rpc("beat_release", { p_beat: x, p_token: token }); return B.J(500, { error: "Could not start checkout" }); }
    if (hold.data === true) held.push(b.id);
  }
  if (held.length < pack.size) { for (const x of held) await B.rpc("beat_release", { p_beat: x, p_token: token }); return B.J(409, { error: "Some of those beats were just claimed. Please try again." }); }
  const h = event.headers || {};
  const origin = /^https:\/\/([a-z0-9-]+\.)*netlify\.app$/.test(String(h.origin || "")) || String(h.origin || "") === B.SITE ? String(h.origin) : B.SITE;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment", allow_promotion_codes: true,
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: pack.price_cents, product_data: { name: pack.name, description: pack.size + " exclusive beats from the POTENT catalog, chosen at random and revealed after purchase. Every beat is sold only to you. All sales final." } } }],
      metadata: { product: "BEAT", pack: pack.key, pack_beat_ids: held.join(","), pack_token: token, user_id: (M.verifyUser(B.bearer(event)) || {}).uid || "", agreement_version: B.AGREEMENT_VERSION, agreed_at: new Date().toISOString() },
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      custom_text: { submit: { message: "By paying you accept the Exclusive Purchase Agreement. Digital product, all sales final. Your beats are revealed with download links right after payment." } },
      success_url: origin + "/beats/?paid=1&pack=1&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: origin + "/beats/?canceled=1"
    });
    return B.J(200, { url: session.url });
  } catch (e) {
    for (const x of held) await B.rpc("beat_release", { p_beat: x, p_token: token });
    console.error("pack-checkout failed:", e.message);
    return B.J(500, { error: "Could not start checkout" });
  }
}
