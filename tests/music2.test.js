// Run: node tests/music2.test.js  Cart allocation, preorder gating, unsubscribe, support rate limit, collaborators.
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
const assert = require("assert");
const M = require("../netlify/functions/lib/music.js"), api = require("../netlify/functions/music-api.js");
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const P1 = "11111111-1111-1111-1111-111111111111", P2 = "22222222-2222-2222-2222-222222222222";
let log;
global.fetch = async (u, o) => { o = o || {}; u = String(u); const m = o.method || "GET"; if (m !== "GET") log.push({ u, body: o.body ? JSON.parse(o.body) : null }); let d = [];
  if (u.includes("music_sales?stripe_session_id=eq.")) d = [];
  else if (u.includes("music_products?id=eq." + P1)) d = [{ id: P1, producer_id: "pr1", title: "A", kind: "sample_pack", price_cents: 1999 }];
  else if (u.includes("music_products?id=eq." + P2)) d = [{ id: P2, producer_id: "pr1", title: "B", kind: "preset", price_cents: 500 }];
  else if (u.includes("beat_producers?id=eq.")) d = [{ id: "pr1", hold_days: 0, email: "s@x.co" }];
  else if (u.includes("music_sales") && m === "POST") d = [Object.assign({ id: "s" + log.length }, JSON.parse(o.body))];
  else if (u.includes("music_support") && m === "POST") d = [];
  else if (u.includes("music_users?id=eq.")) d = [];
  return { ok: true, status: 200, text: async () => JSON.stringify(d), json: async () => d }; };
const call = async (body, ipx) => { const r = await api.handler({ httpMethod: "POST", headers: { "x-nf-client-connection-ip": ipx || "1.1.1.1" }, body: JSON.stringify(body) }); return [r.statusCode, JSON.parse(r.body)]; };
(async () => {
  // allocate always sums exactly
  for (const [t, w] of [[1000, [1999, 500]], [1, [1, 1, 1]], [999, [333, 333, 333]], [0, [5, 5]], [12345, [100, 200, 300, 400]]]) ok(M.allocate(t, w).reduce((a, b) => a + b, 0) === t, "allocate sums " + t);
  // cart: two items, one discount, rows sum to session totals; each 1%/99%
  log = [];
  const s = { id: "cs_c1", payment_status: "paid", amount_total: 2000, payment_intent: "pi_c", total_details: { amount_tax: 101, amount_discount: 499 }, metadata: { product: "MUSIC", item_ids: P1 + "," + P2, prices: P1 + ":1999," + P2 + ":500", user_id: "", agreement_version: "1.0" } };
  const r = await M.fulfillProduct(s); ok(r.ok && r.made === 2, "cart made two sales");
  const rows = log.filter(w => w.u.includes("music_sales")).map(w => w.body);
  ok(rows.length === 2 && rows[0].stripe_session_id === "cs_c1#" + P1 && rows[1].stripe_session_id === "cs_c1#" + P2, "per-item session keys");
  ok(rows.reduce((a, x) => a + x.gross_cents, 0) === 2000, "gross sums to total");
  ok(rows.reduce((a, x) => a + x.tax_cents, 0) === 101, "tax sums");
  ok(rows.reduce((a, x) => a + x.discount_cents, 0) === 499, "discount sums");
  rows.forEach(x => { ok(x.platform_fee_cents + x.seller_cents === x.eligible_cents, "fee+seller=eligible"); ok(x.platform_fee_cents <= Math.ceil(x.eligible_cents * 0.01), "platform ~1%"); });
  // unsubscribe tokens
  const t = M.signUnsub("u-123"); ok(M.verifyUnsub(t) === "u-123", "unsub token verifies"); ok(M.verifyUnsub(t.slice(0, -2) + "xx") === null && M.verifyUnsub("junk") === null, "tampered token rejected");
  let [c, j] = await call({ action: "unsubscribe", t: t }); ok(c === 200 && log.some(w => w.u.includes("music_users") && w.body.marketing_opt_in === false), "unsubscribe works");
  [c] = await call({ action: "unsubscribe", t: "bad" }); ok(c === 400, "bad unsubscribe link rejected");
  // support: validation + rate limit
  [c] = await call({ action: "support_new", email: "nope", message: "hello there" }, "9.9.9.9"); ok(c === 400, "support needs a real email");
  [c] = await call({ action: "support_new", email: "a@b.co", message: "Need help with my order" }, "8.8.8.8"); ok(c === 200, "support accepted");
  let last; for (let i = 0; i < 6; i++) [last] = await call({ action: "support_new", email: "a@b.co", message: "Need help with my order" }, "7.7.7.7"); ok(last === 429, "support rate limited");
  // owner-only actions
  for (const a of ["o_support_list", "o_users", "o_user_resetpw", "o_email_export", "o_home_set"]) { [c] = await call({ action: a }); ok(c === 401 || c === 403, a + " needs owner"); }
  console.log("PASS: " + n + " assertions");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
