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
//  - An exclusive seller's configured share is splits.exclusive, server-clamped to 91-99%.
//  - MAKER ROYALTY (owner decision, Oct 24 2026): whoever MADE the beat earns a fixed 8% royalty
//    on every exclusive sale of it, paid into the maker's own wallet. This is the slice that used
//    to be parked as "unallocated" and paid to nobody. The revenue model is therefore:
//    seller 91% (default) / maker 8% / POTENT 1% — see beat_settings.revenue_model (confirmed:true).
//  - Card-processing fees are Stripe's and are recorded separately; they never change the platform fee or anyone's share.
//
// computeSplit(gross, tax, pct) with NO opts is the legacy split (no maker): seller + platform +
// unallocated, unchanged — the /music/ download store (99/1) still uses it that way.
// computeSplit(gross, tax, pct, { makerPct }) applies the maker royalty rule:
//  - platform (1%) and maker (makerPct%) are SENIOR fixed slices of the eligible amount;
//  - the seller is paid their configured pct of eligible, capped at what is left after platform +
//    maker, so seller + maker + platform never exceeds the eligible amount — any overflow comes
//    out of the seller's slice, never out of the royalty or the fee.
//  - At the default 91 that is exactly seller 91 / maker 8 / platform 1, unallocated 0.
//  - At 99 with a distinct maker the seller nets 91 (100 - 8 - 1): the royalty comes out of the
//    seller's slice. A configured pct above 91 only pays out in full when there is no distinct
//    maker being paid (makerPct 0, or the maker slice is 0 on a zero-value sale).
//  - When maker == seller both slices are credited to the same wallet (99% total at the default).
//  - "unallocated" survives only on the legacy path (no maker) or as a rounding remainder.
const PLATFORM_FEE_PCT = 1, MIN_SELLER_PCT = 91, MAX_SELLER_PCT = 99, MAKER_ROYALTY_PCT = 8;
function sellerPct(v) { const n = Number(v); return Math.min(MAX_SELLER_PCT, Math.max(MIN_SELLER_PCT, isFinite(n) ? n : MIN_SELLER_PCT)); }
function computeSplit(grossCents, taxCents, pct, opts) {
  const gross = Math.max(0, Math.round(Number(grossCents) || 0)), tax = Math.max(0, Math.round(Number(taxCents) || 0));
  const eligible = Math.max(0, gross - tax), sp = sellerPct(pct);
  const mp = opts && Number(opts.makerPct) > 0 ? Number(opts.makerPct) : 0;
  if (!mp) { // legacy split — no maker royalty (music downloads, old callers). Do not change the math.
    const seller = Math.min(eligible, Math.ceil(eligible * sp / 100));
    const platform = Math.min(Math.round(eligible * PLATFORM_FEE_PCT / 100), eligible - seller);
    return { eligible: eligible, seller: seller, platform: platform, maker: 0, makerPct: 0, unallocated: eligible - seller - platform, sellerPct: sp, platformPct: PLATFORM_FEE_PCT };
  }
  const platform = Math.min(Math.round(eligible * PLATFORM_FEE_PCT / 100), eligible);
  const maker = Math.min(Math.round(eligible * mp / 100), eligible - platform);
  const seller = Math.max(0, Math.min(Math.ceil(eligible * sp / 100), eligible - platform - maker));
  return { eligible: eligible, seller: seller, platform: platform, maker: maker, makerPct: mp, unallocated: eligible - seller - maker - platform, sellerPct: sp, platformPct: PLATFORM_FEE_PCT };
}
function estimateFee(gross) { return gross > 0 ? Math.round(gross * 0.029 + 30) : 0; }
// Split a cent total across n rows so the parts sum EXACTLY to the total (first rows absorb the odd cents).
function distribute(total, n) {
  const t = Math.max(0, Math.round(Number(total) || 0)); if (!(n > 0)) return [];
  const base = Math.floor(t / n), rem = t - base * n, out = [];
  for (let i = 0; i < n; i++) out.push(base + (i < rem ? 1 : 0));
  return out;
}

