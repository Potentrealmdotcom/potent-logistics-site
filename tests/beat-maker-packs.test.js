// Run: node tests/beat-maker-packs.test.js
// Proves the two Oct 24 2026 owner decisions: (1) the 8% maker royalty is a real wallet payout,
// (2) mystery packs assign available beats at fulfillment and fail safe. No network needed.
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.STRIPE_SECRET_KEY = "sk_test_fake";
const assert = require("assert");
// The stripe package is installed by Netlify at deploy, not vendored in this clone. Stub the module
// so the handlers load; every path exercised here is stopped before a real Stripe call, and any
// accidental call throws (which the code under test is required to survive gracefully).
const Module = require("module"), origLoad = Module._load;
Module._load = function (req) { if (req === "stripe") return function () { return { checkout: { sessions: { create: async () => { throw new Error("stripe is stubbed in tests"); } } }, refunds: { create: async () => { throw new Error("stripe is stubbed in tests"); } } }; }; return origLoad.apply(this, arguments); };
const B = require("../netlify/functions/lib/beats.js");
let n = 0; const ok = (c, m) => { assert(c, m); n++; };

// ── 1. computeSplit with the maker royalty ──
ok(B.MAKER_ROYALTY_PCT === 8, "the maker royalty pct lives in one named constant: 8%");
let s = B.computeSplit(50000, 0, 91, { makerPct: B.MAKER_ROYALTY_PCT });
ok(s.seller === 45500 && s.maker === 4000 && s.platform === 500 && s.unallocated === 0, "$500 @91: seller $455 / maker $40 / POTENT $5 / nothing left unallocated");
s = B.computeSplit(100000, 0, 99, { makerPct: 8 });
ok(s.maker === 8000 && s.platform === 1000 && s.seller === 91000 && s.unallocated === 0, "seller @99 with a distinct maker: the royalty comes out of the seller slice (seller nets 91)");
s = B.computeSplit(100000, 0, 95, { makerPct: 8 });
ok(s.maker === 8000 && s.platform === 1000 && s.seller === 91000 && s.unallocated === 0, "seller @95 with a distinct maker: platform + maker are senior, seller capped at the remainder");
s = B.computeSplit(50000, 0, 91);
ok(s.maker === 0 && s.unallocated === 4000 && s.seller === 45500 && s.platform === 500, "legacy split without the maker option is untouched (the /music/ store still parks its remainder)");
for (let gross = 100; gross <= 200000; gross += 733) {
  for (const pct of [91, 92.5, 95, 99]) {
    const x = B.computeSplit(gross, Math.floor(gross * 0.07), pct, { makerPct: 8 });
    ok(x.seller + x.maker + x.platform + x.unallocated === x.eligible, "maker split: every cent accounted for");
    ok(x.platform === Math.round(x.eligible * 0.01), "maker split: platform is exactly 1%");
    ok(x.maker === Math.round(x.eligible * 0.08), "maker split: maker is exactly 8%");
    ok(x.unallocated >= 0 && x.seller >= 0 && x.maker >= 0, "maker split: no negatives");
    ok(x.seller <= Math.ceil(x.eligible * x.sellerPct / 100), "maker split: seller never exceeds their configured pct");
  }
}
ok(JSON.stringify(B.distribute(100, 3)) === "[34,33,33]" && B.distribute(99900, 3).join() === "33300,33300,33300" && B.distribute(149900, 5).reduce((a, b) => a + b, 0) === 149900, "pack money distribution sums exactly to the session total");
ok(B.PACKS.pack3.price_cents === 99900 && B.PACKS.pack3.size === 3 && B.PACKS.pack5.price_cents === 149900 && B.PACKS.pack5.size === 5, "pack definitions: 3 beats $999 / 5 beats $1,499");

