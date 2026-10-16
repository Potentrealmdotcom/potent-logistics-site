// Shared helpers for Beat Man: producer accounts, automatic sale splits, wallet ledger.
// Used by beat-api, beat-checkout and the shared stripe-webhook. Server-side only (service role key).
const crypto = require("crypto");

const SB = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
const SITE = "https://potentoperations.netlify.app";
const TOKEN_TTL_MS = 14 * 24 * 3600 * 1000;

function J(status, obj) { return { statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(obj) }; }

async function sb(path, opts) {
  opts = opts || {};
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
  if (opts.prefer) headers.Prefer = opts.prefer;
  const r = await fetch(SB + "/rest/v1/" + path, { method: opts.method || "GET", headers: headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { d = t; }
  return { ok: r.ok, status: r.status, data: d };
}

// ── passwords (scrypt) ──
function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  return "scrypt$" + salt + "$" + crypto.scryptSync(String(pw), salt, 32).toString("hex");
}
function checkPw(stored, pw) {
  const p = String(stored || "").split("$");
  if (p[0] !== "scrypt" || p.length !== 3) return false;
  const a = Buffer.from(crypto.scryptSync(String(pw), p[1], 32).toString("hex")), b = Buffer.from(p[2]);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── producer tokens: signed with a DIFFERENT key than staff tokens, so they can never work in the OS data API ──
function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function key() { return String(process.env.AUTH_SECRET || "") + "|beatman"; }
function signProducer(id) {
  const body = b64u(JSON.stringify({ pid: id, exp: Date.now() + TOKEN_TTL_MS }));
  return body + "." + b64u(crypto.createHmac("sha256", key()).update(body).digest());
}
function verifyProducer(token) {
  if (!process.env.AUTH_SECRET || !token || typeof token !== "string" || token.indexOf(".") < 0) return null;
  const parts = token.split(".");
  const expect = b64u(crypto.createHmac("sha256", key()).update(parts[0]).digest());
  const a = Buffer.from(parts[1] || ""), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return p.exp && p.exp >= Date.now() ? p : null;
  } catch (e) { return null; }
}
// Owner = normal POTENT staff token (AUTH_SECRET) with role owner and no company attached.
function verifyOwner(token) {
  if (!process.env.AUTH_SECRET || !token || typeof token !== "string" || token.indexOf(".") < 0) return null;
  const parts = token.split(".");
  const expect = b64u(crypto.createHmac("sha256", process.env.AUTH_SECRET).update(parts[0]).digest());
  const a = Buffer.from(parts[1] || ""), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return p.exp && p.exp >= Date.now() && p.role === "owner" && !p.orgId && !p.assist ? p : null;
  } catch (e) { return null; }
}
function bearer(event) {
  const h = (event && event.headers) || {};
  const m = String(h.authorization || h.Authorization || "").match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

// ── money ──
function estimateFee(gross) { return gross > 0 ? Math.round(gross * 0.029 + 30) : 0; }

async function balances(producerId) {
  const r = await sb("beat_wallet_txns?producer_id=eq." + producerId + "&select=amount_cents,available_at&limit=5000");
  const rows = Array.isArray(r.data) ? r.data : [];
  const now = Date.now();
  let available = 0, pending = 0;
  rows.forEach(function (t) { if (new Date(t.available_at).getTime() <= now) available += t.amount_cents; else pending += t.amount_cents; });
  return { available: available, pending: pending, total: available + pending };
}

// A paid Checkout Session for a beat -> record the sale and credit the producer's wallet. Idempotent per Stripe session.
async function fulfillSession(session) {
  const md = (session && session.metadata) || {};
  if (md.product !== "BEAT") return { skipped: true };
  if (session.payment_status !== "paid") return { skipped: true, unpaid: true };
  const beatR = await sb("beat_items?id=eq." + encodeURIComponent(md.beat_id || "") + "&select=*");
  const beat = beatR.ok && Array.isArray(beatR.data) && beatR.data[0];
  if (!beat) { console.error("BEAT sale for unknown beat", md.beat_id, session.id); return { error: "Unknown beat" }; }
  const prodR = await sb("beat_producers?id=eq." + beat.producer_id + "&select=*");
  const prod = prodR.ok && Array.isArray(prodR.data) && prodR.data[0];
  if (!prod) return { error: "Unknown producer" };

  const saleType = md.sale_type === "exclusive" ? "exclusive" : "lease";
  const gross = Number(session.amount_total) || 0;
  const fee = prod.deduct_fees ? estimateFee(gross) : 0;
  const net = Math.max(0, gross - fee);
  const pct = Number(prod.splits && prod.splits[saleType]);
  const split = isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 50;
  const producerCents = Math.floor(net * split / 100);
  const email = (session.customer_details && session.customer_details.email) || session.customer_email || null;

  const ins = await sb("beat_sales", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: {
    producer_id: prod.id, beat_id: beat.id, title: beat.title, sale_type: saleType, stripe_session_id: session.id,
    payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
    buyer_email: email, gross_cents: gross, fee_cents: fee, net_cents: net, split_pct: split, producer_cents: producerCents } });
  if (!ins.ok) return { error: "Could not record the sale" };
  let sale = Array.isArray(ins.data) && ins.data[0];
  if (!sale) { // retry of an already-recorded sale: make sure the wallet credit exists
    const ex = await sb("beat_sales?stripe_session_id=eq." + encodeURIComponent(session.id) + "&select=*");
    sale = ex.ok && Array.isArray(ex.data) && ex.data[0];
    if (!sale) return { error: "Sale lookup failed" };
  }
  const availableAt = new Date(Date.now() + (Number(prod.hold_days) || 0) * 864e5).toISOString();
  const tx = await sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: {
    producer_id: prod.id, type: "sale", amount_cents: sale.producer_cents, ref: "sale:" + sale.id,
    note: beat.title + " (" + saleType + ")", available_at: availableAt } });
  if (!tx.ok) return { error: "Could not credit wallet" };
  if (saleType === "exclusive") await sb("beat_items?id=eq." + beat.id, { method: "PATCH", prefer: "return=minimal", body: { exclusive_sold: true } });
  return { ok: true, saleId: sale.id, producerCents: sale.producer_cents };
}

