// Run: node tests/beat-fees.test.js   Proves POTENT's fee rules. No network needed.
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
const assert = require("assert");
const B = require("../netlify/functions/lib/beats.js");
let n = 0; const ok = (c, m) => { assert(c, m); n++; };

// 1. Property test: many amounts x many stored seller percentages (including bad ones)
for (let gross = 100; gross <= 500000; gross += 137) {
  for (const stored of [0, 10, 50, 90, 91, 91.5, 95, 99, 100, 250, -5, "abc", null, undefined]) {
    for (const tax of [0, Math.floor(gross * 0.07)]) {
      const s = B.computeSplit(gross, tax, stored);
      ok(s.eligible === gross - tax, "eligible = gross - tax");
      ok(s.seller >= s.eligible * 0.91 - 1e-9, "seller gets at least 91% (" + gross + "," + stored + ")");
      ok(s.platform <= Math.ceil(s.eligible * 0.01) && s.platform >= Math.floor(s.eligible * 0.01) - 1, "platform fee is 1% (" + gross + ")");
      ok(s.seller + s.platform + s.unallocated === s.eligible, "every cent accounted for");
      ok(s.unallocated >= 0 && s.seller >= 0 && s.platform >= 0, "no negatives");
    }
  }
}
// 2. exact examples
let s = B.computeSplit(50000, 0, 91); ok(s.seller === 45500 && s.platform === 500 && s.unallocated === 4000, "$500 sale: seller $455, POTENT $5, unassigned $40");
s = B.computeSplit(100000, 0, 50); ok(s.sellerPct === 91 && s.seller === 91000, "a stored 50% is lifted to 91% on the server");
s = B.computeSplit(100000, 0, 100); ok(s.sellerPct === 99 && s.platform === 1000, "100% is capped at 99% so the 1% fee is always collected");
s = B.computeSplit(100000, 8000, 91); ok(s.eligible === 92000 && s.platform === 920, "fee is on the eligible amount after tax");
// 3. processing fee is separate: estimateFee never feeds the split
ok(B.estimateFee(50000) > 0 && B.computeSplit(50000, 0, 91).platform === 500, "card fee does not change POTENT's 1%");
ok(B.PLATFORM_FEE_PCT === 1 && B.MIN_SELLER_PCT === 91, "constants");

// 4. API refuses configurations below 91%
const api = require("../netlify/functions/beat-api.js"), crypto = require("crypto");
const b64 = x => Buffer.from(x).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const body = b64(JSON.stringify({ role: "owner", exp: Date.now() + 1e6 })), ot = body + "." + b64(crypto.createHmac("sha256", "t").update(body).digest());
const writes = [];
global.fetch = async (u, o) => { o = o || {}; if ((o.method || "GET") !== "GET") writes.push([u, o.body]); const d = String(u).includes("beat_producers?id=eq.") ? [{ id: "x", splits: { lease: 0, exclusive: 91 } }] : []; return { ok: true, status: 200, text: async () => JSON.stringify(d), json: async () => d }; };
const call = async b => { const r = await api.handler({ httpMethod: "POST", headers: { authorization: "Bearer " + ot }, body: JSON.stringify(b) }); return [r.statusCode, JSON.parse(r.body)]; };
(async () => {
  const id = "11111111-1111-1111-1111-111111111111";
  for (const bad of [90, 50, 0, 100, 99.5, "x"]) { const r = await call({ action: "o_setproducer", id, exclusive_pct: bad }); ok(r[0] === 400, "o_setproducer rejects " + bad); }
  ok(writes.length === 0, "nothing was written for rejected values");
  let r = await call({ action: "o_setproducer", id, exclusive_pct: 93 }); ok(r[0] === 200, "93% accepted");
  r = await call({ action: "o_create", name: "A", email: "a@b.co", exclusive_pct: 80 }); ok(r[0] === 400, "o_create rejects 80%");
  // 5. A real sale through the ledger, with a producer whose stored split is an old 50%.
  // The beat names no separate maker, so the maker IS the seller: the 8% royalty is his too
  // (owner decision Oct 24 2026 — it used to sit in unallocated, paid to nobody).
  const sales = [], wtx = [];
  global.fetch = async (u, o) => { o = o || {}; u = String(u); const m = o.method || "GET"; let d = [];
    if (u.includes("/rpc/beat_finalize")) d = "sold";
    else if (u.includes("beat_items?id=eq.")) d = [{ id: "b1", title: "T", producer_id: "p1", seller_type: "platform" }];
    else if (u.includes("beat_producers?id=eq.")) d = [{ id: "p1", splits: { lease: 50, exclusive: 50 }, deduct_fees: true, hold_days: 0 }];
    else if (u.includes("/beat_sales") && m === "POST") { sales.push(JSON.parse(o.body)); d = [Object.assign({ id: "s1" }, JSON.parse(o.body))]; }
    else if (u.includes("beat_wallet_txns") && m === "POST") { wtx.push(JSON.parse(o.body)); d = []; }
    return { ok: true, status: 200, text: async () => JSON.stringify(d), json: async () => d }; };
  const res = await B.fulfillSession({ id: "cs_1", payment_status: "paid", amount_total: 50000, payment_intent: "pi_1", total_details: { amount_tax: 0 }, metadata: { product: "BEAT", beat_id: "b1", sale_type: "lease" } });
  ok(res.ok && sales.length === 1, "sale recorded");
  const rec = sales[0];
  ok(rec.sale_type === "exclusive", "a lease request is still recorded as exclusive only (non-exclusive is not offered)");
  ok(rec.producer_cents === 45500 && rec.platform_fee_cents === 500 && rec.maker_cents === 4000 && rec.maker_id === "p1" && rec.unallocated_cents === 0 && rec.eligible_cents === 50000, "ledger: $455 seller / $40 maker royalty / $5 POTENT / $0 unassigned");
  ok(rec.producer_cents + rec.maker_cents + rec.platform_fee_cents + rec.unallocated_cents === rec.eligible_cents, "ledger adds up");
  ok(wtx.some(t => t.ref === "sale:s1" && t.amount_cents === 45500 && t.producer_id === "p1") && wtx.some(t => t.ref === "maker:s1" && t.amount_cents === 4000 && t.producer_id === "p1"), "maker == seller: seller credit + maker royalty both land in his wallet (99% total)");
  ok(rec.fee_cents > 0 && rec.platform_fee_cents === 500, "processing fee stored separately from platform fee");
  console.log("PASS: " + n + " assertions");
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
