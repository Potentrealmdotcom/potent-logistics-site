// Run: node tests/release.test.js
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.SUPABASE_URL = "https://x.supabase.co";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const U = "11111111-1111-1111-1111-111111111111", P = "22222222-2222-2222-2222-222222222222", C1 = "c1c1c1c1-1111-1111-1111-111111111111", C2 = "c2c2c2c2-1111-1111-1111-111111111111", S1 = "5a5a5a5a-1111-1111-1111-111111111111", S2 = "5b5b5b5b-1111-1111-1111-111111111111";
const T = { music_projects: [{ id: P, owner_user_id: U, title: "My Song", beat_sale_id: null, final_audio_ref: null }],
  music_contributors: [{ id: C1, project_id: P, name: "Ann", email: "a@x.com", roles: ["artist"] }, { id: C2, project_id: P, name: "Bo", email: "b@x.com", roles: ["writer"] }],
  music_schedules: [], music_schedule_lines: [], music_schedule_approvals: [], music_revenue: [], music_allocations: [], music_works: [], music_registrations: [], music_djs: [], music_campaigns: [], music_campaign_tasks: [], music_reminders: [], music_notifications: [], beat_audit: [], beat_settings: [] };
let seq = 0; const uid = () => "dddddddd-0000-4000-8000-" + String(++seq).padStart(12, "0");
function filt(rows, q) { return rows.filter(r => q.split("&").every(p => { const m = p.match(/^(\w+)=eq\.(.*)$/); if (m) return String(r[m[1]]) === decodeURIComponent(m[2]); const z = p.match(/^(\w+)=is\.null$/); if (z) return r[z[1]] == null; return true; })); }
global.fetch = async (u, o) => { o = o || {}; u = String(u); const m = o.method || "GET"; const R = (d) => ({ ok: true, status: 200, text: async () => JSON.stringify(d) });
  const t = (u.match(/rest\/v1\/([a-z_]+)/) || [])[1]; if (!T[t]) return R([]); const q = u.split("?")[1] || "";
  if (m === "GET") { const d = filt(T[t], q).map(r => Object.assign({}, r)); if (t === "music_schedules") d.forEach(s => { s.music_schedule_lines = T.music_schedule_lines.filter(l => l.schedule_id === s.id); s.music_schedule_approvals = T.music_schedule_approvals.filter(l => l.schedule_id === s.id); }); if (t === "music_campaigns") d.forEach(c => { c.music_campaign_tasks = T.music_campaign_tasks.filter(x => x.campaign_id === c.id); c.music_djs = T.music_djs.find(x => x.id === c.dj_id) || null; }); return R(d); }
  if (m === "POST") { const out = []; for (const r of [].concat(JSON.parse(o.body))) { let key = t === "music_works" ? "project_id" : t === "music_registrations" ? null : null; let ex = t === "music_works" ? T[t].find(x => x.project_id === r.project_id) : t === "music_registrations" ? T[t].find(x => x.project_id === r.project_id && x.org === r.org && x.name === r.name) : null; if (ex) { Object.assign(ex, r); out.push(ex); continue; } const row = Object.assign({ id: uid(), created_at: new Date().toISOString() }, t === "music_djs" ? { active: true, city: "Atlanta" } : {}, r); T[t].push(row); out.push(row); } return R(out); }
  if (m === "PATCH") { const hit = filt(T[t], q); hit.forEach(r => Object.assign(r, JSON.parse(o.body))); return R(hit); }
  if (m === "DELETE") { filt(T[t], q).forEach(r => T[t].splice(T[t].indexOf(r), 1)); return R([]); }
  return R([]); };
