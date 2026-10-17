// Run: node tests/music.test.js  (no network). Checks fees, idempotency, limited drops and permission boundaries.
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
const assert = require("assert"), crypto = require("crypto");
const B = require("../netlify/functions/lib/beats.js"), M = require("../netlify/functions/lib/music.js"), api = require("../netlify/functions/music-api.js");
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const b64 = x => Buffer.from(x).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const ownerTok = (() => { const body = b64(JSON.stringify({ role: "owner", exp: Date.now() + 1e6 })); return body + "." + b64(crypto.createHmac("sha256", "t").update(body).digest()); })();

let state, log;
function reset(o) { state = Object.assign({ existingSale: false, claim: true, sellerKind: "seller", store_admin: false, items: {}, saleOwner: null }, o || {}); log = { writes: [], urls: [], rpc: [] }; }
global.fetch = async (u, o) => { o = o || {}; u = String(u); const m = o.method || "GET"; log.urls.push(m + " " + u); let d = [];
  if (m !== "GET") log.writes.push({ u, body: o.body ? JSON.parse(o.body) : null });
  if (u.includes("/rpc/music_product_claim")) { log.rpc.push("claim"); d = state.claim; }
  else if (u.includes("music_sales?stripe_session_id=eq.") && m === "GET") d = state.existingSale ? [{ id: "s0", status: "complete" }] : [];
  else if (u.includes("music_products?id=eq.") && m === "GET") d = [{ id: "11111111-1111-1111-1111-111111111111", producer_id: "pr1", title: "Pack", kind: "sample_pack", limited_qty: state.limited || null, sold_count: 0 }];
  else if (u.includes("beat_producers?id=eq.") && m === "GET") d = [{ id: "pr1", active: true, kind: state.sellerKind, store_admin: state.store_admin, email: "s@x.co", hold_days: 0 }];
  else if (u.includes("music_sales") && m === "POST") d = [Object.assign({ id: "sale1" }, JSON.parse(o.body))];
  else if (u.includes("music_sales?id=eq.") && u.includes("buyer_user_id")) d = state.saleOwner ? [{ product_id: "p1" }] : [];
  else if (m === "POST" && /music_(tracks|products|videos)/.test(u)) d = [{ id: "new1" }];
  else if (u.includes("music_users?id=eq.")) d = [{ id: "u1", email: "b@x.co", active: true }];
  return { ok: true, status: 200, text: async () => JSON.stringify(d), json: async () => d }; };
const call = async (tok, body) => { const r = await api.handler({ httpMethod: "POST", headers: tok ? { authorization: "Bearer " + tok } : {}, body: JSON.stringify(body) }); return [r.statusCode, JSON.parse(r.body)]; };
const sess = (amt) => ({ id: "cs_m1", payment_status: "paid", amount_total: amt, payment_intent: "pi_1", total_details: { amount_tax: 0, amount_discount: 0 }, metadata: { product: "MUSIC", item_id: "11111111-1111-1111-1111-111111111111", user_id: "u1", agreement_version: "1.0" } });

