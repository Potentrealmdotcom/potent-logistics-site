// POTENT Music: artwork / vinyl / figurine orders and Artist Collectibles. Prices come from the database tiers, never from the browser.
// Fixed tiers are paid up front. "starting price" tiers start as a quote request: POTENT sets the exact price (never below the starting price), then the buyer pays it.
const B = require("./lib/beats");
const M = require("./lib/music");
const UUID = /^[0-9a-f-]{36}$/i;
const clip = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n); };
const rows = function (r) { return r.ok && Array.isArray(r.data) ? r.data : []; };
const fails = {};
function tooMany(k, max) { const f = fails[k]; return !!(f && f.n >= max && Date.now() - f.t < 36e5); }
function note(k) { const f = fails[k]; if (!f || Date.now() - f.t > 36e5) fails[k] = { n: 1, t: Date.now() }; else { f.n++; f.t = Date.now(); } }
const ip = function (e) { return String((e.headers || {})["x-nf-client-connection-ip"] || "x"); };
const httpsUrl = function (v) { v = clip(v, 500); return /^https:\/\//i.test(v) ? v : null; };
const CAT = { cover_art: "artwork", vinyl: "vinyl", figurine: "figurine" };
const STATUSES = ["quote_requested", "awaiting_payment", "paid", "in_progress", "review", "delivered", "cancelled", "refunded"];
const csv = function (head, data) { const q = function (v) { v = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }; return [head.join(",")].concat(data.map(function (r) { return r.map(q).join(","); })).join("\n"); };
const cd = function (c) { return ((c || 0) / 100).toFixed(2); };

async function checkout(event, u, opts) {
  if (!process.env.STRIPE_SECRET_KEY) return B.J(500, { error: "Payments are not set up" });
  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  const h = event.headers || {}; const origin = /^https:\/\/([a-z0-9-]+\.)*netlify\.app$/.test(String(h.origin || "")) || String(h.origin || "") === B.SITE ? String(h.origin) : B.SITE;
  try {
    const session = await stripe.checkout.sessions.create(Object.assign({ mode: "payment", customer_email: u.email,
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: opts.cents, product_data: { name: opts.name, description: opts.desc } } }],
      metadata: opts.metadata, expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      success_url: origin + "/music/services.html?paid=1", cancel_url: origin + "/music/services.html?canceled=1" }, opts.extra || {}));
    return B.J(200, { url: session.url });
  } catch (e) { console.error("services checkout failed:", e.message); return B.J(500, { error: "Could not start checkout" }); }
}

