// POTENT Music: owner console extras (orders, payment events, coupons, staff roles, flags, CSV reports, beat-sale remainder agreements),
// plus buyer/seller features (notifications, listening history, related music, albums, search, releases).
const B = require("./lib/beats");
const M = require("./lib/music");
const UUID = /^[0-9a-f-]{36}$/i;
const clip = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n); };
const rows = function (r) { return r.ok && Array.isArray(r.data) ? r.data : []; };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const fails = {};
function tooMany(k, max) { const f = fails[k]; return !!(f && f.n >= max && Date.now() - f.t < 36e5); }
function note(k) { const f = fails[k]; if (!f || Date.now() - f.t > 36e5) fails[k] = { n: 1, t: Date.now() }; else { f.n++; f.t = Date.now(); } }
const ip = function (e) { return String((e.headers || {})["x-nf-client-connection-ip"] || "x"); };
const csv = function (head, data) { const q = function (v) { v = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }; return [head.join(",")].concat(data.map(function (r) { return r.map(q).join(","); })).join("\n"); };
const usd = function (c) { return ((c || 0) / 100).toFixed(2); };
const like = function (s) { return encodeURIComponent("*" + String(s).replace(/[*,()%]/g, " ").trim() + "*"); };
const FLAG_KEYS = ["ai", "signups", "cart"];

// Largest remainder POTENT can ever assign on an exclusive sale: 100 - 1% POTENT - the seller's share (never below 91).
function maxRemainder(prod) { return Math.max(0, Math.round((100 - B.PLATFORM_FEE_PCT - B.sellerPct(prod && prod.splits && prod.splits.exclusive)) * 1000) / 1000); }

async function checkAgreement(a) {
  // Each agreement is validated on its own. Anything unclear is flagged for review instead of guessed.
  const pr = rows(await B.sb("beat_producers?id=eq." + a.producer_id + "&select=id,splits,name"))[0];
  if (!pr) return { status: "flagged", note: "The producer on this agreement was not found." };
  if (a.scope === "beat" && !a.beat_id) return { status: "flagged", note: "A per-beat agreement needs a beat." };
  if (!clip(a.recipient_name, 80)) return { status: "flagged", note: "Name who receives this share." };
  const max = maxRemainder(pr);
  const q = "beat_remainder_agreements?producer_id=eq." + a.producer_id + "&scope=eq." + a.scope + (a.scope === "beat" ? "&beat_id=eq." + a.beat_id : "") + "&status=in.(validated,pending_review)&select=id,pct";
  const others = rows(await B.sb(q)).filter(function (x) { return x.id !== a.id; });
  const total = Math.round((others.reduce(function (s, x) { return s + Number(x.pct); }, 0) + Number(a.pct)) * 1000) / 1000;
  if (total > max) return { status: "flagged", note: "Shares on this " + a.scope + " add up to " + total + "%, but only " + max + "% is left after POTENT's 1% and the seller's " + (100 - 1 - max) + "%." };
  return { status: "validated", note: null };
}