// ── mystery packs (owner decision, Oct 24 2026) ──
// Fixed pack products sold on /beats/ next to the catalog. A paid pack assigns that many AVAILABLE
// exclusive beats to the buyer at fulfillment (the ones held at checkout first, then a random fill
// from the same catalog), marks each one sold to that buyer, and delivers every file.
const PACKS = {
  pack3: { key: "pack3", size: 3, price_cents: 99900, name: "Mystery Pack — 3 Beats" },
  pack5: { key: "pack5", size: 5, price_cents: 149900, name: "Mystery Pack — 5 Beats" }
};
const UUID_RE = /^[0-9a-f-]{36}$/i;
// Same liveness rule the public catalog uses: published, or approved with its publish time reached.
function beatIsLive(b, now) {
  if (!b || b.active === false || b.exclusive_sold || !b.exclusive_cents) return false;
  if (b.status === "published") return true;
  if (b.status === "approved" && b.publish_at && new Date(b.publish_at).getTime() <= (now || Date.now())) return true;
  return false;
}
async function listAvailableBeats(limit) {
  const iso = new Date().toISOString();
  const r = await sb("beat_items?active=eq.true&exclusive_sold=eq.false&exclusive_cents=not.is.null&or=(status.eq.published,and(status.eq.approved,publish_at.lte." + iso + "))&select=*&order=created_at.desc&limit=" + Math.max(1, Math.min(500, limit || 200)));
  const rows = Array.isArray(r.data) ? r.data : [], now = Date.now();
  return rows.filter(function (b) { return beatIsLive(b, now); });
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

async function balances(producerId) {
  const r = await sb("beat_wallet_txns?producer_id=eq." + producerId + "&select=amount_cents,available_at&limit=5000");
  const rows = Array.isArray(r.data) ? r.data : [];
  const now = Date.now();
  let available = 0, pending = 0;
  rows.forEach(function (t) { if (new Date(t.available_at).getTime() <= now) available += t.amount_cents; else pending += t.amount_cents; });
  return { available: available, pending: pending, total: available + pending };
}

async function loadProducerRow(id) {
  const r = await sb("beat_producers?id=eq." + encodeURIComponent(id || "") + "&select=*");
  return r.ok && Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
}
// Who MADE this beat (the royalty recipient): the listing's maker credit, defaulting to the
// producer of record. If the credited maker account cannot be loaded, the royalty falls back to
// the producer of record rather than being lost.
async function resolveMaker(beat, prod) {
  const mid = UUID_RE.test(String(beat.maker_id || "")) ? beat.maker_id : null;
  if (!mid || mid === prod.id) return { makerId: prod.id, makerProd: prod };
  const mp = await loadProducerRow(mid);
  return mp ? { makerId: mp.id, makerProd: mp } : { makerId: prod.id, makerProd: prod };
}
// Credit a recorded sale's wallets: the seller's share (ref "sale:<id>") and, when the sale carries
// one, the maker's royalty (ref "maker:<id>"). Each credit lands after its own recipient's hold
// period. Refs are unique and inserts ignore duplicates, so retries never double-pay.
async function creditSaleWallets(sale, title) {
  const sellerProd = await loadProducerRow(sale.producer_id);
  const at = function (p) { return new Date(Date.now() + (Number(p && p.hold_days) || 0) * 864e5).toISOString(); };
  const tx = await sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: {
    producer_id: sale.producer_id, type: "sale", amount_cents: sale.producer_cents, ref: "sale:" + sale.id,
    note: (title || sale.title || "Beat") + " (" + (sale.sale_type || "exclusive") + ")", available_at: at(sellerProd) } });
  if (!tx.ok) return "Could not credit wallet";
  if (Number(sale.maker_cents) > 0 && sale.maker_id) {
    const makerProd = sale.maker_id === sale.producer_id ? sellerProd : await loadProducerRow(sale.maker_id);
    const mtx = await sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: {
      producer_id: sale.maker_id, type: "sale", amount_cents: sale.maker_cents, ref: "maker:" + sale.id,
      note: "Maker royalty: " + (title || sale.title || "Beat"), available_at: at(makerProd) } });
    if (!mtx.ok) return "Could not credit maker royalty";
  }
  return null;
}
async function notifySale(sale, prod, makerId, title) {
  await require("./notify")({ producer_id: prod.id, kind: "sale", title: "Beat sold: " + title, body: "You earned $" + (sale.producer_cents / 100).toFixed(2), link: "/beatman/" });
  if (makerId && makerId !== prod.id && Number(sale.maker_cents) > 0)
    await require("./notify")({ producer_id: makerId, kind: "sale", title: "Beat royalty: " + title, body: "You earned $" + (sale.maker_cents / 100).toFixed(2) + " as the maker of this beat", link: "/beatman/" });
}

