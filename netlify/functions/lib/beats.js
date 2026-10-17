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

const AGREEMENT_VERSION = "1.0";
async function rpc(fn, args) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(SB + "/rest/v1/rpc/" + fn, { method: "POST", headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify(args || {}) });
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { d = t; }
  return { ok: r.ok, status: r.status, data: d };
}
// Every important admin / money action is written here. Never throws.
async function audit(actor, action, target, detail) {
  try { await sb("beat_audit", { method: "POST", prefer: "return=minimal", body: { actor: String(actor || "system").slice(0, 120), action: action, target: target ? String(target).slice(0, 200) : null, detail: detail || null } }); } catch (e) { /* logging must not break the action */ }
}
async function getSetting(k) {
  const r = await sb("beat_settings?key=eq." + encodeURIComponent(k) + "&select=value");
  return r.ok && Array.isArray(r.data) && r.data[0] ? r.data[0].value : null;
}
async function setSetting(k, v) {
  return sb("beat_settings", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { key: k, value: v, updated_at: new Date().toISOString() } });
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
// POTENT fee rules (enforced here, on the server):
//  - POTENT's platform fee is exactly 1% of the eligible sale amount.
//  - An exclusive seller always receives at least 91% of the eligible amount (never less, whatever is stored on the producer).
//  - Whatever is left after seller + platform is recorded as "unallocated". It is NOT given to anyone.
//  - Card-processing fees are Stripe's and are recorded separately; they never change the platform fee or the seller's share.
const PLATFORM_FEE_PCT = 1, MIN_SELLER_PCT = 91, MAX_SELLER_PCT = 99;
function sellerPct(v) { const n = Number(v); return Math.min(MAX_SELLER_PCT, Math.max(MIN_SELLER_PCT, isFinite(n) ? n : MIN_SELLER_PCT)); }
function computeSplit(grossCents, taxCents, pct) {
  const gross = Math.max(0, Math.round(Number(grossCents) || 0)), tax = Math.max(0, Math.round(Number(taxCents) || 0));
  const eligible = Math.max(0, gross - tax), sp = sellerPct(pct);
  const seller = Math.min(eligible, Math.ceil(eligible * sp / 100));
  const platform = Math.min(Math.round(eligible * PLATFORM_FEE_PCT / 100), eligible - seller);
  return { eligible: eligible, seller: seller, platform: platform, unallocated: eligible - seller - platform, sellerPct: sp, platformPct: PLATFORM_FEE_PCT };
}
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

  const saleType = "exclusive"; // POTENT Beats sells exclusive masters only
  const gross = Number(session.amount_total) || 0;
  const td = session.total_details || {};
  const tax = Number(td.amount_tax) || 0, discount = Number(td.amount_discount) || 0;
  const procFee = estimateFee(gross); // Stripe's fee, recorded separately
  const sp = computeSplit(gross, tax, prod.splits && prod.splits.exclusive);
  let producerCents = sp.seller;
  const email = (session.customer_details && session.customer_details.email) || session.customer_email || null;
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : null;

  // Exclusive: the database lets exactly one paid session claim the beat.
  let conflict = false;
  {
    const fin = await rpc("beat_finalize", { p_beat: beat.id, p_session: session.id });
    if (!fin.ok) return { error: "Could not lock the exclusive" };
    conflict = fin.data === "conflict";
    if (conflict) {
      let refunded = false;
      try {
        if (pi && process.env.STRIPE_SECRET_KEY) { await require("stripe")(process.env.STRIPE_SECRET_KEY).refunds.create({ payment_intent: pi, reason: "duplicate" }, { idempotencyKey: "beatconflict:" + session.id }); refunded = true; }
      } catch (e) { console.error("auto-refund failed for conflicting exclusive", session.id, e.message); }
      producerCents = 0;
      await audit("system", "exclusive_conflict", beat.id, { session: session.id, auto_refunded: refunded });
    }
  }
  const alloc = { seller_type: beat.seller_type || "platform", rule: "platform fee 1%; exclusive seller at least 91% of eligible amount; remainder unallocated (no recipient assigned)", seller_pct: sp.sellerPct, platform_pct: sp.platformPct, processing_fee_cents_estimated: procFee };
  const ins = await sb("beat_sales", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: {
    producer_id: prod.id, beat_id: beat.id, title: beat.title, sale_type: saleType, stripe_session_id: session.id,
    payment_intent_id: pi, buyer_email: email, gross_cents: gross, fee_cents: procFee, net_cents: sp.eligible, split_pct: conflict ? 0 : sp.sellerPct, producer_cents: conflict ? 0 : producerCents, eligible_cents: sp.eligible, platform_fee_cents: conflict ? 0 : sp.platform, unallocated_cents: conflict ? 0 : sp.unallocated,
    tax_cents: tax, discount_cents: discount, status: conflict ? "refunded" : "complete", seller_type: beat.seller_type || "platform",
    agreement_version: md.agreement_version || null, agreement_accepted_at: md.agreed_at || null, allocation: alloc } });
  if (!ins.ok) return { error: "Could not record the sale" };
  let sale = Array.isArray(ins.data) && ins.data[0];
  if (!sale) { // retry of an already-recorded sale: make sure the wallet credit exists
    const ex = await sb("beat_sales?stripe_session_id=eq." + encodeURIComponent(session.id) + "&select=*");
    sale = ex.ok && Array.isArray(ex.data) && ex.data[0];
    if (!sale) return { error: "Sale lookup failed" };
  }
  if (conflict || sale.status === "refunded") return { ok: true, conflict: true };
  const availableAt = new Date(Date.now() + (Number(prod.hold_days) || 0) * 864e5).toISOString();
  const tx = await sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: {
    producer_id: prod.id, type: "sale", amount_cents: sale.producer_cents, ref: "sale:" + sale.id,
    note: beat.title + " (" + saleType + ")", available_at: availableAt } });
  if (!tx.ok) return { error: "Could not credit wallet" };
  await audit("system", "sale_recorded", beat.id, { sale: sale.id, type: saleType, gross: gross });
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
  await sb("beat_sales?id=eq." + sale.id, { method: "PATCH", prefer: "return=minimal", body: ratio >= 1 ? { status: "refunded", refunded_cents: Number(charge.amount_refunded) || 0 } : { refunded_cents: Number(charge.amount_refunded) || 0 } });
  // A fully refunded exclusive is NOT re-listed automatically: it becomes unavailable until an admin resolves it.
  if (ratio >= 1 && sale.sale_type === "exclusive" && sale.beat_id) await sb("beat_items?id=eq." + sale.beat_id, { method: "PATCH", prefer: "return=minimal", body: { status: "unavailable" } });
  await audit("system", "refund", sale.beat_id, { sale: sale.id, refunded: charge.amount_refunded });
  return { ok: true, reversed: delta > 0 ? delta : 0 };
}

module.exports = { PLATFORM_FEE_PCT, MIN_SELLER_PCT, MAX_SELLER_PCT, sellerPct, computeSplit, AGREEMENT_VERSION, rpc, audit, getSetting, setSetting, SB, SITE, J, sb, hashPw, checkPw, signProducer, verifyProducer, verifyOwner, bearer, balances, fulfillSession, handleRefund, estimateFee };
