// Run: node tests/coins.test.js
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.SUPABASE_URL = "https://x.supabase.co";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const U1 = "11111111-1111-1111-1111-111111111111", P1 = "22222222-2222-2222-2222-222222222222", PR1 = "33333333-3333-3333-3333-333333333333";
const T = { music_users: [{ id: U1, email: "buyer@x.com", name: "Buyer", active: true }], beat_settings: [{ key: "music_coin_pay", value: "1" }], music_coin_wallets: [], music_coin_ledger: [],
  beat_producers: [{ id: PR1, active: true, hold_days: 0, name: "Seller" }], music_products: [{ id: P1, producer_id: PR1, title: "Song", kind: "download", price_cents: 500, status: "published", file_ref: "f", limited_qty: null, sold_count: 0 }],
  music_sales: [], beat_wallet_txns: [], beat_audit: [], music_contract_templates: [{ key: "t1", title: "Tpl", body: "Full text of the agreement goes here.", version: 1, active: true }], music_contracts: [], music_contract_parties: [] };
let seq = 0; const uid = () => "aaaaaaaa-0000-4000-8000-" + String(++seq).padStart(12, "0");
function filt(rows, q) { return rows.filter(r => q.split("&").every(p => { let m = p.match(/^(\w+)=eq\.(.*)$/); if (m) return String(r[m[1]]) === decodeURIComponent(m[2]); m = p.match(/^(\w+)=is\.null$/); if (m) return r[m[1]] == null; m = p.match(/^(\w+)=like\.(.*)\*$/); if (m) return String(r[m[1]] || "").startsWith(decodeURIComponent(m[2])); return true; })); }
function rpc(fn, a) { if (fn === "music_coin_apply") { if (a.p_ref && T.music_coin_ledger.some(l => l.ref === a.p_ref)) return { ok: true, dup: true }; let w = T.music_coin_wallets.find(x => x.user_id === a.p_user); if (!w) T.music_coin_wallets.push(w = { user_id: a.p_user, balance_cents: 0 }); if (w.balance_cents + a.p_delta < 0) return { ok: false, error: "insufficient", balance: w.balance_cents }; w.balance_cents += a.p_delta; T.music_coin_ledger.push({ id: uid(), user_id: a.p_user, delta_cents: a.p_delta, balance_after: w.balance_cents, type: a.p_type, ref: a.p_ref, note: a.p_note, actor: a.p_actor, created_at: new Date().toISOString() }); return { ok: true, balance: w.balance_cents }; } return true; }
global.fetch = async (u, o) => { o = o || {}; u = String(u); const m = o.method || "GET"; const R = (d) => ({ ok: true, status: 200, text: async () => JSON.stringify(d) });
  const rp = u.match(/rest\/v1\/rpc\/(\w+)/); if (rp) return R(rpc(rp[1], JSON.parse(o.body)));
  const t = (u.match(/rest\/v1\/([a-z_]+)/) || [])[1]; if (!T[t]) return R([]); const q = (u.split("?")[1] || "");
  if (m === "GET") { let d = filt(T[t], q).map(r => Object.assign({}, r)); if (t === "music_contracts") d.forEach(c => { c.music_contract_parties = T.music_contract_parties.filter(p => p.contract_id === c.id); }); if (t === "music_products") d.forEach(c => { c.beat_producers = T.beat_producers.find(p => p.id === c.producer_id); }); return R(d); }
  if (m === "POST") { const arr = [].concat(JSON.parse(o.body)); const out = []; for (const r of arr) { if (t === "beat_wallet_txns" && T[t].some(x => x.ref === r.ref)) continue; if (t === "music_sales" && T[t].some(x => x.stripe_session_id === r.stripe_session_id)) continue; if (t === "beat_settings") { const e = T[t].find(x => x.key === r.key); if (e) { Object.assign(e, r); out.push(e); continue; } } if (t === "music_contract_templates") { const e = T[t].find(x => x.key === r.key); if (e) { Object.assign(e, r); out.push(e); continue; } } const row = Object.assign({ id: uid(), created_at: new Date().toISOString() }, t === "music_contracts" ? { status: "pending" } : {}, r); T[t].push(row); out.push(row); } return R(out); }
  if (m === "PATCH") { const hit = filt(T[t], q); hit.forEach(r => Object.assign(r, JSON.parse(o.body))); return R(hit); }
  if (m === "DELETE") { filt(T[t], q).forEach(r => T[t].splice(T[t].indexOf(r), 1)); return R([]); }
  return R([]); };