// A paid Checkout Session for a beat -> record the sale and credit the producer's wallet. Idempotent per Stripe session.
async function fulfillSession(session) {
  const md = (session && session.metadata) || {};
  if (md.product !== "BEAT") return { skipped: true };
  if (session.payment_status !== "paid") return { skipped: true, unpaid: true };
  if (md.pack) return fulfillPackSession(session); // mystery pack: several beats, one session
  const beatR = await sb("beat_items?id=eq." + encodeURIComponent(md.beat_id || "") + "&select=*");
  const beat = beatR.ok && Array.isArray(beatR.data) && beatR.data[0];
  if (!beat) { console.error("BEAT sale for unknown beat", md.beat_id, session.id); return { error: "Unknown beat" }; }
  const prodR = await sb("beat_producers?id=eq." + beat.producer_id + "&select=*");
  const prod = prodR.ok && Array.isArray(prodR.data) && prodR.data[0];
  if (!prod) return { error: "Unknown producer" };
  const mk = await resolveMaker(beat, prod);

  const saleType = "exclusive"; // POTENT Beats sells exclusive masters only
  const gross = Number(session.amount_total) || 0;
  const td = session.total_details || {};
  const tax = Number(td.amount_tax) || 0, discount = Number(td.amount_discount) || 0;
  const procFee = estimateFee(gross); // Stripe's fee, recorded separately
  const sp = computeSplit(gross, tax, prod.splits && prod.splits.exclusive, { makerPct: MAKER_ROYALTY_PCT });
  let producerCents = sp.seller, makerCents = sp.maker;
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
      producerCents = 0; makerCents = 0;
      await audit("system", "exclusive_conflict", beat.id, { session: session.id, auto_refunded: refunded });
    }
  }
  const alloc = { seller_type: beat.seller_type || "platform", rule: "platform fee 1%; maker royalty 8% of eligible to the beat's maker; seller at configured % (91-99) capped so the slices sum to the eligible amount; remainder unallocated", seller_pct: sp.sellerPct, platform_pct: sp.platformPct, maker_pct: MAKER_ROYALTY_PCT, maker_id: mk.makerId, maker_cents: conflict ? 0 : makerCents, processing_fee_cents_estimated: procFee };
  const ins = await sb("beat_sales", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: {
    producer_id: prod.id, beat_id: beat.id, title: beat.title, sale_type: saleType, stripe_session_id: session.id,
    payment_intent_id: pi, buyer_email: email, gross_cents: gross, fee_cents: procFee, net_cents: sp.eligible, split_pct: conflict ? 0 : sp.sellerPct, producer_cents: conflict ? 0 : producerCents, eligible_cents: sp.eligible, platform_fee_cents: conflict ? 0 : sp.platform, unallocated_cents: conflict ? 0 : sp.unallocated,
    maker_id: mk.makerId, maker_cents: conflict ? 0 : makerCents,
    tax_cents: tax, discount_cents: discount, status: conflict ? "refunded" : "complete", seller_type: beat.seller_type || "platform",
    agreement_version: md.agreement_version || null, agreement_accepted_at: md.agreed_at || null, allocation: alloc, buyer_user_id: /^[0-9a-f-]{36}$/i.test(md.user_id || "") ? md.user_id : null } });
  if (!ins.ok) return { error: "Could not record the sale" };
  let sale = Array.isArray(ins.data) && ins.data[0];
  if (!sale) { // retry of an already-recorded sale: make sure the wallet credit exists
    const ex = await sb("beat_sales?stripe_session_id=eq." + encodeURIComponent(session.id) + "&select=*");
    sale = ex.ok && Array.isArray(ex.data) && ex.data[0];
    if (!sale) return { error: "Sale lookup failed" };
  }
  if (conflict || sale.status === "refunded") return { ok: true, conflict: true };
  const cerr = await creditSaleWallets(sale, beat.title);
  if (cerr) return { error: cerr };
  await audit("system", "sale_recorded", beat.id, { sale: sale.id, type: saleType, gross: gross });
  await notifySale(sale, prod, mk.makerId, beat.title);
  return { ok: true, saleId: sale.id, producerCents: sale.producer_cents, makerCents: sale.maker_cents || 0 };
}

