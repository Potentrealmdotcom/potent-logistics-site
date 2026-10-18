// Run: node tests/lab.test.js   (Beat Lab: engineer library, projects, takes, exports, hand-off, privacy)
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.SUPABASE_URL = "https://x.supabase.co";
const assert = require("assert"), crypto = require("crypto"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const E = "11111111-1111-1111-1111-111111111111", F = "22222222-2222-2222-2222-222222222222", X = "33333333-3333-3333-3333-333333333333", ART = "44444444-4444-4444-4444-444444444444", MP = "55555555-5555-4555-8555-555555555555", MP2 = "66666666-6666-4666-8666-666666666666";
const T = { music_users: [{ id: E, email: "eng@x.com", name: "Eng", active: true }, { id: F, email: "eng2@x.com", name: "Eng2", active: true }, { id: X, email: "fan@x.com", name: "Fan", active: true }, { id: ART, email: "art@x.com", name: "Artist", active: true }],
  music_engineers: [{ user_id: E, active: true, quota_bytes: 10 * 1048576 }, { user_id: F, active: true, quota_bytes: 10 * 1048576 }],
  lab_packs: [], lab_assets: [], lab_shares: [], lab_projects: [], lab_versions: [], lab_takes: [], lab_presets: [],
  music_projects: [{ id: MP, owner_user_id: E, title: "My Song", final_audio_ref: null }, { id: MP2, owner_user_id: ART, title: "Artist Song", final_audio_ref: null }], music_contributors: [{ project_id: MP2, email: "eng@x.com" }], music_schedules: [], beat_audit: [] };
const mock = require("./_mock.js")(T, { defaults: { lab_projects: { version: 1, status: "active", credits: [], export_bytes: 0 }, lab_packs: { visibility: "private", archived: false, commercial_ok: false }, lab_assets: { archived: false, tags: [] } }, unique: { music_engineers: (x, r) => x.user_id === r.user_id, lab_shares: (x, r) => x.kind === r.kind && x.ref_id === r.ref_id && x.shared_with_user_id === r.shared_with_user_id } });
const A = require("../netlify/functions/music-lab.js"), Mu = require("../netlify/functions/lib/music.js");
const ownerTok = (() => { const body = Buffer.from(JSON.stringify({ role: "owner", exp: Date.now() + 1e6 })).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); return body + "." + crypto.createHmac("sha256", "t").update(body).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); })();
const as = (uid, tok) => async (action, extra) => { const r = await A.handler({ httpMethod: "POST", headers: { authorization: "Bearer " + (tok || Mu.signUser(uid)) }, body: JSON.stringify(Object.assign({ action }, extra || {})) }); return { s: r.statusCode, j: JSON.parse(r.body) }; };
const eng = as(E), eng2 = as(F), fan = as(X), art = as(ART), owner = as(null, ownerTok);
(async () => {
  // roles
  let r = await fan("l_me"); ok(r.s === 200 && r.j.engineer === false, "fan is not an engineer");
  r = await fan("l_overview"); ok(r.s === 403, "fan cannot open the library");
  r = await A.handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ action: "l_overview" }) }); ok(JSON.parse(r.body).error && r.statusCode === 401, "signed-out refused");
  r = await fan("o_eng_set", { email: "fan@x.com" }); ok(r.s === 403, "fan cannot grant engineer access");
  r = await owner("o_eng_set", { email: "fan@x.com", quota_gb: 1 }); ok(r.s === 200 && T.music_engineers.length === 3, "owner grants engineer"); r = await fan("l_me"); ok(r.j.engineer === true && r.j.quota_bytes === 1073741824, "fan is now an engineer with a 1 GB limit");
  r = await owner("o_eng_set", { email: "fan@x.com", active: false }); r = await fan("l_overview"); ok(r.s === 403, "switching off removes access");
  // packs + upload rules
  r = await eng("l_pack_save", { name: "POTENT 808 Collection" }); ok(r.s === 200 && T.lab_packs[0].visibility === "private", "packs start private"); const PK = r.j.id;
  r = await eng("l_pack_save", { name: "X", visibility: "public" }); ok(r.s === 400, "an engineer cannot self-publish");
  r = await eng("l_pack_save", { name: "Bad commercial", commercial_ok: true }); ok(r.s === 400, "commercial label needs a written licence");
  r = await eng("l_upload_url", { name: "kick.exe", bytes: 1000 }); ok(r.s === 400, "non-audio refused");
  r = await eng("l_upload_url", { name: "kick.wav", bytes: 60 * 1048576 }); ok(r.s === 400, "over 50MB refused");
  r = await eng("l_upload_url", { name: "kick.wav", bytes: 20 * 1048576 }); ok(r.s === 400 && /storage limit/.test(r.j.error), "over quota refused");
  r = await eng("l_upload_url", { name: "kick drum.wav", bytes: 500000 }); ok(r.s === 200 && r.j.ref.startsWith("storage:lab-files/lab/" + E + "/assets/") && /kick_drum\.wav$/.test(r.j.ref), "signed slot in own folder"); const ref1 = r.j.ref;
  r = await eng("l_asset_save", { file_ref: ref1, name: "Kick 1", kind: "drum", pack_id: PK }); ok(r.s === 400 && /Tick the box/.test(r.j.error), "must attest rights");
  r = await eng("l_asset_save", { file_ref: ref1, name: "Kick 1", kind: "drum", pack_id: PK, attest: true }); ok(r.s === 400 && /did not finish/.test(r.j.error), "file must really exist");
  mock.OBJ[ref1.slice(18)] = 500000;
  r = await eng("l_asset_save", { file_ref: "storage:lab-files/lab/" + F + "/assets/z.wav", name: "x", attest: true }); ok(r.s === 400, "someone else's path refused");
  r = await eng("l_asset_save", { file_ref: "storage:lab-files/lab/" + E + "/assets/../../" + F + "/a.wav", name: "x", attest: true }); ok(r.s === 400, "path traversal refused");
  r = await eng("l_asset_save", { file_ref: ref1, name: "Kick 1", kind: "drum", pack_id: PK, attest: true, permission_status: "licensed", bpm: 140, tags: "Trap, Hard" }); ok(r.s === 400 && /licence/.test(r.j.error), "licensed needs the licence text");
  r = await eng("l_asset_save", { file_ref: ref1, name: "Kick 1", kind: "drum", pack_id: PK, attest: true, permission_status: "original", bpm: 140, musical_key: "Am", tags: "Trap, Hard", commercial_ok: true }); ok(r.s === 200 && T.lab_assets[0].bytes === 500000 && T.lab_assets[0].tags.join() === "trap,hard" && T.lab_assets[0].commercial_ok === true, "original sound saved with the real size");
  const A1 = r.j.id;
  r = await eng("l_asset_save", { id: A1, permission_status: "unverified" }); ok(r.s === 400, "cannot be commercial while permission is unverified");
  r = await eng("l_asset_save", { id: A1, permission_status: "unverified", commercial_ok: false }); ok(r.s === 200, "can downgrade");
  r = await eng("l_pack_save", { id: PK, name: "POTENT 808 Collection", license: "All original, I made them", commercial_ok: true }); ok(r.s === 400 && /no confirmed permission/.test(r.j.error), "pack cannot be commercial with an unverified sound inside");
  r = await eng("l_asset_save", { id: A1, permission_status: "original" }); r = await eng("l_pack_save", { id: PK, name: "POTENT 808 Collection", license: "All original, I made them", commercial_ok: true }); ok(r.s === 200 && T.lab_packs[0].commercial_ok, "commercial pack once every sound is confirmed");
  // search
  r = await eng("l_assets", { q: "trap" }); ok(r.j.assets.length === 1, "search by tag"); r = await eng("l_assets", { bpm_min: 150 }); ok(r.j.assets.length === 0, "bpm filter"); r = await eng("l_assets", { key: "am" }); ok(r.j.assets.length === 1, "key filter");
  // privacy
  r = await eng2("l_assets", {}); ok(r.j.assets.length === 0, "other engineer sees nothing of mine"); r = await eng2("l_asset_url", { id: A1 }); ok(r.s === 404, "other engineer cannot sign my file");
  r = await fan("l_asset_url", { id: A1 }); ok(r.s === 403, "non-engineer cannot either"); r = await eng2("l_asset_save", { id: A1, name: "stolen" }); ok(r.s === 404 && T.lab_assets[0].name === "Kick 1", "cannot edit another engineer's sound");
  r = await eng2("l_asset_delete", { id: A1 }); ok(r.s === 404 && T.lab_assets.length === 1, "cannot delete it");
  r = await eng("l_asset_url", { id: A1 }); ok(r.s === 200 && /object\/sign\/lab-files\/lab\/11111111/.test(r.j.url), "owner gets a short-lived link");
  // sharing
  r = await eng("l_share", { kind: "pack", id: PK, email: "fan@x.com" }); ok(r.s === 400, "packs only go to engineers (fan was switched off)");
  r = await eng("l_share", { kind: "pack", id: PK, email: "eng2@x.com" }); ok(r.s === 200 && T.lab_packs[0].visibility === "shared", "shared with another engineer");
  r = await eng2("l_asset_url", { id: A1 }); ok(r.s === 200, "shared engineer can preview"); r = await eng2("l_assets", { scope: "shared" }); ok(r.j.assets.length === 1, "shows under shared"); r = await eng2("l_asset_delete", { id: A1 }); ok(r.s === 404, "but cannot delete it");
  r = await eng("l_share", { kind: "pack", id: PK, email: "eng2@x.com", remove: true }); r = await eng2("l_asset_url", { id: A1 }); ok(r.s === 404, "unsharing removes access");
  // public needs owner approval
  r = await eng("l_pack_save", { id: PK, name: "POTENT 808 Collection", license: "All original", visibility: "public_requested" }); ok(T.lab_packs[0].visibility === "public_requested", "request public");
  r = await eng2("l_assets", { scope: "public" }); ok(r.j.assets.length === 0, "not public until approved");
  r = await eng("o_packs_pending"); ok(r.s === 403, "engineer cannot approve"); r = await owner("o_pack_decide", { id: PK, approve: true }); r = await eng2("l_assets", { scope: "public" }); ok(r.j.assets.length === 1, "approved pack visible to engineers");
  r = await fan("l_assets", { scope: "public" }); ok(r.s === 403, "still not to the public");
  r = await eng("l_asset_save", { id: A1, name: "Kick 1b" }); ok(T.lab_packs[0].visibility === "public_requested", "editing an approved pack sends it back for approval");
  r = await eng2("l_assets", { scope: "public" }); ok(r.j.assets.length === 0, "and it is hidden again meanwhile");
  // replace / archive / delete
  r = await eng("l_upload_url", { name: "kick2.wav", bytes: 1000 }); mock.OBJ[r.j.ref.slice(18)] = 1000; const ref2 = r.j.ref;
  r = await eng("l_asset_replace", { id: A1, file_ref: ref2 }); ok(r.s === 200 && T.lab_assets[0].file_ref === ref2 && T.lab_assets[0].bytes === 1000 && mock.OBJ[ref1.slice(18)] === undefined, "replace swaps the file and removes the old one");
  r = await eng("l_asset_archive", { id: A1 }); r = await eng("l_assets", {}); ok(r.j.assets.length === 0, "archived hides"); r = await eng("l_assets", { archived: true }); ok(r.j.assets.length === 1, "archive view");
  // presets / kits
  r = await eng("l_preset_save", { name: "My trap kit", data: { type: "kit", slots: [A1] } }); ok(r.s === 200, "kit saved"); r = await eng2("l_presets"); ok(r.j.presets.length === 0, "kits are private"); r = await eng("l_preset_save", { name: "Template A", kind: "template", data: { bpm: 140, patterns: [{ n: "P1" }] } });
  // projects
  r = await eng("l_project_create", { title: "Night Drive", artist_name: "Ann", bpm: 140 }); ok(r.s === 200, "project created"); const PJ = r.j.id; ok(T.lab_projects[0].version === 1, "starts at version 1");
  r = await eng("l_project_save", { id: PJ, data: { patterns: [{ steps: [1, 0, 0, 0] }] }, expect_version: 1 }); ok(r.s === 200 && r.j.version === 2, "save bumps version");
  r = await eng("l_project_save", { id: PJ, data: { x: 1 }, expect_version: 1 }); ok(r.s === 409, "stale save refused (no silent overwrite)");
  r = await eng("l_project_save", { id: PJ, data: { big: "x".repeat(700000) } }); ok(r.s === 400, "oversized refused");
  r = await eng("l_project_save", { id: PJ, data: { patterns: 2 }, snapshot: true, note: "v-two", expect_version: 2 }); ok(r.s === 200 && T.lab_versions.length === 1, "snapshot kept"); r = await eng("l_versions", { id: PJ }); ok(r.j.versions.length === 1, "versions listed");
  r = await eng("l_versions", { id: PJ, version_id: T.lab_versions[0].id }); ok(r.j.version.data.patterns === 2, "a version can be reopened");
  for (let i = 0; i < 30; i++) await eng("l_project_save", { id: PJ, data: { i: i }, snapshot: true }); ok(T.lab_versions.length <= 26, "snapshots are pruned");
  r = await eng2("l_project_get", { id: PJ }); ok(r.s === 404, "other engineer cannot open my project"); r = await fan("l_project_get", { id: PJ }); ok(r.s === 404, "nor a fan"); r = await eng2("l_project_save", { id: PJ, data: { evil: 1 } }); ok(r.s === 404, "nor save");
  r = await eng2("l_take_get", { project_id: PJ, id: "x" }); ok(r.s === 404, "nor reach its takes");
  // collaborator
  r = await eng("l_share", { kind: "project", id: PJ, email: "art@x.com", can_edit: false }); ok(r.s === 200, "invite artist (view only)");
  r = await art("l_project_get", { id: PJ }); ok(r.s === 200 && r.j.can_edit === false && r.j.owner === false, "artist can open it"); r = await art("l_project_save", { id: PJ, data: { y: 1 } }); ok(r.s === 403, "view-only cannot save");
  r = await art("l_projects"); ok(r.j.shared.length === 1, "shows up for the collaborator");
  r = await eng("l_share", { kind: "project", id: PJ, email: "art@x.com", can_edit: true }); r = await art("l_project_get", { id: PJ }); const ver = r.j.project.version; r = await art("l_project_save", { id: PJ, data: { y: 1 }, title: "hijack", expect_version: ver }); ok(r.s === 200 && T.lab_projects[0].title === "Night Drive", "editor saves data but cannot rename or change credits");
  r = await art("l_project_archive", { id: PJ }); ok(r.s === 403, "collaborator cannot archive");
  // takes
  r = await eng("l_take_url", { project_id: PJ, name: "vocal.webm", bytes: 800000 }); ok(r.s === 200 && r.j.ref.includes("/takes/" + PJ + "/"), "take slot"); const tref = r.j.ref;
  r = await eng("l_take_save", { project_id: PJ, file_ref: tref, track: "Vox", seconds: 12.5 }); ok(r.s === 400, "unfinished upload refused"); mock.OBJ[tref.slice(18)] = 800000;
  r = await eng("l_take_save", { project_id: PJ, file_ref: tref, track: "Vox", seconds: 12.5, mime: "audio/webm" }); ok(r.s === 200 && T.lab_takes[0].bytes === 800000, "take saved");
  r = await eng("l_take_save", { project_id: PJ, file_ref: "storage:lab-files/lab/" + E + "/assets/kick.wav" }); ok(r.s === 400, "take must be in the project's takes folder");
  r = await eng("l_project_get", { id: PJ }); ok(r.j.takes.length === 1, "takes listed"); r = await art("l_take_get", { project_id: PJ, id: T.lab_takes[0].id }); ok(r.s === 200 && /sign/.test(r.j.url), "collaborator can listen");
  r = await art("l_take_url", { project_id: PJ, name: "x.webm", bytes: 10 }); ok(r.s === 403, "non-engineer collaborator cannot add takes");
  r = await art("l_take_delete", { project_id: PJ, id: T.lab_takes[0].id }); ok(r.s === 403 || r.s === 404, "collaborator cannot delete takes");
  // export + handoff
  r = await eng("l_prep", { id: PJ, target: "marketplace" }); ok(r.s === 400, "cannot prep without an export");
  r = await eng("l_export_url", { project_id: PJ, name: "mix.wav", bytes: 3000000 }); const xref = r.j.ref; mock.OBJ[xref.slice(18)] = 3000000; r = await eng("l_export_save", { project_id: PJ, file_ref: xref }); ok(r.s === 200 && T.lab_projects[0].export_bytes === 3000000, "export saved with real size");
  r = await eng("l_handoff", { id: PJ }); ok(r.s === 400 && /Link/.test(r.j.error), "hand-off needs a linked song");
  r = await eng("l_link", { id: PJ, music_project_id: MP2 }); ok(r.s === 200 && T.lab_projects[0].music_project_id === MP2, "linking to a song I'm a contributor on");
  r = await eng("l_handoff", { id: PJ }); ok(r.s === 403 && T.music_projects[1].final_audio_ref == null, "only the song's owner can attach final audio");
  r = await eng("l_link", { id: PJ, music_project_id: "99999999-9999-4999-8999-999999999999" }); ok(r.s === 404, "unknown song refused"); r = await fan("l_link", { id: PJ, music_project_id: MP }); ok(r.s === 403, "fan cannot link");
  r = await eng("l_link", { id: PJ, music_project_id: MP }); r = await eng("l_handoff", { id: PJ }); ok(r.s === 200 && /^storage:beat-files\/projects\/1111/.test(T.music_projects[0].final_audio_ref) && mock.OBJ[T.music_projects[0].final_audio_ref.slice(8)], "owner's hand-off copies into the release workflow");
  ok(T.music_schedules.length === 0, "hand-off created no splits");
  r = await eng("l_prep", { id: PJ, target: "marketplace" }); ok(r.s === 200 && T.lab_projects[0].marketplace_ready, "marked ready (flag only)"); r = await eng("l_prep", { id: PJ, target: "live" }); r = await eng("l_ready_beats"); ok(r.j.projects.length === 1, "ready for live events");
  r = await eng("l_my_songs"); ok(r.j.songs.length === 2, "songs list includes contributor songs");
  // quota counts everything
  r = await eng("l_me"); ok(r.j.used_bytes === 1000 + 800000 + 3000000, "usage = assets + takes + export");
  r = await eng("l_project_archive", { id: PJ }); r = await eng("l_projects"); ok(r.j.mine.length === 0, "archive hides");
  r = await eng("l_nope"); ok(r.s === 400, "unknown action");
  console.log("lab.test.js: " + n + " checks passed");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