exports.handler = async function (event) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.AUTH_SECRET) return B.J(500, { error: "Server not configured" });
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  const a = String(b.action || "");

  // ───── public ─────
  if (a === "tiers") return B.J(200, { ok: true, tiers: rows(await B.sb("music_service_tiers?active=eq.true&select=*&order=sort.asc")) });
  if (a === "coll_list") {
    const r = rows(await B.sb("music_collectibles?status=eq.published&select=id,title,description,image_url,price_cents,edition_size,sold_count&order=created_at.desc&limit=100"));
    return B.J(200, { ok: true, items: r.map(function (c) { return Object.assign({}, c, { left: Math.max(0, c.edition_size - c.sold_count) }); }) });
  }
  if (a === "cert_get") { // public certificate check: proves an edition exists and its status. No buyer details.
    const code = clip(b.code, 20).toUpperCase().replace(/[^A-Z0-9]/g, ""); if (code.length < 8) return B.J(400, { error: "Enter the certificate code" });
    if (tooMany("cert:" + ip(event), 60)) return B.J(429, { error: "Too many checks" }); note("cert:" + ip(event));
    const u = rows(await B.sb("music_collectible_units?certificate_code=eq." + code + "&select=edition_no,status,created_at,music_collectibles(title,edition_size,image_url)"))[0];
    if (!u) return B.J(404, { error: "No certificate matches that code" });
    return B.J(200, { ok: true, certificate: { title: u.music_collectibles.title, edition_no: u.edition_no, edition_size: u.music_collectibles.edition_size, image_url: u.music_collectibles.image_url, status: u.status, issued: u.created_at, valid: u.status !== "refunded" } });
  }

  // ───── owner ─────
  if (a.indexOf("o_") === 0) {
    const owner = B.verifyOwner(B.bearer(event)); if (!owner) return B.J(403, { error: "POTENT owner only" });
    if (a === "o_svc_list") return B.J(200, { ok: true, orders: rows(await B.sb("music_service_orders?select=*,music_users(email),music_service_tiers(title,price_cents,is_quote)&order=created_at.desc&limit=" + Math.min(300, parseInt(b.limit, 10) || 100) + (STATUSES.indexOf(b.status) >= 0 ? "&status=eq." + b.status : ""))) });
    if (a === "o_svc_update") {
      if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
      const o = rows(await B.sb("music_service_orders?id=eq." + b.id + "&select=*,music_service_tiers(price_cents,is_quote)"))[0]; if (!o) return B.J(404, { error: "Not found" });
      const patch = { updated_at: new Date().toISOString() };
      if (b.quote_cents !== undefined) {
        const q = Math.round(Number(b.quote_cents)); if (o.status !== "quote_requested" && o.status !== "awaiting_payment") return B.J(409, { error: "A price can only be set before payment" });
        if (!o.music_service_tiers.is_quote) return B.J(409, { error: "This tier has a fixed price" });
        if (!(q >= o.music_service_tiers.price_cents && q <= 1e8)) return B.J(400, { error: "The price cannot be below the starting price of $" + cd(o.music_service_tiers.price_cents) });
        patch.quote_cents = q; patch.status = "awaiting_payment";
      }
      if (b.status !== undefined) {
        if (STATUSES.indexOf(b.status) < 0) return B.J(400, { error: "Unknown status" });
        if (["paid", "refunded"].indexOf(b.status) >= 0) return B.J(409, { error: "Paid and refunded are set automatically by Stripe" });
        if (b.status === "awaiting_payment" && o.music_service_tiers.is_quote && patch.quote_cents == null && o.quote_cents == null) return B.J(409, { error: "Set the price first" });
        if (["in_progress", "review", "delivered"].indexOf(b.status) >= 0 && !o.paid_at) return B.J(409, { error: "Work starts after payment" });
        patch.status = b.status;
      }
      if (b.assigned_to !== undefined) patch.assigned_to = clip(b.assigned_to, 80) || null;
      if (b.staff_note !== undefined) patch.staff_note = clip(b.staff_note, 600) || null;
      if (b.delivered_url !== undefined) patch.delivered_url = httpsUrl(b.delivered_url);
      if (patch.status === "delivered" && !(patch.delivered_url || o.delivered_url)) return B.J(409, { error: "Add the delivery link before marking delivered" });
      await B.sb("music_service_orders?id=eq." + o.id, { method: "PATCH", prefer: "return=minimal", body: patch });
      await B.audit("owner", "svc_update", o.id, { status: patch.status || null, quote: patch.quote_cents || null });
      if (patch.status) await require("./lib/notify")({ user_id: o.user_id, kind: "order", title: "Your order is now: " + patch.status.replace("_", " "), body: patch.quote_cents ? "Your price is $" + cd(patch.quote_cents) + ". You can pay from Services." : null, link: "/music/services.html" });
      return B.J(200, { ok: true });
    }
    if (a === "o_coll_save") {
      const title = clip(b.title, 120), price = Math.round(Number(b.price_cents)), size = parseInt(b.edition_size, 10);
      if (title.length < 3) return B.J(400, { error: "Name the collectible" });
      if (!(price >= 30000)) return B.J(400, { error: "Collectibles start at $300" });
      if (!(size >= 1 && size <= 100000)) return B.J(400, { error: "Edition size must be at least 1" });
      const row = { title: title, description: clip(b.description, 1500) || null, image_url: httpsUrl(b.image_url), price_cents: price, edition_size: size, status: ["draft", "published", "retired"].indexOf(b.status) >= 0 ? b.status : "draft" };
      if (UUID.test(String(b.id || ""))) {
        const cur = rows(await B.sb("music_collectibles?id=eq." + b.id + "&select=sold_count,price_cents,edition_size"))[0]; if (!cur) return B.J(404, { error: "Not found" });
        if (cur.sold_count > 0 && (size < cur.sold_count || size !== cur.edition_size || price !== Number(cur.price_cents))) return B.J(409, { error: "Once an edition has sold, its size and price are locked" });
        await B.sb("music_collectibles?id=eq." + b.id, { method: "PATCH", prefer: "return=minimal", body: row }); await B.audit("owner", "collectible_edit", b.id, null); return B.J(200, { ok: true, id: b.id });
      }
      const ins = await B.sb("music_collectibles", { method: "POST", prefer: "return=representation", body: row }); if (!rows(ins).length) return B.J(500, { error: "Could not save" });
      await B.audit("owner", "collectible_create", rows(ins)[0].id, null); return B.J(200, { ok: true, id: rows(ins)[0].id });
    }
    if (a === "o_coll_list") return B.J(200, { ok: true, items: rows(await B.sb("music_collectibles?select=*&order=created_at.desc&limit=200")), units: rows(await B.sb("music_collectible_units?select=*,music_collectibles(title),music_users(email)&order=created_at.desc&limit=300")) });
    if (a === "o_unit_update") {
      if (!UUID.test(String(b.id || "")) || ["sold", "in_production", "shipped", "delivered"].indexOf(b.status) < 0) return B.J(400, { error: "Bad request" });
      const up = await B.sb("music_collectible_units?id=eq." + b.id + "&status=neq.refunded", { method: "PATCH", prefer: "return=representation", body: { status: b.status, tracking: clip(b.tracking, 120) || null } });
      const x = rows(up)[0]; if (!x) return B.J(404, { error: "Not found or refunded" });
      await B.audit("owner", "unit_update", x.id, { status: b.status }); if (x.owner_user_id) await require("./lib/notify")({ user_id: x.owner_user_id, kind: "order", title: "Your collectible is now: " + b.status.replace("_", " "), body: b.tracking ? "Tracking: " + clip(b.tracking, 120) : null, link: "/music/services.html" });
      return B.J(200, { ok: true });
    }
    if (a === "o_acct_report") { // separate accounting categories
      const [so, un] = await Promise.all([B.sb("music_service_orders?paid_at=not.is.null&select=*,music_users(email)&order=paid_at.desc&limit=5000"), B.sb("music_collectible_units?select=*,music_collectibles(title)&order=created_at.desc&limit=5000")]);
      const data = rows(so).map(function (x) { return [x.paid_at, CAT[x.family] || x.family, x.tier_key, x.music_users && x.music_users.email, cd(x.quote_cents != null ? x.quote_cents : x.price_cents), x.status, x.id]; })
        .concat(rows(un).map(function (x) { return [x.created_at, "collectibles", x.music_collectibles && x.music_collectibles.title + " #" + x.edition_no, x.buyer_email, cd(x.price_cents), x.status, x.id]; }));
      return B.J(200, { ok: true, name: "potent-products-by-category.csv", csv: csv(["date", "category", "item", "buyer", "amount", "status", "id"], data) });
    }
    return B.J(400, { error: "Unknown action" });
  }

  // ───── buyer ─────
  const tu = M.verifyUser(B.bearer(event)); if (!tu) return B.J(401, { error: "Please sign in" });
  const u = rows(await B.sb("music_users?id=eq." + tu.uid + "&select=id,email,active"))[0]; if (!u || u.active === false) return B.J(401, { error: "Please sign in" });
  if (tooMany("u:" + u.id, 120)) return B.J(429, { error: "Too many requests" }); note("u:" + u.id);

  if (a === "order_create") {
    const t = rows(await B.sb("music_service_tiers?key=eq." + encodeURIComponent(clip(b.tier_key, 30)) + "&active=eq.true&select=*"))[0]; if (!t) return B.J(404, { error: "That option is not available" });
    const brief = clip(b.brief, 3000); if (brief.length < 20) return B.J(400, { error: "Tell us a bit more in your brief (at least a couple of sentences)" });
    const open = rows(await B.sb("music_service_orders?user_id=eq." + u.id + "&status=in.(quote_requested,awaiting_payment)&select=id&limit=11")); if (open.length > 10) return B.J(409, { error: "You have 10 unpaid orders. Pay or cancel some first." });
    let pid = null; if (b.project_id) { if (!UUID.test(String(b.project_id)) || !rows(await B.sb("music_projects?id=eq." + b.project_id + "&owner_user_id=eq." + u.id + "&select=id")).length) return B.J(403, { error: "Not your project" }); pid = b.project_id; }
    const ins = await B.sb("music_service_orders", { method: "POST", prefer: "return=representation", body: { user_id: u.id, tier_key: t.key, family: t.family, price_cents: t.is_quote ? null : t.price_cents, brief: brief, project_id: pid, status: t.is_quote ? "quote_requested" : "awaiting_payment" } });
    const o = rows(ins)[0]; if (!o) return B.J(500, { error: "Could not save your order" });
    await B.audit("user:" + u.id, "svc_order", o.id, { tier: t.key }); return B.J(200, { ok: true, id: o.id, status: o.status });
  }
  if (a === "order_list") return B.J(200, { ok: true, orders: rows(await B.sb("music_service_orders?user_id=eq." + u.id + "&select=id,tier_key,family,price_cents,quote_cents,status,brief,delivered_url,created_at,paid_at,music_service_tiers(title)&order=created_at.desc&limit=100")), units: rows(await B.sb("music_collectible_units?owner_user_id=eq." + u.id + "&select=id,edition_no,certificate_code,status,tracking,created_at,music_collectibles(title,edition_size,image_url)&order=created_at.desc&limit=100")) });
  if (a === "order_pay") {
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    const o = rows(await B.sb("music_service_orders?id=eq." + b.id + "&user_id=eq." + u.id + "&select=*,music_service_tiers(title)"))[0]; if (!o) return B.J(404, { error: "Not found" });
    if (o.status !== "awaiting_payment") return B.J(409, { error: o.status === "quote_requested" ? "We have not set your price yet. You will get a notice when it is ready." : "This order cannot be paid right now" });
    const cents = Number(o.quote_cents != null ? o.quote_cents : o.price_cents); if (!(cents >= 100)) return B.J(409, { error: "No price is set for this order yet" });
    return checkout(event, u, { cents: cents, name: o.music_service_tiers.title, desc: "Custom creative service. Scope is as agreed in your brief.", metadata: { product: "MUSICSVC", order_id: o.id, user_id: u.id } });
  }
  if (a === "order_cancel") {
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    const up = await B.sb("music_service_orders?id=eq." + b.id + "&user_id=eq." + u.id + "&status=in.(quote_requested,awaiting_payment)", { method: "PATCH", prefer: "return=representation", body: { status: "cancelled", updated_at: new Date().toISOString() } });
    return rows(up).length ? B.J(200, { ok: true }) : B.J(409, { error: "Only an unpaid order can be cancelled here. Contact support for anything else." });
  }
  if (a === "coll_buy") {
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    if (b.agree !== true) return B.J(400, { error: "Please accept the terms first" });
    const c = rows(await B.sb("music_collectibles?id=eq." + b.id + "&status=eq.published&select=*"))[0]; if (!c) return B.J(404, { error: "Not available" });
    if (c.sold_count >= c.edition_size) return B.J(409, { error: "This edition is sold out" });
    return checkout(event, u, { cents: Number(c.price_cents), name: c.title + " (limited edition)", desc: "Individually numbered collectible. Ships to the address you enter.", metadata: { product: "MUSICCOLL", collectible_id: c.id, user_id: u.id, agreement_version: B.AGREEMENT_VERSION, agreed_at: new Date().toISOString() }, extra: { shipping_address_collection: { allowed_countries: ["US"] }, custom_text: { submit: { message: "Each collectible is individually numbered. If this edition sells out while you pay, you are refunded automatically." } } } });
  }
  return B.J(400, { error: "Unknown action" });
};