// Refund a pack payment in full (the pack could not be filled). Mirrors the exclusive-conflict
// auto-refund: best-effort Stripe refund with an idempotency key, always audited.
async function refundPackPayment(session, reason) {
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : null;
  let refunded = false;
  try {
    if (pi && process.env.STRIPE_SECRET_KEY) { await require("stripe")(process.env.STRIPE_SECRET_KEY).refunds.create({ payment_intent: pi, reason: "requested_by_customer" }, { idempotencyKey: "packfail:" + session.id }); refunded = true; }
  } catch (e) { console.error("pack auto-refund failed", session.id, e.message); }
  await audit("system", "pack_refunded", session.id, { reason: reason, auto_refunded: refunded });
  return refunded;
}

// A paid mystery-pack session -> assign the pack's beats and record one sale per beat.
// The beats held for this buyer at checkout go first; the rest is a random fill from the live
// catalog. Every beat passes through beat_finalize, so a beat can never be sold twice; if a held
// beat was somehow claimed, a substitute is drawn. If the pack cannot be filled, the buyer is
// refunded in full and nothing is sold.
async function fulfillPackSession(session) {
  const md = (session && session.metadata) || {};
  const pack = PACKS[md.pack];
  if (!pack) return { error: "Unknown pack" };
  const sid = session.id;
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : null;
  const email = (session.customer_details && session.customer_details.email) || session.customer_email || null;

  // Retry of an already-fulfilled pack: re-run the (idempotent) wallet credits and finish.
  const ex = await sb("beat_sales?pack_session_id=eq." + encodeURIComponent(sid) + "&select=*");
  const existing = ex.ok && Array.isArray(ex.data) ? ex.data : [];
  if (existing.length) {
    if (existing.every(function (s) { return s.status === "refunded"; })) return { ok: true, pack: true, refunded: true, already: true };
    for (const s of existing) { const e = await creditSaleWallets(s, s.title); if (e) return { error: e }; }
    return { ok: true, pack: true, already: true, sales: existing.length };
  }

  // Choose the beats: held ones first (a beat this session already won counts as ours), then a
  // random fill of available beats that are not inside someone else's open checkout.
  const now = Date.now(), want = pack.size, chosen = [], seen = {};
  const take = function (b) { if (b && !seen[b.id] && chosen.length < want) { seen[b.id] = 1; chosen.push(b); } };
  const candIds = String(md.pack_beat_ids || "").split(",").filter(function (x) { return UUID_RE.test(x); });
  for (const id of candIds) {
    if (chosen.length >= want) break;
    const br = await sb("beat_items?id=eq." + encodeURIComponent(id) + "&select=*");
    const b = br.ok && Array.isArray(br.data) && br.data[0];
    if (b && (b.sold_session === sid || beatIsLive(b, now))) take(b);
  }
  if (chosen.length < want) {
    const pool = shuffle(await listAvailableBeats(300));
    for (const b of pool) {
      if (chosen.length >= want) break;
      if (b.reserved_until && new Date(b.reserved_until).getTime() > now && b.reserved_token !== md.pack_token) continue; // another buyer's checkout
      take(b);
    }
  }
  if (chosen.length < want) { await refundPackPayment(session, "not_enough_beats_available"); return { ok: true, pack: true, refunded: true, reason: "Not enough beats available to fill the pack" }; }

  // Claim each beat atomically. A conflict means someone else's paid session won it first: draw a
  // substitute from what is still available. If no substitute exists the whole pack is refunded and
  // any beat already claimed for this pack is parked as unavailable for the owner to resolve —
  // it is never quietly re-listed or delivered.
  const finalBeats = [];
  const used = {}; chosen.forEach(function (b) { used[b.id] = 1; });
  let spares = null;
  for (const b of chosen) {
    const fin = await rpc("beat_finalize", { p_beat: b.id, p_session: sid });
    if (!fin.ok) return { error: "Could not lock the pack beats" };
    if (fin.data !== "conflict") { finalBeats.push(b); continue; }
    if (!spares) { spares = shuffle((await listAvailableBeats(300)).filter(function (x) { return !used[x.id]; })); spares.forEach(function (x) { used[x.id] = 1; }); }
    let sub = null;
    while (spares.length && !sub) {
      const cand = spares.pop();
      if (cand.reserved_until && new Date(cand.reserved_until).getTime() > now && cand.reserved_token !== md.pack_token) continue;
      const f2 = await rpc("beat_finalize", { p_beat: cand.id, p_session: sid });
      if (!f2.ok) return { error: "Could not lock the pack beats" };
      if (f2.data !== "conflict") sub = cand;
    }
    if (sub) { finalBeats.push(sub); continue; }
    await refundPackPayment(session, "pack_beat_conflict");
    for (const fb of finalBeats) {
      await sb("beat_sales", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: {
        producer_id: fb.producer_id, beat_id: fb.id, title: fb.title, sale_type: "exclusive", stripe_session_id: sid + ":" + fb.id, pack_session_id: sid,
        payment_intent_id: pi, buyer_email: email, gross_cents: 0, fee_cents: 0, net_cents: 0, split_pct: 0, producer_cents: 0, eligible_cents: 0, platform_fee_cents: 0, unallocated_cents: 0,
        maker_id: null, maker_cents: 0, tax_cents: 0, discount_cents: 0, status: "refunded", seller_type: fb.seller_type || "platform",
        agreement_version: md.agreement_version || null, agreement_accepted_at: md.agreed_at || null, allocation: { pack: pack.key, refunded: "pack could not be filled" }, buyer_user_id: UUID_RE.test(md.user_id || "") ? md.user_id : null } });
      await sb("beat_items?id=eq." + fb.id, { method: "PATCH", prefer: "return=minimal", body: { status: "unavailable" } });
    }
    await audit("system", "pack_partial_conflict", sid, { beats: finalBeats.map(function (x) { return x.id; }) });
    return { ok: true, pack: true, refunded: true, reason: "A pack beat was claimed by another buyer" };
  }

  // Money per beat: the amount paid (and any tax) is spread across the pack's beats so the parts
  // sum exactly to the session totals; each beat then splits 91 / 8 / 1 by its own seller + maker.
  const gross = Number(session.amount_total) || 0, td = session.total_details || {};
  const tax = Number(td.amount_tax) || 0, discount = Number(td.amount_discount) || 0;
  const grossParts = distribute(gross, finalBeats.length), taxParts = distribute(tax, finalBeats.length), discParts = distribute(discount, finalBeats.length);
  const saleIds = [];
  for (let i = 0; i < finalBeats.length; i++) {
    const beat = finalBeats[i];
    const prod = await loadProducerRow(beat.producer_id);
    if (!prod) return { error: "Unknown producer" };
    const mk = await resolveMaker(beat, prod);
    const sp = computeSplit(grossParts[i], taxParts[i], prod.splits && prod.splits.exclusive, { makerPct: MAKER_ROYALTY_PCT });
    const procFee = estimateFee(grossParts[i]);
    const alloc = { pack: pack.key, pack_size: pack.size, pack_session_id: sid, seller_type: beat.seller_type || "platform", rule: "mystery pack: per-beat share of the pack price, split platform fee 1%; maker royalty 8% of eligible to the beat's maker; seller at configured % (91-99) capped so the slices sum to the eligible amount", seller_pct: sp.sellerPct, platform_pct: sp.platformPct, maker_pct: MAKER_ROYALTY_PCT, maker_id: mk.makerId, maker_cents: sp.maker, processing_fee_cents_estimated: procFee };
    const ins = await sb("beat_sales", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: {
      producer_id: prod.id, beat_id: beat.id, title: beat.title, sale_type: "exclusive", stripe_session_id: sid + ":" + beat.id, pack_session_id: sid,
      payment_intent_id: pi, buyer_email: email, gross_cents: grossParts[i], fee_cents: procFee, net_cents: sp.eligible, split_pct: sp.sellerPct, producer_cents: sp.seller, eligible_cents: sp.eligible, platform_fee_cents: sp.platform, unallocated_cents: sp.unallocated,
      maker_id: mk.makerId, maker_cents: sp.maker, tax_cents: taxParts[i], discount_cents: discParts[i], status: "complete", seller_type: beat.seller_type || "platform",
      agreement_version: md.agreement_version || null, agreement_accepted_at: md.agreed_at || null, allocation: alloc, buyer_user_id: UUID_RE.test(md.user_id || "") ? md.user_id : null } });
    if (!ins.ok) return { error: "Could not record the pack sale" };
    let sale = Array.isArray(ins.data) && ins.data[0];
    if (!sale) { const lk = await sb("beat_sales?stripe_session_id=eq." + encodeURIComponent(sid + ":" + beat.id) + "&select=*"); sale = lk.ok && Array.isArray(lk.data) && lk.data[0]; if (!sale) return { error: "Sale lookup failed" }; }
    const cerr = await creditSaleWallets(sale, beat.title);
    if (cerr) return { error: cerr };
    await notifySale(sale, prod, mk.makerId, beat.title);
    saleIds.push(sale.id);
  }
  await audit("system", "pack_sale_recorded", sid, { pack: pack.key, beats: finalBeats.map(function (x) { return x.id; }), gross: gross });
  return { ok: true, pack: true, sales: saleIds.length, saleIds: saleIds };
}

