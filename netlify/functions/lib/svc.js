// Webhook side for POTENT Music artwork/vinyl/figurine orders and Artist Collectibles. Idempotent per Stripe session.
// These are POTENT's own product lines: 100% is POTENT revenue and is kept in its own accounting categories, apart from the 1% beat/music marketplace fee.
const B = require("./beats");
const rows = function (r) { return r.ok && Array.isArray(r.data) ? r.data : []; };

async function onCheckout(session) {
  const md = (session && session.metadata) || {};
  if (md.product !== "MUSICSVC" && md.product !== "MUSICCOLL") return { skipped: true };
  if (session.payment_status !== "paid") return { skipped: true, unpaid: true };
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : null;
  if (md.product === "MUSICSVC") {
    const o = rows(await B.sb("music_service_orders?id=eq." + encodeURIComponent(md.order_id || "") + "&select=*"))[0];
    if (!o) { console.error("MUSICSVC for unknown order", md.order_id); return { error: "Unknown order" }; }
    if (o.stripe_session_id === session.id) return { ok: true, duplicate: true };
    const expect = Number(o.quote_cents != null ? o.quote_cents : o.price_cents);
    if (Number(session.amount_total) !== expect && Number(session.amount_subtotal) !== expect) { await B.audit("system", "svc_amount_mismatch", o.id, { paid: session.amount_total, expected: expect, session: session.id }); return { ok: true, mismatch: true }; }
    const up = await B.sb("music_service_orders?id=eq." + o.id + "&status=eq.awaiting_payment", { method: "PATCH", prefer: "return=representation", body: { status: "paid", stripe_session_id: session.id, payment_intent_id: pi, paid_at: new Date().toISOString(), updated_at: new Date().toISOString() } });
    if (!up.ok) return { error: "Could not record the order payment" };
    if (rows(up).length) { await B.audit("system", "svc_paid", o.id, { cents: session.amount_total, family: o.family }); await require("./notify")({ user_id: o.user_id, kind: "order", title: "Payment received for your order", link: "/music/services.html" }); }
    return { ok: true };
  }
  const cid = md.collectible_id; const email = (session.customer_details && session.customer_details.email) || session.customer_email || null;
  const ship = (session.shipping_details || (session.collected_information && session.collected_information.shipping_details)) || null;
  const price = Number(session.amount_total) || 0;
  const cl = await B.rpc("music_collectible_claim", { p_id: cid, p_session: session.id, p_user: /^[0-9a-f-]{36}$/i.test(md.user_id || "") ? md.user_id : null, p_email: email, p_pi: pi, p_price: price, p_ship: ship });
  if (!cl.ok) return { error: "Could not claim the edition" };
  const r = cl.data || {};
  if (r.ok === false) {
    let refunded = false;
    try { if (pi && process.env.STRIPE_SECRET_KEY) { await require("stripe")(process.env.STRIPE_SECRET_KEY).refunds.create({ payment_intent: pi, reason: "requested_by_customer" }, { idempotencyKey: "collsoldout:" + session.id }); refunded = true; } } catch (e) { console.error("collectible auto-refund failed", session.id, e.message); }
    await B.audit("system", "collectible_" + r.error, cid, { session: session.id, refunded: refunded });
    return { ok: true, soldOut: true };
  }
  if (!r.dup) { await B.audit("system", "collectible_sold", cid, { edition: r.edition, session: session.id }); if (md.user_id) await require("./notify")({ user_id: md.user_id, kind: "order", title: "Your collectible is reserved: edition " + r.edition, body: "Certificate " + r.code, link: "/music/services.html" }); }
  return { ok: true, edition: r.edition };
}

async function onRefund(charge) {
  const pi = charge && charge.payment_intent; if (!pi) return { skipped: true };
  const full = Number(charge.amount_refunded) >= Number(charge.amount) && Number(charge.amount) > 0;
  if (!full) return { skipped: true, partial: true };
  const [o, u] = await Promise.all([B.sb("music_service_orders?payment_intent_id=eq." + encodeURIComponent(pi) + "&status=neq.refunded", { method: "PATCH", prefer: "return=representation", body: { status: "refunded", updated_at: new Date().toISOString() } }), B.sb("music_collectible_units?payment_intent_id=eq." + encodeURIComponent(pi) + "&status=neq.refunded", { method: "PATCH", prefer: "return=representation", body: { status: "refunded" } })]);
  if (!o.ok || !u.ok) return { error: "Could not record refund" };
  for (const x of rows(o)) await B.audit("system", "svc_refunded", x.id, null);
  for (const x of rows(u)) await B.audit("system", "collectible_refunded", x.id, { edition: x.edition_no });
  return { ok: true };
}
module.exports = { onCheckout, onRefund };
