// POTENT Music: POTENT Coin wallet (closed-loop, ledger only) and contract e-signature records.
// Coins: a collectible/internal credit. No transfers between users, no cash-out. Balances change only through the atomic
// database function music_coin_apply (idempotent per ref). Coin payments are ON unless the owner switches them off. Card top-ups and rewards live in lib/coinbuy.js.
// Contracts: the text is the user's own; this stores exactly what each person saw and assented to, with a hash of the text.
const crypto = require("crypto");
const B = require("./lib/beats");
const M = require("./lib/music");
const CB = require("./lib/coinbuy");
const UUID = /^[0-9a-f-]{36}$/i;
const clip = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n); };
const rows = function (r) { return r.ok && Array.isArray(r.data) ? r.data : []; };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const sha = function (t) { return crypto.createHash("sha256").update(String(t)).digest("hex"); };
const fails = {};
function tooMany(k, max) { const f = fails[k]; return !!(f && f.n >= max && Date.now() - f.t < 36e5); }
function note(k) { const f = fails[k]; if (!f || Date.now() - f.t > 36e5) fails[k] = { n: 1, t: Date.now() }; else { f.n++; f.t = Date.now(); } }
const ip = function (e) { return String((e.headers || {})["x-nf-client-connection-ip"] || "x"); };

