// AceHeals payouts to the producer (Breeze), same Stripe account as POTENT (acct_1TkbJt609KMwZrdN, verified in Stripe):
//   AceHeals Monthly  ($12.99/mo)  -> $2.00 credited each time a payment succeeds
//   AceHeals Lifetime ($79.00 once) -> $12.00 credited
// Credits go to his Beat Man wallet with the normal hold period. Idempotent per Stripe invoice/session; refunds and chargebacks take it back.
// Records only: no cash leaves POTENT until the owner pays out from the wallet.
const B = require("./beats");
const PRICES = {
  "price_1UQIiT609KMwZrdNR5Mxvy10": { kind: "monthly", payout: 200 },
  "price_1UQIhl609KMwZrdNkLZuyV0n": { kind: "lifetime", payout: 1200 }
};
const rows = function (r) { return r.ok && Array.isArray(r.data) ? r.data : []; };
let _pid = null;
async function producer() {
  if (_pid) return _pid;
  const r = rows(await B.sb("beat_producers?email=eq." + encodeURIComponent(process.env.ACE_PRODUCER_EMAIL || "breeze") + "&active=eq.true&select=id,hold_days"))[0];
  return r || null;
}
async function credit(ref, plan, paid, pi) {
  const p = await producer(); if (!p) return { error: "AceHeals producer account not found" };
  const ins = await B.sb("ace_sales", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: { ref: ref, kind: plan.kind, payment_intent_id: pi || null, producer_id: p.id, paid_cents: paid, payout_cents: plan.payout } });
  if (!ins.ok) return { error: "Could not record" };
  const sale = Array.isArray(ins.data) && ins.data[0]; if (!sale) return { duplicate: true };
  const tx = await B.sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { producer_id: p.id, type: "sale", amount_cents: plan.payout, ref: "ace:" + ref, note: "AceHeals " + plan.kind, available_at: new Date(Date.now() + (Number(p.hold_days) || 0) * 864e5).toISOString() } });
  if (!tx.ok) return { error: "Could not credit wallet" };
  await B.audit("system", "aceheals_credit", sale.id, { kind: plan.kind, cents: plan.payout });
  return { ok: true };
}
function planFromPrices(ids) { for (const id of ids) if (PRICES[id]) return PRICES[id]; return null; }
// checkout.session.completed: caller passes the session and the price ids on it (looked up via Stripe)
async function onCheckout(session, priceIds) {
  if (session.payment_status !== "paid") return { skipped: true };
  const plan = planFromPrices(priceIds); if (!plan) return { skipped: true };
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : null;
  return credit(session.invoice ? String(session.invoice) : String(session.id), plan, Number(session.amount_total) || 0, pi);
}
// invoice.paid: every monthly renewal (and the first invoice, which dedupes against the checkout credit)
async function onInvoice(inv) {
  const ids = ((inv.lines && inv.lines.data) || []).map(function (l) { return (l.price && l.price.id) || (l.pricing && l.pricing.price_details && l.pricing.price_details.price) || ""; });
  const plan = planFromPrices(ids); if (!plan || !(Number(inv.amount_paid) > 0)) return { skipped: true };
  return credit(String(inv.id), plan, Number(inv.amount_paid), typeof inv.payment_intent === "string" ? inv.payment_intent : null);
}
async function reverse(pi, ratio, tag) {
  const sales = rows(await B.sb("ace_sales?payment_intent_id=eq." + encodeURIComponent(pi) + "&select=*"));
  for (const s of sales) {
    const target = Math.round(s.payout_cents * Math.min(1, ratio)), delta = target - s.reversed_cents; if (delta <= 0) continue;
    const tx = await B.sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { producer_id: s.producer_id, type: "refund", amount_cents: -delta, ref: "acerev:" + s.id + ":" + tag, note: "AceHeals refund/chargeback" } });
    if (!tx.ok) return { error: "Could not reverse" };
    await B.sb("ace_sales?id=eq." + s.id, { method: "PATCH", prefer: "return=minimal", body: { reversed_cents: target, status: target >= s.payout_cents ? "reversed" : "partly_reversed" } });
    await B.audit("system", "aceheals_reverse", s.id, { delta: delta });
  }
  return { ok: true, n: sales.length };
}
async function onRefund(charge) { const pi = charge && charge.payment_intent; if (!pi || !(Number(charge.amount) > 0)) return { skipped: true }; return reverse(pi, Number(charge.amount_refunded) / Number(charge.amount), "r" + charge.amount_refunded); }
async function onDispute(d) { const pi = typeof d.payment_intent === "string" ? d.payment_intent : null; return pi ? reverse(pi, 1, "d" + d.id) : { skipped: true }; }
module.exports = { PRICES, onCheckout, onInvoice, onRefund, onDispute, planFromPrices };
