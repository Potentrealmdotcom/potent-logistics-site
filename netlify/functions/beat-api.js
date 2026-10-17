// Beat Man API: producer login + wallet, owner admin, public beat catalog, post-purchase delivery.
// POST JSON { action, ... }.  Producer calls send  Authorization: Bearer <producer token>.
// Owner calls send the normal POTENT owner staff token (from auth.js action "staff").
const B = require("./lib/beats");

const METHODS = ["paypal", "airtm", "zinli", "usdt", "binance", "westernunion", "wise", "zelle", "other"];
const UUID = /^[0-9a-f-]{36}$/i;
const clip = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n); };
const MIN_PAYOUT = Number(process.env.BEAT_MIN_PAYOUT_CENTS) || 2500;
const fails = {};
const played = {};
function tooMany(k) { const f = fails[k]; return !!(f && f.n >= 8 && Date.now() - f.t < 15 * 60 * 1000); }
function noteFail(k) { const f = fails[k]; if (!f || Date.now() - f.t > 15 * 60 * 1000) fails[k] = { n: 1, t: Date.now() }; else { f.n++; f.t = Date.now(); } }
function money(v) { const n = Math.round(Number(v)); return isFinite(n) ? n : NaN; }
function pubProducer(p) { return { id: p.id, name: p.name, email: p.email, country: p.country, payout_method: p.payout_method, payout_handle: p.payout_handle, splits: p.splits, hold_days: p.hold_days, deduct_fees: p.deduct_fees, active: p.active, store_admin: p.store_admin, kind: p.kind, verified: p.verified }; }
function pubBeat(b) { return { id: b.id, title: b.title, lease_cents: b.lease_cents, exclusive_cents: b.exclusive_cents, preview_url: b.preview_url, deliver_url: b.deliver_url, exclusive_sold: b.exclusive_sold, active: b.active, status: b.status, genre: b.genre, mood: b.mood, tags: b.tags, bpm: b.bpm, musical_key: b.musical_key, explicit: b.explicit, has_vocal_samples: b.has_vocal_samples, description: b.description, sample_disclosure: b.sample_disclosure, rights_confirmed: b.rights_confirmed, rights_package: b.rights_package, cover_url: b.cover_url, play_count: b.play_count }; }

const STATUSES = ["draft", "processing", "pending_review", "approved", "published", "unavailable", "rejected"];
const DEFAULT_RIGHTS = "Exclusive rights to the master recording of this instrumental: the finished instrumental recording and the audio files listed under 'What you get'. You may use it in new recordings and release them commercially. Only one buyer ever gets this beat. Ownership of the underlying composition (melody and arrangement) and any publishing share stays with the producer unless the listing says otherwise.";
const pickKey = function (o, ks) { const r = {}; ks.forEach(function (k) { if (o[k] !== undefined) r[k] = o[k]; }); return r; };

async function uploadSign(pid, b) {
  const kind = b.kind === "deliver" ? "deliver" : b.kind === "cover" ? "cover" : "preview";
  const name = clip(b.name, 120).replace(/[^A-Za-z0-9._-]/g, "_");
  const ok = kind === "preview" ? /\.(mp3|wav|m4a|ogg)$/i : kind === "cover" ? /\.(jpe?g|png|webp)$/i : /\.(mp3|wav|m4a|flac|zip)$/i;
  if (!ok.test(name)) return B.J(400, { error: kind === "preview" ? "Preview must be MP3, WAV, M4A or OGG" : kind === "cover" ? "Artwork must be JPG, PNG or WEBP" : "Files must be MP3, WAV, M4A, FLAC or ZIP" });
  const bucket = kind === "deliver" ? "beat-files" : "beat-previews", path = pid + "/" + (kind === "cover" ? "cover-" : "") + Date.now() + "-" + name;
  const sg = await fetch(B.SB + "/storage/v1/object/upload/sign/" + bucket + "/" + path, { method: "POST", headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: "{}" });
  const sj = await sg.json().catch(function () { return {}; });
  if (!sg.ok || !sj.url) return B.J(500, { error: "Uploads are not set up yet. Run the beat-uploads SQL in Supabase." });
  return B.J(200, { ok: true, uploadUrl: B.SB + "/storage/v1" + sj.url, ref: kind === "deliver" ? "storage:" + bucket + "/" + path : B.SB + "/storage/v1/object/public/" + bucket + "/" + path });
}

