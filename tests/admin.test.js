// Run: node tests/admin.test.js
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.SUPABASE_URL = "https://x.supabase.co";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const PR = "33333333-3333-3333-3333-333333333333", REC = "44444444-4444-4444-4444-444444444444", SALE = "55555555-5555-5555-5555-555555555555", BEAT = "66666666-6666-6666-6666-666666666666", U1 = "11111111-1111-1111-1111-111111111111";
const T = { beat_producers: [{ id: PR, active: true, name: "Breeze", splits: { exclusive: 91 } }, { id: REC, active: true, name: "Partner", splits: { exclusive: 91 } }],
  beat_sales: [{ id: SALE, producer_id: PR, beat_id: BEAT, status: "complete", eligible_cents: 10000, unallocated_cents: 800, title: "Beat" }, { id: "77777777-7777-7777-7777-777777777777", producer_id: PR, beat_id: BEAT, status: "refunded", eligible_cents: 10000, unallocated_cents: 800 }],
  beat_remainder_agreements: [], beat_sale_remainder: [], beat_wallet_txns: [], beat_audit: [], beat_settings: [], music_users: [{ id: U1, email: "a@x.com", active: true, history_off: false }], music_roles: [], music_history: [], music_notifications: [] };
let seq = 0; const uid = () => "bbbbbbbb-0000-4000-8000-" + String(++seq).padStart(12, "0");
function filt(rows, q) { return rows.filter(r => q.split("&").every(p => { const m = p.match(/^(\w+)=eq\.(.*)$/); return !m || String(r[m[1]]) === decodeURIComponent(m[2]); })); }
global.fetch = async (u, o) => { o = o || {}; u = String(u); const m = o.method || "GET"; const R = (d) => ({ ok: true, status: 200, text: async () => JSON.stringify(d) });
  const t = (u.match(/rest\/v1\/([a-z_]+)/) || [])[1]; if (!T[t]) return R([]); const q = u.split("?")[1] || "";
  if (m === "GET") { const d = filt(T[t], q).map(r => Object.assign({}, r)); if (t === "beat_sale_remainder") d.forEach(r => { r.beat_remainder_agreements = T.beat_remainder_agreements.find(x => x.id === r.agreement_id); }); return R(d); }
  if (m === "POST") { const out = []; for (const r of [].concat(JSON.parse(o.body))) { if (t === "beat_wallet_txns" && T[t].some(x => x.ref === r.ref)) continue; if (t === "beat_sale_remainder" && T[t].some(x => x.sale_id === r.sale_id && x.agreement_id === r.agreement_id)) return { ok: false, status: 409, text: async () => "dup" }; if (t === "beat_settings") { const e = T[t].find(x => x.key === r.key); if (e) { Object.assign(e, r); out.push(e); continue; } } if (t === "music_roles") { const e = T[t].find(x => x.user_id === r.user_id); if (e) { Object.assign(e, r); out.push(e); continue; } } const row = Object.assign({ id: uid(), created_at: new Date().toISOString() }, r); T[t].push(row); out.push(row); } return R(out); }
  if (m === "PATCH") { const hit = filt(T[t], q); hit.forEach(r => Object.assign(r, JSON.parse(o.body))); return R(hit); }
  if (m === "DELETE") { filt(T[t], q).forEach(r => T[t].splice(T[t].indexOf(r), 1)); return R([]); }
  return R([]); };
