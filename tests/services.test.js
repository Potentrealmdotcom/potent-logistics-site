// Run: node tests/services.test.js
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.SUPABASE_URL = "https://x.supabase.co";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const U = "11111111-1111-1111-1111-111111111111", CID = "cccccccc-1111-1111-1111-111111111111";
const T = { music_users: [{ id: U, email: "a@x.com", active: true }], beat_audit: [], music_notifications: [],
  music_service_tiers: [{ key: "cover_1", family: "cover_art", title: "Cover", price_cents: 9900, is_quote: false, active: true, sort: 1 }, { key: "cover_4", family: "cover_art", title: "Custom", price_cents: 49900, is_quote: true, active: true, sort: 4 }],
  music_service_orders: [], music_collectibles: [{ id: CID, title: "Figurine", price_cents: 30000, edition_size: 2, sold_count: 0, status: "published" }], music_collectible_units: [] };
let seq = 0; const uid = () => "eeeeeeee-0000-4000-8000-" + String(++seq).padStart(12, "0");
function filt(rows, q) { return rows.filter(r => q.split("&").every(p => { const m = p.match(/^(\w+)=eq\.(.*)$/); if (m) return String(r[m[1]]) === decodeURIComponent(m[2]); const z = p.match(/^(\w+)=neq\.(.*)$/); if (z) return String(r[z[1]]) !== z[2]; return true; })); }
function rpc(fn, a) { if (fn !== "music_collectible_claim") return true; const ex = T.music_collectible_units.find(x => x.stripe_session_id === a.p_session); if (ex) return { ok: true, dup: true, edition: ex.edition_no, code: ex.certificate_code }; const c = T.music_collectibles.find(x => x.id === a.p_id); if (!c || c.status !== "published") return { ok: false, error: "unavailable" }; if (c.sold_count >= c.edition_size) return { ok: false, error: "sold_out" }; c.sold_count++; const u = { id: uid(), collectible_id: c.id, edition_no: c.sold_count, stripe_session_id: a.p_session, certificate_code: "CODE" + String(c.sold_count).padStart(8, "0"), status: "sold", price_cents: a.p_price, payment_intent_id: a.p_pi }; T.music_collectible_units.push(u); return { ok: true, edition: u.edition_no, code: u.certificate_code }; }
global.fetch = async (u, o) => { o = o || {}; u = String(u); const m = o.method || "GET"; const R = (d) => ({ ok: true, status: 200, text: async () => JSON.stringify(d) });
  const rp = u.match(/rest\/v1\/rpc\/(\w+)/); if (rp) return R(rpc(rp[1], JSON.parse(o.body)));
  const t = (u.match(/rest\/v1\/([a-z_]+)/) || [])[1]; if (!T[t]) return R([]); const q = u.split("?")[1] || "";
  if (m === "GET") { const d = filt(T[t], q).map(r => Object.assign({}, r)); if (t === "music_service_orders") d.forEach(x => { x.music_service_tiers = T.music_service_tiers.find(y => y.key === x.tier_key); }); if (t === "music_collectible_units") d.forEach(x => { x.music_collectibles = T.music_collectibles.find(y => y.id === x.collectible_id); }); return R(d); }
  if (m === "POST") { const out = []; for (const r of [].concat(JSON.parse(o.body))) { const row = Object.assign({ id: uid(), created_at: new Date().toISOString() }, r); T[t].push(row); out.push(row); } return R(out); }
  if (m === "PATCH") { const hit = filt(T[t], q); hit.forEach(r => Object.assign(r, JSON.parse(o.body))); return R(hit); }
  return R([]); };