const b64u = function (buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const skey = function () { return String(process.env.AUTH_SECRET || "") + "|sign"; };
function signParty(pid) { const body = b64u(JSON.stringify({ pid: pid })); return body + "." + b64u(crypto.createHmac("sha256", skey()).update(body).digest()); }
function verifyParty(t) {
  if (!process.env.AUTH_SECRET || typeof t !== "string" || t.indexOf(".") < 0) return null;
  const p = t.split("."), want = b64u(crypto.createHmac("sha256", skey()).update(p[0]).digest());
  const x = Buffer.from(p[1] || ""), y = Buffer.from(want);
  if (x.length !== y.length || !crypto.timingSafeEqual(x, y)) return null;
  try { return JSON.parse(Buffer.from(p[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")).pid || null; } catch (e) { return null; }
}

// On by default; the owner can switch it off (setting music_coin_pay = "0").
async function coinOn() { return (await B.getSetting("music_coin_pay")) !== "0"; }
const apply = function (uid, delta, type, ref, noteText, actor) { return B.rpc("music_coin_apply", { p_user: uid, p_delta: delta, p_type: type, p_ref: ref, p_note: noteText, p_actor: actor }); };

async function walletOf(uid) { const w = rows(await B.sb("music_coin_wallets?user_id=eq." + uid + "&select=balance_cents"))[0]; return w ? Number(w.balance_cents) : 0; }

// Pay for a beat with coins. Order: hold the beat, take coins, record the sale; any failure puts everything back.
async function payBeat(u, b) {
  if (!UUID.test(String(b.beat_id || ""))) return B.J(400, { error: "Bad request" });
  if (b.agree !== true) return B.J(400, { error: "Please accept the purchase agreement first" });
  const r = await B.sb("beat_items?id=eq." + b.beat_id + "&active=eq.true&select=*,beat_producers(active)");
  const beat = rows(r)[0];
  if (!beat || !beat.beat_producers || !beat.beat_producers.active) return B.J(404, { error: "That beat is not available" });
  const live = beat.status === "published" || (beat.status === "approved" && beat.publish_at && new Date(beat.publish_at).getTime() <= Date.now());
  if (beat.exclusive_sold || beat.status === "sold") return B.J(409, { error: "This beat has already been sold exclusively" });
  if (!live || !beat.exclusive_cents) return B.J(404, { error: "That beat is not available" });
  const token = crypto.randomBytes(12).toString("hex");
  const hold = await B.rpc("beat_reserve", { p_beat: beat.id, p_token: token, p_minutes: 5 });
  if (!hold.ok) return B.J(500, { error: "Could not start checkout" });
  if (hold.data !== true) return B.J(409, { error: "Someone else is checking out with this beat right now. Try again in a few minutes." });
  const sid = "coin_" + crypto.randomUUID();
  const pay = await apply(u.id, -beat.exclusive_cents, "purchase", "pay:" + sid, "Beat: " + beat.title, "user");
  if (!pay.ok || !pay.data || pay.data.ok !== true) { await B.rpc("beat_release", { p_beat: beat.id, p_token: token }); return B.J(pay.data && pay.data.error === "insufficient" ? 402 : 500, { error: pay.data && pay.data.error === "insufficient" ? "Not enough coins" : "Could not take payment" }); }
  const out = await B.fulfillSession({ id: sid, payment_status: "paid", amount_total: beat.exclusive_cents, total_details: {}, payment_intent: null, customer_details: { email: u.email },
    metadata: { product: "BEAT", beat_id: beat.id, sale_type: "exclusive", user_id: u.id, agreement_version: B.AGREEMENT_VERSION, agreed_at: new Date().toISOString(), paid_with: "coins" } });
  if (!out || !out.ok || out.conflict) {
    await apply(u.id, beat.exclusive_cents, "refund", "payrev:" + sid, "Not completed: " + beat.title, "system");
    await B.rpc("beat_release", { p_beat: beat.id, p_token: token });
    return B.J(409, { error: "That purchase did not complete. Your coins were returned." });
  }
  await B.audit("user:" + u.id, "coin_beat_sale", beat.id, { sale: out.saleId });
  return B.J(200, { ok: true, kind: "beat", sale_id: out.saleId, balance: pay.data.balance });
}

async function payCart(u, b) {
  const raw = Array.isArray(b.product_ids) ? b.product_ids : [b.product_id];
  const ids = Array.from(new Set(raw.map(String))).filter(function (x) { return UUID.test(x); });
  if (!ids.length || ids.length !== new Set(raw.map(String)).size || ids.length > 10) return B.J(400, { error: "Bad request" });
  if (b.agree !== true) return B.J(400, { error: "Please accept the purchase terms first" });
  const items = [];
  for (const id of ids) {
    const p = rows(await B.sb("music_products?id=eq." + id + "&select=*,beat_producers(active)"))[0];
    const liveP = p && p.status === "published" && (!p.publish_at || new Date(p.publish_at).getTime() <= Date.now() || p.preorder === true);
    if (!p || !liveP || !p.beat_producers || !p.beat_producers.active) return B.J(404, { error: "An item in your cart is not available" });
    if (p.limited_qty != null && (p.sold_count || 0) >= p.limited_qty) return B.J(409, { error: p.title + " is sold out" });
    if (!p.file_ref || !(p.price_cents >= 100)) return B.J(409, { error: p.title + " is not ready" });
    items.push(p);
  }
  const total = items.reduce(function (a, p) { return a + p.price_cents; }, 0);
  const sid = "coin_" + crypto.randomUUID();
  const pay = await apply(u.id, -total, "purchase", "pay:" + sid, "Music: " + items.map(function (p) { return p.title; }).join(", ").slice(0, 160), "user");
  if (!pay.ok || !pay.data || pay.data.ok !== true) return B.J(pay.data && pay.data.error === "insufficient" ? 402 : 500, { error: pay.data && pay.data.error === "insufficient" ? "Not enough coins" : "Could not take payment" });
  const out = await M.fulfillProduct({ id: sid, payment_status: "paid", amount_total: total, total_details: {}, payment_intent: null, customer_details: { email: u.email },
    metadata: { product: "MUSIC", item_ids: items.map(function (p) { return p.id; }).join(","), prices: items.map(function (p) { return p.id + ":" + p.price_cents; }).join(","), user_id: u.id, agreement_version: B.AGREEMENT_VERSION, agreed_at: new Date().toISOString(), paid_with: "coins" } });
  if (!out || !out.ok) { await apply(u.id, total, "refund", "payrev:" + sid, "Not completed", "system"); return B.J(500, { error: "That purchase did not complete. Your coins were returned." }); }
  // sold-out limited items inside the cart are returned to the wallet, never kept
  if (out.soldOut) {
    const sales = rows(await B.sb("music_sales?stripe_session_id=like." + encodeURIComponent(sid + "#") + "*&status=eq.refunded&select=id,gross_cents"));
    for (const s of sales) await apply(u.id, s.gross_cents, "refund", "soldout:" + s.id, "Sold out: returned", "system");
  }
  return B.J(200, { ok: true, kind: "cart", balance: await walletOf(u.id), sold_out: out.soldOut || 0 });
}

// Owner coin refund for a coin-paid sale: puts coins back, takes the seller's share back, marks the sale refunded.
async function refundSale(b, actor) {
  const kind = b.kind === "beat" ? "beat" : "product";
  if (!UUID.test(String(b.sale_id || ""))) return B.J(400, { error: "Bad id" });
  const tbl = kind === "beat" ? "beat_sales" : "music_sales";
  const s = rows(await B.sb(tbl + "?id=eq." + b.sale_id + "&select=*"))[0];
  if (!s) return B.J(404, { error: "Sale not found" });
  if (String(s.stripe_session_id || "").indexOf("coin_") !== 0) return B.J(400, { error: "This sale was paid by card. Refund it in Stripe." });
  if (s.status === "refunded") return B.J(409, { error: "Already refunded" });
  if (!s.buyer_user_id) return B.J(400, { error: "No buyer account on this sale" });
  const sellerCents = kind === "beat" ? s.producer_cents : s.seller_cents;
  const flip = await B.sb(tbl + "?id=eq." + s.id + "&status=eq.complete", { method: "PATCH", prefer: "return=representation", body: { status: "refunded", refunded_cents: s.gross_cents } });
  if (!rows(flip).length) return B.J(409, { error: "Already refunded" });
  if (sellerCents > 0) await B.sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { producer_id: s.producer_id, type: "refund", amount_cents: -sellerCents, ref: "coinrefund:" + s.id, note: "Refund: coin sale" } });
  const back = await apply(s.buyer_user_id, s.gross_cents, "refund", "coinrefund:" + s.id, "Refund: " + (s.title || "purchase"), actor);
  await B.audit(actor, "coin_refund", s.id, { kind: kind, gross: s.gross_cents });
  return B.J(200, { ok: true, balance: back.data && back.data.balance });
}

// ───── contracts ─────
function partyPublic(p) { return { name: p.name, role: p.role, signed: !!p.signed_at, signed_at: p.signed_at }; }
async function contractFull(id) {
  const c = rows(await B.sb("music_contracts?id=eq." + id + "&select=*,music_contract_parties(id,name,email,role,signed_at,typed_name,signature_hash)"))[0]; return c || null;
}
async function maybeExecute(c) {
  const parties = rows(await B.sb("music_contract_parties?contract_id=eq." + c.id + "&select=*&order=name.asc"));
  if (!parties.length || !parties.every(function (p) { return p.signed_at; })) return false;
  const finalHash = sha(c.body_hash + "|" + parties.map(function (p) { return p.email + ":" + p.signature_hash; }).join("|"));
  await B.sb("music_contracts?id=eq." + c.id + "&status=eq.pending", { method: "PATCH", prefer: "return=minimal", body: { status: "executed", executed_at: new Date().toISOString(), final_hash: finalHash } });
  return true;
}
function finalDoc(c, parties) {
  const e = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (x) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[x]; }); };
  return "<!doctype html><meta charset=utf-8><title>" + e(c.title) + "</title><body style='font:15px/1.5 system-ui;max-width:720px;margin:24px auto;padding:0 16px'><h1>" + e(c.title) + "</h1><pre style='white-space:pre-wrap;font:inherit'>" + e(c.body) + "</pre><h2>Signatures</h2>" +
    parties.map(function (p) { return "<p><b>" + e(p.typed_name || p.name) + "</b> (" + e(p.email) + (p.role ? ", " + e(p.role) : "") + ")<br>Signed " + e(p.signed_at) + "<br><small>Signature record: " + e(p.signature_hash) + "</small></p>"; }).join("") +
    "<hr><small>Status: " + e(c.status) + ". Document hash (SHA-256): " + e(c.body_hash) + (c.final_hash ? ". Final record hash: " + e(c.final_hash) : "") + ".</small></body>";
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.AUTH_SECRET) return B.J(500, { error: "Server not configured" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  const a = String(b.action || "");

  // ── signer side: the signed link in the email is the credential ──
  if (a === "s_view" || a === "s_sign") {
    if (tooMany("s:" + ip(event), 60)) return B.J(429, { error: "Too many requests" }); note("s:" + ip(event));
    const pid = verifyParty(clip(b.t, 500)); if (!pid) return B.J(403, { error: "This link is not valid" });
    const p = rows(await B.sb("music_contract_parties?id=eq." + pid + "&select=*"))[0]; if (!p) return B.J(404, { error: "Not found" });
    let c = await contractFull(p.contract_id); if (!c) return B.J(404, { error: "Not found" });
    if (a === "s_sign") {
      if (c.status !== "pending") return B.J(409, { error: c.status === "void" ? "This contract was cancelled" : "This contract is already complete" });
      if (p.signed_at) return B.J(409, { error: "You already signed" });
      const typed = clip(b.typed_name, 120);
      if (typed.length < 2 || b.assent !== true) return B.J(400, { error: "Type your full name and tick the box to sign" });
      if (clip(b.body_hash, 80) !== c.body_hash) return B.J(409, { error: "The document changed. Reload and review it again." });
      const when = new Date().toISOString();
      const sigHash = sha(c.body_hash + "|" + p.email + "|" + typed + "|" + when);
      const up = await B.sb("music_contract_parties?id=eq." + p.id + "&signed_at=is.null", { method: "PATCH", prefer: "return=representation", body: { signed_at: when, typed_name: typed, signer_ip: ip(event), signer_ua: clip((event.headers || {})["user-agent"], 300), signature_hash: sigHash } });
      if (!rows(up).length) return B.J(409, { error: "You already signed" });
      await maybeExecute(c); c = await contractFull(p.contract_id);
      await B.audit("signer:" + p.email, "contract_signed", c.id, { hash: sigHash });
    }
    return B.J(200, { ok: true, contract: { id: c.id, title: c.title, body: c.body, body_hash: c.body_hash, status: c.status, final_hash: c.final_hash, parties: c.music_contract_parties.map(partyPublic) }, you: { name: p.name, email: p.email, role: p.role, signed: !!p.signed_at }, final_html: c.status === "executed" ? finalDoc(c, c.music_contract_parties) : null });
  }

  // ── owner (staff) side ──
  if (a.indexOf("o_") === 0) {
    const owner = B.verifyOwner(B.bearer(event)); if (!owner) return B.J(403, { error: "POTENT owner only" });
    const who = "owner";
    if (a === "o_coin_get") return B.J(200, { ok: true, enabled: await coinOn() });
    if (a === "o_coin_set") { await B.setSetting("music_coin_pay", b.enabled === true ? "1" : "0"); await B.audit(who, "coin_pay_" + (b.enabled === true ? "on" : "off"), null, null); return B.J(200, { ok: true, enabled: b.enabled === true }); }
    if (a === "o_coin_adjust") { // credit or debit with a required reason; never below zero
      const email = clip(b.email, 200).toLowerCase(), cents = Math.round(Number(b.delta_cents));
      if (!EMAIL.test(email) || !isFinite(cents) || cents === 0 || Math.abs(cents) > 100000000 || clip(b.note, 200).length < 3) return B.J(400, { error: "Email, a non-zero amount and a reason are required" });
      const u = rows(await B.sb("music_users?email=eq." + encodeURIComponent(email) + "&select=id"))[0]; if (!u) return B.J(404, { error: "No account with that email" });
      const r = await apply(u.id, cents, cents > 0 ? "admin_credit" : "admin_debit", "adm:" + crypto.randomUUID(), clip(b.note, 200), who);
      if (!r.ok || !r.data || r.data.ok !== true) return B.J(409, { error: r.data && r.data.error === "insufficient" ? "That would take the balance below zero" : "Could not adjust" });
      await B.audit(who, "coin_adjust", u.id, { delta: cents, note: clip(b.note, 200) });
      return B.J(200, { ok: true, balance: r.data.balance });
    }
    if (a === "o_coin_ledger") {
      const email = clip(b.email, 200).toLowerCase(); let q = "music_coin_ledger?select=*,music_users(email)&order=created_at.desc&limit=200";
      if (email) { const u = rows(await B.sb("music_users?email=eq." + encodeURIComponent(email) + "&select=id"))[0]; if (!u) return B.J(404, { error: "No account with that email" }); q += "&user_id=eq." + u.id; }
      const [l, t] = await Promise.all([B.sb(q), B.sb("music_coin_wallets?select=balance_cents&limit=100000")]);
      return B.J(200, { ok: true, rows: rows(l), outstanding_cents: rows(t).reduce(function (x, w) { return x + Number(w.balance_cents); }, 0) });
    }
    if (a === "o_coin_refund") return refundSale(b, who);
    if (a === "o_tpl_list") return B.J(200, { ok: true, templates: rows(await B.sb("music_contract_templates?select=*&order=title.asc")) });
    if (a === "o_tpl_save") {
      const key = clip(b.key, 60).toLowerCase().replace(/[^a-z0-9_-]/g, ""), title = clip(b.title, 140), body = clip(b.body, 40000);
      if (!key || !title || body.length < 20) return B.J(400, { error: "Key, title and the full text are required" });
      const ex = rows(await B.sb("music_contract_templates?key=eq." + key + "&select=version"))[0];
      await B.sb("music_contract_templates", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { key: key, title: title, body: body, version: ex ? ex.version + 1 : 1, active: b.active !== false } });
      return B.J(200, { ok: true });
    }
    if (a === "o_contracts") return B.J(200, { ok: true, contracts: rows(await B.sb("music_contracts?select=id,title,status,created_at,executed_at,final_hash,music_contract_parties(name,email,signed_at)&order=created_at.desc&limit=200")) });
    if (a === "o_contract_void") { if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" }); await B.sb("music_contracts?id=eq." + b.id + "&status=eq.pending", { method: "PATCH", prefer: "return=minimal", body: { status: "void" } }); await B.audit(who, "contract_void", b.id, null); return B.J(200, { ok: true }); }
    return B.J(400, { error: "Unknown action" });
  }

  // ── buyer side ──
  const tu = M.verifyUser(B.bearer(event)); if (!tu) return B.J(401, { error: "Please sign in" });
  const u = rows(await B.sb("music_users?id=eq." + tu.uid + "&select=id,email,name,active"))[0];
  if (!u || u.active === false) return B.J(401, { error: "Please sign in" });
  if (tooMany("u:" + u.id, 120)) return B.J(429, { error: "Too many requests" }); note("u:" + u.id);

  if (a === "topup") {
    if (!(await coinOn())) return B.J(403, { error: "Coins are switched off right now" });
    const cents = Math.round(Number(b.cents));
    if (!(cents >= CB.MIN && cents <= CB.MAX) || cents % 100 !== 0) return B.J(400, { error: "Choose between $" + CB.MIN / 100 + " and $" + CB.MAX / 100 + " in whole dollars" });
    if (!process.env.STRIPE_SECRET_KEY) return B.J(500, { error: "Payments are not set up" });
    if (tooMany("top:" + u.id, 15)) return B.J(429, { error: "Too many attempts. Try again later." }); note("top:" + u.id);
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY), h = event.headers || {};
    const origin = /^https:\/\/([a-z0-9-]+\.)*netlify\.app$/.test(String(h.origin || "")) || String(h.origin || "") === B.SITE ? String(h.origin) : B.SITE;
    try {
      const s = await stripe.checkout.sessions.create({ mode: "payment", customer_email: u.email, expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
        line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: cents, product_data: { name: (cents / 100) + " POTENT Coins", description: "Closed-loop credit for POTENT purchases. Not cash, cannot be transferred or cashed out. Every $1,000 you buy earns a $100 coin reward." } } }],
        metadata: { product: "MUSICCOIN", user_id: u.id }, success_url: origin + "/music/coins.html?topup=1", cancel_url: origin + "/music/coins.html?canceled=1" });
      return B.J(200, { ok: true, url: s.url });
    } catch (e) { console.error("coin checkout failed:", e.message); return B.J(500, { error: "Could not start checkout" }); }
  }
  if (a === "wallet") {
    const [bal, led] = await Promise.all([walletOf(u.id), B.sb("music_coin_ledger?user_id=eq." + u.id + "&select=id,delta_cents,balance_after,type,note,created_at&order=created_at.desc&limit=50")]);
    return B.J(200, { ok: true, balance_cents: bal, ledger: rows(led), pay_enabled: await coinOn(), packs: CB.PACKS, min_cents: CB.MIN, max_cents: CB.MAX, rewards: await CB.progress(u.id), rules: "POTENT Coins are a closed-loop credit inside POTENT Music. They cannot be sent to other people or cashed out." });
  }
  if (a === "pay_beat" || a === "pay_cart") {
    if (!(await coinOn())) return B.J(403, { error: "Paying with coins is not turned on yet" });
    if (tooMany("pay:" + u.id, 20)) return B.J(429, { error: "Too many attempts. Try again later." }); note("pay:" + u.id);
    return a === "pay_beat" ? payBeat(u, b) : payCart(u, b);
  }

  if (a === "c_templates") return B.J(200, { ok: true, templates: rows(await B.sb("music_contract_templates?active=eq.true&select=key,title,body,version&order=title.asc")) });
  if (a === "c_list") {
    const mine = rows(await B.sb("music_contracts?created_by_user=eq." + u.id + "&select=id,title,status,created_at,executed_at,music_contract_parties(name,email,signed_at)&order=created_at.desc&limit=100"));
    const asParty = rows(await B.sb("music_contract_parties?email=eq." + encodeURIComponent(u.email.toLowerCase()) + "&select=id,signed_at,music_contracts(id,title,status,created_at)&limit=100"));
    return B.J(200, { ok: true, created: mine, to_sign: asParty.filter(function (p) { return !p.signed_at && p.music_contracts && p.music_contracts.status === "pending"; }).map(function (p) { return { title: p.music_contracts.title, link: "/music/sign.html?t=" + signParty(p.id) }; }) });
  }
  if (a === "c_create") {
    let body = clip(b.body, 40000), title = clip(b.title, 140), tk = null;
    if (b.template_key) { const t = rows(await B.sb("music_contract_templates?key=eq." + encodeURIComponent(clip(b.template_key, 60)) + "&active=eq.true&select=*"))[0]; if (!t) return B.J(404, { error: "Template not found" }); tk = t.key; if (!body) body = t.body; if (!title) title = t.title; }
    if (title.length < 3 || body.length < 20) return B.J(400, { error: "A title and the contract text are required" });
    const ps = Array.isArray(b.parties) ? b.parties.slice(0, 12) : [], seen = {}, list = [];
    for (const p of ps) { const email = clip(p && p.email, 200).toLowerCase(), name = clip(p && p.name, 120); if (!EMAIL.test(email) || name.length < 2) return B.J(400, { error: "Each signer needs a name and a valid email" }); if (seen[email]) return B.J(400, { error: "The same email is listed twice" }); seen[email] = 1; list.push({ name: name, email: email, role: clip(p.role, 60) || null }); }
    if (list.length < 1) return B.J(400, { error: "Add at least one signer" });
    if (b.project_id && !UUID.test(String(b.project_id))) return B.J(400, { error: "Bad project" });
    const ins = await B.sb("music_contracts", { method: "POST", prefer: "return=representation", body: { template_key: tk, title: title, body: body, body_hash: sha(body), created_by_user: u.id, created_by_label: u.name || u.email, project_id: b.project_id || null } });
    const c = rows(ins)[0]; if (!c) return B.J(500, { error: "Could not save the contract" });
    const pr = await B.sb("music_contract_parties", { method: "POST", prefer: "return=representation", body: list.map(function (p) { return Object.assign({ contract_id: c.id }, p); }) });
    if (!pr.ok) { await B.sb("music_contracts?id=eq." + c.id, { method: "DELETE", prefer: "return=minimal" }); return B.J(500, { error: "Could not add signers" }); }
    await B.audit("user:" + u.id, "contract_created", c.id, { signers: list.length });
    return B.J(200, { ok: true, id: c.id, links: rows(pr).map(function (p) { return { name: p.name, email: p.email, link: "/music/sign.html?t=" + signParty(p.id) }; }) });
  }
  if (a === "c_get") {
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    const c = await contractFull(b.id); if (!c || c.created_by_user !== u.id) return B.J(404, { error: "Not found" });
    return B.J(200, { ok: true, contract: { id: c.id, title: c.title, status: c.status, body_hash: c.body_hash, final_hash: c.final_hash, parties: c.music_contract_parties.map(function (p) { return Object.assign(partyPublic(p), { email: p.email, link: p.signed_at ? null : "/music/sign.html?t=" + signParty(p.id) }); }) }, final_html: c.status === "executed" ? finalDoc(c, c.music_contract_parties) : null });
  }
  if (a === "c_void") {
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    const up = await B.sb("music_contracts?id=eq." + b.id + "&created_by_user=eq." + u.id + "&status=eq.pending", { method: "PATCH", prefer: "return=representation", body: { status: "void" } });
    return rows(up).length ? B.J(200, { ok: true }) : B.J(409, { error: "Only a contract that is still waiting for signatures can be cancelled" });
  }
  return B.J(400, { error: "Unknown action" });
};
module.exports.signParty = signParty; module.exports.verifyParty = verifyParty;
