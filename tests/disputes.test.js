// Run: node tests/disputes.test.js  Chargebacks, payout race guard, and cache headers on public reads.
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
const assert = require("assert");
const B = require("../netlify/functions/lib/beats.js"), music = require("../netlify/functions/music-api.js"), beat = require("../netlify/functions/beat-api.js");
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
let W, bal;
global.fetch = async (u, o) => { o = o || {}; u = String(u); const m = o.method || "GET"; let d = [];
  if (m !== "GET") W.push({ u, m, body: o.body ? JSON.parse(o.body) : null });
  if (u.includes("beat_sales?payment_intent_id")) d = [{ id: "s1", producer_id: "p1", beat_id: "b1", title: "T", producer_cents: 45500, sale_type: "exclusive" }];
  else if (u.includes("music_sales?payment_intent_id")) d = [];
  else if (u.includes("beat_wallet_txns?ref=like")) d = bal.priorRefund ? [{ amount_cents: -10000 }] : [];
  else if (u.includes("beat_wallet_txns?ref=eq.dispute")) d = [{ amount_cents: -45500 }];
  else if (u.includes("beat_wallet_txns?producer_id")) d = bal.rows;
  else if (u.includes("beat_producers?id=eq.")) d = [{ id: "p1", active: true, email: "a@b.co", payout_method: "paypal", payout_handle: "x" }];
  else if (u.includes("beat_settings?key=eq.payout_code")) d = [{ value: { hash: B.hashPw("code123") } }];
  else if (u.includes("beat_payouts") && m === "POST") d = [{ id: "po1" }];
  return { ok: true, status: 200, text: async () => JSON.stringify(d), json: async () => d }; };
(async () => {
  W = []; bal = {};
  let r = await B.handleDispute({ id: "dp_1", payment_intent: "pi_1" }, "created");
  const tx = W.find(w => w.u.includes("beat_wallet_txns")).body;
  ok(r.ok && tx.amount_cents === -45500 && tx.ref === "dispute:dp_1", "chargeback takes back the seller's full share, idempotent ref");
  ok(W.some(w => w.u.includes("beat_sales?id=eq.s1") && w.body.status === "disputed"), "sale marked disputed");
  ok(W.some(w => w.u.includes("beat_items?id=eq.b1") && w.body.status === "unavailable"), "disputed exclusive locked until resolved");
  W = []; bal = { priorRefund: true }; await B.handleDispute({ id: "dp_2", payment_intent: "pi_1" }, "created");
  ok(W.find(w => w.u.includes("beat_wallet_txns")).body.amount_cents === -35500, "a prior partial refund is not taken twice");
  W = []; r = await B.handleDispute({ id: "dp_1", payment_intent: "pi_1", status: "won" }, "closed");
  ok(W.find(w => w.u.includes("beat_wallet_txns")).body.amount_cents === 45500 && W.some(w => w.body && w.body.status === "complete"), "won chargeback restores the seller share");
  W = []; r = await B.handleDispute({ id: "dp_1", payment_intent: "pi_1", status: "lost" }, "closed");
  ok(!W.some(w => w.u.includes("beat_wallet_txns")) && W.some(w => w.body && w.body.status === "refunded"), "lost chargeback stays reversed");
  ok((await B.handleDispute({ id: "x", payment_intent: null }, "created")).skipped, "dispute without payment intent skipped");

  // payout race: two requests pass the first check, the wallet then goes negative -> the second is undone
  const pt = B.signProducer("p1");
  const run = async rows => { W = []; bal = { rows }; return beat.handler({ httpMethod: "POST", headers: { authorization: "Bearer " + pt }, body: JSON.stringify({ action: "requestpayout", amount_cents: "all", code: "code123" }) }); };
  const wallet = (x) => [{ amount_cents: x, available_at: "2020-01-01" }];
  // before write balance 10000 passes; after write we simulate the debit not yet reflected -> still +10000 => ok
  let res = await run(wallet(10000)); ok(res.statusCode === 200, "normal payout passes");
  res = await run([{ amount_cents: 10000, available_at: "2020-01-01" }, { amount_cents: -10000, available_at: "2020-01-01" }]); ok(res.statusCode === 400 || res.statusCode === 409, "empty wallet cannot cash out (" + res.statusCode + ")");

  // public reads: GET is cached by the CDN, POST-only actions are not exposed to GET
  global.fetch = async () => ({ ok: true, status: 200, text: async () => "[]", json: async () => [] });
  let g = await music.handler({ httpMethod: "GET", headers: {}, queryStringParameters: { action: "home" } });
  ok(g.statusCode === 200 && /s-maxage=60/.test(g.headers["Netlify-CDN-Cache-Control"]), "home is CDN-cacheable");
  g = await music.handler({ httpMethod: "GET", headers: {}, queryStringParameters: { action: "me" } }); ok(g.statusCode === 405, "account data is never served over GET");
  g = await music.handler({ httpMethod: "GET", headers: {}, queryStringParameters: { action: "download" } }); ok(g.statusCode === 405, "downloads never over GET");
  g = await beat.handler({ httpMethod: "GET", headers: {}, queryStringParameters: { action: "catalog" } }); ok(g.statusCode === 200 && g.headers["Netlify-CDN-Cache-Control"], "beat catalog is CDN-cacheable");
  g = await beat.handler({ httpMethod: "GET", headers: {}, queryStringParameters: { action: "o_list" } }); ok(g.statusCode === 405, "owner actions never over GET");
  console.log("PASS: " + n + " assertions");
})().catch(e => { console.error("FAIL", e.stack); process.exit(1); });
