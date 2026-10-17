// POTENT Music API: discovery/streaming, storefronts, buyer accounts + library, creator studio, moderation.
// POST JSON { action, ... }. Buyer calls send the buyer token; sellers send the Beat Man producer token; the owner sends the owner token.
const B = require("./lib/beats");
const M = require("./lib/music");

const UUID = /^[0-9a-f-]{36}$/i;
const clip = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n); };
const lc = function (v, n) { return clip(v, n).toLowerCase(); };
const fails = {}, seen = {};
function tooMany(k, max) { const f = fails[k]; return !!(f && f.n >= (max || 8) && Date.now() - f.t < 15 * 60 * 1000); }
function noteFail(k) { const f = fails[k]; if (!f || Date.now() - f.t > 15 * 60 * 1000) fails[k] = { n: 1, t: Date.now() }; else { f.n++; f.t = Date.now(); } }
function ip(event) { return String((event.headers || {})["x-nf-client-connection-ip"] || "x"); }
const NOW = function () { return new Date().toISOString(); };

const KINDS = ["album", "sample_pack", "preset", "stems", "project_file", "bundle", "video", "digital"];
const SELLER_STATUS = ["draft", "pending_review"];
const ALL_STATUS = ["draft", "pending_review", "published", "unavailable", "rejected"];
const TYPES = { track: "music_tracks", product: "music_products", video: "music_videos" };
const httpsUrl = function (v, n) { v = clip(v, n || 600); return /^https:\/\//i.test(v) ? v : null; };
const isLive = function (type, x) { return x.status === "published" && (type !== "product" || !x.publish_at || x.preorder === true || new Date(x.publish_at).getTime() <= Date.now()); };
// Credits/splits are a record shown on the listing (who made it, what share they agreed). They never move money: payouts follow the fee rules.
function collabs(v) {
  if (!Array.isArray(v)) return { ok: true, list: [] };
  const list = v.slice(0, 8).map(function (c) { return { name: clip(c && c.name, 60), role: clip(c && c.role, 40), pct: Math.round(Number(c && c.pct) * 100) / 100 }; }).filter(function (c) { return c.name; });
  if (!list.length) return { ok: true, list: [] };
  if (list.some(function (c) { return !(c.pct > 0 && c.pct <= 100); })) return { ok: false, error: "Each collaborator share must be between 0 and 100" };
  const sum = Math.round(list.reduce(function (a, c) { return a + c.pct; }, 0) * 100) / 100;
  return sum === 100 ? { ok: true, list: list } : { ok: false, error: "Collaborator shares must add up to 100 (now " + sum + ")" };
}

function pubTrack(x) { return { id: x.id, title: x.title, album: x.album, audio_url: x.audio_url, cover_url: x.cover_url, genre: x.genre, mood: x.mood, explicit: x.explicit, description: x.description, release_date: x.release_date, collaborators: x.collaborators || [], plays: x.plays, featured: x.featured, producer_id: x.producer_id, artist: x.beat_producers && x.beat_producers.name, slug: x.beat_producers && x.beat_producers.slug, label: "Free stream" }; }
function pubProduct(x) { return { id: x.id, kind: x.kind, title: x.title, description: x.description, cover_url: x.cover_url, price_cents: x.price_cents, preview_url: x.preview_url, tags: x.tags || [], rights_text: x.rights_text, sample_disclosure: x.sample_disclosure, featured: x.featured, limited_qty: x.limited_qty, preorder: !!(x.preorder && x.publish_at && new Date(x.publish_at).getTime() > Date.now()), releases: x.preorder && x.publish_at ? x.publish_at : null, collaborators: x.collaborators || [], left: x.limited_qty == null ? null : Math.max(0, x.limited_qty - (x.sold_count || 0)), producer_id: x.producer_id, artist: x.beat_producers && x.beat_producers.name, slug: x.beat_producers && x.beat_producers.slug, label: "Paid download" }; }
function pubVideo(x) { return { id: x.id, title: x.title, description: x.description, video_url: x.video_url, thumb_url: x.thumb_url, track_id: x.track_id, views: x.views, featured: x.featured, producer_id: x.producer_id, artist: x.beat_producers && x.beat_producers.name, slug: x.beat_producers && x.beat_producers.slug }; }
const PRODSEL = "*,beat_producers(name,slug,verified)";
const liveNow = "status=eq.published";

async function sellerFrom(event) {
  const pt = B.verifyProducer(B.bearer(event)); if (!pt) return null;
  const r = await B.sb("beat_producers?id=eq." + pt.pid + "&select=*");
  const p = r.ok && Array.isArray(r.data) && r.data[0];
  return p && p.active ? p : null;
}
async function userFrom(event) {
  const u = M.verifyUser(B.bearer(event)); if (!u) return null;
  const r = await B.sb("music_users?id=eq." + u.uid + "&select=id,email,name,active,marketing_opt_in");
  const x = r.ok && Array.isArray(r.data) && r.data[0];
  return x && x.active ? x : null;
}

// Validate + build a row for a seller's/admin's item. role: "seller" (needs approval) | "trusted" (platform store admin or owner).
function itemRow(type, b, cur, role) {
  const row = {};
  const title = clip(b.title !== undefined ? b.title : cur && cur.title, 140); if (!title) return { error: "Enter a title" };
  row.title = title;
  if (b.description !== undefined) row.description = clip(b.description, 3000) || null;
  if (b.cover_url !== undefined) row.cover_url = httpsUrl(b.cover_url);
  let status = b.status !== undefined ? String(b.status) : (cur ? cur.status : "draft");
  if (ALL_STATUS.indexOf(status) < 0) return { error: "Unknown status" };
  if (role === "seller" && SELLER_STATUS.indexOf(status) < 0 && !(cur && cur.status === status && status === "published")) return { error: "You can save a draft or submit for review. POTENT approves what goes live." };
  row.status = status;
  if (type === "track") {
    if (b.album !== undefined) row.album = clip(b.album, 140) || null;
    if (b.audio_url !== undefined) row.audio_url = httpsUrl(b.audio_url);
    if (b.genre !== undefined) row.genre = lc(b.genre, 40) || null;
    if (b.mood !== undefined) row.mood = lc(b.mood, 40) || null;
    if (b.explicit !== undefined) row.explicit = !!b.explicit;
    if (b.collaborators !== undefined) { const c = collabs(b.collaborators); if (!c.ok) return { error: c.error }; row.collaborators = c.list; }
    if (b.release_date !== undefined) row.release_date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.release_date)) ? b.release_date : null;
    const fin = Object.assign({}, cur || {}, row);
    if (["published", "pending_review"].indexOf(status) >= 0 && !fin.audio_url) return { error: "Add the audio file first" };
  } else if (type === "product") {
    if (b.kind !== undefined) { if (KINDS.indexOf(b.kind) < 0) return { error: "Pick a product type" }; row.kind = b.kind; }
    if (b.price_cents !== undefined) { const n = Math.round(Number(b.price_cents)); if (!(n >= 100 && n <= 5000000)) return { error: "Price must be $1 or more" }; row.price_cents = n; }
    if (!cur && row.price_cents === undefined) return { error: "Set a price ($1 or more)" };
    if (b.file_ref !== undefined) { const f = clip(b.file_ref, 500); row.file_ref = /^storage:beat-files\/[0-9a-f-]{36}\//i.test(f) && f.indexOf(ctxPid(b)) > 0 ? f : null; }
    if (b.preview_url !== undefined) row.preview_url = httpsUrl(b.preview_url);
    if (Array.isArray(b.tags)) row.tags = b.tags.map(function (t) { return lc(t, 30); }).filter(Boolean).slice(0, 12);
    if (b.rights_text !== undefined) row.rights_text = clip(b.rights_text, 3000) || null;
    if (b.sample_disclosure !== undefined) row.sample_disclosure = clip(b.sample_disclosure, 2000) || null;
    if (b.rights_confirmed !== undefined) row.rights_confirmed = !!b.rights_confirmed;
    if (b.limited_qty !== undefined) { const q = b.limited_qty === "" || b.limited_qty == null ? null : Math.round(Number(b.limited_qty)); if (q !== null && !(q >= 1 && q <= 1000000)) return { error: "Limited quantity must be 1 or more" }; row.limited_qty = q; }
    if (b.publish_at !== undefined) { const d = b.publish_at ? new Date(b.publish_at) : null; row.publish_at = d && isFinite(d.getTime()) ? d.toISOString() : null; }
    if (b.collaborators !== undefined) { const c = collabs(b.collaborators); if (!c.ok) return { error: c.error }; row.collaborators = c.list; }
    if (b.preorder !== undefined) row.preorder = !!b.preorder;
    const fin = Object.assign({}, cur || {}, row);
    if (fin.preorder && ["published", "pending_review"].indexOf(status) >= 0 && !(fin.publish_at && new Date(fin.publish_at).getTime() > Date.now())) return { error: "A preorder needs a release date in the future" };
    if (["published", "pending_review"].indexOf(status) >= 0) {
      if (!fin.file_ref) return { error: "Add the file buyers receive after paying" };
      if (!fin.rights_confirmed) return { error: "Confirm you own or are authorized to sell everything in this product" };
      if (!clip(fin.rights_text, 3000)) return { error: "Describe what rights the buyer gets" };
    }
  } else if (type === "video") {
    if (b.video_url !== undefined) row.video_url = httpsUrl(b.video_url);
    if (b.thumb_url !== undefined) row.thumb_url = httpsUrl(b.thumb_url);
    if (b.track_id !== undefined) row.track_id = UUID.test(String(b.track_id || "")) ? b.track_id : null;
    const fin = Object.assign({}, cur || {}, row);
    if (!fin.video_url) return { error: "Add a video link (YouTube, Vimeo or a direct https video file)" };
  }
  return { row: row };
}
let _pid = ""; function ctxPid(b) { return _pid; }

