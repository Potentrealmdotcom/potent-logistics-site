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

// Split an amount across items in proportion to their prices; the last item takes the rounding remainder.
function allocate(total, weights) {
  const sum = weights.reduce(function (x, y) { return x + y; }, 0) || 1; let left = total; const out = [];
  weights.forEach(function (w, i) { const v = i === weights.length - 1 ? left : Math.round(total * w / sum); out.push(v); left -= v; });
  return out;
}
function unsubKey() { return String(process.env.AUTH_SECRET || "") + "|unsub"; }
function signUnsub(id) { const body = b64u(JSON.stringify({ uid: id })); return body + "." + b64u(crypto.createHmac("sha256", unsubKey()).update(body).digest()); }
function verifyUnsub(t) {
  if (!process.env.AUTH_SECRET || !t || t.indexOf(".") < 0) return null; const p = t.split("."), e = b64u(crypto.createHmac("sha256", unsubKey()).update(p[0]).digest());
  const x = Buffer.from(p[1] || ""), y = Buffer.from(e); if (x.length !== y.length || !crypto.timingSafeEqual(x, y)) return null;
  try { return JSON.parse(Buffer.from(p[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")).uid || null; } catch (e2) { return null; }
}

// Product sale(s) in one checkout (a cart can hold several). Idempotent per Stripe session + product.
// Each item: POTENT keeps 1% of that item's eligible amount, the seller the rest. Limited drops are claimed atomically.
async function fulfillProduct(session) {
  const md = (session && session.metadata) || {};
  if (md.product !== "MUSIC") return { skipped: true };
  if (session.payment_status !== "paid") return { skipped: true, unpaid: true };
  const ids = String(md.item_ids || md.item_id || "").split(",").filter(function (x) { return /^[0-9a-f-]{36}$/i.test(x); });
  if (!ids.length) return { error: "No items" };
  const priceMap = {}; String(md.prices || "").split(",").forEach(function (kv) { const p = kv.split(":"); if (p.length === 2) priceMap[p[0]] = Number(p[1]) || 0; });
  const rows = [];
  for (const id of ids) { const pr = await B.sb("music_products?id=eq." + id + "&select=*"); const prod = pr.ok && Array.isArray(pr.data) && pr.data[0]; if (!prod) { console.error("MUSIC sale for unknown product", id, session.id); return { error: "Unknown product" }; } rows.push(prod); }
  const weights = rows.map(function (p) { return priceMap[p.id] || p.price_cents || 1; });
  const total = Number(session.amount_total) || 0, td = session.total_details || {};
  const grossA = allocate(total, weights), taxA = allocate(Number(td.amount_tax) || 0, weights), discA = allocate(Number(td.amount_discount) || 0, weights), feeA = allocate(B.estimateFee(total), weights);
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : null;
  const email = (session.customer_details && session.customer_details.email) || session.customer_email || null;
  const sellers = {}; let made = 0, dup = 0, soldOut = 0;
  for (let i = 0; i < rows.length; i++) {
    const prod = rows[i], key = session.id + "#" + prod.id;
    const done = await B.sb("music_sales?stripe_session_id=eq." + encodeURIComponent(key) + "&select=id");
    if (done.ok && Array.isArray(done.data) && done.data[0]) { dup++; continue; }
    if (!sellers[prod.producer_id]) { const sr = await B.sb("beat_producers?id=eq." + prod.producer_id + "&select=*"); sellers[prod.producer_id] = sr.ok && Array.isArray(sr.data) && sr.data[0]; }
    const seller = sellers[prod.producer_id]; if (!seller) return { error: "Unknown seller" };
    const sp = B.computeSplit(grossA[i], taxA[i], 99); // 1% POTENT, 99% seller, nothing unassigned
    const claim = prod.limited_qty == null ? true : ((await B.rpc("music_product_claim", { p_id: prod.id })).data === true);
    let status = "complete", sellerCents = sp.seller, plat = sp.platform;
    if (!claim) {
      status = "refunded"; sellerCents = 0; plat = 0; soldOut++;
      try { if (pi && process.env.STRIPE_SECRET_KEY && grossA[i] > 0) await require("stripe")(process.env.STRIPE_SECRET_KEY).refunds.create({ payment_intent: pi, amount: grossA[i], reason: "requested_by_customer" }, { idempotencyKey: "musicsoldout:" + key }); } catch (e) { console.error("auto-refund failed", key, e.message); }
      await B.audit("system", "limited_drop_sold_out", prod.id, { session: session.id });
    } else if (prod.limited_qty == null) {
      await B.sb("music_products?id=eq." + prod.id, { method: "PATCH", prefer: "return=minimal", body: { sold_count: (prod.sold_count || 0) + 1 } });
    }
    const ins = await B.sb("music_sales", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: {
      product_id: prod.id, producer_id: seller.id, buyer_user_id: /^[0-9a-f-]{36}$/i.test(md.user_id || "") ? md.user_id : null, buyer_email: email, stripe_session_id: key, payment_intent_id: pi,
      gross_cents: grossA[i], tax_cents: taxA[i], discount_cents: discA[i], fee_cents: feeA[i], eligible_cents: sp.eligible, platform_fee_cents: plat, seller_cents: sellerCents, status: status,
      agreement_version: md.agreement_version || null, agreement_accepted_at: md.agreed_at || null } });
    if (!ins.ok) return { error: "Could not record the sale" };
    const sale = Array.isArray(ins.data) && ins.data[0]; if (!sale) { dup++; continue; }
    if (status === "complete" && sellerCents > 0) {
      const availableAt = new Date(Date.now() + (Number(seller.hold_days) || 0) * 864e5).toISOString();
      const tx = await B.sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { producer_id: seller.id, type: "sale", amount_cents: sellerCents, ref: "msale:" + sale.id, note: prod.title + " (" + prod.kind + ")", available_at: availableAt } });
      if (!tx.ok) return { error: "Could not credit wallet" };
    }
    made++; await B.audit("system", "music_sale", prod.id, { sale: sale.id, gross: grossA[i] });
  }
  return { ok: true, made: made, duplicate: dup > 0 && made === 0, soldOut: soldOut };
}

// charge.refunded for product sales. A cart charge can hold several sales: refunds we issued ourselves for a sold-out item are
// attributed to that item, and only the rest is spread over the other items.
async function refundProduct(charge) {
  const pi = charge && charge.payment_intent;
  if (!pi) return { skipped: true };
  const s = await B.sb("music_sales?payment_intent_id=eq." + encodeURIComponent(pi) + "&select=*");
  const sales = s.ok && Array.isArray(s.data) ? s.data : [];
  if (!sales.length) return { skipped: true };
  const auto = sales.filter(function (x) { return x.status === "refunded" && x.seller_cents === 0 && x.platform_fee_cents === 0; });
  const autoGross = auto.reduce(function (a, x) { return a + x.gross_cents; }, 0);
  const remainingCharge = Math.max(0, (Number(charge.amount) || 0) - autoGross), refunded = Math.max(0, (Number(charge.amount_refunded) || 0) - autoGross);
  const ratio = remainingCharge > 0 ? Math.min(1, refunded / remainingCharge) : 0;
  let reversed = 0;
  for (const sale of sales) {
    if (auto.indexOf(sale) >= 0) continue;
    const target = Math.round(sale.seller_cents * ratio);
    const prev = await B.sb("beat_wallet_txns?ref=like." + encodeURIComponent("mrefund:" + sale.id + ":") + "*&select=amount_cents");
    const already = (Array.isArray(prev.data) ? prev.data : []).reduce(function (a, t) { return a + Math.abs(t.amount_cents); }, 0);
    const delta = target - already;
    if (delta > 0) {
      const tx = await B.sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { producer_id: sale.producer_id, type: "refund", amount_cents: -delta, ref: "mrefund:" + sale.id + ":" + charge.amount_refunded, note: "Refund: music sale" } });
      if (!tx.ok) return { error: "Could not record refund" };
      reversed += delta;
    }
    await B.sb("music_sales?id=eq." + sale.id, { method: "PATCH", prefer: "return=minimal", body: ratio >= 1 ? { status: "refunded", refunded_cents: sale.gross_cents } : { refunded_cents: Math.round(sale.gross_cents * ratio) } });
    await B.audit("system", "music_refund", sale.product_id, { sale: sale.id, refunded: charge.amount_refunded });
  }
  return { ok: true, reversed: reversed };
}

module.exports = { allocate, signUnsub, verifyUnsub, signUser, verifyUser, signedUrl, fulfillProduct, refundProduct };