exports.handler = async function (event) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.AUTH_SECRET) return B.J(500, { error: "Server not configured" });
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  const a = String(b.action || "");

  // ───── public ─────
  if (a === "search") {
    const q = clip(b.q, 60); if (q.length < 2) return B.J(200, { ok: true, tracks: [], products: [], artists: [], beats: [] });
    if (tooMany("sr:" + ip(event), 120)) return B.J(429, { error: "Slow down a little" }); note("sr:" + ip(event));
    const L = like(q), live = "status=eq.published";
    const [t, p, ar, be] = await Promise.all([
      B.sb("music_tracks?" + live + "&or=(title.ilike." + L + ",genre.ilike." + L + ",mood.ilike." + L + ")&select=id,title,cover_url,genre,beat_producers(name,slug)&limit=8"),
      B.sb("music_products?" + live + "&or=(title.ilike." + L + ",description.ilike." + L + ")&select=id,title,kind,price_cents,cover_url,beat_producers(name,slug)&limit=8"),
      B.sb("beat_producers?active=eq.true&slug=not.is.null&name=ilike." + L + "&select=name,slug,avatar_url&limit=6"),
      B.sb("beat_items?active=eq.true&status=eq.published&exclusive_sold=eq.false&or=(title.ilike." + L + ",genre.ilike." + L + ")&select=id,title,genre,exclusive_cents&limit=8")]);
    return B.J(200, { ok: true, tracks: rows(t), products: rows(p), artists: rows(ar), beats: rows(be) });
  }
  if (a === "creators") { // public directory of creators with a storefront
    const q = clip(b.q, 40), city = clip(b.city, 40);
    let path = "beat_producers?active=eq.true&slug=not.is.null&select=id,name,slug,avatar_url,city,verified,bio&order=verified.desc,name.asc&limit=200";
    if (q) path += "&name=ilike." + like(q); if (city) path += "&city=ilike." + like(city);
    const [pr, tr, pd] = await Promise.all([B.sb(path), B.sb("music_tracks?status=eq.published&select=producer_id&limit=5000"), B.sb("music_products?status=eq.published&select=producer_id&limit=5000")]);
    const cnt = function (list) { const o = {}; list.forEach(function (x) { o[x.producer_id] = (o[x.producer_id] || 0) + 1; }); return o; }, tc = cnt(rows(tr)), pc = cnt(rows(pd));
    return B.J(200, { ok: true, creators: rows(pr).map(function (x) { return { name: x.name, slug: x.slug, avatar_url: x.avatar_url, city: x.city, verified: !!x.verified, bio: clip(x.bio, 140), songs: tc[x.id] || 0, downloads: pc[x.id] || 0 }; }) });
  }
  if (a === "categories") {
    const [t, p] = await Promise.all([B.sb("music_tracks?status=eq.published&select=genre&limit=2000"), B.sb("music_products?status=eq.published&select=kind&limit=2000")]);
    const cnt = function (list, k) { const o = {}; list.forEach(function (x) { const v = x[k]; if (v) o[v] = (o[v] || 0) + 1; }); return Object.keys(o).sort(function (x, y) { return o[y] - o[x]; }).map(function (n) { return { name: n, count: o[n] }; }); };
    return B.J(200, { ok: true, genres: cnt(rows(t), "genre"), kinds: cnt(rows(p), "kind") });
  }
  if (a === "releases") { // upcoming and new releases + the owner's calendar
    const now = new Date().toISOString();
    const [up, nw, site] = await Promise.all([
      B.sb("music_products?status=eq.published&publish_at=gt." + now + "&select=id,title,kind,cover_url,publish_at,preorder,price_cents,beat_producers(name,slug)&order=publish_at.asc&limit=24"),
      B.sb("music_tracks?status=eq.published&select=id,title,cover_url,release_date,beat_producers(name,slug)&order=created_at.desc&limit=24"),
      B.getSetting("music_home")]);
    return B.J(200, { ok: true, upcoming: rows(up), newest: rows(nw), calendar: ((site && site.calendar) || []).filter(function (c) { return c.date >= now.slice(0, 10); }).sort(function (x, y) { return x.date < y.date ? -1 : 1; }) });
  }
  if (a === "album_get") {
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    const al = rows(await B.sb("music_albums?id=eq." + b.id + "&status=eq.published&select=*,beat_producers(name,slug),music_album_tracks(position,music_tracks(id,title,audio_url,cover_url,status,explicit))"))[0];
    if (!al) return B.J(404, { error: "Not found" });
    al.tracks = al.music_album_tracks.filter(function (x) { return x.music_tracks && x.music_tracks.status === "published"; }).sort(function (x, y) { return x.position - y.position; }).map(function (x) { return x.music_tracks; }); delete al.music_album_tracks;
    return B.J(200, { ok: true, album: al });
  }
  if (a === "related") { // plain matching on genre / mood / artist, no AI call
    if (!UUID.test(String(b.track_id || ""))) return B.J(400, { error: "Bad id" });
    const t = rows(await B.sb("music_tracks?id=eq." + b.track_id + "&select=id,genre,mood,producer_id"))[0]; if (!t) return B.J(200, { ok: true, items: [] });
    const ors = [t.genre ? "genre.eq." + encodeURIComponent(t.genre) : null, t.mood ? "mood.eq." + encodeURIComponent(t.mood) : null, "producer_id.eq." + t.producer_id].filter(Boolean).join(",");
    const r = rows(await B.sb("music_tracks?status=eq.published&id=neq." + t.id + "&or=(" + ors + ")&select=id,title,audio_url,cover_url,genre,beat_producers(name,slug)&order=plays.desc&limit=8"));
    return B.J(200, { ok: true, items: r });
  }

  // ───── owner ─────
  if (a.indexOf("o_") === 0) {
    const owner = B.verifyOwner(B.bearer(event)); if (!owner) return B.J(403, { error: "POTENT owner only" });
    if (a === "o_orders") {
      const q = clip(b.q, 80), st = ["complete", "refunded"].indexOf(b.status) >= 0 ? b.status : "", page = Math.max(0, parseInt(b.page, 10) || 0), per = 25, take = (page + 1) * per;
      const f = (st ? "&status=eq." + st : "");
      const [bs, ms] = await Promise.all([
        b.kind === "product" ? null : B.sb("beat_sales?select=id,title,buyer_email,gross_cents,status,created_at,stripe_session_id,beat_producers(name)" + f + (q ? "&or=(buyer_email.ilike." + like(q) + ",title.ilike." + like(q) + ")" : "") + "&order=created_at.desc&limit=" + take),
        b.kind === "beat" ? null : B.sb("music_sales?select=id,buyer_email,gross_cents,status,created_at,stripe_session_id,music_products(title),beat_producers(name)" + f + (q ? "&or=(buyer_email.ilike." + like(q) + ")" : "") + "&order=created_at.desc&limit=" + take)]);
      const all = (bs ? rows(bs).map(function (x) { return { kind: "beat", id: x.id, title: x.title, buyer: x.buyer_email, seller: x.beat_producers && x.beat_producers.name, gross_cents: x.gross_cents, status: x.status, date: x.created_at, paid_with: String(x.stripe_session_id || "").indexOf("coin_") === 0 ? "coins" : "card" }; }) : [])
        .concat(ms ? rows(ms).map(function (x) { return { kind: "product", id: x.id, title: x.music_products && x.music_products.title, buyer: x.buyer_email, seller: x.beat_producers && x.beat_producers.name, gross_cents: x.gross_cents, status: x.status, date: x.created_at, paid_with: String(x.stripe_session_id || "").indexOf("coin_") === 0 ? "coins" : "card" }; }) : [])
        .sort(function (x, y) { return x.date < y.date ? 1 : -1; });
      const slice = all.slice(page * per, page * per + per);
      return B.J(200, { ok: true, rows: slice, more: all.length > (page + 1) * per, page: page });
    }
    if (a === "o_events") {
      const q = clip(b.q, 60), page = Math.max(0, parseInt(b.page, 10) || 0);
      const r = await B.sb("beat_audit?select=*&order=created_at.desc&limit=50&offset=" + page * 50 + (q ? "&or=(action.ilike." + like(q) + ",actor.ilike." + like(q) + ",target.ilike." + like(q) + ")" : ""));
      return B.J(200, { ok: true, rows: rows(r), more: rows(r).length === 50 });
    }
    if (a === "o_coupons") {
      if (!process.env.STRIPE_SECRET_KEY) return B.J(500, { error: "Stripe is not configured" });
      const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
      const l = await stripe.promotionCodes.list({ limit: 100, expand: ["data.coupon"] });
      return B.J(200, { ok: true, codes: l.data.map(function (p) { return { id: p.id, code: p.code, active: p.active, percent_off: p.coupon.percent_off, amount_off: p.coupon.amount_off, redeemed: p.times_redeemed, max: p.max_redemptions, expires_at: p.expires_at }; }) });
    }
    if (a === "o_coupon_create") {
      if (!process.env.STRIPE_SECRET_KEY) return B.J(500, { error: "Stripe is not configured" });
      const code = clip(b.code, 30).toUpperCase().replace(/[^A-Z0-9_-]/g, ""), pct = Number(b.percent_off), amt = Math.round(Number(b.amount_off_cents));
      if (code.length < 3 || (!(pct > 0 && pct <= 100) && !(amt >= 100))) return B.J(400, { error: "Give a code (3+ letters) and either a percent off or a dollar amount off" });
      const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
      try {
        const c = await stripe.coupons.create(pct > 0 ? { percent_off: pct, duration: "once", name: code } : { amount_off: amt, currency: "usd", duration: "once", name: code });
        const pcode = { coupon: c.id, code: code }; const mx = parseInt(b.max_redemptions, 10); if (mx > 0) pcode.max_redemptions = mx; const ex = b.expires_at ? Math.floor(new Date(b.expires_at).getTime() / 1000) : 0; if (ex > Date.now() / 1000) pcode.expires_at = ex;
        await stripe.promotionCodes.create(pcode); await B.audit("owner", "coupon_create", code, { pct: pct || null, amt: amt || null });
        return B.J(200, { ok: true });
      } catch (e) { return B.J(400, { error: "Stripe said: " + String(e.message).slice(0, 160) }); }
    }
    if (a === "o_coupon_active") {
      if (!process.env.STRIPE_SECRET_KEY || !/^promo_[A-Za-z0-9]+$/.test(String(b.id || ""))) return B.J(400, { error: "Bad request" });
      await require("stripe")(process.env.STRIPE_SECRET_KEY).promotionCodes.update(b.id, { active: b.active === true }); await B.audit("owner", "coupon_" + (b.active ? "on" : "off"), b.id, null); return B.J(200, { ok: true });
    }
    if (a === "o_roles") { const r = await B.sb("music_roles?select=user_id,role,created_at,music_users(email)&order=created_at.desc&limit=200"); return B.J(200, { ok: true, roles: rows(r) }); }
    if (a === "o_role_set") {
      const email = clip(b.email, 200).toLowerCase(); if (!EMAIL.test(email)) return B.J(400, { error: "Enter their account email" });
      const u = rows(await B.sb("music_users?email=eq." + encodeURIComponent(email) + "&select=id"))[0]; if (!u) return B.J(404, { error: "No account with that email. They need to sign up first." });
      if (!b.role) { await B.sb("music_roles?user_id=eq." + u.id, { method: "DELETE", prefer: "return=minimal" }); await B.audit("owner", "role_remove", u.id, null); return B.J(200, { ok: true }); }
      if (["moderator", "support", "store_admin"].indexOf(b.role) < 0) return B.J(400, { error: "Unknown role" });
      await B.sb("music_roles", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { user_id: u.id, role: b.role, granted_by: "owner" } }); await B.audit("owner", "role_set", u.id, { role: b.role });
      return B.J(200, { ok: true });
    }
    if (a === "o_flags_get") { const f = (await B.getSetting("music_flags")) || {}; return B.J(200, { ok: true, flags: { ai: f.ai !== false, signups: f.signups !== false, cart: f.cart !== false, download_limit: Number(f.download_limit) > 0 ? Number(f.download_limit) : 25 } }); }
    if (a === "o_flags_set") {
      const f = (await B.getSetting("music_flags")) || {}; FLAG_KEYS.forEach(function (k) { if (typeof b[k] === "boolean") f[k] = b[k]; });
      if (b.download_limit !== undefined) { const n = parseInt(b.download_limit, 10); if (n >= 1 && n <= 1000) f.download_limit = n; }
      await B.setSetting("music_flags", f); await B.audit("owner", "flags_set", "music_flags", f); return B.J(200, { ok: true });
    }
    if (a === "o_reset_downloads") {
      if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
      await B.sb((b.kind === "beat" ? "beat_sales" : "music_sales") + "?id=eq." + b.id, { method: "PATCH", prefer: "return=minimal", body: { download_count: 0 } }); await B.audit("owner", "download_reset", b.id, null); return B.J(200, { ok: true });
    }
    if (a === "o_report") { // CSV downloads
      const t = String(b.type || "");
      if (t === "sales") {
        const [bs, ms] = await Promise.all([B.sb("beat_sales?select=*,beat_producers(name)&order=created_at.desc&limit=5000"), B.sb("music_sales?select=*,music_products(title,kind),beat_producers(name)&order=created_at.desc&limit=5000")]);
        const data = rows(bs).map(function (x) { return [x.created_at, "beat", x.title, x.beat_producers && x.beat_producers.name, x.buyer_email, usd(x.gross_cents), usd(x.tax_cents), usd(x.discount_cents), usd(x.platform_fee_cents), usd(x.producer_cents), usd(x.unallocated_cents), usd(x.refunded_cents), x.status, x.agreement_version, x.stripe_session_id]; })
          .concat(rows(ms).map(function (x) { return [x.created_at, x.music_products && x.music_products.kind, x.music_products && x.music_products.title, x.beat_producers && x.beat_producers.name, x.buyer_email, usd(x.gross_cents), usd(x.tax_cents), usd(x.discount_cents), usd(x.platform_fee_cents), usd(x.seller_cents), "0.00", usd(x.refunded_cents), x.status, x.agreement_version, x.stripe_session_id]; }));
        return B.J(200, { ok: true, name: "potent-music-sales.csv", csv: csv(["date", "type", "item", "seller", "buyer", "paid", "tax", "discount", "potent_fee", "seller_share", "unassigned", "refunded", "status", "agreement_version", "payment_ref"], data) });
      }
      if (t === "payouts") { const r = rows(await B.sb("beat_payouts?select=*,beat_producers(name)&order=requested_at.desc&limit=5000")); return B.J(200, { ok: true, name: "potent-payouts.csv", csv: csv(["requested", "seller", "amount", "method", "status", "reference", "paid_at"], r.map(function (x) { return [x.requested_at, x.beat_producers && x.beat_producers.name, usd(x.amount_cents), x.method, x.status, x.reference, x.paid_at]; })) }); }
      if (t === "coins") { const r = rows(await B.sb("music_coin_ledger?select=*,music_users(email)&order=created_at.desc&limit=10000")); return B.J(200, { ok: true, name: "potent-coin-ledger.csv", csv: csv(["date", "account", "type", "coins", "balance_after", "note", "actor"], r.map(function (x) { return [x.created_at, x.music_users && x.music_users.email, x.type, usd(x.delta_cents), usd(x.balance_after), x.note, x.actor]; })) }); }
      if (t === "remainder") { const r = rows(await B.sb("beat_sale_remainder?select=*,beat_remainder_agreements(label,pct),beat_sales(title,created_at)&order=created_at.desc&limit=5000")); return B.J(200, { ok: true, name: "potent-remainder.csv", csv: csv(["date", "sale", "agreement", "pct", "recipient", "amount", "credited_to_wallet"], r.map(function (x) { return [x.created_at, x.beat_sales && x.beat_sales.title, x.beat_remainder_agreements && x.beat_remainder_agreements.label, x.beat_remainder_agreements && x.beat_remainder_agreements.pct, x.recipient_name, usd(x.cents), x.credited ? "yes" : "no"]; })) }); }
      return B.J(400, { error: "Unknown report" });
    }
    // beat-sale remainder: the 8% that is unassigned unless a written agreement names someone
    if (a === "o_rem_list") {
      const [ag, ap] = await Promise.all([B.sb("beat_remainder_agreements?select=*,beat_producers!beat_remainder_agreements_producer_id_fkey(name),beat_items(title)&order=created_at.desc&limit=200"), B.sb("beat_sale_remainder?select=*&order=created_at.desc&limit=200")]);
      return B.J(200, { ok: true, agreements: rows(ag), applied: rows(ap) });
    }
    if (a === "o_rem_save") {
      const pct = Math.round(Number(b.pct) * 1000) / 1000, scope = b.scope === "beat" ? "beat" : "producer";
      if (!UUID.test(String(b.producer_id || "")) || !(pct > 0 && pct <= 8) || clip(b.label, 100).length < 3) return B.J(400, { error: "Producer, a label and a percent between 0 and 8 are required" });
      if (scope === "beat" && !UUID.test(String(b.beat_id || ""))) return B.J(400, { error: "Pick the beat" });
      const rec = UUID.test(String(b.recipient_producer_id || "")) ? b.recipient_producer_id : null;
      const row = { label: clip(b.label, 100), recipient_name: clip(b.recipient_name, 80), recipient_producer_id: rec, pct: pct, scope: scope, producer_id: b.producer_id, beat_id: scope === "beat" ? b.beat_id : null, note: clip(b.note, 400) || null };
      const v = await checkAgreement(row); row.status = v.status; if (v.note) row.note = (row.note ? row.note + " | " : "") + v.note;
      const ins = await B.sb("beat_remainder_agreements", { method: "POST", prefer: "return=representation", body: row }); if (!ins.ok) return B.J(500, { error: "Could not save" });
      await B.audit("owner", "remainder_agreement", rows(ins)[0].id, { pct: pct, status: v.status }); return B.J(200, { ok: true, status: v.status, note: v.note });
    }
    if (a === "o_rem_end") { if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" }); await B.sb("beat_remainder_agreements?id=eq." + b.id, { method: "PATCH", prefer: "return=minimal", body: { status: "ended" } }); await B.audit("owner", "remainder_end", b.id, null); return B.J(200, { ok: true }); }
    if (a === "o_rem_apply") { // assign a slice of a completed sale's unassigned remainder under one validated agreement
      if (!UUID.test(String(b.sale_id || "")) || !UUID.test(String(b.agreement_id || ""))) return B.J(400, { error: "Bad request" });
      const [sl, ag] = await Promise.all([B.sb("beat_sales?id=eq." + b.sale_id + "&select=*"), B.sb("beat_remainder_agreements?id=eq." + b.agreement_id + "&select=*")]);
      const sale = rows(sl)[0], agr = rows(ag)[0]; if (!sale || !agr) return B.J(404, { error: "Not found" });
      if (sale.status !== "complete") return B.J(409, { error: "Only a completed sale can be assigned" });
      if (agr.status !== "validated") return B.J(409, { error: "This agreement is " + agr.status.replace("_", " ") + ". Only validated agreements can be applied." });
      if (agr.producer_id !== sale.producer_id || (agr.scope === "beat" && agr.beat_id !== sale.beat_id)) return B.J(409, { error: "This agreement does not cover that sale" });
      const used = rows(await B.sb("beat_sale_remainder?sale_id=eq." + sale.id + "&select=cents")).reduce(function (s, x) { return s + Number(x.cents); }, 0);
      const cents = Math.floor(Number(sale.eligible_cents) * Number(agr.pct) / 100);
      if (cents < 1) return B.J(409, { error: "That share rounds to zero" });
      if (cents + used > Number(sale.unallocated_cents)) return B.J(409, { error: "Not enough unassigned money left on this sale" });
      const ins = await B.sb("beat_sale_remainder", { method: "POST", prefer: "return=representation", body: { sale_id: sale.id, agreement_id: agr.id, recipient_name: agr.recipient_name, cents: cents } });
      if (!ins.ok) return B.J(409, { error: "This agreement was already applied to that sale" });
      const row = rows(ins)[0]; let credited = false;
      if (b.credit_wallet === true && agr.recipient_producer_id) {
        const tx = await B.sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { producer_id: agr.recipient_producer_id, type: "sale", amount_cents: cents, ref: "rem:" + row.id, note: "Agreed share: " + agr.label, available_at: new Date().toISOString() } });
        if (tx.ok) { await B.sb("beat_sale_remainder?id=eq." + row.id, { method: "PATCH", prefer: "return=minimal", body: { credited: true } }); credited = true; }
      }
      await B.audit("owner", "remainder_apply", sale.id, { agreement: agr.id, cents: cents, credited: credited }); return B.J(200, { ok: true, cents: cents, credited: credited });
    }
    if (a === "o_rem_reverse") { // use if the sale is refunded after a share was assigned
      if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
      const row = rows(await B.sb("beat_sale_remainder?id=eq." + b.id + "&select=*,beat_remainder_agreements(recipient_producer_id)"))[0]; if (!row) return B.J(404, { error: "Not found" });
      if (row.credited && row.beat_remainder_agreements && row.beat_remainder_agreements.recipient_producer_id) await B.sb("beat_wallet_txns", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { producer_id: row.beat_remainder_agreements.recipient_producer_id, type: "refund", amount_cents: -row.cents, ref: "remrev:" + row.id, note: "Agreed share reversed", available_at: new Date().toISOString() } });
      await B.sb("beat_sale_remainder?id=eq." + row.id, { method: "DELETE", prefer: "return=minimal" }); await B.audit("owner", "remainder_reverse", row.sale_id, { cents: row.cents }); return B.J(200, { ok: true });
    }
    return B.J(400, { error: "Unknown action" });
  }

  // ───── seller (producer token) ─────
  if (a.indexOf("s_") === 0) {
    const pt = B.verifyProducer(B.bearer(event)); if (!pt) return B.J(401, { error: "Please sign in" });
    const pid = pt.pid || pt.id || pt.sub; const pr = rows(await B.sb("beat_producers?id=eq." + pid + "&active=eq.true&select=id,name"))[0]; if (!pr) return B.J(401, { error: "Please sign in" });
    if (a === "s_album_list") return B.J(200, { ok: true, albums: rows(await B.sb("music_albums?producer_id=eq." + pr.id + "&select=*,music_album_tracks(track_id,position)&order=created_at.desc&limit=100")) });
    if (a === "s_album_save") {
      const title = clip(b.title, 120); if (title.length < 2) return B.J(400, { error: "Give the release a title" });
      const kind = ["album", "ep", "single"].indexOf(b.kind) >= 0 ? b.kind : "album", ids = Array.from(new Set((Array.isArray(b.track_ids) ? b.track_ids : []).map(String))).filter(function (x) { return UUID.test(x); }).slice(0, 60);
      if (ids.length) { const own = rows(await B.sb("music_tracks?id=in.(" + ids.join(",") + ")&producer_id=eq." + pr.id + "&select=id")); if (own.length !== ids.length) return B.J(403, { error: "You can only add your own songs" }); }
      const body = { title: title, kind: kind, description: clip(b.description, 800) || null, cover_url: clip(b.cover_url, 400) || null, release_date: /^\d{4}-\d{2}-\d{2}$/.test(String(b.release_date || "")) ? b.release_date : null, status: b.status === "published" ? "published" : "draft" };
      let id = UUID.test(String(b.id || "")) ? b.id : null;
      if (id) { const up = await B.sb("music_albums?id=eq." + id + "&producer_id=eq." + pr.id, { method: "PATCH", prefer: "return=representation", body: body }); if (!rows(up).length) return B.J(404, { error: "Not found" }); }
      else { const ins = await B.sb("music_albums", { method: "POST", prefer: "return=representation", body: Object.assign({ producer_id: pr.id }, body) }); if (!rows(ins).length) return B.J(500, { error: "Could not save" }); id = rows(ins)[0].id; }
      await B.sb("music_album_tracks?album_id=eq." + id, { method: "DELETE", prefer: "return=minimal" });
      if (ids.length) await B.sb("music_album_tracks", { method: "POST", prefer: "return=minimal", body: ids.map(function (t, i) { return { album_id: id, track_id: t, position: i }; }) });
      return B.J(200, { ok: true, id: id });
    }
    if (a === "s_notifs") { const r = await B.sb("music_notifications?producer_id=eq." + pr.id + "&select=*&order=created_at.desc&limit=50"); if (b.read === true) await B.sb("music_notifications?producer_id=eq." + pr.id + "&read_at=is.null", { method: "PATCH", prefer: "return=minimal", body: { read_at: new Date().toISOString() } }); return B.J(200, { ok: true, items: rows(r) }); }
    if (a === "s_statement") { // the seller's own sales as a CSV
      const [bs, ms] = await Promise.all([B.sb("beat_sales?producer_id=eq." + pr.id + "&select=*&order=created_at.desc&limit=5000"), B.sb("music_sales?producer_id=eq." + pr.id + "&select=*,music_products(title)&order=created_at.desc&limit=5000")]);
      const data = rows(bs).map(function (x) { return [x.created_at, "exclusive beat", x.title, usd(x.gross_cents), usd(x.tax_cents), usd(x.platform_fee_cents), usd(x.producer_cents), x.status]; }).concat(rows(ms).map(function (x) { return [x.created_at, "music", x.music_products && x.music_products.title, usd(x.gross_cents), usd(x.tax_cents), usd(x.platform_fee_cents), usd(x.seller_cents), x.status]; }));
      return B.J(200, { ok: true, name: "potent-statement.csv", csv: csv(["date", "type", "item", "paid", "tax", "potent_fee", "your_share", "status"], data) });
    }
    return B.J(400, { error: "Unknown action" });
  }

  // ───── buyer ─────
  const tu = M.verifyUser(B.bearer(event)); if (!tu) return B.J(401, { error: "Please sign in" });
  const u = rows(await B.sb("music_users?id=eq." + tu.uid + "&select=id,email,active,history_off"))[0]; if (!u || u.active === false) return B.J(401, { error: "Please sign in" });
  if (a === "notif_list") {
    const r = await B.sb("music_notifications?user_id=eq." + u.id + "&select=*&order=created_at.desc&limit=40");
    return B.J(200, { ok: true, items: rows(r), unread: rows(r).filter(function (x) { return !x.read_at; }).length });
  }
  if (a === "notif_read") { await B.sb("music_notifications?user_id=eq." + u.id + "&read_at=is.null" + (UUID.test(String(b.id || "")) ? "&id=eq." + b.id : ""), { method: "PATCH", prefer: "return=minimal", body: { read_at: new Date().toISOString() } }); return B.J(200, { ok: true }); }
  if (a === "hist_add") { // quietly remembers the song; does nothing when the person has turned history off
    if (u.history_off || !UUID.test(String(b.track_id || ""))) return B.J(200, { ok: true, skipped: true });
    await B.sb("music_history", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { user_id: u.id, track_id: b.track_id, played_at: new Date().toISOString() } }); return B.J(200, { ok: true });
  }
  if (a === "hist_get") { const r = await B.sb("music_history?user_id=eq." + u.id + "&select=played_at,music_tracks(id,title,audio_url,cover_url,status,beat_producers(name,slug))&order=played_at.desc&limit=50"); return B.J(200, { ok: true, off: !!u.history_off, items: rows(r).filter(function (x) { return x.music_tracks && x.music_tracks.status === "published"; }) }); }
  if (a === "hist_clear") { await B.sb("music_history?user_id=eq." + u.id, { method: "DELETE", prefer: "return=minimal" }); return B.J(200, { ok: true }); }
  if (a === "hist_set") { await B.sb("music_users?id=eq." + u.id, { method: "PATCH", prefer: "return=minimal", body: { history_off: b.off === true } }); if (b.off === true) await B.sb("music_history?user_id=eq." + u.id, { method: "DELETE", prefer: "return=minimal" }); return B.J(200, { ok: true, off: b.off === true }); }
  return B.J(400, { error: "Unknown action" });
};