const PUBLIC_GET = ["home","browse","artist"];
// Public read-only actions can be fetched with GET so Netlify's CDN caches them for a minute: far fewer function runs and database reads.
exports.handler = async function (event) {
  if (event.httpMethod === "GET") {
    const q = event.queryStringParameters || {};
    if (PUBLIC_GET.indexOf(q.action) < 0) return B.J(405, { error: "POST only" });
    const body = {}; Object.keys(q).forEach(function (k) { body[k] = q[k] === "true" ? true : q[k] === "false" ? false : q[k]; });
    const r = await core({ httpMethod: "POST", headers: event.headers || {}, body: JSON.stringify(body) });
    if (r.statusCode === 200) r.headers = Object.assign({}, r.headers, { "Cache-Control": "public, max-age=0, must-revalidate", "Netlify-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" });
    return r;
  }
  return core(event);
};
async function core(event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.AUTH_SECRET) return B.J(500, { error: "Server not configured" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  const a = String(b.action || "");
  const term = function (v) { return clip(v, 60).toLowerCase().replace(/[^a-z0-9 #'+-]/g, "").trim(); };

  // ───────── public: discovery ─────────
  if (a === "home") {
    const [nt, tt, ft, pr, vd, ar, pl] = await Promise.all([
      B.sb("music_tracks?" + liveNow + "&select=*,beat_producers(name,slug)&order=created_at.desc&limit=10"),
      B.sb("music_tracks?" + liveNow + "&plays=gt.0&select=*,beat_producers(name,slug)&order=plays.desc&limit=10"),
      B.sb("music_tracks?" + liveNow + "&featured=eq.true&select=*,beat_producers(name,slug)&order=created_at.desc&limit=6"),
      B.sb("music_products?" + liveNow + "&or=(publish_at.is.null,publish_at.lte." + NOW() + ",preorder.eq.true)&select=" + PRODSEL + "&order=featured.desc,created_at.desc&limit=8"),
      B.sb("music_videos?" + liveNow + "&select=*,beat_producers(name,slug)&order=featured.desc,created_at.desc&limit=6"),
      B.sb("beat_producers?active=eq.true&slug=not.is.null&select=id,name,slug,avatar_url,city,verified&order=created_at.desc&limit=12"),
      B.sb("music_playlists?curated=eq.true&is_public=eq.true&select=id,title,description&order=created_at.desc&limit=8")
    ]);
    const L = function (r) { return Array.isArray(r.data) ? r.data : []; };
    const site = (await B.getSetting("music_home")) || {};
    return B.J(200, { ok: true, site: { headline: clip(site.headline, 120), sub: clip(site.sub, 240), banner: clip(site.banner, 200) }, newTracks: L(nt).map(pubTrack), trending: L(tt).map(pubTrack), featured: L(ft).map(pubTrack), products: L(pr).map(pubProduct), videos: L(vd).map(pubVideo), artists: L(ar), playlists: L(pl) });
  }
  if (a === "browse") {
    const type = ["track", "product", "video", "artist"].indexOf(b.type) >= 0 ? b.type : "track";
    const q = term(b.q), limit = Math.max(1, Math.min(48, parseInt(b.limit, 10) || 24)), offset = Math.max(0, parseInt(b.offset, 10) || 0);
    let path;
    if (type === "artist") {
      path = "beat_producers?active=eq.true&slug=not.is.null&select=id,name,slug,avatar_url,city,verified,bio" + (q ? "&or=(name.ilike.*" + q + "*,city.ilike.*" + q + "*)" : "") + "&order=name.asc&limit=" + limit + "&offset=" + offset;
      const r = await B.sb(path); return B.J(200, { ok: true, items: r.data || [], more: (r.data || []).length === limit });
    }
    if (type === "track") {
      path = "music_tracks?" + liveNow + "&select=*,beat_producers(name,slug)";
      if (q) path += "&or=(title.ilike.*" + q + "*,genre.ilike.*" + q + "*,mood.ilike.*" + q + "*,album.ilike.*" + q + "*)";
      if (term(b.genre)) path += "&genre=eq." + encodeURIComponent(term(b.genre));
      if (term(b.mood)) path += "&mood=eq." + encodeURIComponent(term(b.mood));
      path += "&order=" + (b.sort === "plays" ? "plays.desc" : "created_at.desc") + "&limit=" + limit + "&offset=" + offset;
    } else if (type === "product") {
      path = "music_products?" + liveNow + "&or=(publish_at.is.null,publish_at.lte." + NOW() + ",preorder.eq.true)&select=" + PRODSEL;
      if (q) path += "&title=ilike.*" + q + "*";
      if (KINDS.indexOf(b.kind) >= 0) path += "&kind=eq." + b.kind;
      if (Number(b.price_max) > 0) path += "&price_cents=lte." + Math.round(Number(b.price_max) * 100);
      path += "&order=" + (b.sort === "price_asc" ? "price_cents.asc" : b.sort === "price_desc" ? "price_cents.desc" : "created_at.desc") + "&limit=" + limit + "&offset=" + offset;
    } else {
      path = "music_videos?" + liveNow + "&select=*,beat_producers(name,slug)" + (q ? "&title=ilike.*" + q + "*" : "") + "&order=created_at.desc&limit=" + limit + "&offset=" + offset;
    }
    const r = await B.sb(path); const rows = Array.isArray(r.data) ? r.data : [];
    return B.J(200, { ok: true, more: rows.length === limit, items: rows.map(type === "track" ? pubTrack : type === "product" ? pubProduct : pubVideo) });
  }
  if (a === "artist") {
    const slug = lc(b.slug, 60).replace(/[^a-z0-9-]/g, "");
    const pr = await B.sb("beat_producers?slug=eq." + encodeURIComponent(slug) + "&active=eq.true&select=id,name,slug,bio,avatar_url,banner_url,links,city,verified");
    const p = pr.ok && Array.isArray(pr.data) && pr.data[0]; if (!p) return B.J(404, { error: "Artist not found" });
    const [tr, pd, vd, bt, fl] = await Promise.all([
      B.sb("music_tracks?producer_id=eq." + p.id + "&" + liveNow + "&select=*,beat_producers(name,slug)&order=created_at.desc&limit=60"),
      B.sb("music_products?producer_id=eq." + p.id + "&" + liveNow + "&or=(publish_at.is.null,publish_at.lte." + NOW() + ",preorder.eq.true)&select=" + PRODSEL + "&order=created_at.desc&limit=60"),
      B.sb("music_videos?producer_id=eq." + p.id + "&" + liveNow + "&select=*,beat_producers(name,slug)&order=created_at.desc&limit=30"),
      B.sb("beat_items?producer_id=eq." + p.id + "&active=eq.true&status=eq.published&exclusive_sold=eq.false&select=id,title,exclusive_cents,cover_url,bpm,musical_key,genre&order=created_at.desc&limit=30"),
      B.sb("music_follows?producer_id=eq." + p.id + "&select=user_id&limit=100000")
    ]);
    const L = function (r) { return Array.isArray(r.data) ? r.data : []; };
    return B.J(200, { ok: true, artist: p, tracks: L(tr).map(pubTrack), products: L(pd).map(pubProduct), videos: L(vd).map(pubVideo), beats: L(bt), followers: L(fl).length });
  }
  if (a === "playlist_get") {
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    const pr = await B.sb("music_playlists?id=eq." + b.id + "&select=*"); const p = pr.ok && pr.data && pr.data[0]; if (!p) return B.J(404, { error: "Not found" });
    const u = await userFrom(event);
    if (!p.is_public && !(u && p.user_id === u.id)) return B.J(404, { error: "Not found" });
    const it = await B.sb("music_playlist_items?playlist_id=eq." + p.id + "&select=track_id,position&order=position.asc&limit=300");
    const ids = (it.data || []).map(function (x) { return x.track_id; });
    const tr = ids.length ? await B.sb("music_tracks?id=in.(" + ids.join(",") + ")&" + liveNow + "&select=*,beat_producers(name,slug)") : { data: [] };
    const by = {}; (tr.data || []).forEach(function (t) { by[t.id] = t; });
    return B.J(200, { ok: true, playlist: { id: p.id, title: p.title, description: p.description, curated: p.curated, mine: !!(u && p.user_id === u.id) }, tracks: ids.map(function (i) { return by[i]; }).filter(Boolean).map(pubTrack) });
  }
  if (a === "track_play" || a === "video_view") {
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad request" });
    const k = a + ":" + ip(event) + ":" + b.id;
    if (!seen[k] || Date.now() - seen[k] > 30 * 60 * 1000) { seen[k] = Date.now(); await B.rpc(a === "track_play" ? "music_track_play" : "music_video_view", { p_id: b.id }); }
    return B.J(200, { ok: true });
  }
  if (a === "report") { // copyright / takedown / abuse report
    const k = "report:" + ip(event); if (tooMany(k, 6)) return B.J(429, { error: "Too many reports. Try again later." }); noteFail(k);
    const kind = ["track", "product", "video", "beat"].indexOf(b.kind) >= 0 ? b.kind : null;
    if (!kind || !UUID.test(String(b.item_id || "")) || !clip(b.reason, 1500)) return B.J(400, { error: "Tell us what you are reporting and why" });
    await B.sb("music_reports", { method: "POST", prefer: "return=minimal", body: { kind: kind, item_id: b.item_id, reason: clip(b.reason, 1500), contact: clip(b.contact, 200) || null } });
    return B.J(200, { ok: true });
  }

  // ───────── buyer accounts ─────────
  if (a === "register") {
    const k = "reg:" + ip(event); if (tooMany(k, 10)) return B.J(429, { error: "Too many attempts. Try again later." }); noteFail(k);
    const email = lc(b.email, 200);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return B.J(400, { error: "Enter a valid email" });
    if (String(b.password || "").length < 10) return B.J(400, { error: "Password must be at least 10 characters" });
    const r = await B.sb("music_users", { method: "POST", prefer: "return=representation", body: { email: email, name: clip(b.name, 80) || null, password_hash: B.hashPw(b.password), marketing_opt_in: b.marketing_opt_in === true } });
    if (!r.ok) return B.J(r.status === 409 ? 409 : 500, { error: r.status === 409 ? "That email already has an account. Sign in instead." : "Could not create the account" });
    return B.J(200, { ok: true, token: M.signUser(r.data[0].id), user: { email: email, name: r.data[0].name } });
  }
  if (a === "login") {
    const email = lc(b.email, 200), k = "ulogin:" + email; if (tooMany(k)) return B.J(429, { error: "Too many attempts. Try again in 15 minutes." });
    const r = await B.sb("music_users?email=eq." + encodeURIComponent(email) + "&select=*"); const u = r.ok && Array.isArray(r.data) && r.data[0];
    if (!u || !u.active || !B.checkPw(u.password_hash, b.password)) { noteFail(k); return B.J(401, { error: "Wrong email or password" }); }
    return B.J(200, { ok: true, token: M.signUser(u.id), user: { email: u.email, name: u.name } });
  }

  const user = await userFrom(event);
  if (user && a.indexOf("o_") !== 0 && a.indexOf("s_") !== 0) {
    if (a === "me") {
      const [bs, ms, fv, fo, pl] = await Promise.all([
        B.sb("beat_sales?buyer_user_id=eq." + user.id + "&select=id,title,sale_type,gross_cents,status,created_at,agreement_version,agreement_accepted_at&order=created_at.desc&limit=200"),
        B.sb("music_sales?buyer_user_id=eq." + user.id + "&select=id,gross_cents,status,created_at,agreement_version,agreement_accepted_at,music_products(title,kind,cover_url)&order=created_at.desc&limit=200"),
        B.sb("music_favorites?user_id=eq." + user.id + "&select=kind,item_id&limit=1000"),
        B.sb("music_follows?user_id=eq." + user.id + "&select=producer_id,beat_producers(name,slug,avatar_url)&limit=500"),
        B.sb("music_playlists?user_id=eq." + user.id + "&select=id,title,description,is_public&order=created_at.desc&limit=100")
      ]);
      const L = function (r) { return Array.isArray(r.data) ? r.data : []; };
      return B.J(200, { ok: true, user: { email: user.email, name: user.name, marketing_opt_in: user.marketing_opt_in },
        library: L(bs).map(function (x) { return { kind: "beat", id: x.id, title: x.title, type: "Exclusive master", gross_cents: x.gross_cents, status: x.status, date: x.created_at, agreement_version: x.agreement_version, agreement_at: x.agreement_accepted_at }; })
          .concat(L(ms).map(function (x) { return { kind: "product", id: x.id, title: x.music_products && x.music_products.title, type: x.music_products && x.music_products.kind, cover_url: x.music_products && x.music_products.cover_url, gross_cents: x.gross_cents, status: x.status, date: x.created_at, agreement_version: x.agreement_version, agreement_at: x.agreement_accepted_at }; })),
        favorites: L(fv), follows: L(fo), playlists: L(pl) });
    }
    if (a === "favs") { // resolve the buyer's favorites into real, still-live items
      const fv = await B.sb("music_favorites?user_id=eq." + user.id + "&select=kind,item_id&limit=500");
      const ids = function (k) { return (fv.data || []).filter(function (f) { return f.kind === k; }).map(function (f) { return f.item_id; }); };
      const t = ids("track"), p = ids("product");
      const [tr, pd] = await Promise.all([t.length ? B.sb("music_tracks?id=in.(" + t.join(",") + ")&status=eq.published&select=*,beat_producers(name,slug)") : { data: [] }, p.length ? B.sb("music_products?id=in.(" + p.join(",") + ")&status=eq.published&select=" + PRODSEL) : { data: [] }]);
      return B.J(200, { ok: true, tracks: (tr.data || []).map(pubTrack), products: (pd.data || []).map(pubProduct) });
    }
    if (a === "fav_toggle") {
      const kind = ["beat", "track", "product"].indexOf(b.kind) >= 0 ? b.kind : null; if (!kind || !UUID.test(String(b.item_id || ""))) return B.J(400, { error: "Bad request" });
      const ex = await B.sb("music_favorites?user_id=eq." + user.id + "&kind=eq." + kind + "&item_id=eq." + b.item_id + "&select=item_id");
      if (Array.isArray(ex.data) && ex.data.length) { await B.sb("music_favorites?user_id=eq." + user.id + "&kind=eq." + kind + "&item_id=eq." + b.item_id, { method: "DELETE", prefer: "return=minimal" }); return B.J(200, { ok: true, on: false }); }
      await B.sb("music_favorites", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { user_id: user.id, kind: kind, item_id: b.item_id } });
      return B.J(200, { ok: true, on: true });
    }
    if (a === "follow_toggle") {
      if (!UUID.test(String(b.producer_id || ""))) return B.J(400, { error: "Bad request" });
      const ex = await B.sb("music_follows?user_id=eq." + user.id + "&producer_id=eq." + b.producer_id + "&select=user_id");
      if (Array.isArray(ex.data) && ex.data.length) { await B.sb("music_follows?user_id=eq." + user.id + "&producer_id=eq." + b.producer_id, { method: "DELETE", prefer: "return=minimal" }); return B.J(200, { ok: true, on: false }); }
      await B.sb("music_follows", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { user_id: user.id, producer_id: b.producer_id } });
      return B.J(200, { ok: true, on: true });
    }
    if (a === "playlist_save") {
      const title = clip(b.title, 80); if (!title) return B.J(400, { error: "Name your playlist" });
      if (b.id) { if (!UUID.test(String(b.id))) return B.J(400, { error: "Bad id" }); await B.sb("music_playlists?id=eq." + b.id + "&user_id=eq." + user.id, { method: "PATCH", prefer: "return=minimal", body: { title: title, description: clip(b.description, 300) || null, is_public: b.is_public === true } }); return B.J(200, { ok: true }); }
      const r = await B.sb("music_playlists", { method: "POST", prefer: "return=representation", body: { user_id: user.id, title: title, description: clip(b.description, 300) || null, is_public: b.is_public === true } });
      return B.J(r.ok ? 200 : 500, r.ok ? { ok: true, id: r.data[0].id } : { error: "Could not create the playlist" });
    }
    if (a === "playlist_add" || a === "playlist_remove" || a === "playlist_delete") {
      if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
      const own = await B.sb("music_playlists?id=eq." + b.id + "&user_id=eq." + user.id + "&select=id"); if (!(own.data && own.data.length)) return B.J(404, { error: "Not found" });
      if (a === "playlist_delete") { await B.sb("music_playlists?id=eq." + b.id, { method: "DELETE", prefer: "return=minimal" }); return B.J(200, { ok: true }); }
      if (!UUID.test(String(b.track_id || ""))) return B.J(400, { error: "Bad track" });
      if (a === "playlist_remove") { await B.sb("music_playlist_items?playlist_id=eq." + b.id + "&track_id=eq." + b.track_id, { method: "DELETE", prefer: "return=minimal" }); return B.J(200, { ok: true }); }
      const cnt = await B.sb("music_playlist_items?playlist_id=eq." + b.id + "&select=track_id&limit=500");
      await B.sb("music_playlist_items", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { playlist_id: b.id, track_id: b.track_id, position: (cnt.data || []).length } });
      return B.J(200, { ok: true });
    }
    if (a === "download") { // only the buyer of a completed, non-refunded sale gets a (5 minute) link
      if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
      if (b.kind === "beat") {
        const s = await B.sb("beat_sales?id=eq." + b.id + "&buyer_user_id=eq." + user.id + "&status=eq.complete&select=beat_id");
        const sale = s.data && s.data[0]; if (!sale) return B.J(404, { error: "Not found" });
        const it = await B.sb("beat_items?id=eq." + sale.beat_id + "&select=title,deliver_url"); const x = it.data && it.data[0];
        const url = x && await M.signedUrl(x.deliver_url, 300); if (!url) return B.J(404, { error: "File not available. Contact POTENT." });
        await B.audit("buyer:" + user.email, "download", sale.beat_id, { kind: "beat" }); return B.J(200, { ok: true, url: url, title: x.title });
      }
      const s = await B.sb("music_sales?id=eq." + b.id + "&buyer_user_id=eq." + user.id + "&status=eq.complete&select=product_id");
      const sale = s.data && s.data[0]; if (!sale) return B.J(404, { error: "Not found" });
      const it = await B.sb("music_products?id=eq." + sale.product_id + "&select=title,file_ref,publish_at,preorder"); const x = it.data && it.data[0];
      if (x && x.publish_at && new Date(x.publish_at).getTime() > Date.now()) return B.J(409, { error: "This is a preorder. Your download unlocks on " + new Date(x.publish_at).toDateString() + "." });
      const url = x && await M.signedUrl(x.file_ref, 300); if (!url) return B.J(404, { error: "File not available. Contact POTENT." });
      await B.audit("buyer:" + user.email, "download", sale.product_id, { kind: "product" }); return B.J(200, { ok: true, url: url, title: x.title });
    }
    if (a === "changepw") {
      const r = await B.sb("music_users?id=eq." + user.id + "&select=password_hash");
      if (!B.checkPw(r.data[0].password_hash, b.oldPassword)) return B.J(401, { error: "Current password is wrong" });
      if (String(b.newPassword || "").length < 10) return B.J(400, { error: "New password must be at least 10 characters" });
      await B.sb("music_users?id=eq." + user.id, { method: "PATCH", prefer: "return=minimal", body: { password_hash: B.hashPw(b.newPassword) } }); return B.J(200, { ok: true });
    }
    if (a === "set_optin") { await B.sb("music_users?id=eq." + user.id, { method: "PATCH", prefer: "return=minimal", body: { marketing_opt_in: b.value === true } }); return B.J(200, { ok: true }); }
    return B.J(400, { error: "Unknown action" });
  }

  if (a === "support_new") {
    const k = "sup:" + ip(event); if (tooMany(k, 5)) return B.J(429, { error: "Too many messages. Try again later." }); noteFail(k);
    const email = lc(b.email, 160), msg = clip(b.message, 3000);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || msg.length < 5) return B.J(400, { error: "Enter your email and a message" });
    const topic = ["order", "download", "refund", "seller", "report", "other"].indexOf(b.topic) >= 0 ? b.topic : "other";
    const r = await B.sb("music_support", { method: "POST", prefer: "return=minimal", body: { name: clip(b.name, 80) || null, email: email, topic: topic, message: msg } });
    return r.ok ? B.J(200, { ok: true }) : B.J(500, { error: "Could not send. Please try again." });
  }
  if (a === "unsubscribe") {
    const uid = M.verifyUnsub(clip(b.t, 400)); if (!uid) return B.J(400, { error: "This link is not valid" });
    await B.sb("music_users?id=eq." + uid, { method: "PATCH", prefer: "return=minimal", body: { marketing_opt_in: false } }); return B.J(200, { ok: true });
  }

  // guest receipt after checkout: verified with Stripe, shows the buyer their download
  if (a === "delivery") {
    const sid = clip(b.session_id, 200); if (!/^cs_/.test(sid) || !process.env.STRIPE_SECRET_KEY) return B.J(400, { error: "Bad request" });
    try {
      const s = await require("stripe")(process.env.STRIPE_SECRET_KEY).checkout.sessions.retrieve(sid);
      if (!s || s.payment_status !== "paid" || !s.metadata || s.metadata.product !== "MUSIC") return B.J(402, { error: "Payment not found" });
      const sl = await B.sb("music_sales?stripe_session_id=like." + encodeURIComponent(sid) + "*&select=status,product_id");
      const sales = (Array.isArray(sl.data) ? sl.data : []).filter(function (x) { return x.status === "complete"; });
      if (!sales.length) return B.J(sl.data && sl.data.length ? 409 : 202, { error: sl.data && sl.data.length ? "This order was refunded" : "Your payment is confirmed. Your downloads are being prepared, refresh in a moment." });
      const downloads = [];
      for (const sale of sales) {
        const it = await B.sb("music_products?id=eq." + sale.product_id + "&select=title,file_ref,publish_at"); const x = it.data && it.data[0]; if (!x) continue;
        const pre = x.publish_at && new Date(x.publish_at).getTime() > Date.now();
        downloads.push({ title: x.title, url: pre ? null : await M.signedUrl(x.file_ref, 3600), releases: pre ? x.publish_at : null });
      }
      return B.J(200, { ok: true, downloads: downloads, title: downloads[0] && downloads[0].title, url: downloads[0] && downloads[0].url });
    } catch (e) { return B.J(500, { error: "Could not verify payment" }); }
  }

  // ───────── creator studio (sellers + platform producers) ─────────
  const seller = await sellerFrom(event);
  if (seller && a.indexOf("o_") !== 0) {
    const trusted = seller.kind !== "seller" && seller.store_admin;
    _pid = seller.id;
    if (a === "s_my") {
      const [pf, tr, pd, vd, sl] = await Promise.all([
        B.sb("beat_producers?id=eq." + seller.id + "&select=id,name,slug,bio,avatar_url,banner_url,links,city,verified,kind,store_admin"),
        B.sb("music_tracks?producer_id=eq." + seller.id + "&select=*&order=created_at.desc&limit=200"),
        B.sb("music_products?producer_id=eq." + seller.id + "&select=*&order=created_at.desc&limit=200"),
        B.sb("music_videos?producer_id=eq." + seller.id + "&select=*&order=created_at.desc&limit=100"),
        B.sb("music_sales?producer_id=eq." + seller.id + "&select=gross_cents,tax_cents,discount_cents,eligible_cents,platform_fee_cents,seller_cents,refunded_cents,status,created_at,music_products(title)&order=created_at.desc&limit=2000")
      ]);
      return B.J(200, { ok: true, profile: pf.data[0], tracks: tr.data || [], products: pd.data || [], videos: vd.data || [], sales: sl.data || [], trusted: trusted, feeNote: "POTENT's fee is 1% of the eligible amount (sale minus tax). You keep the rest. Card-processing fees are Stripe's and are shown separately." });
    }
    if (a === "s_profile") {
      const slug = lc(b.slug, 40).replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
      if (slug && (slug.length < 3 || ["admin", "api", "music", "beats", "account", "studio", "artist"].indexOf(slug) >= 0)) return B.J(400, { error: "Pick a web name of 3+ letters/numbers" });
      const links = {}; ["instagram", "youtube", "tiktok", "soundcloud", "spotify", "website"].forEach(function (k) { const v = httpsUrl(b[k], 300); if (v) links[k] = v; });
      const patch = { bio: clip(b.bio, 1200) || null, city: clip(b.city, 60) || null, links: links, avatar_url: httpsUrl(b.avatar_url), banner_url: httpsUrl(b.banner_url) };
      if (slug) patch.slug = slug;
      const r = await B.sb("beat_producers?id=eq." + seller.id, { method: "PATCH", prefer: "return=minimal", body: patch });
      if (!r.ok) return B.J(r.status === 409 ? 409 : 500, { error: r.status === 409 ? "That web name is taken" : "Could not save" });
      return B.J(200, { ok: true });
    }
    if (a === "s_upload_url") {
      const kind = ["audio", "cover", "file", "video"].indexOf(b.kind) >= 0 ? b.kind : "cover";
      const name = clip(b.name, 120).replace(/[^A-Za-z0-9._-]/g, "_");
      const rx = { audio: /\.(mp3|wav|m4a|ogg)$/i, cover: /\.(jpe?g|png|webp)$/i, file: /\.(mp3|wav|m4a|flac|zip|pdf|mp4|mov)$/i, video: /\.(mp4|webm|mov)$/i }[kind];
      if (!rx.test(name)) return B.J(400, { error: "That file type is not allowed for " + kind });
      const bucket = kind === "file" ? "beat-files" : "beat-previews", path = seller.id + "/" + kind + "-" + Date.now() + "-" + name;
      const sg = await fetch(B.SB + "/storage/v1/object/upload/sign/" + bucket + "/" + path, { method: "POST", headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: "{}" });
      const sj = await sg.json().catch(function () { return {}; });
      if (!sg.ok || !sj.url) return B.J(500, { error: "Uploads are not set up yet." });
      return B.J(200, { ok: true, uploadUrl: B.SB + "/storage/v1" + sj.url, ref: kind === "file" ? "storage:" + bucket + "/" + path : B.SB + "/storage/v1/object/public/" + bucket + "/" + path });
    }
    if (a === "s_item") {
      const type = TYPES[b.type] ? b.type : null; if (!type) return B.J(400, { error: "Bad type" });
      let cur = null;
      if (b.id) { if (!UUID.test(String(b.id))) return B.J(400, { error: "Bad id" }); const c = await B.sb(TYPES[type] + "?id=eq." + b.id + "&producer_id=eq." + seller.id + "&select=*"); cur = c.data && c.data[0]; if (!cur) return B.J(404, { error: "Not found" }); }
      // A product that has sales keeps its price, file and rights: buyers' deals are protected.
      if (cur && type === "product" && cur.sold_count > 0) { ["price_cents", "file_ref", "rights_text", "rights_confirmed", "kind"].forEach(function (k) { delete b[k]; }); }
      const v = itemRow(type, b, cur, trusted ? "trusted" : "seller"); if (v.error) return B.J(400, { error: v.error });
      if (v.row.status === "published" && !trusted && !(cur && cur.status === "published")) return B.J(400, { error: "POTENT approves what goes live." });
      if (!cur) { v.row.producer_id = seller.id; const r = await B.sb(TYPES[type], { method: "POST", prefer: "return=representation", body: v.row }); if (!r.ok) return B.J(500, { error: "Could not save" }); await B.audit("seller:" + seller.email, type + "_add", r.data[0].id, { status: v.row.status }); }
      else { const r = await B.sb(TYPES[type] + "?id=eq." + cur.id + "&producer_id=eq." + seller.id, { method: "PATCH", prefer: "return=minimal", body: v.row }); if (!r.ok) return B.J(500, { error: "Could not save" }); await B.audit("seller:" + seller.email, type + "_edit", cur.id, { status: v.row.status }); }
      return B.J(200, { ok: true });
    }
    if (a === "s_archive") { // unpublish; files stay available to people who already bought
      const type = TYPES[b.type] ? b.type : null; if (!type || !UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad request" });
      await B.sb(TYPES[type] + "?id=eq." + b.id + "&producer_id=eq." + seller.id, { method: "PATCH", prefer: "return=minimal", body: { status: "unavailable" } });
      await B.audit("seller:" + seller.email, type + "_unpublish", b.id, null); return B.J(200, { ok: true });
    }
    return B.J(400, { error: "Unknown action" });
  }

  // ───────── owner ─────────
  if (!a || a.indexOf("o_") !== 0) return B.J(401, { error: "Sign in first" });
  const owner = B.verifyOwner(B.bearer(event)); if (!owner) return B.J(403, { error: "POTENT owner only" });
  if (a === "o_queue") {
    const [tr, pd, vd, rp] = await Promise.all([
      B.sb("music_tracks?status=eq.pending_review&select=*,beat_producers(name)&order=created_at.asc&limit=100"),
      B.sb("music_products?status=eq.pending_review&select=*,beat_producers(name)&order=created_at.asc&limit=100"),
      B.sb("music_videos?status=eq.pending_review&select=*,beat_producers(name)&order=created_at.asc&limit=100"),
      B.sb("music_reports?status=eq.open&select=*&order=created_at.desc&limit=100")]);
    return B.J(200, { ok: true, tracks: tr.data || [], products: pd.data || [], videos: vd.data || [], reports: rp.data || [] });
  }
  if (a === "o_set_status") {
    const type = TYPES[b.type] ? b.type : null; if (!type || !UUID.test(String(b.id || "")) || ALL_STATUS.indexOf(b.status) < 0) return B.J(400, { error: "Bad request" });
    await B.sb(TYPES[type] + "?id=eq." + b.id, { method: "PATCH", prefer: "return=minimal", body: Object.assign({ status: b.status }, b.featured !== undefined ? { featured: !!b.featured } : {}) });
    await B.audit("owner", type + "_status", b.id, { status: b.status, note: clip(b.note, 300) }); return B.J(200, { ok: true });
  }
  if (a === "o_takedown") { // report resolved: optionally take the item down
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    const g = await B.sb("music_reports?id=eq." + b.id + "&select=*"); const rp = g.data && g.data[0]; if (!rp) return B.J(404, { error: "Not found" });
    if (b.remove === true) { const tbl = { track: "music_tracks", product: "music_products", video: "music_videos", beat: "beat_items" }[rp.kind]; if (tbl) await B.sb(tbl + "?id=eq." + rp.item_id, { method: "PATCH", prefer: "return=minimal", body: { status: "unavailable" } }); }
    await B.sb("music_reports?id=eq." + b.id, { method: "PATCH", prefer: "return=minimal", body: { status: b.remove === true ? "removed" : "dismissed" } });
    await B.audit("owner", "report_" + (b.remove ? "takedown" : "dismissed"), rp.item_id, { kind: rp.kind }); return B.J(200, { ok: true });
  }
  if (a === "o_playlist_save") { // POTENT-curated playlist
    const title = clip(b.title, 80); if (!title) return B.J(400, { error: "Name the playlist" });
    const ids = (Array.isArray(b.track_ids) ? b.track_ids : []).filter(function (x) { return UUID.test(String(x)); }).slice(0, 100);
    let id = UUID.test(String(b.id || "")) ? b.id : null;
    if (id) await B.sb("music_playlists?id=eq." + id + "&curated=eq.true", { method: "PATCH", prefer: "return=minimal", body: { title: title, description: clip(b.description, 300) || null, is_public: b.is_public !== false } });
    else { const r = await B.sb("music_playlists", { method: "POST", prefer: "return=representation", body: { title: title, description: clip(b.description, 300) || null, curated: true, is_public: b.is_public !== false } }); if (!r.ok) return B.J(500, { error: "Could not save" }); id = r.data[0].id; }
    await B.sb("music_playlist_items?playlist_id=eq." + id, { method: "DELETE", prefer: "return=minimal" });
    if (ids.length) await B.sb("music_playlist_items", { method: "POST", prefer: "return=minimal", body: ids.map(function (t, i) { return { playlist_id: id, track_id: t, position: i }; }) });
    await B.audit("owner", "playlist_save", id, { tracks: ids.length }); return B.J(200, { ok: true, id: id });
  }
  if (a === "o_support_list") { const r = await B.sb("music_support?status=eq." + (b.status === "resolved" ? "resolved" : "open") + "&select=*&order=created_at.desc&limit=200"); return B.J(200, { ok: true, items: r.data || [] }); }
  if (a === "o_support_resolve") { if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" }); await B.sb("music_support?id=eq." + b.id, { method: "PATCH", prefer: "return=minimal", body: { status: b.reopen ? "open" : "resolved" } }); await B.audit("owner", "support_" + (b.reopen ? "reopen" : "resolve"), b.id, null); return B.J(200, { ok: true }); }
  if (a === "o_home_get") return B.J(200, { ok: true, site: (await B.getSetting("music_home")) || {} });
  if (a === "o_home_set") { await B.setSetting("music_home", { headline: clip(b.headline, 120), sub: clip(b.sub, 240), banner: clip(b.banner, 200) }); await B.audit("owner", "home_edit", "music_home", null); return B.J(200, { ok: true }); }
  if (a === "o_users") {
    const q = lc(b.q, 80).replace(/[^a-z0-9@._+-]/g, "");
    const r = await B.sb("music_users?select=id,email,active,marketing_opt_in,created_at" + (q ? "&email=ilike.*" + q + "*" : "") + "&order=created_at.desc&limit=100");
    return B.J(200, { ok: true, users: r.data || [] });
  }
  if (a === "o_user_resetpw") { // owner-assisted reset (no email service connected yet): sets a one-time temporary password to give the buyer
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    const temp = require("crypto").randomBytes(9).toString("base64").replace(/[^A-Za-z0-9]/g, "x") + "9a";
    const r = await B.sb("music_users?id=eq." + b.id, { method: "PATCH", prefer: "return=representation", body: { password_hash: B.hashPw(temp) } });
    if (!r.ok || !Array.isArray(r.data) || !r.data[0]) return B.J(404, { error: "User not found" });
    await B.audit("owner", "user_pw_reset", b.id, null); return B.J(200, { ok: true, temp: temp, email: r.data[0].email });
  }
  if (a === "o_user_active") { if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" }); await B.sb("music_users?id=eq." + b.id, { method: "PATCH", prefer: "return=minimal", body: { active: b.active === true } }); await B.audit("owner", "user_active", b.id, { active: b.active === true }); return B.J(200, { ok: true }); }
  if (a === "o_email_export") { // opted-in buyers with their own one-click unsubscribe links (sending needs an email provider)
    const r = await B.sb("music_users?marketing_opt_in=eq.true&active=eq.true&select=id,email&limit=100000");
    const rows = (r.data || []).map(function (u) { return u.email + "," + B.SITE + "/music/unsubscribe.html?t=" + M.signUnsub(u.id); });
    await B.audit("owner", "email_export", "music_users", { n: rows.length }); return B.J(200, { ok: true, count: rows.length, csv: "email,unsubscribe_url\n" + rows.join("\n") });
  }
  if (a === "o_music_stats") {
    const [ms, tr, us] = await Promise.all([B.sb("music_sales?select=status,gross_cents,eligible_cents,platform_fee_cents,seller_cents,refunded_cents&limit=10000"), B.sb("music_tracks?select=status,plays&limit=10000"), B.sb("music_users?select=id&limit=100000")]);
    let gross = 0, elig = 0, plat = 0, sell = 0, ref = 0, n = 0; (ms.data || []).forEach(function (x) { ref += x.refunded_cents || 0; if (x.status === "complete") { n++; gross += x.gross_cents; elig += x.eligible_cents; plat += x.platform_fee_cents; sell += x.seller_cents; } });
    const live = (tr.data || []).filter(function (x) { return x.status === "published"; });
    return B.J(200, { ok: true, productSales: n, grossCents: gross, eligibleCents: elig, platformCents: plat, sellerCents: sell, refundsCents: ref, tracksLive: live.length, plays: live.reduce(function (s, x) { return s + (x.plays || 0); }, 0), buyers: (us.data || []).length });
  }
  return B.J(400, { error: "Unknown action" });
}
