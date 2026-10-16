// Beat Man API: producer login + wallet, owner admin, public beat catalog, post-purchase delivery.
// POST JSON { action, ... }.  Producer calls send  Authorization: Bearer <producer token>.
// Owner calls send the normal POTENT owner staff token (from auth.js action "staff").
const B = require("./lib/beats");

const METHODS = ["paypal", "airtm", "zinli", "usdt", "binance", "westernunion", "wise", "zelle", "other"];
const UUID = /^[0-9a-f-]{36}$/i;
const clip = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n); };
const MIN_PAYOUT = Number(process.env.BEAT_MIN_PAYOUT_CENTS) || 2500;
const fails = {};
function tooMany(k) { const f = fails[k]; return !!(f && f.n >= 8 && Date.now() - f.t < 15 * 60 * 1000); }
function noteFail(k) { const f = fails[k]; if (!f || Date.now() - f.t > 15 * 60 * 1000) fails[k] = { n: 1, t: Date.now() }; else { f.n++; f.t = Date.now(); } }
function money(v) { const n = Math.round(Number(v)); return isFinite(n) ? n : NaN; }
function pubProducer(p) { return { id: p.id, name: p.name, email: p.email, country: p.country, payout_method: p.payout_method, payout_handle: p.payout_handle, splits: p.splits, hold_days: p.hold_days, deduct_fees: p.deduct_fees, active: p.active }; }
function pubBeat(b) { return { id: b.id, title: b.title, lease_cents: b.lease_cents, exclusive_cents: b.exclusive_cents, preview_url: b.preview_url, deliver_url: b.deliver_url, exclusive_sold: b.exclusive_sold, active: b.active }; }

