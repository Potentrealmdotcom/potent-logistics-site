// POTENT Music helpers: buyer account tokens, private-file links, product sales ledger, refunds.
// Fee rules (server-side): POTENT keeps 1% of the eligible amount (sale minus tax). The seller gets the rest.
// Stripe's processing fee is recorded separately. Royalty or artist agreements are never altered here.
const crypto = require("crypto");
const B = require("./beats");

function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function ukey() { return String(process.env.AUTH_SECRET || "") + "|music"; }
function signUser(id) {
  const body = b64u(JSON.stringify({ uid: id, exp: Date.now() + 30 * 24 * 3600 * 1000 }));
  return body + "." + b64u(crypto.createHmac("sha256", ukey()).update(body).digest());
}
function verifyUser(token) {
  if (!process.env.AUTH_SECRET || !token || typeof token !== "string" || token.indexOf(".") < 0) return null;
  const parts = token.split("."), expect = b64u(crypto.createHmac("sha256", ukey()).update(parts[0]).digest());
  const a = Buffer.from(parts[1] || ""), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const p = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); return p.exp && p.exp >= Date.now() && p.uid ? p : null; } catch (e) { return null; }
}

// "storage:bucket/path" -> short-lived signed download link. Anything else is returned as-is if https.
async function signedUrl(ref, seconds) {
  if (!ref) return null;
  if (/^https:\/\//i.test(ref)) return ref;
  if (ref.indexOf("storage:") !== 0) return null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(B.SB + "/storage/v1/object/sign/" + ref.slice(8), { method: "POST", headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: seconds || 300 }) });
  const j = await r.json().catch(function () { return {}; });
  return j.signedURL ? B.SB + "/storage/v1" + j.signedURL : null;
}

// Product sale. Idempotent per Stripe session. Limited drops are claimed atomically in the database.
async function fulfillProduct(session) {
  const md = (session && session.metadata) || {};
  if (md.product !== "MUSIC") return { skipped: true };
  if (session.payment_status !== "paid") return { skipped: true, unpaid: true };
  const done = await B.sb("music_sales?stripe_session_id=eq." + encodeURIComponent(session.id) + "&select=id,status");
  if (done.ok && Array.isArray(done.data) && done.data[0]) return { ok: true, duplicate: true };
  const pr = await B.sb("music_products?id=eq." + encodeURIComponent(md.item_id || "") + "&select=*");
  const prod = pr.ok && Array.isArray(pr.data) && pr.data[0];
  if (!prod) { console.error("MUSIC sale for unknown product", md.item_id, session.id); return { error: "Unknown product" }; }
  const sr = await B.sb("beat_producers?id=eq." + prod.producer_id + "&select=*");
  const seller = sr.ok && Array.isArray(sr.data) && sr.data[0];
  if (!seller) return { error: "Unknown seller" };

  const gross = Number(session.amount_total) || 0, td = session.total_details || {};
  const tax = Number(td.amount_tax) || 0, discount = Number(td.amount_discount) || 0;
  const sp = B.computeSplit(gross, tax, 99); // 1% POTENT, 99% seller, nothing unassigned
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : null;
  const email = (session.customer_details && session.customer_details.email) || session.customer_email || null;
  const claim = prod.limited_qty == null ? true : ((await B.rpc("music_product_claim", { p_id: prod.id })).data === true);
  let status = "complete", sellerCents = sp.seller, plat = sp.platform;
  if (!claim) {
    status = "refunded"; sellerCents = 0; plat = 0;
    try { if (pi && process.env.STRIPE_SECRET_KEY) await require("stripe")(process.env.STRIPE_SECRET_KEY).refunds.create({ payment_intent: pi, reason: "duplicate" }, { idempotencyKey: "musicsoldout:" + session.id }); } catch (e) { console.error("auto-refund failed", session.id, e.message); }
    await B.audit("system", "limited_drop_sold_out", prod.id, { session: session.id });
  } else if (prod.limited_qty == null) {
    await B.sb("music_products?id=eq." + prod.id, { method: "PATCH", prefer: "return=minimal", body: { sold_count: (prod.sold_count || 0) + 1 } });
  }
  const ins = await B.sb("music_sales", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: {
    product_id: prod.id, producer_id: seller.id, buyer_user_id: /^[0-9a-f-]{36}$/i.test(md.user_id || "") ? md.user_id : null, buyer_email: email, stripe_session_id: session.id, payment_intent_id: pi,
    gross_cents: gross, tax_cents: tax, discount_cents: discount, fee_cents: B.estimateFee(gross), eligible_cents: sp.eligible, platform_fee_cents: plat, seller_cents: sellerCents, status: status,
    agreement_version: md.agreement_version || null, agreement_accepted_at: md.agreed_at || null } });
  if (!ins.ok) return { error: "Could not record the sale" };
  const sale = Array.isArray(ins.data) && ins.data[0];
  if (!sale) return { ok: true, duplicate: true };
  if (status === "complete" && sellerCents > 0) {
    const availableAt = new Date(Date.now() + (Number(seller.hold_days) || 0) * 864e5).toISOString();
    const tx = await B.sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { producer_id: seller.id, type: "sale", amount_cents: sellerCents, ref: "msale:" + sale.id, note: prod.title + " (" + prod.kind + ")", available_at: availableAt } });
    if (!tx.ok) return { error: "Could not credit wallet" };
  }
  await B.audit("system", "music_sale", prod.id, { sale: sale.id, gross: gross });
  return { ok: true, saleId: sale.id, sellerCents: sellerCents, platformCents: plat };
}

async function refundProduct(charge) {
  const pi = charge && charge.payment_intent;
  if (!pi) return { skipped: true };
  const s = await B.sb("music_sales?payment_intent_id=eq." + encodeURIComponent(pi) + "&select=*");
  const sale = s.ok && Array.isArray(s.data) && s.data[0];
  if (!sale) return { skipped: true };
  const ratio = charge.amount > 0 ? Math.min(1, (Number(charge.amount_refunded) || 0) / charge.amount) : 0;
  const target = Math.round(sale.seller_cents * ratio);
  const prev = await B.sb("beat_wallet_txns?ref=like." + encodeURIComponent("mrefund:" + sale.id + ":") + "*&select=amount_cents");
  const already = (Array.isArray(prev.data) ? prev.data : []).reduce(function (a, t) { return a + Math.abs(t.amount_cents); }, 0);
  const delta = target - already;
  if (delta > 0) {
    const tx = await B.sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { producer_id: sale.producer_id, type: "refund", amount_cents: -delta, ref: "mrefund:" + sale.id + ":" + charge.amount_refunded, note: "Refund: music sale" } });
    if (!tx.ok) return { error: "Could not record refund" };
  }
  await B.sb("music_sales?id=eq." + sale.id, { method: "PATCH", prefer: "return=minimal", body: ratio >= 1 ? { status: "refunded", refunded_cents: Number(charge.amount_refunded) || 0 } : { refunded_cents: Number(charge.amount_refunded) || 0 } });
  await B.audit("system", "music_refund", sale.product_id, { sale: sale.id, refunded: charge.amount_refunded });
  return { ok: true, reversed: delta > 0 ? delta : 0 };
}

module.exports = { signUser, verifyUser, signedUrl, fulfillProduct, refundProduct };