const A = require("../netlify/functions/music-admin.js"), Mu = require("../netlify/functions/lib/music.js");
const crypto = require("crypto"), b64u = x => Buffer.from(x).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const owner = (() => { const body = b64u(JSON.stringify({ role: "owner", exp: Date.now() + 1e6 })); return body + "." + b64u(crypto.createHmac("sha256", "t").update(body).digest()); })();
const call = async (a, extra, tok) => { const r = await A.handler({ httpMethod: "POST", headers: { authorization: "Bearer " + (tok || owner), "x-nf-client-connection-ip": "8.8.8." + (++seq) }, body: JSON.stringify(Object.assign({ action: a }, extra || {})) }); return { s: r.statusCode, j: JSON.parse(r.body) }; };
(async () => {
  let r = await call("o_orders", {}, Mu.signUser(U1)); ok(r.s === 403, "buyers cannot use owner tools");
  r = await call("o_rem_save", { label: "Too big", recipient_name: "X", pct: 9, producer_id: PR }); ok(r.s === 400, "more than 8% rejected");
  r = await call("o_rem_save", { label: "Partner A 5%", recipient_name: "Partner", recipient_producer_id: REC, pct: 5, producer_id: PR }); ok(r.s === 200 && r.j.status === "validated", "5% validated");
  r = await call("o_rem_save", { label: "Partner B 3%", recipient_name: "Partner", recipient_producer_id: REC, pct: 3, producer_id: PR }); ok(r.j.status === "validated", "3% still fits in the 8%");
  r = await call("o_rem_save", { label: "Extra 1%", recipient_name: "Other", pct: 1, producer_id: PR }); ok(r.j.status === "flagged" && /only 8%/.test(r.j.note), "overflow is flagged, not guessed: " + r.j.note);
  r = await call("o_rem_save", { label: "No name", recipient_name: "", pct: 1, producer_id: PR }); ok(r.j.status === "flagged", "missing recipient is flagged");
  const [A5, B3, F1] = T.beat_remainder_agreements; 
  r = await call("o_rem_apply", { sale_id: SALE, agreement_id: F1.id }); ok(r.s === 409, "flagged agreement cannot be applied");
  r = await call("o_rem_apply", { sale_id: "77777777-7777-7777-7777-777777777777", agreement_id: A5.id }); ok(r.s === 409, "refunded sale cannot be assigned");
  r = await call("o_rem_apply", { sale_id: SALE, agreement_id: A5.id }); ok(r.s === 200 && r.j.cents === 500 && !r.j.credited && T.beat_wallet_txns.length === 0, "5% of 100.00 = 5.00 assigned, nothing paid by default");
  r = await call("o_rem_apply", { sale_id: SALE, agreement_id: A5.id }); ok(r.s === 409, "same agreement cannot apply twice");
  r = await call("o_rem_apply", { sale_id: SALE, agreement_id: B3.id, credit_wallet: true }); ok(r.s === 200 && r.j.cents === 300 && r.j.credited && T.beat_wallet_txns[0].amount_cents === 300 && T.beat_wallet_txns[0].producer_id === REC, "3% assigned and only then credited to partner wallet");
  ok(T.beat_sale_remainder.reduce((s, x) => s + x.cents, 0) <= T.beat_sales[0].unallocated_cents, "never assigns more than the unassigned money");
  const rid = T.beat_sale_remainder.find(x => x.credited).id; r = await call("o_rem_reverse", { id: rid }); ok(r.s === 200 && T.beat_wallet_txns.length === 2 && T.beat_wallet_txns[1].amount_cents === -300, "reversal takes the credit back");
  r = await call("o_role_set", { email: "a@x.com", role: "moderator" }); ok(r.s === 200 && T.music_roles[0].role === "moderator", "role granted");
  r = await call("o_role_set", { email: "a@x.com", role: "boss" }); ok(r.s === 400, "unknown role refused");
  r = await call("o_flags_set", { ai: false, download_limit: 5 }); r = await call("o_flags_get"); ok(r.j.flags.ai === false && r.j.flags.download_limit === 5 && r.j.flags.signups === true, "flags saved");
  r = await call("o_report", { type: "remainder" }); ok(r.s === 200 && /5\.00/.test(r.j.csv), "remainder CSV");
  r = await call("hist_add", { track_id: "99999999-9999-9999-9999-999999999999" }, Mu.signUser(U1)); ok(r.s === 200 && T.music_history.length === 1, "history recorded");
  r = await call("hist_set", { off: true }, Mu.signUser(U1)); ok(T.music_history.length === 0, "turning history off clears it");
  r = await call("hist_add", { track_id: "99999999-9999-9999-9999-999999999999" }, Mu.signUser(U1)); ok(T.music_history.length === 0, "history stays off");
  console.log("PASS: " + n + " assertions");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