(async () => {
  // 1. Product sale: POTENT 1%, seller the rest, nothing unassigned, Stripe fee separate
  for (const amt of [100, 999, 2500, 4999, 10000, 123456]) {
    reset(); const r = await M.fulfillProduct(sess(amt)); ok(r.ok, "sale ok " + amt);
    const row = log.writes.find(w => w.u.includes("music_sales")).body;
    ok(row.platform_fee_cents <= Math.ceil(amt * 0.01) && row.platform_fee_cents >= Math.floor(amt * 0.01) - 1, "platform fee ~1% for " + amt);
    ok(row.platform_fee_cents + row.seller_cents === row.eligible_cents, "fee + seller = eligible for " + amt);
    ok(row.seller_cents >= Math.floor(amt * 0.98), "seller keeps ~99% for " + amt);
    ok(row.fee_cents > 0, "processing fee stored separately");
  }
  // 2. Replayed webhook creates nothing new
  reset({ existingSale: true }); let r = await M.fulfillProduct(sess(5000)); ok(r.duplicate && log.writes.length === 0, "duplicate webhook: no writes");
  // 3. Limited drop sold out: refunded, nobody paid
  reset({ limited: 5, claim: false }); r = await M.fulfillProduct(sess(5000));
  const so = log.writes.find(w => w.u.includes("music_sales")).body; ok(so.status === "refunded" && so.seller_cents === 0 && so.platform_fee_cents === 0, "sold-out drop: refunded, zero allocations");
  ok(!log.writes.some(w => w.u.includes("beat_wallet_txns")), "sold-out drop: seller wallet not credited");
  // 4. Normal sale credits seller wallet by seller_cents only
  reset(); await M.fulfillProduct(sess(5000)); const w = log.writes.find(x => x.u.includes("beat_wallet_txns")).body; ok(w.amount_cents === 4950 && w.ref === "msale:sale1", "wallet credited $49.50 (99%) with idempotent ref");

  // 5. Permission boundaries
  reset(); let c = await call(null, { action: "o_queue" }); ok(c[0] === 403, "anonymous cannot use owner queue");
  const ut = M.signUser("u1"); c = await call(ut, { action: "o_queue" }); ok(c[0] === 403, "buyer token cannot use owner queue");
  c = await call(ut, { action: "s_my" }); ok(c[0] === 401 || c[0] === 400, "buyer token is not a seller (" + c[0] + ")");
  const pt = B.signProducer("pr1"); c = await call(pt, { action: "o_queue" }); ok(c[0] === 403, "seller token cannot use owner queue");
  c = await call(ownerTok, { action: "o_queue" }); ok(c[0] === 200, "owner can use queue");
  c = await call("garbage", { action: "me" }); ok(c[0] === 401, "bad token rejected");
  // 6. Sellers cannot publish; trusted platform store admins can
  reset(); c = await call(pt, { action: "s_item", type: "track", title: "x", audio_url: "https://a/b.mp3", status: "published" }); ok(c[0] === 400 && /review|approves/i.test(c[1].error), "seller cannot publish directly");
  c = await call(pt, { action: "s_item", type: "track", title: "x", audio_url: "https://a/b.mp3", status: "pending_review" }); ok(c[0] === 200, "seller can submit for review");
  reset({ sellerKind: "platform", store_admin: true }); c = await call(pt, { action: "s_item", type: "track", title: "x", audio_url: "https://a/b.mp3", status: "published" }); ok(c[0] === 200, "platform store admin may publish own content");
  // 7. Product needs rights + file + price before review; price floor
  reset(); c = await call(pt, { action: "s_item", type: "product", title: "p", price_cents: 50, status: "draft" }); ok(c[0] === 400, "price under $1 rejected");
  c = await call(pt, { action: "s_item", type: "product", title: "p", price_cents: 500, status: "pending_review" }); ok(c[0] === 400, "cannot submit without file/rights");
  // 8. Downloads: only the buyer's own completed sale
  reset({ saleOwner: false }); c = await call(ut, { action: "download", kind: "product", id: "11111111-1111-1111-1111-111111111111" }); ok(c[0] === 404, "cannot download someone else's purchase");
  ok(log.urls.some(u => u.includes("buyer_user_id=eq.u1") && u.includes("status=eq.complete")), "download query is scoped to buyer and completed sales");
  // 9. Seller can only touch their own items (query is scoped by producer_id)
  reset(); await call(pt, { action: "s_item", type: "track", id: "22222222-2222-2222-2222-222222222222", title: "t" });
  ok(log.urls.some(u => u.includes("music_tracks?id=eq.22222222") && u.includes("producer_id=eq.pr1")), "seller edit lookup is scoped to their own producer id");
  console.log("PASS: " + n + " assertions");
})().catch(e => { console.error("FAIL", e.stack); process.exit(1); });