const C = require("../netlify/functions/music-coins.js"), Mu = require("../netlify/functions/lib/music.js"), Bt = require("../netlify/functions/lib/beats.js");
const crypto = require("crypto"), b64u = x => Buffer.from(x).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const owner = (() => { const body = b64u(JSON.stringify({ role: "owner", exp: Date.now() + 1e6 })); return body + "." + b64u(crypto.createHmac("sha256", "t").update(body).digest()); })();
const call = async (a, extra, tok) => { const r = await C.handler({ httpMethod: "POST", headers: { authorization: "Bearer " + (tok || Mu.signUser(U1)), "x-nf-client-connection-ip": "9.9.9." + (++seq) }, body: JSON.stringify(Object.assign({ action: a }, extra || {})) }); return { s: r.statusCode, j: JSON.parse(r.body) }; };
(async () => {
  let r = await call("wallet"); ok(r.s === 200 && r.j.balance_cents === 0 && r.j.pay_enabled, "empty wallet, pay enabled");
  r = await call("o_coin_adjust", { email: "buyer@x.com", delta_cents: 700, note: "welcome" }, Mu.signUser(U1)); ok(r.s === 403, "buyer cannot adjust coins");
  r = await call("o_coin_adjust", { email: "buyer@x.com", delta_cents: 700 }, owner); ok(r.s === 400, "reason required");
  r = await call("o_coin_adjust", { email: "buyer@x.com", delta_cents: 700, note: "welcome" }, owner); ok(r.s === 200 && r.j.balance === 700, "owner credit");
  r = await call("o_coin_adjust", { email: "buyer@x.com", delta_cents: -800, note: "too much" }, owner); ok(r.s === 409, "cannot go below zero");
  r = await call("pay_cart", { product_ids: [P1], agree: false }); ok(r.s === 400, "must accept terms");
  r = await call("pay_cart", { product_ids: [P1], agree: true }); ok(r.s === 200 && r.j.balance === 200, "paid 5.00 with coins: " + JSON.stringify(r.j));
  ok(T.music_sales.length === 1 && T.music_sales[0].platform_fee_cents === 5 && T.music_sales[0].seller_cents === 495, "1% POTENT / 99% seller on coin sale");
  ok(T.beat_wallet_txns.length === 1 && T.beat_wallet_txns[0].amount_cents === 495, "seller wallet credited");
  r = await call("pay_cart", { product_ids: [P1], agree: true }); ok(r.s === 402, "insufficient coins refused");
  ok(T.music_sales.length === 1 && T.music_coin_wallets[0].balance_cents === 200, "failed payment changes nothing");
  r = await call("o_coin_refund", { kind: "product", sale_id: T.music_sales[0].id }, owner); ok(r.s === 200 && T.music_coin_wallets[0].balance_cents === 700, "refund returns coins");
  ok(T.music_sales[0].status === "refunded" && T.beat_wallet_txns.some(x => x.amount_cents === -495), "refund reverses seller share");
  r = await call("o_coin_refund", { kind: "product", sale_id: T.music_sales[0].id }, owner); ok(r.s === 409, "no double refund");
  ok(T.music_coin_wallets[0].balance_cents === 700, "balance unchanged by repeat refund");
  await call("o_coin_set", { enabled: false }, owner); r = await call("pay_cart", { product_ids: [P1], agree: true }); ok(r.s === 403, "payments off when switched off");
  // contracts
  r = await call("c_create", { template_key: "t1", parties: [{ name: "Ann", email: "ann@x.com", role: "writer" }, { name: "Bo", email: "bo@x.com" }] }); ok(r.s === 200 && r.j.links.length === 2, "contract created with links");
  const cid = r.j.id, l1 = r.j.links[0].link.split("t=")[1], l2 = r.j.links[1].link.split("t=")[1];
  r = await call("s_view", { t: "bad.token" }); ok(r.s === 403, "bad signing link refused");
  r = await call("s_view", { t: l1 }); ok(r.s === 200 && r.j.you.name === "Ann" && !r.j.final_html, "signer sees contract");
  const h = r.j.contract.body_hash;
  r = await call("s_sign", { t: l1, typed_name: "Ann Lee", assent: false, body_hash: h }); ok(r.s === 400, "must tick assent " + JSON.stringify(r));
  r = await call("s_sign", { t: l1, typed_name: "Ann Lee", assent: true, body_hash: "deadbeef" }); ok(r.s === 409, "stale/changed document blocks signing");
  r = await call("s_sign", { t: l1, typed_name: "Ann Lee", assent: true, body_hash: h }); ok(r.s === 200 && r.j.contract.status === "pending", "first signature recorded, still pending");
  r = await call("s_sign", { t: l1, typed_name: "Ann Lee", assent: true, body_hash: h }); ok(r.s === 409, "no double signing");
  r = await call("s_sign", { t: l2, typed_name: "Bo Ray", assent: true, body_hash: h }); ok(r.s === 200 && r.j.contract.status === "executed" && /Signatures/.test(r.j.final_html) && r.j.contract.final_hash, "all signed -> executed with final record");
  r = await call("c_void", { id: cid }); ok(r.s === 409, "executed contract cannot be cancelled");
  r = await call("c_get", { id: cid }); ok(r.s === 200 && r.j.final_html, "creator can download final record");
  console.log("PASS: " + n + " assertions");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