const S = require("../netlify/functions/music-services.js"), Svc = require("../netlify/functions/lib/svc.js"), Mu = require("../netlify/functions/lib/music.js");
const crypto = require("crypto"), b64u = x => Buffer.from(x).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const owner = (() => { const body = b64u(JSON.stringify({ role: "owner", exp: Date.now() + 1e6 })); return body + "." + b64u(crypto.createHmac("sha256", "t").update(body).digest()); })();
const call = async (a, extra, tok) => { const r = await S.handler({ httpMethod: "POST", headers: { authorization: "Bearer " + (tok || Mu.signUser(U)), "x-nf-client-connection-ip": "7.7.7." + (++seq) }, body: JSON.stringify(Object.assign({ action: a }, extra || {})) }); return { s: r.statusCode, j: JSON.parse(r.body) }; };
(async () => {
  let r = await call("order_create", { tier_key: "cover_1", brief: "short" }); ok(r.s === 400, "brief required");
  r = await call("order_create", { tier_key: "cover_1", brief: "A moody cover with a city skyline at night please" }); ok(r.s === 200 && r.j.status === "awaiting_payment" && T.music_service_orders[0].price_cents === 9900, "fixed tier = awaiting payment at the database price");
  r = await call("order_create", { tier_key: "cover_1", brief: "A moody cover with a city skyline at night please", price_cents: 1 }); ok(T.music_service_orders[1].price_cents === 9900, "browser cannot change the price");
  r = await call("order_create", { tier_key: "cover_4", brief: "Full gatefold package with a custom illustration" }); ok(r.j.status === "quote_requested" && T.music_service_orders[2].price_cents == null, "starting-price tier begins as a quote request");
  const q = T.music_service_orders[2].id, f = T.music_service_orders[0].id;
  r = await call("order_pay", { id: q }); ok(r.s === 409, "cannot pay before a price is set");
  r = await call("o_svc_update", { id: q, quote_cents: 40000 }, owner); ok(r.s === 400, "quote cannot be under the starting price");
  r = await call("o_svc_update", { id: f, quote_cents: 20000 }, owner); ok(r.s === 409, "fixed tiers cannot be re-priced");
  r = await call("o_svc_update", { id: q, quote_cents: 65000 }, owner); ok(r.s === 200 && T.music_service_orders[2].status === "awaiting_payment" && T.music_service_orders[2].quote_cents === 65000, "quote set, buyer can now pay");
  r = await call("o_svc_update", { id: f, status: "in_progress" }, owner); ok(r.s === 409, "no work before payment");
  r = await call("o_svc_update", { id: f, status: "paid" }, owner); ok(r.s === 409, "paid is only set by Stripe");
  // webhook: wrong amount does not mark paid; right amount does; replay is safe
  let w = await Svc.onCheckout({ id: "cs_1", payment_status: "paid", amount_total: 100, payment_intent: "pi_1", metadata: { product: "MUSICSVC", order_id: f } }); ok(w.mismatch && T.music_service_orders[0].status === "awaiting_payment", "wrong amount is not accepted as payment");
  w = await Svc.onCheckout({ id: "cs_1", payment_status: "paid", amount_total: 9900, payment_intent: "pi_1", metadata: { product: "MUSICSVC", order_id: f } }); ok(w.ok && T.music_service_orders[0].status === "paid" && T.music_service_orders[0].paid_at, "payment recorded");
  w = await Svc.onCheckout({ id: "cs_1", payment_status: "paid", amount_total: 9900, payment_intent: "pi_1", metadata: { product: "MUSICSVC", order_id: f } }); ok(w.duplicate, "replayed webhook is harmless");
  r = await call("o_svc_update", { id: f, status: "delivered" }, owner); ok(r.s === 409, "delivery needs a link");
  r = await call("o_svc_update", { id: f, status: "delivered", delivered_url: "https://example.com/art.zip" }, owner); ok(r.s === 200, "delivered with link");
  w = await Svc.onRefund({ payment_intent: "pi_1", amount: 9900, amount_refunded: 9900 }); ok(w.ok && T.music_service_orders[0].status === "refunded", "full refund marks the order refunded");
  // collectibles
  r = await call("o_coll_save", { title: "Cheap", price_cents: 29999, edition_size: 5 }, owner); ok(r.s === 400, "collectibles start at $300");
  const ses = (id, pi) => ({ id: id, payment_status: "paid", amount_total: 30000, payment_intent: pi, customer_details: { email: "a@x.com" }, metadata: { product: "MUSICCOLL", collectible_id: CID, user_id: U } });
  w = await Svc.onCheckout(ses("cs_a", "pi_a")); ok(w.ok && w.edition === 1, "edition 1 issued");
  w = await Svc.onCheckout(ses("cs_a", "pi_a")); ok(w.ok && T.music_collectible_units.length === 1, "replay does not issue another");
  w = await Svc.onCheckout(ses("cs_b", "pi_b")); ok(w.edition === 2, "edition 2 issued");
  w = await Svc.onCheckout(ses("cs_c", "pi_c")); ok(w.soldOut && T.music_collectible_units.length === 2 && T.music_collectibles[0].sold_count === 2, "sold out: no extra edition, buyer is refunded");
  r = await call("cert_get", { code: "CODE00000001" }); ok(r.s === 200 && r.j.certificate.edition_no === 1 && r.j.certificate.edition_size === 2 && r.j.certificate.valid && !JSON.stringify(r.j).includes("a@x.com"), "certificate verifies without exposing the buyer");
  r = await call("o_coll_save", { id: CID, title: "Figurine", price_cents: 35000, edition_size: 2 }, owner); ok(r.s === 409, "price locked after sales");
  r = await call("o_unit_update", { id: T.music_collectible_units[0].id, status: "shipped", tracking: "1Z999" }, owner); ok(r.s === 200 && T.music_collectible_units[0].status === "shipped", "workflow: shipped with tracking");
  w = await Svc.onRefund({ payment_intent: "pi_b", amount: 30000, amount_refunded: 30000 }); ok(T.music_collectible_units[1].status === "refunded", "refunded edition is marked refunded");
  r = await call("cert_get", { code: "CODE00000002" }); ok(r.j.certificate.valid === false, "refunded certificate is no longer valid");
  console.log("PASS: " + n + " assertions");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