// role: "owner" | "store" (store admin) | "seller" (approved third party). cur = existing row when editing.
function beatRow(b, pid, ctx) {
  ctx = ctx || {}; const role = ctx.role || "owner", cur = ctx.cur || null;
  if (cur && cur.exclusive_sold) { // a sold exclusive: files, rights and price are frozen so the buyer's deal cannot be undermined
    const r = {}; if (b.description !== undefined) r.description = clip(b.description, 3000) || null; if (b.internal_notes !== undefined && role !== "seller") r.internal_notes = clip(b.internal_notes, 3000) || null;
    return { row: r, locked: true };
  }
  const title = clip(b.title !== undefined ? b.title : cur && cur.title, 120);
  if (!title) return { error: "Enter a title" };
  const num = function (v, curV) { if (v === undefined) return curV === undefined ? null : curV; return v === "" || v == null ? null : money(v); };
  const lease = num(b.lease_cents, cur && cur.lease_cents), excl = num(b.exclusive_cents, cur && cur.exclusive_cents);
  if ([lease, excl].some(function (v) { return v !== null && !(v >= 100 && v <= 5000000); })) return { error: "Prices must be $1 or more" };
  let status = b.status !== undefined ? String(b.status) : (cur ? cur.status : "draft");
  if (STATUSES.indexOf(status) < 0 && !(cur && status === cur.status)) return { error: "Unknown status" };
  const thirdParty = role === "seller" || (cur && cur.seller_type === "third_party");
  if (role === "seller" && ["draft", "pending_review"].indexOf(status) < 0) return { error: "Sellers can save drafts or submit for review" };
  if (role !== "owner" && thirdParty && ["approved", "published"].indexOf(status) >= 0) return { error: "Only the POTENT owner can approve a seller's beat" };
  const url = function (v) { v = clip(v, 500); return /^https:\/\//i.test(v) || (/^storage:beat-files\/[0-9a-f-]{36}\//i.test(v) && v.indexOf(pid) > 0) ? v : null; };
  const row = { title: title, lease_cents: lease, exclusive_cents: excl, status: status, active: b.active !== false };
  if (!cur) row.seller_type = thirdParty ? "third_party" : "platform";
  if (b.preview_url !== undefined) row.preview_url = url(b.preview_url);
  if (b.deliver_url !== undefined) row.deliver_url = url(b.deliver_url);
  if (b.cover_url !== undefined) { const c = clip(b.cover_url, 500); row.cover_url = /^https:\/\//i.test(c) ? c : null; }
  if (Array.isArray(b.tags)) row.tags = b.tags.map(function (t) { return clip(t, 30).toLowerCase(); }).filter(Boolean).slice(0, 12);
  if (Array.isArray(b.deliverables)) row.deliverables = b.deliverables.map(function (t) { return clip(t, 30).toLowerCase(); }).filter(Boolean).slice(0, 8);
  if (b.bpm !== undefined && b.bpm !== "") { const n = parseInt(b.bpm, 10); row.bpm = n >= 40 && n <= 250 ? n : null; }
  if (b.key !== undefined) row.musical_key = clip(b.key, 12) || null;
  if (b.genre !== undefined) row.genre = clip(b.genre, 40).toLowerCase() || null;
  if (b.mood !== undefined) row.mood = clip(b.mood, 40).toLowerCase() || null;
  if (b.explicit !== undefined) row.explicit = !!b.explicit;
  if (b.has_vocal_samples !== undefined) row.has_vocal_samples = !!b.has_vocal_samples;
  if (b.description !== undefined) row.description = clip(b.description, 3000) || null;
  if (b.sample_disclosure !== undefined) row.sample_disclosure = clip(b.sample_disclosure, 2000) || null;
  if (b.rights_confirmed !== undefined) row.rights_confirmed = !!b.rights_confirmed;
  if (b.rights_package !== undefined) row.rights_package = clip(b.rights_package, 3000) || null;
  if (b.publish_at !== undefined) { const d = b.publish_at ? new Date(b.publish_at) : null; row.publish_at = d && isFinite(d.getTime()) ? d.toISOString() : null; }
  if (b.internal_notes !== undefined && role !== "seller") row.internal_notes = clip(b.internal_notes, 3000) || null;
  const fin = Object.assign({}, cur || {}, row);
  if (["published", "approved", "pending_review"].indexOf(status) >= 0) {
    if (!(fin.exclusive_cents >= 100)) return { error: "Set an exclusive price ($1 or more) before publishing" };
    if (!fin.preview_url) return { error: "Add a preview audio file first" };
    if (!fin.deliver_url) return { error: "Add the full audio file buyers receive after paying" };
    if (!fin.rights_confirmed) return { error: "Confirm you own or are authorized to sell exclusive rights to this beat" };
    if (!clip(fin.rights_package, 3000)) return { error: "Describe the rights package being sold" };
  }
  if (status === "approved" && !fin.publish_at) row.status = "published"; // approved with no schedule goes live now
  return { row: row };
}
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
    const term = function (v) { return clip(v, 60).toLowerCase().replace(/[^a-z0-9 #'+-]/g, "").trim(); };
    const iso = new Date().toISOString();
    const and = ["or(status.eq.published,status.eq.sold,and(status.eq.approved,publish_at.lte." + iso + "))"];
    const q = term(b.q);
    if (q) and.push("or(title.ilike.*" + q + "*,genre.ilike.*" + q + "*,mood.ilike.*" + q + "*,musical_key.ilike.*" + q + "*,tags.cs.{" + q.replace(/ /g, "%20") + "})");
    let qs = "beat_items?active=eq.true&and=(" + and.join(",") + ")";
    if (term(b.genre)) qs += "&genre=eq." + encodeURIComponent(term(b.genre));
    if (term(b.mood)) qs += "&mood=eq." + encodeURIComponent(term(b.mood));
    if (clip(b.key, 12)) qs += "&musical_key=eq." + encodeURIComponent(clip(b.key, 12));
    if (UUID.test(String(b.producer || ""))) qs += "&producer_id=eq." + b.producer;
    if (parseInt(b.bpm_min, 10) > 0) qs += "&bpm=gte." + parseInt(b.bpm_min, 10);
    if (parseInt(b.bpm_max, 10) > 0) qs += "&bpm=lte." + parseInt(b.bpm_max, 10);
    if (Number(b.price_min) > 0) qs += "&exclusive_cents=gte." + Math.round(Number(b.price_min) * 100);
    if (Number(b.price_max) > 0) qs += "&exclusive_cents=lte." + Math.round(Number(b.price_max) * 100);
    if (b.explicit === "clean") qs += "&explicit=eq.false"; else if (b.explicit === "explicit") qs += "&explicit=eq.true";
    if (b.vocals === "yes") qs += "&has_vocal_samples=eq.true"; else if (b.vocals === "no") qs += "&has_vocal_samples=eq.false";
    if (b.available === true) qs += "&exclusive_sold=eq.false";
    const order = { new: "created_at.desc", plays: "play_count.desc", price_asc: "exclusive_cents.asc.nullslast", price_desc: "exclusive_cents.desc.nullslast", bpm: "bpm.asc.nullslast" }[b.sort] || "created_at.desc";
    const limit = Math.max(1, Math.min(60, parseInt(b.limit, 10) || 30)), offset = Math.max(0, parseInt(b.offset, 10) || 0);
    const now = Date.now();
    const [r, fx] = await Promise.all([
      B.sb(qs + "&select=id,title,lease_cents,exclusive_cents,preview_url,cover_url,exclusive_sold,status,reserved_until,producer_id,tags,bpm,musical_key,genre,mood,explicit,has_vocal_samples,description,sample_disclosure,rights_package,deliverables,play_count,seller_type,beat_producers(name,verified)&order=" + order + "&limit=" + limit + "&offset=" + offset),
      offset === 0 ? B.sb("beat_items?active=eq.true&or=(status.eq.published,status.eq.sold)&select=genre,mood,musical_key,producer_id,beat_producers(name)&limit=1000") : Promise.resolve({ data: [] })
    ]);
    const rows = Array.isArray(r.data) ? r.data : [];
    const uniq = function (arr) { return Array.from(new Set(arr.filter(Boolean))).sort(); };
    const fxr = Array.isArray(fx.data) ? fx.data : [];
    const model = await B.getSetting("revenue_model");
    return B.J(200, { ok: true, more: rows.length === limit,
      facets: offset === 0 ? { genres: uniq(fxr.map(function (x) { return x.genre; })), moods: uniq(fxr.map(function (x) { return x.mood; })), keys: uniq(fxr.map(function (x) { return x.musical_key; })), producers: Object.values(fxr.reduce(function (m, x) { if (x.producer_id && x.beat_producers) m[x.producer_id] = { id: x.producer_id, name: x.beat_producers.name }; return m; }, {})) } : undefined,
      publicTerms: model && model.confirmed && model.public_text ? model.public_text : null,
      agreementVersion: B.AGREEMENT_VERSION,
      beats: rows.map(function (x) { return { id: x.id, title: x.title, producer: x.beat_producers && x.beat_producers.name, verified: !!(x.beat_producers && x.beat_producers.verified), preview_url: x.preview_url, cover_url: x.cover_url,
        lease_cents: null, exclusive_cents: x.exclusive_sold ? null : x.exclusive_cents, price_cents: x.exclusive_cents,
        state: x.exclusive_sold || x.status === "sold" ? "sold" : (x.reserved_until && new Date(x.reserved_until).getTime() > now ? "reserved" : "available"),
        tags: x.tags || [], bpm: x.bpm || null, key: x.musical_key || null, genre: x.genre, mood: x.mood, explicit: !!x.explicit, vocals: !!x.has_vocal_samples,
        description: x.description, sample_disclosure: x.sample_disclosure, rights_package: x.rights_package || DEFAULT_RIGHTS, deliverables: x.deliverables || [], plays: x.play_count || 0 }; }) });
  }
  if (a === "play") { // counts a real preview play (one per IP per beat per 30 min)
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad request" });
    const ip = String((event.headers || {})["x-nf-client-connection-ip"] || "x"), k = "play:" + ip + ":" + b.id;
    if (!played[k] || Date.now() - played[k] > 30 * 60 * 1000) { played[k] = Date.now(); await B.rpc("beat_play", { p_beat: b.id }); }
    return B.J(200, { ok: true });
  }
  if (a === "apply") { // outside producer applies to sell. Needs owner approval before anything can be published.
    const ip = String((event.headers || {})["x-nf-client-connection-ip"] || "x");
    if (tooMany("apply:" + ip)) return B.J(429, { error: "Too many applications. Try again later." });
    noteFail("apply:" + ip);
    const row = { legal_name: clip(b.legal_name, 120), producer_name: clip(b.producer_name, 80), email: clip(b.email, 200).toLowerCase(), phone: clip(b.phone, 40) || null, portfolio: clip(b.portfolio, 500) || null, country: clip(b.country, 60) || null, sample_info: clip(b.sample_info, 2000) || null, payout_preference: clip(b.payout_preference, 200) || null };
    if (!row.legal_name || !row.producer_name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) return B.J(400, { error: "Legal name, producer name and a valid email are required" });
    if (b.rights_declaration !== true) return B.J(400, { error: "You must confirm you own or are authorized to sell every right you offer" });
    if (b.agree !== true) return B.J(400, { error: "You must accept the seller agreement" });
    const dup = await B.sb("beat_applications?email=eq." + encodeURIComponent(row.email) + "&status=eq.pending&select=id");
    if (Array.isArray(dup.data) && dup.data.length) return B.J(200, { ok: true, already: true });
    Object.assign(row, { rights_declaration: true, agreement_version: B.AGREEMENT_VERSION, agreement_accepted_at: new Date().toISOString() });
    const r = await B.sb("beat_applications", { method: "POST", prefer: "return=minimal", body: row });
    if (!r.ok) return B.J(500, { error: "Could not submit. Try again." });
    await B.audit("applicant:" + row.email, "application", row.producer_name, null);
    return B.J(200, { ok: true });
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
      let dl = it && it.deliver_url || null;
      if (dl && dl.indexOf("storage:") === 0) {
        const sg = await fetch(B.SB + "/storage/v1/object/sign/" + dl.slice(8), { method: "POST", headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 604800 }) });
        const sj = await sg.json().catch(function () { return {}; });
        dl = sj.signedURL ? B.SB + "/storage/v1" + sj.signedURL : null;
      }
      return B.J(200, { ok: true, title: it && it.title, url: dl, license: s.metadata.sale_type });
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
      // Cashing out needs the owner's secret payout code. Without it (or if none is set) nobody can request money.
      const pc = await B.getSetting("payout_code");
      if (!pc || !pc.hash) return B.J(403, { error: "Payouts are locked. The POTENT owner has to set the payout code first." });
      const ck = "code:" + p.id;
      if (tooMany(ck)) return B.J(429, { error: "Too many wrong codes. Try again in 15 minutes." });
      if (!B.checkPw(pc.hash, String(b.code || ""))) { noteFail(ck); await B.audit("producer:" + p.email, "payout_code_wrong", p.id, null); return B.J(401, { error: "Wrong payout code. Ask the POTENT owner." }); }
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

    // Approved outside sellers can upload; everything they submit waits for owner approval.
    if (a === "upload_url" || a === "addbeat" || a === "setbeat") {
      if (p.kind !== "seller") return B.J(403, { error: "Beats are uploaded by POTENT. Ask the owner." });
      if (a === "upload_url") return uploadSign(p.id, b);
      let cur = null;
      if (a === "setbeat") { if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" }); const c = await B.sb("beat_items?id=eq." + b.id + "&producer_id=eq." + p.id + "&select=*"); cur = c.ok && c.data && c.data[0]; if (!cur) return B.J(404, { error: "Not found" }); }
      const v = beatRow(b, p.id, { role: "seller", cur: cur }); if (v.error) return B.J(400, { error: v.error });
      if (!cur) { v.row.producer_id = p.id; const r = await B.sb("beat_items", { method: "POST", prefer: "return=minimal", body: v.row }); if (!r.ok) return B.J(500, { error: "Could not save" }); }
      else { const r = await B.sb("beat_items?id=eq." + cur.id + "&producer_id=eq." + p.id, { method: "PATCH", prefer: "return=minimal", body: v.row }); if (!r.ok) return B.J(500, { error: "Could not save" }); }
      await B.audit("seller:" + p.email, a === "addbeat" ? "beat_add" : "beat_edit", cur ? cur.id : v.row.title, { status: v.row.status });
      return B.J(200, await dash(p));
    }

    // Store admins (e.g. Breeze) run the public store: upload, edit, publish PLATFORM beats. No money, no payouts, no other producers' accounts.
    if (a.indexOf("s_") === 0) {
      if (!p.store_admin) return B.J(403, { error: "Store admin access is not turned on for this account" });
      if (a === "s_list") {
        const [pr, bt] = await Promise.all([B.sb("beat_producers?kind=eq.platform&active=eq.true&select=id,name&order=created_at.asc"), B.sb("beat_items?seller_type=eq.platform&select=*,beat_producers(name)&order=created_at.desc&limit=500")]);
        return B.J(200, { ok: true, producers: pr.data || [], beats: (bt.data || []).map(function (x) { return Object.assign(pubBeat(x), { producer_id: x.producer_id, producer_name: x.beat_producers && x.beat_producers.name, internal_notes: x.internal_notes, publish_at: x.publish_at }); }) });
      }
      if (a === "s_upload_url" || a === "s_addbeat" || a === "s_setbeat") {
        let pid = String(b.producer_id || ""), cur = null;
        if (a === "s_setbeat") { if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" }); const c = await B.sb("beat_items?id=eq." + b.id + "&seller_type=eq.platform&select=*"); cur = c.ok && c.data && c.data[0]; if (!cur) return B.J(404, { error: "Not found" }); if (!pid) pid = cur.producer_id; }
        const tp = UUID.test(pid) ? await loadProducer(pid) : null;
        if (!tp || tp.kind !== "platform") return B.J(400, { error: "Pick a producer" });
        if (a === "s_upload_url") return uploadSign(pid, b);
        const v = beatRow(b, pid, { role: "store", cur: cur }); if (v.error) return B.J(400, { error: v.error });
        if (!cur) { v.row.producer_id = pid; const r = await B.sb("beat_items", { method: "POST", prefer: "return=minimal", body: v.row }); if (!r.ok) return B.J(500, { error: "Could not save" }); }
        else { if (b.producer_id && !cur.exclusive_sold) v.row.producer_id = pid; const r = await B.sb("beat_items?id=eq." + cur.id, { method: "PATCH", prefer: "return=minimal", body: v.row }); if (!r.ok) return B.J(500, { error: "Could not save" }); }
        await B.audit("store:" + p.email, cur ? "beat_edit" : "beat_add", cur ? cur.id : v.row.title, { status: v.row.status, locked: !!v.locked });
        return B.J(200, { ok: true, locked: !!v.locked });
      }
      return B.J(400, { error: "Unknown action" });
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
    const [prods, pays, sales, beatsR] = await Promise.all([
      B.sb("beat_producers?select=*&order=created_at.asc&limit=200"),
      B.sb("beat_payouts?select=*,beat_producers(name,email)&order=requested_at.desc&limit=100"),
      B.sb("beat_sales?select=title,sale_type,gross_cents,producer_cents,status,created_at,beat_producers(name)&order=created_at.desc&limit=50"),
      B.sb("beat_items?select=*,beat_producers(name)&order=created_at.desc&limit=500")
    ]);
    const list = [];
    for (const p of (prods.data || [])) list.push(Object.assign(pubProducer(p), { balance: await B.balances(p.id) }));
    return B.J(200, { ok: true, producers: list, payouts: pays.data || [], sales: sales.data || [], beats: beatsR.data || [] });
  }
  if (a === "o_upload_url") {
    if (!UUID.test(String(b.producer_id || "")) || !(await loadProducer(b.producer_id))) return B.J(400, { error: "Pick a producer" });
    return uploadSign(b.producer_id, b);
  }
  if (a === "o_addbeat" || a === "o_setbeat") {
    const isNew = a === "o_addbeat";
    let pid = String(b.producer_id || ""), cur = null;
    if (!isNew) { if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" }); const c = await B.sb("beat_items?id=eq." + b.id + "&select=*"); cur = c.ok && c.data && c.data[0]; if (!cur) return B.J(404, { error: "Not found" }); if (!pid) pid = cur.producer_id; }
    if (!UUID.test(pid) || !(await loadProducer(pid))) return B.J(400, { error: "Pick a producer" });
    const v = beatRow(b, pid, { role: "owner", cur: cur }); if (v.error) return B.J(400, { error: v.error });
    if (isNew) { v.row.producer_id = pid; const r = await B.sb("beat_items", { method: "POST", prefer: "return=minimal", body: v.row }); if (!r.ok) return B.J(500, { error: "Could not save" }); }
    else { if (b.producer_id && !cur.exclusive_sold) v.row.producer_id = pid; const r = await B.sb("beat_items?id=eq." + b.id, { method: "PATCH", prefer: "return=minimal", body: v.row }); if (!r.ok) return B.J(500, { error: "Could not save" }); }
    await B.audit("owner", isNew ? "beat_add" : "beat_edit", cur ? cur.id : v.row.title, { status: v.row.status, locked: !!v.locked, from: cur ? cur.status : null });
    return B.J(200, { ok: true, locked: !!v.locked });
  }
  if (a === "o_relist") { // after a refund, an admin decides to put an exclusive back on sale
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    const sl = await B.sb("beat_sales?beat_id=eq." + b.id + "&sale_type=eq.exclusive&status=eq.complete&select=id");
    if (Array.isArray(sl.data) && sl.data.length) return B.J(409, { error: "This exclusive has an active sale. It cannot be re-listed." });
    await B.sb("beat_items?id=eq." + b.id, { method: "PATCH", prefer: "return=minimal", body: { exclusive_sold: false, sold_session: null, sold_at: null, status: "draft", reserved_until: null, reserved_token: null } });
    await B.audit("owner", "relist_after_refund", b.id, null);
    return B.J(200, { ok: true });
  }
  if (a === "o_stats") {
    const [items, sales, pays] = await Promise.all([B.sb("beat_items?select=status,play_count&limit=5000"), B.sb("beat_sales?select=sale_type,status,gross_cents,tax_cents,fee_cents,net_cents,producer_cents,refunded_cents&limit=10000"), B.sb("beat_payouts?select=amount_cents,status&limit=5000")]);
    const by = {}; (items.data || []).forEach(function (x) { by[x.status] = (by[x.status] || 0) + 1; });
    let gross = 0, net = 0, fees = 0, prod = 0, refunds = 0, ex = 0;
    (sales.data || []).forEach(function (x) { gross += x.gross_cents; refunds += x.refunded_cents || 0; if (x.status === "complete") { net += x.net_cents; fees += x.fee_cents; prod += x.producer_cents; if (x.sale_type === "exclusive") ex++; } });
    const model = await B.getSetting("revenue_model");
    return B.J(200, { ok: true, byStatus: by, plays: (items.data || []).reduce(function (a2, x) { return a2 + (x.play_count || 0); }, 0), soldExclusives: ex, grossCents: gross, netEligibleCents: net, estFeesCents: fees, producerCents: prod, platformCents: net - prod, artistCents: null, refundsCents: refunds,
      pendingPayoutsCents: (pays.data || []).filter(function (x) { return x.status === "pending"; }).reduce(function (a2, x) { return a2 + x.amount_cents; }, 0), revenueModel: model, payoutCodeSet: !!((await B.getSetting("payout_code")) || {}).hash });
  }
  if (a === "o_audit") { const r = await B.sb("beat_audit?select=*&order=created_at.desc&limit=100"); return B.J(200, { ok: true, rows: r.data || [] }); }
  if (a === "o_setcode") {
    const code = String(b.code || "");
    if (code.length < 6 || code.length > 64) return B.J(400, { error: "Use a payout code of 6 or more characters" });
    const cur = await B.getSetting("payout_code");
    if (cur && cur.hash && !B.checkPw(cur.hash, String(b.old_code || ""))) return B.J(401, { error: "Enter the current payout code to change it" });
    await B.setSetting("payout_code", { hash: B.hashPw(code) });
    await B.audit("owner", "payout_code_set", null, null);
    return B.J(200, { ok: true });
  }
  if (a === "o_setmodel") { // revenue model: nothing is paid out by these percentages until confirmed:true is set deliberately
    const n = function (v) { v = Number(v); return isFinite(v) ? Math.max(0, Math.min(100, v)) : 0; };
    const m = { confirmed: b.confirmed === true, stream: clip(b.stream, 600) || null, artist_pct: n(b.artist_pct), producer_pct: n(b.producer_pct), platform_pct: n(b.platform_pct), public_text: clip(b.public_text, 600) || null };
    if (m.confirmed && (!m.stream || Math.round((m.artist_pct + m.producer_pct + m.platform_pct) * 100) !== 10000)) return B.J(400, { error: "To confirm, describe the revenue stream and make the three percentages add to 100" });
    await B.setSetting("revenue_model", m);
    await B.audit("owner", "revenue_model_set", null, m);
    return B.J(200, { ok: true });
  }
  if (a === "o_apps") { const r = await B.sb("beat_applications?select=*&order=created_at.desc&limit=100"); return B.J(200, { ok: true, apps: r.data || [] }); }
  if (a === "o_appdecide") {
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    const g = await B.sb("beat_applications?id=eq." + b.id + "&select=*"); const ap = g.ok && g.data && g.data[0];
    if (!ap || ap.status !== "pending") return B.J(400, { error: "That application is not pending" });
    if (b.decision !== "approve") { await B.sb("beat_applications?id=eq." + ap.id, { method: "PATCH", prefer: "return=minimal", body: { status: "rejected", review_note: clip(b.note, 500) || null, decided_at: new Date().toISOString() } }); await B.audit("owner", "application_rejected", ap.id, null); return B.J(200, { ok: true }); }
    const ex = Math.round(Number(b.exclusive_pct)); if (!(ex >= 0 && ex <= 100)) return B.J(400, { error: "Enter the seller's % of each exclusive sale (0-100)" });
    const temp = require("crypto").randomBytes(9).toString("base64").replace(/[^a-zA-Z0-9]/g, "x").slice(0, 12);
    const r = await B.sb("beat_producers", { method: "POST", prefer: "return=representation", body: { name: ap.producer_name, legal_name: ap.legal_name, email: ap.email, password_hash: B.hashPw(temp), country: ap.country, kind: "seller", splits: { lease: ex, exclusive: ex } } });
    if (!r.ok) return B.J(r.status === 409 ? 409 : 500, { error: r.status === 409 ? "That email already has an account" : "Could not create the seller account" });
    await B.sb("beat_applications?id=eq." + ap.id, { method: "PATCH", prefer: "return=minimal", body: { status: "approved", producer_id: r.data[0].id, decided_at: new Date().toISOString(), review_note: clip(b.note, 500) || null } });
    await B.audit("owner", "application_approved", ap.id, { producer: r.data[0].id, exclusive_pct: ex });
    return B.J(200, { ok: true, email: ap.email, tempPassword: temp });
  }
  if (a === "o_create") {
    const email = clip(b.email, 200).toLowerCase(), name = clip(b.name, 80);
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return B.J(400, { error: "Name and a valid email are required" });
    const temp = String(b.password || "").length >= 10 ? String(b.password) : require("crypto").randomBytes(9).toString("base64").replace(/[^a-zA-Z0-9]/g, "x").slice(0, 12);
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
    if (b.store_admin != null) patch.store_admin = !!b.store_admin;
    if (b.verified != null) patch.verified = !!b.verified;
    await B.audit("owner", "producer_edit", b.id, patch);
    await B.sb("beat_producers?id=eq." + b.id, { method: "PATCH", prefer: "return=minimal", body: patch });
    return B.J(200, { ok: true });
  }
  if (a === "o_resetpw") {
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    const temp = String(b.password || "").length >= 10 ? String(b.password) : require("crypto").randomBytes(9).toString("base64").replace(/[^a-zA-Z0-9]/g, "x").slice(0, 12);
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
      await B.audit("owner", "payout_paid", po.id, { amount: po.amount_cents, ref: ref });
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