// ── a small stateful fake of the beats database (the shared _mock does not emulate the RPCs) ──
const P1 = "11111111-1111-4111-8111-111111111111"; // seller, 91%, maker of some beats
const P2 = "22222222-2222-4222-8222-222222222222"; // a distinct maker, 3-day hold
const P3 = "33333333-3333-4333-8333-333333333333"; // seller at 99% who makes his own beats
const K = i => "b0000000-0000-4000-8000-00000000000" + i;
function world() {
  const T = { beat_items: [], beat_producers: [], beat_sales: [], beat_wallet_txns: [], beat_audit: [], music_notifications: [] };
  let seq = 0; const uid = () => "f0000000-0000-4000-8000-" + String(++seq).padStart(12, "0");
  T.beat_producers.push(
    { id: P1, name: "Seller One", splits: { exclusive: 91 }, hold_days: 0, active: true },
    { id: P2, name: "Maker Two", splits: { exclusive: 91 }, hold_days: 3, active: true },
    { id: P3, name: "Top Seller", splits: { exclusive: 99 }, hold_days: 0, active: true });
  const beat = (id, over) => Object.assign({ id, title: "Beat " + id.slice(-1), producer_id: P1, maker_id: null, seller_type: "platform", status: "published", active: true, exclusive_sold: false, exclusive_cents: 50000, deliver_url: "https://files.example/" + id + ".wav", created_at: "2026-10-01T00:00:00Z" }, over || {});
  const match = (row, q) => {
    for (const [k, v] of q.entries()) {
      if (["select", "order", "limit", "offset", "on_conflict"].includes(k) || k === "or") continue;
      if (v.startsWith("eq.")) { if (String(row[k]) !== v.slice(3)) return false; }
      else if (v.startsWith("like.")) { const p = v.slice(5).replace(/[*%]/g, ""); if (!String(row[k] == null ? "" : row[k]).startsWith(p)) return false; }
      else if (v === "not.is.null") { if (row[k] == null) return false; }
      else if (v.startsWith("lte.")) { if (!(String(row[k] || "") <= v.slice(4))) return false; }
    }
    return true;
  };
  const R = d => ({ ok: true, status: 200, text: async () => JSON.stringify(d), json: async () => d });
  global.fetch = async (u, o) => {
    o = o || {}; const m = o.method || "GET", path = String(u).split("/rest/v1/")[1] || "";
    const [table, qs] = path.split("?"), q = new URLSearchParams(qs || "");
    if (table.startsWith("rpc/")) {
      const fn = table.slice(4), args = JSON.parse(o.body || "{}");
      const bt = T.beat_items.find(x => x.id === args.p_beat);
      if (fn === "beat_reserve") {
        if (!bt || bt.exclusive_sold) return R(false);
        if (bt.reserved_until && new Date(bt.reserved_until).getTime() > Date.now() && bt.reserved_token !== args.p_token) return R(false);
        bt.reserved_token = args.p_token; bt.reserved_until = new Date(Date.now() + (args.p_minutes || 30) * 60000).toISOString(); return R(true);
      }
      if (fn === "beat_release") { if (bt && bt.reserved_token === args.p_token) { bt.reserved_token = null; bt.reserved_until = null; } return R(true); }
      if (fn === "beat_finalize") {
        if (!bt) return R("conflict");
        if (bt.exclusive_sold) return R(bt.sold_session === args.p_session ? "already" : "conflict");
        bt.exclusive_sold = true; bt.sold_session = args.p_session; bt.status = "sold"; return R("sold");
      }
      return R(null);
    }
    const rows = T[table]; if (!rows) return R([]);
    if (m === "GET") { let out = rows.filter(r => match(r, q)); const lim = parseInt(q.get("limit") || "0", 10); if (lim) out = out.slice(0, lim); return R(out); }
    const body = JSON.parse(o.body || "{}");
    if (m === "POST") {
      const uniq = table === "beat_wallet_txns" ? "ref" : table === "beat_sales" ? "stripe_session_id" : null;
      const inserted = [];
      for (const r of (Array.isArray(body) ? body : [body])) {
        if (uniq && rows.some(x => x[uniq] === r[uniq])) continue; // ignore-duplicates
        const row = Object.assign({ id: uid(), created_at: new Date().toISOString() }, r); rows.push(row); inserted.push(row);
      }
      return R(String(o.prefer || "").includes("return=representation") ? inserted : []);
    }
    if (m === "PATCH") { rows.filter(r => match(r, q)).forEach(r => Object.assign(r, body)); return R([]); }
    return R([]);
  };
  return { T, beat };
}