const A = require("../netlify/functions/music-release.js"), Mu = require("../netlify/functions/lib/music.js");
const call = async (a, extra) => { const r = await A.handler({ httpMethod: "POST", headers: { authorization: "Bearer " + Mu.signUser(U) }, body: JSON.stringify(Object.assign({ action: a, project_id: P }, extra || {})) }); return { s: r.statusCode, j: JSON.parse(r.body) }; };
const step = (r, k) => r.j.tracker.steps.find(x => x.k === k);
(async () => {
  let r = await call("r_track"); ok(r.s === 200 && r.j.tracker.total === 7, "seven steps");
  ok(step(r, "beat").s === "NOT APPLICABLE" && step(r, "team").s === "COMPLETED" && step(r, "splits").s === "NOT STARTED" && step(r, "audio").s === "NOT STARTED" && step(r, "dist").s === "NOT STARTED" && step(r, "earn").s === "NOT STARTED", "honest starting statuses");
  ok(r.j.tracker.next.k === "splits", "next step is the first unfinished one");
  // splits in progress then approved
  T.music_schedules.push({ id: S1, project_id: P, category: "master", status: "pending", version: 1 }); r = await call("r_track"); ok(step(r, "splits").s === "IN PROGRESS", "pending split = in progress");
  T.music_schedule_approvals.push({ schedule_id: S1, contributor_id: C1, decision: "disputed" }); T.music_schedules[0].status = "disputed"; r = await call("r_track"); ok(step(r, "splits").s === "ACTION REQUIRED" && r.j.tracker.next.k === "splits", "dispute = action required, shown first");
  T.music_schedules[0].status = "approved"; T.music_schedules.push({ id: S2, project_id: P, category: "publishing", status: "approved", version: 1 }); r = await call("r_track"); ok(step(r, "splits").s === "COMPLETED", "both splits approved = completed");
  // work metadata
  r = await call("r_work_save", { release_title: "My Song", isrc: "bad" }); ok(r.s === 400, "bad ISRC rejected");
  r = await call("r_work_save", { release_title: "My Song", isrc: "usabc2600001", iswc: "t1234567890", upc: "123456789012" }); ok(r.s === 200 && T.music_works[0].isrc === "US-ABC-26-00001" && T.music_works[0].iswc === "T-123.456.789-0", "identifiers normalized");
  ok(step(r, "details").s === "IN PROGRESS", "details partly filled");
  r = await call("r_work_save", { release_title: "My Song", primary_artist: "Ann", release_date: "2026-12-01" }); ok(step(r, "details").s === "COMPLETED", "details complete");
  // registrations never confirmed without evidence
  r = await call("r_reg_save", { org: "distributor", name: "DistroKid", status: "confirmed" }); ok(r.s === 400 && /confirmation/i.test(r.j.error), "cannot confirm without a confirmation number");
  r = await call("r_reg_save", { org: "distributor", name: "DistroKid", status: "submitted" }); ok(r.s === 200 && step(r, "dist").s === "IN PROGRESS" && T.music_registrations[0].submitted_at, "submitted = in progress");
  r = await call("r_reg_save", { org: "distributor", name: "DistroKid", status: "confirmed", confirmation_ref: "DK-99881" }); ok(step(r, "dist").s === "COMPLETED", "confirmed with a reference = completed");
  r = await call("r_reg_save", { org: "distributor", name: "Other", status: "rejected" }); ok(step(r, "dist").s === "COMPLETED", "a confirmed registration stays confirmed");
  // audio must belong to this project
  r = await call("r_audio_set", { ref: "storage:beat-files/projects/someone-else/" + P + "/x.wav" }); ok(r.s === 400, "foreign audio ref refused");
  r = await call("r_audio_set", { ref: "storage:beat-files/projects/" + U + "/" + P + "/1-x.wav" }); ok(r.s === 200 && step(r, "audio").s === "COMPLETED", "audio saved");
  // statements
  T.music_revenue.push({ id: "e1e1e1e1-1111-1111-1111-111111111111", project_id: P, category: "master", source: "statement", status: "received", reference: "R1", schedule_version: 1, created_at: "2026-01-01" }, { id: "e2e2e2e2-1111-1111-1111-111111111111", project_id: P, category: "master", source: "statement", status: "calculated", reference: "R2", schedule_version: 1, created_at: "2026-02-01" });
  T.music_allocations.push({ revenue_id: T.music_revenue[0].id, contributor_id: C1, cents: 6000 }, { revenue_id: T.music_revenue[0].id, contributor_id: C2, cents: 4000 }, { revenue_id: T.music_revenue[1].id, contributor_id: C1, cents: 3000 }, { revenue_id: T.music_revenue[1].id, contributor_id: C2, cents: 2000 });
  r = await call("r_statements"); const ann = r.j.people.find(x => x.name === "Ann"); ok(ann.calculated_cents === 9000 && ann.received_cents === 6000 && ann.awaiting_cents === 3000, "per-person totals separate received from awaiting");
  ok(/\$90\.00/.test(r.j.summary) && /\$60\.00/.test(r.j.summary), "summary uses record numbers");
  r = await call("r_statements", { csv: true }); ok(r.j.csv.split("\n").length === 5, "CSV has one row per allocation");
  r = await call("r_track"); ok(step(r, "earn").s === "COMPLETED" && r.j.tracker.done === 7, "all seven done");
  // campaigns
  r = await call("c_save", { title: "Atlanta push", comp_type: "percent_promo", comp_pct: 5 }); ok(r.s === 409, "percentage needs an approved promo split");
  r = await call("c_save", { title: "Atlanta push", comp_type: "flat", comp_flat_cents: 5000, brief: "Play at Friday set", due_date: "2026-11-01" }); ok(r.s === 200, "flat fee campaign saved");
  const cid = r.j.id; r = await call("c_task", { campaign_id: cid, title: "Send mp3" }); ok(r.s === 200 && T.music_campaign_tasks.length === 1, "task added");
  r = await call("c_draft", { campaign_id: cid }); ok(/\$50\.00/.test(r.j.text) && /doesn't change who owns/.test(r.j.text), "outreach states the real fee and ownership line");
  r = await call("dj_save", { name: "DJ Test", kind: "dj" }); ok(r.s === 200, "dj saved"); r = await call("dj_list", {}); ok(r.j.djs.length === 1 && r.j.djs[0].mine, "directory lists Atlanta contacts");
  // reminders surface once
  r = await call("rem_add", { text: "Send stems", due_at: new Date(Date.now() - 1000).toISOString() }); ok(r.s === 200, "reminder added");
  await call("rem_list"); await call("rem_list"); ok(T.music_notifications.length === 1, "due reminder notifies exactly once");
  r = await call("r_import", { category: "master", csv: "ref,amount\nx,1" }); ok(r.s === 400, "import needs the right header");
  console.log("PASS: " + n + " assertions");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