// charge.refunded -> take back the producer's share in proportion to what was refunded. Idempotent per refunded total.
// One payment can carry several beat sales (a mystery pack shares one payment intent): every row's
// seller share AND maker royalty is reversed by the same ratio. Single-beat payments have one row.
async function handleRefund(charge) {
  const pi = charge && charge.payment_intent;
  if (!pi) return { skipped: true };
  const s = await sb("beat_sales?payment_intent_id=eq." + encodeURIComponent(pi) + "&select=*");
  const sales = s.ok && Array.isArray(s.data) ? s.data : [];
  if (!sales.length) return { skipped: true };
  const ratio = charge.amount > 0 ? Math.min(1, (Number(charge.amount_refunded) || 0) / charge.amount) : 0;
  let reversed = 0;
  for (const sale of sales) {
    const target = Math.round(sale.producer_cents * ratio);
    const prev = await sb("beat_wallet_txns?ref=like." + encodeURIComponent("refund:" + sale.id + ":") + "*&select=amount_cents");
    const already = (Array.isArray(prev.data) ? prev.data : []).reduce(function (a, t) { return a + Math.abs(t.amount_cents); }, 0);
    const delta = target - already;
    if (delta > 0) {
      const tx = await sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: {
        producer_id: sale.producer_id, type: "refund", amount_cents: -delta, ref: "refund:" + sale.id + ":" + charge.amount_refunded,
        note: "Refund: " + (sale.title || "beat") } });
      if (!tx.ok) return { error: "Could not record refund" };
      reversed += delta;
    }
    if (Number(sale.maker_cents) > 0 && sale.maker_id) {
      const mTarget = Math.round(sale.maker_cents * ratio);
      const mPrev = await sb("beat_wallet_txns?ref=like." + encodeURIComponent("makerrefund:" + sale.id + ":") + "*&select=amount_cents");
      const mAlready = (Array.isArray(mPrev.data) ? mPrev.data : []).reduce(function (a, t) { return a + Math.abs(t.amount_cents); }, 0);
      const mDelta = mTarget - mAlready;
      if (mDelta > 0) {
        const mtx = await sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: {
          producer_id: sale.maker_id, type: "refund", amount_cents: -mDelta, ref: "makerrefund:" + sale.id + ":" + charge.amount_refunded,
          note: "Refund (maker royalty): " + (sale.title || "beat") } });
        if (!mtx.ok) return { error: "Could not record refund" };
        reversed += mDelta;
      }
    }
    await sb("beat_sales?id=eq." + sale.id, { method: "PATCH", prefer: "return=minimal", body: ratio >= 1 ? { status: "refunded", refunded_cents: Number(charge.amount_refunded) || 0 } : { refunded_cents: Number(charge.amount_refunded) || 0 } });
    // A fully refunded exclusive is NOT re-listed automatically: it becomes unavailable until an admin resolves it.
    if (ratio >= 1 && sale.sale_type === "exclusive" && sale.beat_id) await sb("beat_items?id=eq." + sale.beat_id, { method: "PATCH", prefer: "return=minimal", body: { status: "unavailable" } });
    await audit("system", "refund", sale.beat_id, { sale: sale.id, refunded: charge.amount_refunded });
  }
  return { ok: true, reversed: reversed };
}

