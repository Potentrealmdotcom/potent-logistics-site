// POTENT Beat Lab: private engineer workspace. Sound library (packs + assets), projects, takes, exports, hand-off.
// Everything is private by default. Nothing here lists anything in the marketplace, moves money, or changes a split.
// POST JSON { action, ... } with a POTENT Music account token. Engineers are added by the owner (o_eng_set).
const B = require("./lib/beats");
const M = require("./lib/music");

const UUID = /^[0-9a-f-]{36}$/i;
const clip = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n); };
const rows = function (r) { return r.ok && Array.isArray(r.data) ? r.data : []; };
const num = function (v, lo, hi) { v = Number(v); return isFinite(v) && v >= lo && v <= hi ? v : null; };
const MAX_FILE = 50 * 1024 * 1024, MAX_DATA = 600 * 1024;
const AUDIO_EXT = /\.(wav|mp3|m4a|aac|flac|ogg|webm|aiff?)$/i;
const MIME = { wav: "audio/wav", mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac", ogg: "audio/ogg", webm: "audio/webm", aif: "audio/aiff", aiff: "audio/aiff" };
const KINDS = ["drum", "808", "loop", "sample", "melody", "vocal", "fx", "preset", "other"];
const PERMS = ["original", "licensed", "cleared", "unverified"];
const REF = function (uid) { return "storage:lab-files/lab/" + uid + "/"; };
const fails = {};
function tooMany(k, max) { const f = fails[k]; return !!(f && f.n >= max && Date.now() - f.t < 36e5); }
function note(k) { const f = fails[k]; if (!f || Date.now() - f.t > 36e5) fails[k] = { n: 1, t: Date.now() }; else { f.n++; f.t = Date.now(); } }

async function userFrom(event) {
  const u = M.verifyUser(B.bearer(event)); if (!u) return null;
  const r = await B.sb("music_users?id=eq." + u.uid + "&select=id,email,name,active");
  const x = rows(r)[0]; return x && x.active ? x : null;
}
async function engineerOf(uid) { const r = rows(await B.sb("music_engineers?user_id=eq." + uid + "&select=*"))[0]; return r && r.active ? r : null; }
function sbKey() { return process.env.SUPABASE_SERVICE_ROLE_KEY; }
async function signUpload(path) {
  const sg = await fetch(B.SB + "/storage/v1/object/upload/sign/lab-files/" + path, { method: "POST", headers: { apikey: sbKey(), Authorization: "Bearer " + sbKey(), "Content-Type": "application/json" }, body: "{}" });
  const sj = await sg.json().catch(function () { return {}; }); return sg.ok && sj.url ? B.SB + "/storage/v1" + sj.url : null;
}
// The real size of an uploaded object (also proves the file exists). Never trust the number the browser says.
async function objSize(ref) {
  const path = String(ref).replace("storage:lab-files/", "");
  const r = await fetch(B.SB + "/storage/v1/object/authenticated/lab-files/" + path, { method: "HEAD", headers: { apikey: sbKey(), Authorization: "Bearer " + sbKey() } });
  if (!r.ok) return null; const n = Number(r.headers && r.headers.get ? r.headers.get("content-length") : 0); return n >= 0 ? n : 0;
}
async function delObj(ref) { try { if (ref && ref.indexOf("storage:lab-files/") === 0) await fetch(B.SB + "/storage/v1/object/lab-files/" + ref.slice(18), { method: "DELETE", headers: { apikey: sbKey(), Authorization: "Bearer " + sbKey() } }); } catch (e) { } }
async function used(uid) {
  const [a, t, p] = await Promise.all([B.sb("lab_assets?owner_user_id=eq." + uid + "&select=bytes"), B.sb("lab_takes?owner_user_id=eq." + uid + "&select=bytes"), B.sb("lab_projects?owner_user_id=eq." + uid + "&select=export_bytes")]);
  const s = function (l, k) { return l.reduce(function (x, y) { return x + (Number(y[k]) || 0); }, 0); };
  return s(rows(a), "bytes") + s(rows(t), "bytes") + s(rows(p), "export_bytes");
}
function safeName(n) { return clip(n, 120).replace(/[^A-Za-z0-9._-]/g, "_"); }
async function uploadSlot(u, eng, b, folder) {
  const name = safeName(b.name); if (!AUDIO_EXT.test(name)) return { err: "Upload an audio file (wav, mp3, m4a, aac, flac, ogg, webm, aiff)" };
  const bytes = Number(b.bytes); if (!(bytes > 0) || bytes > MAX_FILE) return { err: "Files can be up to 50 MB each" };
  if (await used(u.id) + bytes > Number(eng.quota_bytes)) return { err: "That would go over your storage limit. Delete something you no longer need first." };
  const path = "lab/" + u.id + "/" + folder + "/" + Date.now() + "-" + name; const url = await signUpload(path);
  return url ? { uploadUrl: url, ref: "storage:lab-files/" + path } : { err: "Uploads are not set up yet." };
}
async function checkRef(uid, ref, folder) { // a file ref must be this person's own, in the expected folder, and must really exist
  ref = clip(ref, 400); if (ref.indexOf(REF(uid) + folder + "/") !== 0 || ref.indexOf("..") >= 0) return { err: "That file does not belong to you" };
  const n = await objSize(ref); if (n == null) return { err: "The upload did not finish. Try again." }; if (n > MAX_FILE) return { err: "File is too large" };
  return { ref: ref, bytes: n };
}
// access to a pack for reading: owner, a share, or an owner-approved public pack (engineers only)
async function packAccess(uid, pack) {
  if (!pack) return null; if (pack.owner_user_id === uid) return { edit: true, own: true };
  const s = rows(await B.sb("lab_shares?kind=eq.pack&ref_id=eq." + pack.id + "&shared_with_user_id=eq." + uid + "&select=can_edit"))[0];
  if (s) return { edit: false, own: false };
  if (pack.visibility === "public" && !pack.archived) return { edit: false, own: false };
  return null;
}
async function assetAccess(uid, asset) {
  if (!asset) return false; if (asset.owner_user_id === uid) return true; if (!asset.pack_id) return false;
  const p = rows(await B.sb("lab_packs?id=eq." + asset.pack_id + "&select=*"))[0]; return !!(await packAccess(uid, p));
}
async function projAccess(uid, p) {
  if (!p) return null; if (p.owner_user_id === uid) return { own: true, edit: true };
  const s = rows(await B.sb("lab_shares?kind=eq.project&ref_id=eq." + p.id + "&shared_with_user_id=eq." + uid + "&select=can_edit"))[0];
  return s ? { own: false, edit: !!s.can_edit } : null;
}
function pubAsset(a) { return { id: a.id, name: a.name, kind: a.kind, pack_id: a.pack_id, bytes: a.bytes, bpm: a.bpm, musical_key: a.musical_key, genre: a.genre, tags: a.tags || [], description: a.description, permission_status: a.permission_status, license: a.license, source: a.source, restrictions: a.restrictions, commercial_ok: !!a.commercial_ok, archived: !!a.archived, owner: a.owner_user_id, created_at: a.created_at }; }

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.AUTH_SECRET) return B.J(500, { error: "Server not configured" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  const a = String(b.action || "");

  // ───────── owner: who is an engineer, and public-pack approval ─────────
  if (a.indexOf("o_") === 0) {
    if (!B.verifyOwner(B.bearer(event))) return B.J(403, { error: "POTENT owner only" });
    if (a === "o_eng_list") return B.J(200, { ok: true, engineers: rows(await B.sb("music_engineers?select=user_id,active,quota_bytes,created_at,music_users(email,name)&order=created_at.desc&limit=200")) });
    if (a === "o_eng_set") {
      const email = clip(b.email, 200).toLowerCase(); const u = rows(await B.sb("music_users?email=eq." + encodeURIComponent(email) + "&select=id"))[0];
      if (!u) return B.J(404, { error: "No Music account with that email. They need to create one first." });
      const gb = b.quota_gb === undefined ? 2 : num(b.quota_gb, 0.1, 100); if (gb == null) return B.J(400, { error: "Storage limit is between 0.1 and 100 GB" });
      await B.sb("music_engineers", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { user_id: u.id, active: b.active !== false, quota_bytes: Math.round(gb * 1073741824), granted_by: "owner" } });
      await B.audit("owner", b.active === false ? "engineer_off" : "engineer_on", u.id, { quota_gb: gb }); return B.J(200, { ok: true });
    }
    if (a === "o_packs_pending") return B.J(200, { ok: true, packs: rows(await B.sb("lab_packs?visibility=eq.public_requested&select=*,music_users(email,name)&order=created_at.asc&limit=100")) });
    if (a === "o_pack_decide") {
      if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
      await B.sb("lab_packs?id=eq." + b.id + "&visibility=eq.public_requested", { method: "PATCH", prefer: "return=minimal", body: { visibility: b.approve === true ? "public" : "private" } });
      await B.audit("owner", b.approve === true ? "lab_pack_public" : "lab_pack_declined", b.id, null); return B.J(200, { ok: true });
    }
    return B.J(400, { error: "Unknown action" });
  }

  const u = await userFrom(event); if (!u) return B.J(401, { error: "Sign in first" });
  const eng = await engineerOf(u.id);
  if (a === "l_me") { if (!eng) return B.J(200, { ok: true, engineer: false, note: "Beat Lab is for POTENT engineers. Ask POTENT to add your account." }); return B.J(200, { ok: true, engineer: true, email: u.email, name: u.name, quota_bytes: Number(eng.quota_bytes), used_bytes: await used(u.id) }); }
  // projects can also be opened by an invited collaborator who is not an engineer; everything else is engineers only
  const COLLAB = ["l_project_get", "l_project_save", "l_take_get", "l_take_url", "l_take_save", "l_projects", "l_export_get", "l_versions"];
  if (!eng && COLLAB.indexOf(a) < 0) return B.J(403, { error: "Beat Lab is for POTENT engineers" });
  if (!eng && a === "l_take_url") return B.J(403, { error: "Only engineers can upload recordings" });
  if (tooMany("lab:" + u.id, 3000)) return B.J(429, { error: "Slow down a little" }); note("lab:" + u.id);

  // ───────── library: packs ─────────
  if (a === "l_overview") {
    const mine = rows(await B.sb("lab_packs?owner_user_id=eq." + u.id + "&archived=eq.false&select=*&order=created_at.desc&limit=200"));
    const sh = rows(await B.sb("lab_shares?kind=eq.pack&shared_with_user_id=eq." + u.id + "&select=ref_id,owner_user_id"));
    let shared = []; if (sh.length) shared = rows(await B.sb("lab_packs?id=in.(" + sh.map(function (s) { return s.ref_id; }).join(",") + ")&archived=eq.false&select=*,music_users(name)"));
    const pub = rows(await B.sb("lab_packs?visibility=eq.public&archived=eq.false&owner_user_id=neq." + u.id + "&select=*,music_users(name)&limit=100"));
    return B.J(200, { ok: true, mine: mine, shared: shared, public: pub, used_bytes: await used(u.id), quota_bytes: Number(eng.quota_bytes) });
  }
  if (a === "l_pack_save") {
    const name = clip(b.name, 80); if (name.length < 2) return B.J(400, { error: "Name the pack" });
    const vis = b.visibility === undefined ? null : String(b.visibility); if (vis && ["private", "shared", "public_requested"].indexOf(vis) < 0) return B.J(400, { error: "Pick private, shared, or ask for public approval. POTENT approves public packs." });
    const license = clip(b.license, 600), commercial = b.commercial_ok === true;
    const row = { name: name, description: clip(b.description, 600) || null, license: license || null, source: clip(b.source, 300) || null, restrictions: clip(b.restrictions, 600) || null };
    let cur = null; if (UUID.test(String(b.id || ""))) { cur = rows(await B.sb("lab_packs?id=eq." + b.id + "&owner_user_id=eq." + u.id + "&select=*"))[0]; if (!cur) return B.J(404, { error: "Pack not found" }); }
    if (commercial) { // only labelled commercial when the actual licence supports it
      if (!license) return B.J(400, { error: "To mark a pack commercially usable, write the licence that allows it" });
      if (cur) { const bad = rows(await B.sb("lab_assets?pack_id=eq." + cur.id + "&archived=eq.false&permission_status=eq.unverified&select=id")); if (bad.length) return B.J(400, { error: bad.length + " sound(s) in this pack have no confirmed permission. Fix those first." }); }
    }
    row.commercial_ok = commercial;
    if (vis) {
      if (vis === "public_requested" && !license) return B.J(400, { error: "A public pack needs its licence written out" });
      row.visibility = vis === "public_requested" && cur && cur.visibility === "public" ? "public" : vis; // asking again never un-approves
    }
    if (cur) { await B.sb("lab_packs?id=eq." + cur.id, { method: "PATCH", prefer: "return=minimal", body: row }); return B.J(200, { ok: true, id: cur.id }); }
    if (rows(await B.sb("lab_packs?owner_user_id=eq." + u.id + "&select=id&limit=201")).length > 200) return B.J(400, { error: "Pack limit reached" });
    const ins = await B.sb("lab_packs", { method: "POST", prefer: "return=representation", body: Object.assign({ owner_user_id: u.id, visibility: vis || "private" }, row) });
    return B.J(200, { ok: true, id: rows(ins)[0] && rows(ins)[0].id });
  }
  if (a === "l_pack_archive") {
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    await B.sb("lab_packs?id=eq." + b.id + "&owner_user_id=eq." + u.id, { method: "PATCH", prefer: "return=minimal", body: { archived: b.archived !== false, visibility: "private" } }); return B.J(200, { ok: true });
  }

  // ───────── library: assets ─────────
  if (a === "l_assets") {
    const scope = b.scope === "shared" ? "shared" : b.scope === "public" ? "public" : "mine";
    let q = "lab_assets?select=*&order=created_at.desc&limit=300";
    if (scope === "mine") q += "&owner_user_id=eq." + u.id + "&archived=eq." + (b.archived === true);
    else {
      let ids = [];
      if (scope === "shared") ids = rows(await B.sb("lab_shares?kind=eq.pack&shared_with_user_id=eq." + u.id + "&select=ref_id")).map(function (s) { return s.ref_id; });
      else ids = rows(await B.sb("lab_packs?visibility=eq.public&archived=eq.false&select=id")).map(function (s) { return s.id; });
      if (!ids.length) return B.J(200, { ok: true, assets: [] });
      q += "&pack_id=in.(" + ids.join(",") + ")&archived=eq.false";
    }
    if (UUID.test(String(b.pack_id || ""))) q += "&pack_id=eq." + b.pack_id;
    if (KINDS.indexOf(b.kind) >= 0) q += "&kind=eq." + b.kind;
    let list = rows(await B.sb(q)); const s = clip(b.q, 60).toLowerCase();
    if (s) list = list.filter(function (x) { return (x.name + " " + (x.tags || []).join(" ") + " " + (x.genre || "") + " " + (x.musical_key || "") + " " + (x.description || "")).toLowerCase().indexOf(s) >= 0; });
    const lo = num(b.bpm_min, 0, 400), hi = num(b.bpm_max, 0, 400); if (lo != null) list = list.filter(function (x) { return x.bpm != null && Number(x.bpm) >= lo; }); if (hi != null) list = list.filter(function (x) { return x.bpm != null && Number(x.bpm) <= hi; });
    if (clip(b.key, 12)) list = list.filter(function (x) { return String(x.musical_key || "").toLowerCase() === clip(b.key, 12).toLowerCase(); });
    return B.J(200, { ok: true, assets: list.map(pubAsset) });
  }
  if (a === "l_upload_url") { const s = await uploadSlot(u, eng, b, "assets"); return s.err ? B.J(400, { error: s.err }) : B.J(200, { ok: true, uploadUrl: s.uploadUrl, ref: s.ref }); }
  if (a === "l_asset_save") {
    let cur = null; if (UUID.test(String(b.id || ""))) { cur = rows(await B.sb("lab_assets?id=eq." + b.id + "&owner_user_id=eq." + u.id + "&select=*"))[0]; if (!cur) return B.J(404, { error: "Sound not found" }); }
    const name = clip(b.name !== undefined ? b.name : cur && cur.name, 100); if (name.length < 1) return B.J(400, { error: "Name the sound" });
    const kind = b.kind !== undefined ? String(b.kind) : cur ? cur.kind : "sample"; if (KINDS.indexOf(kind) < 0) return B.J(400, { error: "Unknown sound type" });
    const perm = b.permission_status !== undefined ? String(b.permission_status) : cur ? cur.permission_status : "unverified"; if (PERMS.indexOf(perm) < 0) return B.J(400, { error: "Unknown permission status" });
    const license = clip(b.license !== undefined ? b.license : cur && cur.license, 600), source = clip(b.source !== undefined ? b.source : cur && cur.source, 300);
    if (perm === "licensed" && !license) return B.J(400, { error: "Write the licence you have for this sound" });
    if (perm === "cleared" && !(license || source)) return B.J(400, { error: "Say who cleared it and where it came from" });
    const commercial = b.commercial_ok !== undefined ? b.commercial_ok === true : !!(cur && cur.commercial_ok);
    if (commercial && (perm === "unverified" || !license && perm !== "original")) return B.J(400, { error: "A sound is only marked commercially usable when its permission is confirmed and the licence supports it" });
    let packId = b.pack_id !== undefined ? (b.pack_id || null) : cur ? cur.pack_id : null;
    if (packId) { if (!UUID.test(String(packId)) || !rows(await B.sb("lab_packs?id=eq." + packId + "&owner_user_id=eq." + u.id + "&select=id")).length) return B.J(404, { error: "Pack not found" }); }
    const bpm = b.bpm === undefined ? (cur ? cur.bpm : null) : (b.bpm === "" || b.bpm == null ? null : num(b.bpm, 20, 400)); if (b.bpm !== undefined && b.bpm !== "" && b.bpm != null && bpm == null) return B.J(400, { error: "BPM is between 20 and 400" });
    const tags = b.tags !== undefined ? (Array.isArray(b.tags) ? b.tags : String(b.tags || "").split(",")).map(function (t) { return clip(t, 24).toLowerCase(); }).filter(Boolean).slice(0, 12) : cur ? cur.tags : [];
    const row = { name: name, kind: kind, pack_id: packId, bpm: bpm, musical_key: clip(b.musical_key !== undefined ? b.musical_key : cur && cur.musical_key, 12) || null, genre: clip(b.genre !== undefined ? b.genre : cur && cur.genre, 40).toLowerCase() || null, tags: tags,
      description: clip(b.description !== undefined ? b.description : cur && cur.description, 500) || null, permission_status: perm, license: license || null, source: source || null, restrictions: clip(b.restrictions !== undefined ? b.restrictions : cur && cur.restrictions, 500) || null, commercial_ok: commercial };
    const reopen = async function () { if (packId) await B.sb("lab_packs?id=eq." + packId + "&visibility=eq.public", { method: "PATCH", prefer: "return=minimal", body: { visibility: "public_requested" } }); }; // changing an approved pack sends it back for approval
    if (cur) { await B.sb("lab_assets?id=eq." + cur.id, { method: "PATCH", prefer: "return=minimal", body: row }); await reopen(); return B.J(200, { ok: true, id: cur.id }); }
    if (b.attest !== true) return B.J(400, { error: "Tick the box to confirm you made this sound or have the right to use it. Do not upload other people's material without permission." });
    const f = await checkRef(u.id, b.file_ref, "assets"); if (f.err) return B.J(400, { error: f.err });
    if (await used(u.id) + f.bytes > Number(eng.quota_bytes)) { await delObj(f.ref); return B.J(400, { error: "That would go over your storage limit" }); }
    row.file_ref = f.ref; row.bytes = f.bytes; row.mime = MIME[((f.ref.match(/\.(\w+)$/) || [])[1] || "").toLowerCase()] || "audio/wav"; row.owner_user_id = u.id;
    const ins = await B.sb("lab_assets", { method: "POST", prefer: "return=representation", body: row }); if (!ins.ok) return B.J(500, { error: "Could not save the sound" });
    await reopen(); await B.audit("user:" + u.email, "lab_asset_add", rows(ins)[0] && rows(ins)[0].id, { perm: perm }); return B.J(200, { ok: true, id: rows(ins)[0] && rows(ins)[0].id });
  }
  if (a === "l_asset_replace") {
    const cur = UUID.test(String(b.id || "")) && rows(await B.sb("lab_assets?id=eq." + b.id + "&owner_user_id=eq." + u.id + "&select=*"))[0]; if (!cur) return B.J(404, { error: "Sound not found" });
    const f = await checkRef(u.id, b.file_ref, "assets"); if (f.err) return B.J(400, { error: f.err });
    await B.sb("lab_assets?id=eq." + cur.id, { method: "PATCH", prefer: "return=minimal", body: { file_ref: f.ref, bytes: f.bytes } }); await delObj(cur.file_ref); return B.J(200, { ok: true });
  }
  if (a === "l_asset_archive") { if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" }); await B.sb("lab_assets?id=eq." + b.id + "&owner_user_id=eq." + u.id, { method: "PATCH", prefer: "return=minimal", body: { archived: b.archived !== false } }); return B.J(200, { ok: true }); }
  if (a === "l_asset_delete") {
    const cur = UUID.test(String(b.id || "")) && rows(await B.sb("lab_assets?id=eq." + b.id + "&owner_user_id=eq." + u.id + "&select=id,file_ref"))[0]; if (!cur) return B.J(404, { error: "Sound not found" });
    await B.sb("lab_assets?id=eq." + cur.id, { method: "DELETE", prefer: "return=minimal" }); await delObj(cur.file_ref); await B.audit("user:" + u.email, "lab_asset_delete", cur.id, null); return B.J(200, { ok: true });
  }
  if (a === "l_asset_url") {
    const x = UUID.test(String(b.id || "")) && rows(await B.sb("lab_assets?id=eq." + b.id + "&select=*"))[0];
    if (!x || !(await assetAccess(u.id, x))) return B.J(404, { error: "Sound not found" }); // same answer whether it exists or not
    const url = await M.signedUrl(x.file_ref, 600); return url ? B.J(200, { ok: true, url: url, asset: pubAsset(x) }) : B.J(404, { error: "File not available" });
  }
  if (a === "l_share") {
    const kind = b.kind === "project" ? "project" : "pack"; if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    const own = kind === "pack" ? rows(await B.sb("lab_packs?id=eq." + b.id + "&owner_user_id=eq." + u.id + "&select=id"))[0] : rows(await B.sb("lab_projects?id=eq." + b.id + "&owner_user_id=eq." + u.id + "&select=id"))[0];
    if (!own) return B.J(404, { error: "Not found" });
    const t = rows(await B.sb("music_users?email=eq." + encodeURIComponent(clip(b.email, 200).toLowerCase()) + "&select=id,email,active"))[0];
    if (!t || !t.active || t.id === u.id) return B.J(404, { error: "No active account with that email" });
    if (kind === "pack" && !(await engineerOf(t.id))) return B.J(400, { error: "Sound packs can only be shared with POTENT engineers" });
    if (b.remove === true) { await B.sb("lab_shares?kind=eq." + kind + "&ref_id=eq." + b.id + "&shared_with_user_id=eq." + t.id, { method: "DELETE", prefer: "return=minimal" }); return B.J(200, { ok: true }); }
    await B.sb("lab_shares?on_conflict=kind,ref_id,shared_with_user_id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { kind: kind, ref_id: b.id, owner_user_id: u.id, shared_with_user_id: t.id, can_edit: kind === "project" && b.can_edit === true } });
    if (kind === "pack") await B.sb("lab_packs?id=eq." + b.id + "&visibility=eq.private", { method: "PATCH", prefer: "return=minimal", body: { visibility: "shared" } });
    return B.J(200, { ok: true });
  }
  if (a === "l_shares") {
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    const sh = rows(await B.sb("lab_shares?ref_id=eq." + b.id + "&owner_user_id=eq." + u.id + "&select=can_edit,shared_with_user_id")); let us = [];
    if (sh.length) us = rows(await B.sb("music_users?id=in.(" + sh.map(function (x) { return x.shared_with_user_id; }).join(",") + ")&select=id,email,name"));
    return B.J(200, { ok: true, shares: sh.map(function (x) { const w = us.find(function (y) { return y.id === x.shared_with_user_id; }) || {}; return { email: w.email, name: w.name, can_edit: x.can_edit }; }) });
  }

  // ───────── presets, kits and templates ─────────
  if (a === "l_presets") { return B.J(200, { ok: true, presets: rows(await B.sb("lab_presets?owner_user_id=eq." + u.id + "&select=*&order=created_at.desc&limit=200")) }); }
  if (a === "l_preset_save") {
    const name = clip(b.name, 80); if (name.length < 2) return B.J(400, { error: "Name it" }); const kind = b.kind === "template" ? "template" : "preset";
    const data = b.data && typeof b.data === "object" ? b.data : null; if (!data || JSON.stringify(data).length > 200 * 1024) return B.J(400, { error: "Too large or empty" });
    const ins = await B.sb("lab_presets", { method: "POST", prefer: "return=representation", body: { owner_user_id: u.id, kind: kind, name: name, data: data } }); return B.J(200, { ok: true, id: rows(ins)[0] && rows(ins)[0].id });
  }
  if (a === "l_preset_delete") { if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" }); await B.sb("lab_presets?id=eq." + b.id + "&owner_user_id=eq." + u.id, { method: "DELETE", prefer: "return=minimal" }); return B.J(200, { ok: true }); }

  // ───────── projects ─────────
  if (a === "l_projects") {
    const mine = rows(await B.sb("lab_projects?owner_user_id=eq." + u.id + "&status=eq.active&select=id,title,artist_name,song_title,bpm,version,updated_at,music_project_id,export_ref,handed_off_at,marketplace_ready,live_ready&order=updated_at.desc&limit=200"));
    const sh = rows(await B.sb("lab_shares?kind=eq.project&shared_with_user_id=eq." + u.id + "&select=ref_id,can_edit")); let shared = [];
    if (sh.length) shared = rows(await B.sb("lab_projects?id=in.(" + sh.map(function (s) { return s.ref_id; }).join(",") + ")&status=eq.active&select=id,title,artist_name,song_title,bpm,version,updated_at,music_users(name)")).map(function (p) { const s = sh.find(function (x) { return x.ref_id === p.id; }); p.can_edit = !!(s && s.can_edit); return p; });
    return B.J(200, { ok: true, mine: mine, shared: shared });
  }
  if (a === "l_project_create") {
    const title = clip(b.title, 100); if (title.length < 2) return B.J(400, { error: "Name the project" });
    if (rows(await B.sb("lab_projects?owner_user_id=eq." + u.id + "&select=id&limit=201")).length > 200) return B.J(400, { error: "Project limit reached" });
    let data = {}; if (UUID.test(String(b.template_id || ""))) { const t = rows(await B.sb("lab_presets?id=eq." + b.template_id + "&owner_user_id=eq." + u.id + "&kind=eq.template&select=data"))[0]; if (t) data = t.data; }
    const ins = await B.sb("lab_projects", { method: "POST", prefer: "return=representation", body: { owner_user_id: u.id, title: title, artist_name: clip(b.artist_name, 80) || null, song_title: clip(b.song_title, 100) || null, bpm: num(b.bpm, 40, 300) || 120, data: data } });
    return B.J(200, { ok: true, id: rows(ins)[0] && rows(ins)[0].id });
  }
  if (a === "l_project_get") {
    const p = UUID.test(String(b.id || "")) && rows(await B.sb("lab_projects?id=eq." + b.id + "&select=*"))[0]; const acc = p && await projAccess(u.id, p);
    if (!acc) return B.J(404, { error: "Project not found" });
    const takes = rows(await B.sb("lab_takes?project_id=eq." + p.id + "&select=id,track,bytes,seconds,mime,created_at&order=created_at.asc&limit=300"));
    return B.J(200, { ok: true, project: p, can_edit: acc.edit, owner: acc.own, takes: takes });
  }
  if (a === "l_project_save") {
    const p = UUID.test(String(b.id || "")) && rows(await B.sb("lab_projects?id=eq." + b.id + "&select=*"))[0]; const acc = p && await projAccess(u.id, p);
    if (!acc) return B.J(404, { error: "Project not found" }); if (!acc.edit) return B.J(403, { error: "You have view-only access to this project" });
    if (b.expect_version != null && Number(b.expect_version) !== p.version) return B.J(409, { error: "Someone saved a newer version. Reload to see it, or save as a new copy.", version: p.version });
    const row = { updated_at: new Date().toISOString() };
    if (b.data !== undefined) { if (!b.data || typeof b.data !== "object" || JSON.stringify(b.data).length > MAX_DATA) return B.J(400, { error: "Project data is too large" }); row.data = b.data; }
    if (b.bpm !== undefined) { const v = num(b.bpm, 40, 300); if (v == null) return B.J(400, { error: "Tempo is between 40 and 300" }); row.bpm = v; }
    if (acc.own) { // details owned by the project owner
      if (b.title !== undefined) { const t = clip(b.title, 100); if (t.length < 2) return B.J(400, { error: "Name the project" }); row.title = t; }
      if (b.artist_name !== undefined) row.artist_name = clip(b.artist_name, 80) || null; if (b.song_title !== undefined) row.song_title = clip(b.song_title, 100) || null;
      if (b.notes !== undefined) row.notes = clip(b.notes, 4000) || null;
      if (b.credits !== undefined) { if (!Array.isArray(b.credits)) return B.J(400, { error: "Bad credits" }); row.credits = b.credits.slice(0, 20).map(function (c) { return { name: clip(c && c.name, 60), role: clip(c && c.role, 40) }; }).filter(function (c) { return c.name; }); }
    }
    if (b.snapshot === true && row.data) await B.sb("lab_versions", { method: "POST", prefer: "return=minimal", body: { project_id: p.id, version: p.version + 1, data: row.data, note: clip(b.note, 120) || null, saved_by: u.id } });
    row.version = p.version + 1; // compare-and-set: only the version we read can be replaced
    const up = await B.sb("lab_projects?id=eq." + p.id + "&version=eq." + p.version, { method: "PATCH", prefer: "return=representation", body: row });
    if (!rows(up).length) return B.J(409, { error: "Someone saved a newer version. Reload to see it.", version: p.version });
    const old = rows(await B.sb("lab_versions?project_id=eq." + p.id + "&select=id,version&order=version.desc&offset=25&limit=50")); // keep the 25 newest snapshots
    if (old.length) await B.sb("lab_versions?id=in.(" + old.map(function (v) { return v.id; }).join(",") + ")", { method: "DELETE", prefer: "return=minimal" });
    return B.J(200, { ok: true, version: row.version, saved_at: row.updated_at });
  }
  if (a === "l_versions") {
    const p = UUID.test(String(b.id || "")) && rows(await B.sb("lab_projects?id=eq." + b.id + "&select=id,owner_user_id"))[0]; if (!p || !(await projAccess(u.id, p))) return B.J(404, { error: "Project not found" });
    if (UUID.test(String(b.version_id || ""))) { const v = rows(await B.sb("lab_versions?id=eq." + b.version_id + "&project_id=eq." + p.id + "&select=*"))[0]; return v ? B.J(200, { ok: true, version: v }) : B.J(404, { error: "Version not found" }); }
    return B.J(200, { ok: true, versions: rows(await B.sb("lab_versions?project_id=eq." + p.id + "&select=id,version,note,created_at&order=version.desc&limit=25")) });
  }
  if (a === "l_project_archive") { if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" }); await B.sb("lab_projects?id=eq." + b.id + "&owner_user_id=eq." + u.id, { method: "PATCH", prefer: "return=minimal", body: { status: b.archived === false ? "active" : "archived" } }); return B.J(200, { ok: true }); }

  // ───────── recordings (takes) and exports ─────────
  if (a === "l_take_url" || a === "l_take_save" || a === "l_take_get" || a === "l_take_delete" || a === "l_export_url" || a === "l_export_save" || a === "l_export_get") {
    const p = UUID.test(String(b.project_id || "")) && rows(await B.sb("lab_projects?id=eq." + b.project_id + "&select=*"))[0]; const acc = p && await projAccess(u.id, p);
    if (!acc) return B.J(404, { error: "Project not found" });
    const write = a !== "l_take_get" && a !== "l_export_get"; if (write && !acc.edit) return B.J(403, { error: "You have view-only access to this project" });
    const ownerEng = acc.own ? eng : await engineerOf(p.owner_user_id); if (write && !ownerEng) return B.J(403, { error: "The project owner's engineer access is off" });
    const folder = (a.indexOf("export") > 0 ? "exports/" : "takes/") + p.id; // files always live under the project owner's folder
    if (a === "l_take_url" || a === "l_export_url") {
      const bytes = Number(b.bytes), name = safeName(b.name || "take.webm"); if (!AUDIO_EXT.test(name)) return B.J(400, { error: "Unsupported audio type" }); if (!(bytes > 0) || bytes > MAX_FILE) return B.J(400, { error: "Files can be up to 50 MB each" });
      if (await used(p.owner_user_id) + bytes > Number(ownerEng.quota_bytes)) return B.J(400, { error: "Storage limit reached. Delete old takes or exports." });
      if (a === "l_take_url" && rows(await B.sb("lab_takes?project_id=eq." + p.id + "&select=id&limit=301")).length > 300) return B.J(400, { error: "This project has 300 takes. Delete some." });
      const path = "lab/" + p.owner_user_id + "/" + folder + "/" + Date.now() + "-" + name, url = await signUpload(path); return url ? B.J(200, { ok: true, uploadUrl: url, ref: "storage:lab-files/" + path }) : B.J(500, { error: "Uploads are not set up yet." });
    }
    if (a === "l_take_save" || a === "l_export_save") {
      const f = await checkRef(p.owner_user_id, b.file_ref, folder); if (f.err) return B.J(400, { error: f.err });
      if (a === "l_take_save") {
        const ins = await B.sb("lab_takes", { method: "POST", prefer: "return=representation", body: { project_id: p.id, owner_user_id: p.owner_user_id, track: clip(b.track, 40) || null, file_ref: f.ref, bytes: f.bytes, seconds: num(b.seconds, 0, 7200), mime: clip(b.mime, 40) || null } });
        return B.J(200, { ok: true, id: rows(ins)[0] && rows(ins)[0].id });
      }
      const prev = p.export_ref; await B.sb("lab_projects?id=eq." + p.id, { method: "PATCH", prefer: "return=minimal", body: { export_ref: f.ref, export_bytes: f.bytes, exported_at: new Date().toISOString() } }); if (prev && prev !== f.ref) await delObj(prev);
      return B.J(200, { ok: true });
    }
    if (a === "l_take_get") { const t = UUID.test(String(b.id || "")) && rows(await B.sb("lab_takes?id=eq." + b.id + "&project_id=eq." + p.id + "&select=file_ref"))[0]; const url = t && await M.signedUrl(t.file_ref, 600); return url ? B.J(200, { ok: true, url: url }) : B.J(404, { error: "Take not found" }); }
    if (a === "l_take_delete") { const t = UUID.test(String(b.id || "")) && rows(await B.sb("lab_takes?id=eq." + b.id + "&project_id=eq." + p.id + "&select=id,file_ref"))[0]; if (!t) return B.J(404, { error: "Take not found" }); await B.sb("lab_takes?id=eq." + t.id, { method: "DELETE", prefer: "return=minimal" }); await delObj(t.file_ref); return B.J(200, { ok: true }); }
    if (a === "l_export_get") { const url = p.export_ref && await M.signedUrl(p.export_ref, 600); return url ? B.J(200, { ok: true, url: url }) : B.J(404, { error: "No export yet" }); }
  }

  // ───────── connect to POTENT Music (records and links only: no splits, ownership or payments change) ─────────
  if (a === "l_link") {
    const p = UUID.test(String(b.id || "")) && rows(await B.sb("lab_projects?id=eq." + b.id + "&owner_user_id=eq." + u.id + "&select=id"))[0]; if (!p) return B.J(404, { error: "Project not found" });
    const row = {}; if (b.artist_name !== undefined) row.artist_name = clip(b.artist_name, 80) || null; if (b.song_title !== undefined) row.song_title = clip(b.song_title, 100) || null;
    if (b.music_project_id !== undefined) {
      if (b.music_project_id === null || b.music_project_id === "") row.music_project_id = null;
      else {
        if (!UUID.test(String(b.music_project_id))) return B.J(400, { error: "Bad song project" });
        const mp = rows(await B.sb("music_projects?id=eq." + b.music_project_id + "&select=id,owner_user_id,title"))[0];
        const isOwner = mp && mp.owner_user_id === u.id, isContrib = mp && !isOwner && rows(await B.sb("music_contributors?project_id=eq." + mp.id + "&email=eq." + encodeURIComponent(u.email.toLowerCase()) + "&select=id")).length > 0;
        if (!mp || (!isOwner && !isContrib)) return B.J(404, { error: "That song project was not found on your account" }); // same answer for "not yours"
        row.music_project_id = mp.id; if (!row.song_title) row.song_title = mp.title;
      }
    }
    await B.sb("lab_projects?id=eq." + p.id, { method: "PATCH", prefer: "return=minimal", body: row }); return B.J(200, { ok: true });
  }
  if (a === "l_my_songs") { // song projects this engineer can link to
    const own = rows(await B.sb("music_projects?owner_user_id=eq." + u.id + "&select=id,title&order=created_at.desc&limit=100"));
    const cids = rows(await B.sb("music_contributors?email=eq." + encodeURIComponent(u.email.toLowerCase()) + "&select=project_id&limit=100")).map(function (c) { return c.project_id; });
    const cs = cids.length ? rows(await B.sb("music_projects?id=in.(" + cids.join(",") + ")&select=id,title")) : [];
    const seen = {}; const list = own.map(function (x) { seen[x.id] = 1; return { id: x.id, title: x.title, mine: true }; });
    cs.forEach(function (c) { if (!seen[c.id]) { seen[c.id] = 1; list.push({ id: c.id, title: c.title, mine: false }); } });
    return B.J(200, { ok: true, songs: list });
  }
  if (a === "l_handoff") { // copy the finished mix into the song's release workflow as its final audio. Splits and ownership are untouched.
    const p = UUID.test(String(b.id || "")) && rows(await B.sb("lab_projects?id=eq." + b.id + "&owner_user_id=eq." + u.id + "&select=*"))[0]; if (!p) return B.J(404, { error: "Project not found" });
    if (!p.export_ref) return B.J(400, { error: "Export a mix first" }); if (!p.music_project_id) return B.J(400, { error: "Link this project to a song first" });
    const mp = rows(await B.sb("music_projects?id=eq." + p.music_project_id + "&select=id,owner_user_id"))[0];
    if (!mp || mp.owner_user_id !== u.id) return B.J(403, { error: "Only the song's owner can attach its final audio. Download the export and send it to them." });
    const name = p.export_ref.split("/").pop(), dest = "projects/" + u.id + "/" + mp.id + "/" + name;
    const cp = await fetch(B.SB + "/storage/v1/object/copy", { method: "POST", headers: { apikey: sbKey(), Authorization: "Bearer " + sbKey(), "Content-Type": "application/json" }, body: JSON.stringify({ bucketId: "lab-files", sourceKey: p.export_ref.slice(18), destinationBucket: "beat-files", destinationKey: dest }) });
    if (!cp.ok) return B.J(500, { error: "Could not copy the file. Try again." });
    await B.sb("music_projects?id=eq." + mp.id, { method: "PATCH", prefer: "return=minimal", body: { final_audio_ref: "storage:beat-files/" + dest } });
    await B.sb("lab_projects?id=eq." + p.id, { method: "PATCH", prefer: "return=minimal", body: { handed_off_at: new Date().toISOString() } });
    await B.audit("user:" + u.email, "lab_handoff", p.id, { music_project_id: mp.id }); return B.J(200, { ok: true, note: "Final audio is saved on the song. Splits and ownership were not changed." });
  }
  if (a === "l_prep") { // flags only. Nothing is listed or published; the marketplace and live events keep their own rights checks.
    const p = UUID.test(String(b.id || "")) && rows(await B.sb("lab_projects?id=eq." + b.id + "&owner_user_id=eq." + u.id + "&select=id,export_ref"))[0]; if (!p) return B.J(404, { error: "Project not found" });
    if (b.on !== false && !p.export_ref) return B.J(400, { error: "Export a mix first" });
    const col = b.target === "live" ? "live_ready" : b.target === "marketplace" ? "marketplace_ready" : null; if (!col) return B.J(400, { error: "Unknown target" });
    const body = {}; body[col] = b.on !== false; await B.sb("lab_projects?id=eq." + p.id, { method: "PATCH", prefer: "return=minimal", body: body });
    return B.J(200, { ok: true, note: col === "marketplace_ready" ? "Marked ready. To sell it, list it in Beat Man. Every sale still uses the exclusive-sale agreement and fee rules." : "Marked ready for live events. The host still confirms performance rights for each session." });
  }
  if (a === "l_ready_beats") { // finished mixes the engineer can bring into a Smoke Session
    return B.J(200, { ok: true, projects: rows(await B.sb("lab_projects?owner_user_id=eq." + u.id + "&live_ready=eq.true&select=id,title,artist_name,export_ref")) .map(function (x) { return { id: x.id, title: x.title, artist_name: x.artist_name }; }) });
  }
  return B.J(400, { error: "Unknown action" });
};
exports.lib = { objSize: objSize };
