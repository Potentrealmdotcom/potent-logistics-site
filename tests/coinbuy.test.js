// Run: node tests/coinbuy.test.js  (coin top-ups, $100-per-$1,000 reward, refunds and chargebacks)
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.SUPABASE_URL = "https://x.supabase.co";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const U1 = "11111111-1111-1111-1111-111111111111", P1 = "22222222-2222-2222-2222-222222222222", PR1 = "33333333-3333-3333-3333-333333333333";
const T = { music_users: [{ id: U1, email: "buyer@x.com", name: "Buyer", active: true }], beat_settings: [], music_coin_wallets: [], music_coin_ledger: [], music_coin_topups: [], notifications: [],
  beat_producers: [{ id: PR1, active: true, hold_days: 0, name: "Seller" }], music_products: [{ id: P1, producer_id: PR1, title: "Song", kind: "download", price_cents: 500, status: "published", file_ref: "f", limited_qty: null, sold_count: 0 }],
  music_sales: [], beat_wallet_txns: [], beat_audit: [], music_contract_templates: [{ key: "t1", title: "Tpl", body: "Full text of the agreement goes here.", version: 1, active: true }], music_contracts: [], music_contract_parties: [] };
let seq = 0; const uid = () => "aaaaaaaa-0000-4000-8000-" + String(++seq).padStart(12, "0");
function filt(rows, q) { return rows.filter(r => q.split("&").every(p => { let m = p.match(/^(\w+)=eq\.(.*)$/); if (m) return String(r[m[1]]) === decodeURIComponent(m[2]); m = p.match(/^(\w+)=is\.null$/); if (m) return r[m[1]] == null; m = p.match(/^(\w+)=like\.(.*)\*$/); if (m) return String(r[m[1]] || "").startsWith(decodeURIComponent(m[2])); return true; })); }
function rpc(fn, a) { if (fn === "music_coin_apply") { if (a.p_ref && T.music_coin_ledger.some(l => l.ref === a.p_ref)) return { ok: true, dup: true }; let w = T.music_coin_wallets.find(x => x.user_id === a.p_user); if (!w) T.music_coin_wallets.push(w = { user_id: a.p_user, balance_cents: 0 }); if (w.balance_cents + a.p_delta < 0) return { ok: false, error: "insufficient", balance: w.balance_cents }; w.balance_cents += a.p_delta; T.music_coin_ledger.push({ id: uid(), user_id: a.p_user, delta_cents: a.p_delta, balance_after: w.balance_cents, type: a.p_type, ref: a.p_ref, note: a.p_note, actor: a.p_actor, created_at: new Date().toISOString() }); return { ok: true, balance: w.balance_cents }; } return true; }
global.fetch = async (u, o) => { o = o || {}; u = String(u); const m = o.method || "GET"; const R = (d) => ({ ok: true, status: 200, text: async () => JSON.stringify(d) });
  const rp = u.match(/rest\/v1\/rpc\/(\w+)/); if (rp) return R(rpc(rp[1], JSON.parse(o.body)));
  const t = (u.match(/rest\/v1\/([a-z_]+)/) || [])[1]; if (!T[t]) return R([]); const q = (u.split("?")[1] || "");
  if (m === "GET") { let d = filt(T[t], q).map(r => Object.assign({}, r)); if (t === "music_contracts") d.forEach(c => { c.music_contract_parties = T.music_contract_parties.filter(p => p.contract_id === c.id); }); if (t === "music_products") d.forEach(c => { c.beat_producers = T.beat_producers.find(p => p.id === c.producer_id); }); return R(d); }
  if (m === "POST") { const arr = [].concat(JSON.parse(o.body)); const out = []; for (const r of arr) { if (t === "music_coin_topups" && T[t].some(x => x.session_id === r.session_id)) continue; if (t === "beat_wallet_txns" && T[t].some(x => x.ref === r.ref)) continue; if (t === "music_sales" && T[t].some(x => x.stripe_session_id === r.stripe_session_id)) continue; if (t === "beat_settings") { const e = T[t].find(x => x.key === r.key); if (e) { Object.assign(e, r); out.push(e); continue; } } if (t === "music_contract_templates") { const e = T[t].find(x => x.key === r.key); if (e) { Object.assign(e, r); out.push(e); continue; } } const row = Object.assign({ id: uid(), created_at: new Date().toISOString() }, t === "music_contracts" ? { status: "pending" } : t === "music_coin_topups" ? { status: "paid" } : {}, r); T[t].push(row); out.push(row); } return R(out); }
  if (m === "PATCH") { const hit = filt(T[t], q); hit.forEach(r => Object.assign(r, JSON.parse(o.body))); return R(hit); }
  if (m === "DELETE") { filt(T[t], q).forEach(r => T[t].splice(T[t].indexOf(r), 1)); return R([]); }
  return R([]); };
