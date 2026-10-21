// Phone-booking payment: a secure Stripe link for the server's quote total, and the webhook step that marks the job paid only when it really was.
const assert = require("assert");
process.env.STRIPE_SECRET_KEY = "sk_test_x"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
const make = require("./_mock.js");
const T = { voice_bookings: [{ id: "bbbbbbbb-0000-4000-8000-000000000001", org_id: "o1", reference: "PV-1", job_id: "PL-1", status: "confirmed", snapshot: { quote: { total_cents: 45000 } } },
  { id: "bbbbbbbb-0000-4000-8000-000000000002", org_id: "o1", reference: "PV-2", job_id: null, status: "pending_review", snapshot: { quote: { total_cents: 45000 } } }],
  jobs: [{ id: "PL-1", payment_status: "pending", payment: "cash" }], beat_audit: [] };
make(T);
const mockFetch = global.fetch; let stripeCalls = [];
global.fetch = async (u, o) => {
  if (/api\.stripe\.com/.test(u)) { stripeCalls.push({ u, o }); return { ok: true, status: 200, json: async () => ({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" }) }; }
  return mockFetch(u, o);
};
const JP = require("../netlify/functions/lib/voice/jobpay.js");
(async () => {
  let r = await JP.createLink(T.voice_bookings[0], "a@b.com");
  assert.ok(r.ok && r.url === "https://checkout.stripe.com/c/pay/cs_1" && r.cents === 45000, "link made for the quote total");
  const body = new URLSearchParams(stripeCalls[0].o.body);
  assert.strictEqual(body.get("line_items[0][price_data][unit_amount]"), "45000", "amount comes from the saved quote");
  assert.strictEqual(body.get("metadata[product]"), "VOICEJOB");
  assert.ok(/voicejob-/.test(stripeCalls[0].o.headers["Idempotency-Key"]), "idempotency key prevents duplicate sessions");
  const sess = (o) => Object.assign({ id: "cs_1", payment_status: "paid", amount_total: 45000, payment_intent: "pi_1", metadata: { product: "VOICEJOB", booking_id: "bbbbbbbb-0000-4000-8000-000000000001" } }, o || {});
  r = await JP.onCheckout(sess({ payment_status: "unpaid" })); assert.ok(r.skipped && T.jobs[0].payment_status === "pending", "unpaid session does nothing");
  r = await JP.onCheckout(sess({ amount_total: 100 })); assert.ok(r.error && T.jobs[0].payment_status === "pending", "wrong amount is refused, job not marked paid");
  r = await JP.onCheckout(sess({ metadata: { product: "VOICEJOB", booking_id: "bbbbbbbb-0000-4000-8000-000000000002" } })); assert.ok(r.error && T.jobs[0].payment_status === "pending", "unconfirmed booking is not marked paid");
  r = await JP.onCheckout(sess()); assert.ok(r.ok && T.jobs[0].payment_status === "paid" && T.jobs[0].amount_paid === 450 && T.jobs[0].paid_online === true && T.jobs[0].payment_intent_id === "pi_1", "real payment marks the job paid");
  r = await JP.onCheckout(sess()); assert.ok(r.ok && r.duplicate, "Stripe retry is harmless");
  r = await JP.onCheckout({ metadata: { product: "OTHER" } }); assert.ok(r.skipped, "other products ignored");
  delete process.env.STRIPE_SECRET_KEY; r = await JP.createLink(T.voice_bookings[0], "a@b.com"); assert.ok(!r.ok && r.error === "stripe_not_configured", "no Stripe key: honest failure");
  console.log("voice-jobpay ok");
})().catch(e => { console.error(e); process.exit(1); });