// charge.refunded -> take back the producer's share in proportion to what was refunded. Idempotent per refunded total.
async function handleRefund(charge) {
  const pi = charge && charge.payment_intent;
  if (!pi) return { skipped: true };
  const s = await sb("beat_sales?payment_intent_id=eq." + encodeURIComponent(pi) + "&select=*");
  const sale = s.ok && Array.isArray(s.data) && s.data[0];
  if (!sale) return { skipped: true };
  const ratio = charge.amount > 0 ? Math.min(1, (Number(charge.amount_refunded) || 0) / charge.amount) : 0;
  const target = Math.round(sale.producer_cents * ratio);
  const prev = await sb("beat_wallet_txns?ref=like." + encodeURIComponent("refund:" + sale.id + ":") + "*&select=amount_cents");
  const already = (Array.isArray(prev.data) ? prev.data : []).reduce(function (a, t) { return a + Math.abs(t.amount_cents); }, 0);
  const delta = target - already;
  if (delta > 0) {
    const tx = await sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: {
      producer_id: sale.producer_id, type: "refund", amount_cents: -delta, ref: "refund:" + sale.id + ":" + charge.amount_refunded,
      note: "Refund: " + (sale.title || "beat") } });
    if (!tx.ok) return { error: "Could not record refund" };
  }
  if (ratio >= 1) await sb("beat_sales?id=eq." + sale.id, { method: "PATCH", prefer: "return=minimal", body: { status: "refunded" } });
  return { ok: true, reversed: delta > 0 ? delta : 0 };
}

module.exports = { SB, SITE, J, sb, hashPw, checkPw, signProducer, verifyProducer, verifyOwner, bearer, balances, fulfillSession, handleRefund, estimateFee };
