// Run: node tests/aceheals.test.js
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
const assert = require("assert"), A = require("../netlify/functions/lib/aceheals.js"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const T = { beat_producers: [{ id: "p1", email: "breeze", active: true, hold_days: 3 }], ace_sales: [], beat_wallet_txns: [], beat_audit: [] };
global.fetch = async (u, o) => { o = o || {}; u = String(u); const m = o.method || "GET"; const t = (u.match(/rest\/v1\/([a-z_]+)/) || [])[1]; let d = [];
  if (!T[t]) return { ok: true, status: 200, text: async () => "[]" };
  if (m === "GET") { const q = u.split("?")[1] || ""; d = T[t].filter(r => q.split("&").every(p => { const x = p.match(/^(\w+)=eq\.(.*)$/); return !x || String(r[x[1]]) === decodeURIComponent(x[2]) || x[1] === "active"; })); }
  else if (m === "POST") { const r = JSON.parse(o.body); const key = t === "ace_sales" ? "ref" : t === "beat_wallet_txns" ? "ref" : null; if (key && T[t].some(x => x[key] === r[key])) d = []; else { r.id = r.id || "id" + T[t].length; if (t === "ace_sales") r.reversed_cents = 0; T[t].push(r); d = [r]; } }
  else if (m === "PATCH") { d = T[t].slice(); Object.assign(T[t].find(r => u.includes("id=eq." + r.id)) || {}, JSON.parse(o.body)); }
  return { ok: true, status: 200, text: async () => JSON.stringify(d) }; };
const MONTHLY = "price_1UQIiT609KMwZrdNR5Mxvy10", LIFE = "price_1UQIhl609KMwZrdNkLZuyV0n";
(async () => {
  let r = await A.onCheckout({ id: "cs_1", payment_status: "paid", amount_total: 7900, payment_intent: "pi_L" }, [LIFE]); ok(r.ok, "lifetime credited");
  ok(T.beat_wallet_txns[0].amount_cents === 1200, "lifetime pays $12");
  r = await A.onCheckout({ id: "cs_1", payment_status: "paid", amount_total: 7900, payment_intent: "pi_L" }, [LIFE]); ok(r.duplicate && T.beat_wallet_txns.length === 1, "replayed webhook does not pay twice");
  r = await A.onCheckout({ id: "cs_2", invoice: "in_1", payment_status: "paid", amount_total: 1299, payment_intent: "pi_M" }, [MONTHLY]); ok(r.ok && T.beat_wallet_txns[1].amount_cents === 200, "first monthly pays $2");
  r = await A.onInvoice({ id: "in_1", amount_paid: 1299, payment_intent: "pi_M", lines: { data: [{ price: { id: MONTHLY } }] } }); ok(r.duplicate && T.beat_wallet_txns.length === 2, "first invoice does not double-pay the checkout");
  r = await A.onInvoice({ id: "in_2", amount_paid: 1299, payment_intent: "pi_M2", lines: { data: [{ price: { id: MONTHLY } }] } }); ok(r.ok && T.beat_wallet_txns.length === 3, "renewal pays another $2");
  r = await A.onInvoice({ id: "in_x", amount_paid: 5000, lines: { data: [{ price: { id: "price_other" } }] } }); ok(r.skipped, "other products ignored");
  r = await A.onCheckout({ id: "cs_u", payment_status: "unpaid", amount_total: 7900 }, [LIFE]); ok(r.skipped, "unpaid ignored");
  r = await A.onRefund({ payment_intent: "pi_L", amount: 7900, amount_refunded: 7900 }); const rev = T.beat_wallet_txns.find(x => x.type === "refund"); ok(rev && rev.amount_cents === -1200, "full refund takes back $12");
  await A.onRefund({ payment_intent: "pi_L", amount: 7900, amount_refunded: 7900 }); ok(T.beat_wallet_txns.filter(x => x.type === "refund").length === 1, "refund not reversed twice");
  console.log("PASS: " + n + " assertions");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