(async () => {
  // ── 2. single sale with a DISTINCT maker: both wallets credited, split snapshotted ──
  let W = world();
  W.T.beat_items.push(W.beat(K(1), { maker_id: P2 }));
  let res = await B.fulfillSession({ id: "cs_single", payment_status: "paid", amount_total: 50000, payment_intent: "pi_single", total_details: { amount_tax: 0 }, customer_details: { email: "buyer@x.co" }, metadata: { product: "BEAT", beat_id: K(1), agreement_version: "1.0", agreed_at: "2026-10-24T00:00:00Z" } });
  ok(res.ok && res.producerCents === 45500 && res.makerCents === 4000, "single sale: seller $455, maker $40");
  let sale = W.T.beat_sales[0];
  ok(sale.maker_id === P2 && sale.maker_cents === 4000 && sale.unallocated_cents === 0 && sale.allocation.maker_id === P2 && sale.allocation.maker_cents === 4000, "sale row snapshots the maker and the royalty");
  let txs = W.T.beat_wallet_txns;
  ok(txs.some(t => t.ref === "sale:" + sale.id && t.producer_id === P1 && t.amount_cents === 45500), "seller wallet credited 91%");
  const mtx = txs.find(t => t.ref === "maker:" + sale.id);
  ok(mtx && mtx.producer_id === P2 && mtx.amount_cents === 4000, "maker wallet credited the 8% royalty");
  ok(new Date(mtx.available_at).getTime() > Date.now() + 2 * 864e5, "maker royalty waits out the maker's own hold period (3 days)");

  // ── 3. refunding that sale reverses BOTH shares ──
  res = await B.handleRefund({ payment_intent: "pi_single", amount: 50000, amount_refunded: 50000 });
  ok(res.ok && res.reversed === 49500, "full refund reverses seller share + maker royalty");
  ok(txs.some(t => t.ref === "refund:" + sale.id + ":50000" && t.producer_id === P1 && t.amount_cents === -45500), "seller share clawed back");
  ok(txs.some(t => t.ref === "makerrefund:" + sale.id + ":50000" && t.producer_id === P2 && t.amount_cents === -4000), "maker royalty clawed back");
  ok(W.T.beat_sales[0].status === "refunded" && W.T.beat_items[0].status === "unavailable", "refunded exclusive is parked unavailable, never re-listed");

  // ── 4. mystery pack: 3 beats, 3 different seller/maker shapes, one session ──
  W = world();
  W.T.beat_items.push(
    W.beat(K(1), { maker_id: P2 }),                                  // seller P1 91%, maker P2
    W.beat(K(2), { producer_id: P3, status: "approved", publish_at: "2026-01-01T00:00:00Z" }), // seller P3 99%, maker = himself
    W.beat(K(3), {}),                                                // seller P1, maker = himself
    W.beat(K(4), {}),                                                // spare, stays on the shelf
    W.beat(K(5), { exclusive_sold: true, status: "sold" }));         // already sold: must never be picked
  const packSession = { id: "cs_pack1", payment_status: "paid", amount_total: 99900, payment_intent: "pi_pack1", total_details: { amount_tax: 0, amount_discount: 0 }, customer_details: { email: "fan@x.co" }, metadata: { product: "BEAT", pack: "pack3", pack_beat_ids: [K(1), K(2), K(3)].join(","), pack_token: "tok1", agreement_version: "1.0", agreed_at: "2026-10-24T00:00:00Z" } };
  res = await B.fulfillSession(packSession);
  ok(res.ok && res.pack && res.sales === 3, "pack fulfilled: 3 sale rows from one session");
  const rows = W.T.beat_sales;
  ok(rows.every(r => r.pack_session_id === "cs_pack1" && r.status === "complete"), "every pack row carries the pack session");
  ok(new Set(rows.map(r => r.stripe_session_id)).size === 3, "pack rows have unique session keys (session id + beat id)");
  ok(rows.reduce((a, r) => a + r.gross_cents, 0) === 99900 && rows.every(r => r.gross_cents === 33300), "pack price spread across the beats: $333 each, summing to $999");
  ok(rows.every(r => r.producer_cents + r.maker_cents + r.platform_fee_cents + r.unallocated_cents === r.eligible_cents && r.unallocated_cents === 0), "every pack row splits clean: seller + maker + 1% = eligible");
  const byBeat = {}; rows.forEach(r => { byBeat[r.beat_id] = r; });
  ok(byBeat[K(1)].producer_cents === 30303 && byBeat[K(1)].maker_cents === 2664 && byBeat[K(1)].maker_id === P2 && byBeat[K(1)].platform_fee_cents === 333, "pack beat 1: seller 91% / maker 8% / POTENT 1% of its $333 share");
  ok(byBeat[K(2)].producer_cents === 30303 && byBeat[K(2)].maker_cents === 2664 && byBeat[K(2)].maker_id === P3, "pack beat 2: 99% seller capped so maker + platform still fit (nets 91% + his own 8% royalty)");
  ok([K(1), K(2), K(3)].every(id => W.T.beat_items.find(b => b.id === id).exclusive_sold), "pack beats are marked sold to this buyer");
  ok(!W.T.beat_items.find(b => b.id === K(4)).exclusive_sold && !rows.some(r => r.beat_id === K(5)), "spare stays listed; the already-sold beat was not touched");
  const p2tx = W.T.beat_wallet_txns.filter(t => t.producer_id === P2);
  ok(p2tx.length === 1 && p2tx[0].amount_cents === 2664 && p2tx[0].ref.indexOf("maker:") === 0, "distinct maker paid once for his pack beat");
  const p3tx = W.T.beat_wallet_txns.filter(t => t.producer_id === P3);
  ok(p3tx.reduce((a, t) => a + t.amount_cents, 0) === 30303 + 2664, "maker == seller in a pack: his wallet totals seller share + royalty");

  // ── 5. pack fulfillment is idempotent: a webhook retry changes nothing ──
  const txCount = W.T.beat_wallet_txns.length;
  res = await B.fulfillSession(packSession);
  ok(res.ok && res.already === true && W.T.beat_sales.length === 3 && W.T.beat_wallet_txns.length === txCount, "pack webhook retry: no duplicate sales, no duplicate credits");

  // ── 6. pack fail-safe: fewer available beats than the pack size -> graceful refund path ──
  W = world();
  W.T.beat_items.push(W.beat(K(1), {}), W.beat(K(2), {}));
  res = await B.fulfillSession({ id: "cs_pack2", payment_status: "paid", amount_total: 99900, payment_intent: "pi_pack2", total_details: { amount_tax: 0 }, customer_details: { email: "fan@x.co" }, metadata: { product: "BEAT", pack: "pack3", pack_beat_ids: [K(1), K(2)].join(","), pack_token: "tok2", agreement_version: "1.0" } });
  ok(res.ok && res.refunded === true, "short pack: fulfillment reports the automatic-refund path");
  ok(W.T.beat_sales.length === 0 && W.T.beat_wallet_txns.length === 0, "short pack: nothing sold, nobody credited");
  ok(W.T.beat_items.every(b => !b.exclusive_sold), "short pack: no beat was claimed");
  ok(W.T.beat_audit.some(a => a.action === "pack_refunded"), "short pack: the refund is audited");

  // ── 7. checkout guards: packs validated before Stripe is ever touched ──
  const checkout = require("../netlify/functions/beat-checkout.js");
  const call = async b => { const r = await checkout.handler({ httpMethod: "POST", headers: {}, body: JSON.stringify(b) }); return [r.statusCode, JSON.parse(r.body)]; };
  W = world();
  W.T.beat_items.push(W.beat(K(1), {}), W.beat(K(2), {}));
  let cr = await call({ pack: "pack9", agree: true }); ok(cr[0] === 400, "unknown pack rejected");
  cr = await call({ pack: "pack3" }); ok(cr[0] === 400, "pack without agreement acceptance rejected");
  cr = await call({ pack: "pack3", agree: true }); ok(cr[0] === 409, "pack bigger than the available catalog rejected before any Stripe session");

  console.log("PASS: " + n + " assertions");
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