// Chargebacks. created: take back the seller's whole remaining share and lock the item. closed+won: give it back. closed+lost: it stays reversed.
// Idempotent through unique wallet refs. Works for beat sales and music product sales.
async function handleDispute(dispute, phase) {
  const pi = dispute && (typeof dispute.payment_intent === "string" ? dispute.payment_intent : null);
  if (!pi) return { skipped: true };
  let kind = "beat", tbl = "beat_sales", col = "producer_cents", pref = "refund:";
  let r = await sb("beat_sales?payment_intent_id=eq." + encodeURIComponent(pi) + "&select=*");
  let sales = r.ok && Array.isArray(r.data) ? r.data : [];
  if (!sales.length) { r = await sb("music_sales?payment_intent_id=eq." + encodeURIComponent(pi) + "&select=*"); sales = r.ok && Array.isArray(r.data) ? r.data : []; kind = "music"; tbl = "music_sales"; col = "seller_cents"; pref = "mrefund:"; }
  if (!sales.length) return { skipped: true };
  let total = 0;
  for (const sale of sales) {
    if (sale.status === "refunded" && !sale[col]) continue; // already fully refunded / auto-refunded: nothing left to take back
    const ref = "dispute:" + dispute.id + ((kind === "music" || sale.pack_session_id) ? ":" + sale.id : "");
    const share = sale[col] || 0;
    if (phase === "created") {
      const prev = await sb("beat_wallet_txns?ref=like." + encodeURIComponent(pref + sale.id + ":") + "*&select=amount_cents");
      const already = (Array.isArray(prev.data) ? prev.data : []).reduce(function (a, t) { return a + Math.abs(t.amount_cents); }, 0);
      const take = Math.max(0, share - already);
      if (take > 0) {
        const tx = await sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { producer_id: sale.producer_id, type: "refund", amount_cents: -take, ref: ref, note: "Chargeback: " + (sale.title || "sale") } });
        if (!tx.ok) return { error: "Could not record chargeback" };
      }
      total += take;
      if (kind === "beat" && Number(sale.maker_cents) > 0 && sale.maker_id) { // the maker's royalty is clawed back with the seller's share
        const mPrev = await sb("beat_wallet_txns?ref=like." + encodeURIComponent("makerrefund:" + sale.id + ":") + "*&select=amount_cents");
        const mAlready = (Array.isArray(mPrev.data) ? mPrev.data : []).reduce(function (a, t) { return a + Math.abs(t.amount_cents); }, 0);
        const mTake = Math.max(0, sale.maker_cents - mAlready);
        if (mTake > 0) {
          const mtx = await sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { producer_id: sale.maker_id, type: "refund", amount_cents: -mTake, ref: ref + ":maker", note: "Chargeback (maker royalty): " + (sale.title || "sale") } });
          if (!mtx.ok) return { error: "Could not record chargeback" };
        }
      }
      await sb(tbl + "?id=eq." + sale.id, { method: "PATCH", prefer: "return=minimal", body: { status: "disputed" } });
      if (kind === "beat" && sale.beat_id) await sb("beat_items?id=eq." + sale.beat_id, { method: "PATCH", prefer: "return=minimal", body: { status: "unavailable" } });
      await audit("system", "chargeback_opened", sale.id, { dispute: dispute.id, reversed: take });
    } else if (phase === "closed") {
      if (dispute.status === "won") {
        const back = await sb("beat_wallet_txns?ref=eq." + encodeURIComponent(ref) + "&select=amount_cents");
        const took = back.ok && Array.isArray(back.data) && back.data[0] ? Math.abs(back.data[0].amount_cents) : 0;
        if (took > 0) {
          const tx = await sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { producer_id: sale.producer_id, type: "adjustment", amount_cents: took, ref: "disputewon:" + dispute.id + ((kind === "music" || sale.pack_session_id) ? ":" + sale.id : ""), note: "Chargeback won" } });
          if (!tx.ok) return { error: "Could not restore" };
        }
        if (kind === "beat" && sale.maker_id) { // give the maker royalty back too
          const mBack = await sb("beat_wallet_txns?ref=eq." + encodeURIComponent(ref + ":maker") + "&select=amount_cents");
          const mTook = mBack.ok && Array.isArray(mBack.data) && mBack.data[0] ? Math.abs(mBack.data[0].amount_cents) : 0;
          if (mTook > 0) {
            const mtx = await sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { producer_id: sale.maker_id, type: "adjustment", amount_cents: mTook, ref: "disputewon:" + dispute.id + (sale.pack_session_id ? ":" + sale.id : "") + ":maker", note: "Chargeback won (maker royalty)" } });
            if (!mtx.ok) return { error: "Could not restore" };
          }
        }
        total += took;
        await sb(tbl + "?id=eq." + sale.id, { method: "PATCH", prefer: "return=minimal", body: { status: "complete" } });
        if (kind === "beat" && sale.beat_id) await sb("beat_items?id=eq." + sale.beat_id, { method: "PATCH", prefer: "return=minimal", body: { status: "sold" } });
        await audit("system", "chargeback_won", sale.id, { dispute: dispute.id, restored: took });
      } else {
        await sb(tbl + "?id=eq." + sale.id, { method: "PATCH", prefer: "return=minimal", body: { status: "refunded" } });
        await audit("system", "chargeback_lost", sale.id, { dispute: dispute.id });
      }
    }
  }
  return phase === "created" ? { ok: true, reversed: total } : { ok: true, restored: total };
}

module.exports = { handleDispute, PLATFORM_FEE_PCT, MIN_SELLER_PCT, MAX_SELLER_PCT, MAKER_ROYALTY_PCT, PACKS, sellerPct, computeSplit, distribute, beatIsLive, listAvailableBeats, AGREEMENT_VERSION, rpc, audit, getSetting, setSetting, SB, SITE, J, sb, hashPw, checkPw, signProducer, verifyProducer, verifyOwner, bearer, balances, fulfillSession, fulfillPackSession, handleRefund, estimateFee };