const C = require("../netlify/functions/music-coins.js"), Mu = require("../netlify/functions/lib/music.js"), CB = require("../netlify/functions/lib/coinbuy.js");
const call = async (a, extra) => { const r = await C.handler({ httpMethod: "POST", headers: { authorization: "Bearer " + Mu.signUser(U1), "x-nf-client-connection-ip": "9.9.9." + (++seq) }, body: JSON.stringify(Object.assign({ action: a }, extra || {})) }); return { s: r.statusCode, j: JSON.parse(r.body) }; };
const sess = (id, cents, pi) => ({ id: id, payment_status: "paid", amount_total: cents, payment_intent: pi || "pi_" + id, metadata: { product: "MUSICCOIN", user_id: U1 } });
const bal = () => (T.music_coin_wallets[0] || { balance_cents: 0 }).balance_cents;
(async () => {
  let r = await call("topup", { cents: 100 }); ok(r.s === 400, "below minimum refused");
  r = await call("topup", { cents: 2550 }); ok(r.s === 400, "whole dollars only");
  r = await call("topup", { cents: 99999999 }); ok(r.s === 400, "above max refused");
  r = await call("wallet"); ok(r.j.pay_enabled && r.j.packs.length && r.j.rewards.rewards_earned === 0, "wallet shows packs and reward progress, on by default");
  ok((await CB.onCheckout({ id: "x", payment_status: "unpaid", amount_total: 5000, metadata: { product: "MUSICCOIN", user_id: U1 } })).unpaid, "unpaid session credits nothing");
  ok((await CB.onCheckout(sess("s0", 5000))).skipped === undefined && bal() === 5000, "$50 top-up credits 5000");
  await CB.onCheckout(sess("s0", 5000)); ok(bal() === 5000 && T.music_coin_topups.length === 1, "webhook replay does not double credit");
  await CB.onCheckout(sess("s1", 90000)); ok(bal() === 95000 && !T.music_coin_ledger.some(l => /^reward:/.test(l.ref)), "$950 total: no reward yet");
  await CB.onCheckout(sess("s2", 5000)); ok(bal() === 100000 + 10000 && T.music_coin_ledger.filter(l => /^reward:/.test(l.ref)).length === 1, "crossing $1,000 adds one $100 reward");
  await CB.onCheckout(sess("s2", 5000)); ok(bal() === 110000, "replay after reward: still once");
  r = await call("wallet"); ok(r.j.rewards.rewards_earned === 1 && r.j.rewards.into_cents === 0, "progress shows 1 earned");
  await CB.onCheckout(sess("s3", 100000)); ok(bal() === 110000 + 100000 + 10000 && T.music_coin_ledger.filter(l => /^reward:/.test(l.ref)).length === 2, "another $1,000 gives a second reward");
  // spend some, then refund s3: coins clawed back only up to what's left, reward reversed
  await call("o_noop"); T.music_coin_wallets[0].balance_cents -= 50000;
  let x = await CB.onRefund({ payment_intent: "pi_s3", amount: 100000, amount_refunded: 100000 }); ok(x.ok && x.clawed === 100000 && bal() === 60000, "refund takes the top-up and the reward it earned: " + bal());
  ok(T.music_coin_topups.find(t => t.session_id === "s3").status === "refunded", "top-up marked refunded");
  ok(T.music_coin_wallets[0].balance_cents >= 0, "never below zero");
  ok(T.music_coin_ledger.some(l => l.ref === "rewardrev:" + U1 + ":2"), "reward 2 reversed (or wallet emptied)");
  x = await CB.onRefund({ payment_intent: "pi_s3", amount: 100000, amount_refunded: 100000 }); ok(x.skipped || x.duplicate, "repeat refund does nothing");
  x = await CB.onRefund({ payment_intent: "pi_s2", amount: 5000, amount_refunded: 1000 }); ok(x.skipped, "partial refund ignored");
  x = await CB.onDispute({ payment_intent: "pi_s1" }); ok(x.ok && T.music_coin_topups.find(t => t.session_id === "s1").status === "disputed", "dispute pulls coins back");
  await CB.onDisputeClosed({ payment_intent: "pi_s1", status: "won" }); ok(T.music_coin_topups.find(t => t.session_id === "s1").status === "paid", "won dispute restores top-up");
  ok((await CB.onCheckout({ id: "bad", payment_status: "paid", amount_total: 5000, metadata: { product: "MUSICCOIN", user_id: "nope" } })).bad, "bad user id ignored safely");
  console.log("PASS: " + n + " assertions");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
