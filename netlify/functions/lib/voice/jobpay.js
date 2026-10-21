// Payment for a phone booking: a secure Stripe Checkout link (Stripe's own page; no card number ever reaches the AI), and the webhook step that marks the job paid.
// The amount is the confirmed quote's total read from OUR database, never a number the model supplies, and the webhook re-checks it before marking anything paid.
const B = require("../beats");
const rows = function (r) { return r && r.ok && Array.isArray(r.data) ? r.data : []; };
const SITE = function () { return process.env.URL || "https://potentoperations.netlify.app"; };

async function createLink(booking, email) {
  const key = process.env.STRIPE_SECRET_KEY; if (!key) return { ok: false, error: "stripe_not_configured" };
  const cents = Number(booking.snapshot && booking.snapshot.quote && booking.snapshot.quote.total_cents);
  if (!(cents >= 100 && cents <= 5000000)) return { ok: false, error: "bad_amount" };
  const p = new URLSearchParams();
  p.append("mode", "payment"); p.append("customer_email", email);
  p.append("line_items[0][quantity]", "1"); p.append("line_items[0][price_data][currency]", "usd"); p.append("line_items[0][price_data][unit_amount]", String(cents));
  p.append("line_items[0][price_data][product_data][name]", "POTENT Logistics: delivery " + booking.reference);
  p.append("metadata[product]", "VOICEJOB"); p.append("metadata[booking_id]", booking.id); p.append("metadata[job_id]", booking.job_id || ""); p.append("metadata[reference]", booking.reference); p.append("metadata[org_id]", booking.org_id);
  p.append("payment_intent_data[metadata][product]", "VOICEJOB"); p.append("payment_intent_data[metadata][booking_id]", booking.id);
  p.append("success_url", SITE() + "/?paid=" + encodeURIComponent(booking.reference)); p.append("cancel_url", SITE() + "/");
  p.append("expires_at", String(Math.floor(Date.now() / 1000) + 23 * 3600));
  let r, d; try {
    r = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": "voicejob-" + booking.id + "-" + cents }, body: p.toString(), signal: AbortSignal.timeout(10000) });
    d = await r.json();
  } catch (e) { return { ok: false, error: "stripe_unreachable" }; }
  if (!r.ok || !d || !d.url) { console.error("jobpay: Stripe HTTP " + (r && r.status) + " " + String(d && d.error && d.error.message || "").slice(0, 120)); return { ok: false, error: "stripe_refused" }; }
  return { ok: true, url: d.url, cents: cents, session: d.id };
}

// Stripe says the checkout finished. Mark the job paid only if it was really paid, for the right amount, for a real confirmed booking. Safe to run twice.
async function onCheckout(session) {
  const md = (session && session.metadata) || {};
  if (md.product !== "VOICEJOB") return { skipped: true };
  if (session.payment_status !== "paid") return { skipped: true, unpaid: true };
  const bk = rows(await B.sb("voice_bookings?id=eq." + encodeURIComponent(md.booking_id || "") + "&select=id,org_id,reference,job_id,status,snapshot&limit=1"))[0];
  if (!bk) { console.error("VOICEJOB paid for unknown booking", md.booking_id); return { error: "Unknown booking" }; }
  const expect = Number(bk.snapshot && bk.snapshot.quote && bk.snapshot.quote.total_cents);
  if (Number(session.amount_total) !== expect) { await B.audit("system", "voicejob_amount_mismatch", bk.id, { paid: session.amount_total, expected: expect }); return { error: "Amount mismatch" }; }
  if (bk.status !== "confirmed" || !bk.job_id) { await B.audit("system", "voicejob_paid_unconfirmed", bk.id, { status: bk.status }); return { error: "Booking not confirmed" }; }
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : null;
  const job = rows(await B.sb("jobs?id=eq." + encodeURIComponent(bk.job_id) + "&select=id,payment_intent_id,payment_status&limit=1"))[0];
  if (!job) return { error: "Job not found" };
  if (job.payment_status === "paid" && (!pi || job.payment_intent_id === pi)) return { ok: true, duplicate: true };
  const up = await B.sb("jobs?id=eq." + encodeURIComponent(job.id), { method: "PATCH", prefer: "return=minimal", body: { payment_status: "paid", amount_paid: expect / 100, paid_online: true, payment_intent_id: pi, payment_verified_at: new Date().toISOString(), payment: "card" } });
  if (!up.ok) return { error: "Could not mark the job paid" };
  await B.audit("system", "voicejob_paid", bk.id, { job: job.id, cents: expect });
  return { ok: true };
}
module.exports = { createLink, onCheckout };