async function loadProducer(id) {
  const r = await B.sb("beat_producers?id=eq." + id + "&select=*");
  return r.ok && Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
}
async function dash(p) {
  const [bal, txns, sales, pays, beats] = await Promise.all([
    B.balances(p.id),
    B.sb("beat_wallet_txns?producer_id=eq." + p.id + "&select=type,amount_cents,note,available_at,created_at&order=created_at.desc&limit=60"),
    B.sb("beat_sales?producer_id=eq." + p.id + "&select=title,sale_type,gross_cents,net_cents,split_pct,producer_cents,status,created_at&order=created_at.desc&limit=60"),
    B.sb("beat_payouts?producer_id=eq." + p.id + "&select=id,amount_cents,method,handle,status,reference,requested_at,paid_at&order=requested_at.desc&limit=40"),
    B.sb("beat_items?producer_id=eq." + p.id + "&select=*&order=created_at.desc&limit=200")
  ]);
  return { ok: true, producer: pubProducer(p), balance: bal, minPayoutCents: MIN_PAYOUT, methods: METHODS,
    txns: txns.data || [], sales: sales.data || [], payouts: pays.data || [], beats: (beats.data || []).map(pubBeat) };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.AUTH_SECRET) return B.J(500, { error: "Server not configured" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  const a = String(b.action || "");

  // ───────── public ─────────
  if (a === "catalog") {
    const r = await B.sb("beat_items?active=eq.true&select=id,title,lease_cents,exclusive_cents,preview_url,exclusive_sold,producer_id,beat_producers(name)&order=created_at.desc&limit=200");
    const rows = Array.isArray(r.data) ? r.data : [];
    return B.J(200, { ok: true, beats: rows.map(function (x) { return { id: x.id, title: x.title, producer: x.beat_producers && x.beat_producers.name, preview_url: x.preview_url,
      lease_cents: x.lease_cents, exclusive_cents: x.exclusive_sold ? null : x.exclusive_cents }; }) });
  }
  if (a === "delivery") { // after paying: show the buyer their download link (verified with Stripe)
    const sid = clip(b.session_id, 200);
    if (!/^cs_/.test(sid) || !process.env.STRIPE_SECRET_KEY) return B.J(400, { error: "Bad request" });
    try {
      const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
      const s = await stripe.checkout.sessions.retrieve(sid);
      if (!s || s.payment_status !== "paid" || !s.metadata || s.metadata.product !== "BEAT") return B.J(402, { error: "Payment not found" });
      const r = await B.sb("beat_items?id=eq." + encodeURIComponent(s.metadata.beat_id) + "&select=title,deliver_url");
      const it = r.ok && Array.isArray(r.data) && r.data[0];
      return B.J(200, { ok: true, title: it && it.title, url: it && it.deliver_url || null, license: s.metadata.sale_type });
    } catch (e) { return B.J(500, { error: "Could not verify payment" }); }
  }

  // ───────── producer login ─────────
  if (a === "login") {
    const email = clip(b.email, 200).toLowerCase();
    const lk = "beat:" + email;
    if (tooMany(lk)) return B.J(429, { error: "Too many attempts. Try again in 15 minutes." });
    const r = await B.sb("beat_producers?email=eq." + encodeURIComponent(email) + "&select=*");
    const p = r.ok && Array.isArray(r.data) && r.data[0];
    if (!p || !p.active || !B.checkPw(p.password_hash, b.password)) { noteFail(lk); return B.J(401, { error: "Wrong email or password" }); }
    return B.J(200, Object.assign(await dash(p), { token: B.signProducer(p.id) }));
  }

  // ───────── producer (signed in) ─────────
  const pt = B.verifyProducer(B.bearer(event));
  if (pt && !a.startsWith("o_")) {
    const p = await loadProducer(pt.pid);
    if (!p || !p.active) return B.J(401, { error: "Session ended" });

    if (a === "me") return B.J(200, await dash(p));

    if (a === "savepayout") {
      const method = clip(b.method, 20).toLowerCase();
      if (METHODS.indexOf(method) < 0) return B.J(400, { error: "Pick a payout method" });
      const handle = clip(b.handle, 120);
      if (!handle) return B.J(400, { error: "Enter your account name, email or wallet label" });
      if (/^\d[\d\s-]{11,}$/.test(handle)) return B.J(400, { error: "Do not enter a full card or bank number here." });
      await B.sb("beat_producers?id=eq." + p.id, { method: "PATCH", prefer: "return=minimal", body: { payout_method: method, payout_handle: handle } });
      return B.J(200, await dash(Object.assign({}, p, { payout_method: method, payout_handle: handle })));
    }

    if (a === "requestpayout") {
      if (!p.payout_method || !p.payout_handle) return B.J(400, { error: "Save your payout method first" });
      const bal = await B.balances(p.id);
      let amt = b.amount_cents === "all" || b.amount_cents == null ? bal.available : money(b.amount_cents);
      if (!(amt >= MIN_PAYOUT)) return B.J(400, { error: "Minimum payout is $" + (MIN_PAYOUT / 100).toFixed(2) });
      if (amt > bal.available) return B.J(400, { error: "That is more than your available balance" });
      const pend = await B.sb("beat_payouts?producer_id=eq." + p.id + "&status=eq.pending&select=id");
      if (Array.isArray(pend.data) && pend.data.length >= 3) return B.J(400, { error: "You already have payouts waiting" });
      const ins = await B.sb("beat_payouts", { method: "POST", prefer: "return=representation", body: { producer_id: p.id, amount_cents: amt, method: p.payout_method, handle: p.payout_handle } });
      const row = ins.ok && Array.isArray(ins.data) && ins.data[0];
      if (!row) return B.J(500, { error: "Could not request payout" });
      await B.sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { producer_id: p.id, type: "payout", amount_cents: -amt, ref: "payout:" + row.id, note: "Payout requested" } });
      return B.J(200, await dash(p));
    }

    if (a === "addbeat" || a === "setbeat") {
      const title = clip(b.title, 120);
      const lease = b.lease_cents === "" || b.lease_cents == null ? null : money(b.lease_cents);
      const excl = b.exclusive_cents === "" || b.exclusive_cents == null ? null : money(b.exclusive_cents);
      if (!title) return B.J(400, { error: "Enter a title" });
      [lease, excl].forEach(function (v) { if (v !== null && !(v >= 100 && v <= 5000000)) title && (b.__bad = true); });
      if (b.__bad || (lease === null && excl === null)) return B.J(400, { error: "Set at least one price ($1 or more)" });
      const url = function (v) { v = clip(v, 500); return /^https:\/\//i.test(v) ? v : null; };
      const row = { title: title, lease_cents: lease, exclusive_cents: excl, preview_url: url(b.preview_url), deliver_url: url(b.deliver_url), active: b.active !== false };
      if (a === "addbeat") { row.producer_id = p.id; const r = await B.sb("beat_items", { method: "POST", prefer: "return=minimal", body: row }); if (!r.ok) return B.J(500, { error: "Could not save" }); }
      else { if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" }); await B.sb("beat_items?id=eq." + b.id + "&producer_id=eq." + p.id, { method: "PATCH", prefer: "return=minimal", body: row }); }
      return B.J(200, await dash(p));
    }

    if (a === "changepw") {
      if (!B.checkPw(p.password_hash, b.oldPassword)) return B.J(401, { error: "Current password is wrong" });
      if (String(b.newPassword || "").length < 10) return B.J(400, { error: "New password must be at least 10 characters" });
      await B.sb("beat_producers?id=eq." + p.id, { method: "PATCH", prefer: "return=minimal", body: { password_hash: B.hashPw(b.newPassword) } });
      return B.J(200, { ok: true });
    }
    return B.J(400, { error: "Unknown action" });
  }

  // ───────── owner ─────────
  if (!a || a.indexOf("o_") !== 0) return B.J(401, { error: "Sign in first" });
  const owner = B.verifyOwner(B.bearer(event));
  if (!owner) return B.J(403, { error: "POTENT owner only" });

  if (a === "o_list") {
    const [prods, pays, sales] = await Promise.all([
      B.sb("beat_producers?select=*&order=created_at.asc&limit=200"),
      B.sb("beat_payouts?select=*,beat_producers(name,email)&order=requested_at.desc&limit=100"),
      B.sb("beat_sales?select=title,sale_type,gross_cents,producer_cents,status,created_at,beat_producers(name)&order=created_at.desc&limit=50")
    ]);
    const list = [];
    for (const p of (prods.data || [])) list.push(Object.assign(pubProducer(p), { balance: await B.balances(p.id) }));
    return B.J(200, { ok: true, producers: list, payouts: pays.data || [], sales: sales.data || [] });
  }
  if (a === "o_create") {
    const email = clip(b.email, 200).toLowerCase(), name = clip(b.name, 80);
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return B.J(400, { error: "Name and a valid email are required" });
    const temp = require("crypto").randomBytes(9).toString("base64").replace(/[^a-zA-Z0-9]/g, "x").slice(0, 12);
    const lease = Math.max(0, Math.min(100, Number(b.lease_pct == null ? 50 : b.lease_pct))), excl = Math.max(0, Math.min(100, Number(b.exclusive_pct == null ? 50 : b.exclusive_pct)));
    const r = await B.sb("beat_producers", { method: "POST", prefer: "return=representation", body: { name: name, email: email, password_hash: B.hashPw(temp), country: clip(b.country, 60) || null, splits: { lease: lease, exclusive: excl } } });
    if (!r.ok) return B.J(r.status === 409 ? 409 : 500, { error: r.status === 409 ? "That email already has an account" : "Could not create the account" });
    return B.J(200, { ok: true, producer: pubProducer(r.data[0]), tempPassword: temp });
  }
  if (a === "o_setproducer") {
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    const patch = {};
    if (b.lease_pct != null || b.exclusive_pct != null) { const p = await loadProducer(b.id); if (!p) return B.J(404, { error: "Not found" });
      patch.splits = { lease: b.lease_pct != null ? Math.max(0, Math.min(100, Number(b.lease_pct))) : p.splits.lease, exclusive: b.exclusive_pct != null ? Math.max(0, Math.min(100, Number(b.exclusive_pct))) : p.splits.exclusive }; }
    if (b.hold_days != null) patch.hold_days = Math.max(0, Math.min(60, Math.round(Number(b.hold_days))));
    if (b.deduct_fees != null) patch.deduct_fees = !!b.deduct_fees;
    if (b.active != null) patch.active = !!b.active;
    await B.sb("beat_producers?id=eq." + b.id, { method: "PATCH", prefer: "return=minimal", body: patch });
    return B.J(200, { ok: true });
  }
  if (a === "o_resetpw") {
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    const temp = require("crypto").randomBytes(9).toString("base64").replace(/[^a-zA-Z0-9]/g, "x").slice(0, 12);
    await B.sb("beat_producers?id=eq." + b.id, { method: "PATCH", prefer: "return=minimal", body: { password_hash: B.hashPw(temp) } });
    return B.J(200, { ok: true, tempPassword: temp });
  }
  if (a === "o_markpaid" || a === "o_cancelpayout") {
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    const g = await B.sb("beat_payouts?id=eq." + b.id + "&select=*");
    const po = g.ok && Array.isArray(g.data) && g.data[0];
    if (!po || po.status !== "pending") return B.J(400, { error: "That payout is not pending" });
    if (a === "o_markpaid") {
      const ref = clip(b.reference, 120);
      if (!ref) return B.J(400, { error: "Enter the confirmation / transaction number" });
      await B.sb("beat_payouts?id=eq." + po.id, { method: "PATCH", prefer: "return=minimal", body: { status: "paid", reference: ref, paid_at: new Date().toISOString() } });
    } else {
      await B.sb("beat_payouts?id=eq." + po.id, { method: "PATCH", prefer: "return=minimal", body: { status: "cancelled" } });
      await B.sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { producer_id: po.producer_id, type: "payout_cancel", amount_cents: po.amount_cents, ref: "payoutcancel:" + po.id, note: "Payout cancelled" } });
    }
    return B.J(200, { ok: true });
  }
  if (a === "o_adjust") {
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    const amt = money(b.amount_cents);
    if (!isFinite(amt) || amt === 0 || Math.abs(amt) > 5000000) return B.J(400, { error: "Enter an amount" });
    const type = b.kind === "bonus" ? "bonus" : "adjustment";
    await B.sb("beat_wallet_txns", { method: "POST", prefer: "return=minimal", body: { producer_id: b.id, type: type, amount_cents: amt, note: clip(b.note, 200) || type } });
    return B.J(200, { ok: true });
  }
  return B.J(400, { error: "Unknown action" });
};
