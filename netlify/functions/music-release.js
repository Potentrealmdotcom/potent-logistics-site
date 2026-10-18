// POTENT Music: release prep tracker, work metadata, registration tracking (records only), per-person statements,
// Atlanta DJ / promoter network and campaigns, reminders, voice-note drafts.
// Nothing here submits anything anywhere. A registration only shows "confirmed" when a confirmation number was entered.
const B = require("./lib/beats");
const M = require("./lib/music");
const RR = require("./music-rights");
const L = RR.lib;
const UUID = /^[0-9a-f-]{36}$/i;
const clip = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n); };
const rows = function (r) { return r.ok && Array.isArray(r.data) ? r.data : []; };
const EMAIL = /^[^\s@]+@[^@\s]+\.[^\s@]{2,}$/;
const usd = function (c) { return "$" + ((c || 0) / 100).toFixed(2); };
const csvq = function (v) { v = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const fails = {};
function tooMany(k, max) { const f = fails[k]; return !!(f && f.n >= max && Date.now() - f.t < 36e5); }
function note(k) { const f = fails[k]; if (!f || Date.now() - f.t > 36e5) fails[k] = { n: 1, t: Date.now() }; else { f.n++; f.t = Date.now(); } }
const ORGS = ["distributor", "pro", "mlc", "soundexchange", "copyright_office", "other"], REG_ST = ["not_started", "prepared", "submitted", "confirmed", "rejected"];
const ORG_NAME = { distributor: "Distributor", pro: "Performing rights organization (PRO)", mlc: "Mechanical licensing (MLC)", soundexchange: "SoundExchange", copyright_office: "Copyright Office", other: "Other" };

// Seven steps, each with an honest status taken from the records. No AI, no guessing.
function tracker(p, work, regs) {
  const has = function (c) { return p.schedules.some(function (s) { return s.category === c && s.status === "approved"; }); };
  const anySched = function (c) { return p.schedules.some(function (s) { return s.category === c; }); };
  const disputed = p.schedules.some(function (s) { return s.status === "disputed"; });
  const dist = regs.filter(function (r) { return r.org === "distributor"; });
  const wf = work ? ["release_title", "primary_artist", "release_date"].filter(function (k) { return work[k]; }).length : 0;
  const splitDone = has("master") && has("publishing");
  const distSt = dist.some(function (r) { return r.status === "confirmed"; }) ? "COMPLETED" : dist.some(function (r) { return r.status === "rejected"; }) ? "ACTION REQUIRED" : dist.some(function (r) { return r.status === "submitted" || r.status === "prepared"; }) ? "IN PROGRESS" : "NOT STARTED";
  const steps = [
    { k: "beat", t: "Beat purchased", s: p.beat_sale_id ? "COMPLETED" : "NOT APPLICABLE", d: p.beat_sale_id ? "Linked to your completed purchase." : "This project is not linked to a beat purchase. That is fine if you made the music yourself." },
    { k: "team", t: "Song contributors added", s: p.contributors.length ? "COMPLETED" : "NOT STARTED", d: p.contributors.length + " people on this project.", page: "team" },
    { k: "splits", t: "Revenue splits approved", s: splitDone ? "COMPLETED" : disputed ? "ACTION REQUIRED" : (anySched("master") || anySched("publishing")) ? "IN PROGRESS" : "NOT STARTED", d: "Master recording " + (has("master") ? "approved" : "not approved yet") + ". Songwriting " + (has("publishing") ? "approved" : "not approved yet") + ".", page: "splits" },
    { k: "audio", t: "Upload final audio", s: p.final_audio_ref ? "COMPLETED" : "NOT STARTED", d: p.final_audio_ref ? "Final audio is saved to this project." : "No final audio is saved yet.", page: "audio" },
    { k: "details", t: "Confirm release details", s: wf === 3 ? "COMPLETED" : wf > 0 ? "IN PROGRESS" : "NOT STARTED", d: "Title, artist and release date" + (wf === 3 ? " are filled in." : " are needed."), page: "details" },
    { k: "dist", t: "Prepare distribution", s: distSt, d: dist.length ? "Distributor: " + dist.map(function (r) { return r.name + " is " + r.status.replace("_", " "); }).join(", ") + "." : "Nothing is being tracked with a distributor yet. POTENT does not submit releases for you.", page: "registrations" },
    { k: "earn", t: "Track earnings", s: p.revenue.length ? "COMPLETED" : "NOT STARTED", d: p.revenue.length + " income " + (p.revenue.length === 1 ? "entry" : "entries") + " recorded.", page: "money" }
  ];
  const done = steps.filter(function (x) { return x.s === "COMPLETED" || x.s === "NOT APPLICABLE"; }).length;
  const nxt = steps.find(function (x) { return x.s === "ACTION REQUIRED"; }) || steps.find(function (x) { return x.s !== "COMPLETED" && x.s !== "NOT APPLICABLE"; }) || null;
  return { steps: steps, done: done, total: steps.length, next: nxt };
}

function normalize(kind, v) {
  v = clip(v, 40).toUpperCase(); if (!v) return { ok: true, v: null };
  if (kind === "isrc") { const x = v.replace(/-/g, ""); return /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(x) ? { ok: true, v: x.slice(0, 2) + "-" + x.slice(2, 5) + "-" + x.slice(5, 7) + "-" + x.slice(7) } : { ok: false, e: "ISRC looks like US-ABC-26-00001" }; }
  if (kind === "iswc") { const x = v.replace(/[-.\s]/g, ""); return /^T\d{10}$/.test(x) ? { ok: true, v: "T-" + x.slice(1, 4) + "." + x.slice(4, 7) + "." + x.slice(7, 10) + "-" + x.slice(10) } : { ok: false, e: "ISWC looks like T-123.456.789-0" }; }
  if (kind === "upc") { const x = v.replace(/\D/g, ""); return /^\d{12,13}$/.test(x) ? { ok: true, v: x } : { ok: false, e: "UPC/EAN is 12 or 13 digits" }; }
  return { ok: true, v: v };
}


const HELP = {
  fee: "On a beat sale the seller keeps 91% or more and POTENT's fee is 1%. If anything is left over it stays unassigned until a written agreement names who gets it. This is a payment split. It does not change who owns the music.",
  rights: "Each beat is sold once as an exclusive master. The listing's rights package says exactly what you get and the sample note says whether anything in it is borrowed. Your accepted agreement version and time are saved on your receipt.",
  checkout: "You pay the listed price plus tax if any. Digital products, all sales final. Right after payment your download and receipt are in your Account. If a limited item sells out while you pay, that item is refunded automatically.",
  download: "Your files are in Account → Purchases & downloads. Each link works for 5 minutes, so press Download again for a fresh one. If you hit the download limit, contact support and we will reset it.",
  money: "Estimated means a guess. Reported means a statement said so. Calculated is what an agreed split works out to. Awaiting is calculated money not yet confirmed in. Received is confirmed as money in. Only received has actually been paid.",
  dj: "Paying or crediting a DJ or promoter never gives them ownership. A flat fee is just a fee. A percentage has to be recorded as a separate promotion split that everyone named approves.",
  coins: "POTENT Coins are a closed-loop credit. They cannot be sent to other people or cashed out. If a coin purchase is refunded the coins come back to you.",
  general: "I can explain fees, rights, checkout, downloads, splits and where your money is. For anything about your own project, open it in Projects and I will use its real records."
};
function helpRule(ctx, text) {
  const t = String(text || "").toLowerCase();
  if (/fee|percent|91|1%|cut|split.*beat|breeze|8%/.test(t)) return HELP.fee;
  if (/refund|checkout|pay|tax|total|price/.test(t) && !/paid.*project/.test(t)) return /coin/.test(t) ? HELP.coins : HELP.checkout;
  if (/coin/.test(t)) return HELP.coins;
  if (/download|file|link/.test(t)) return HELP.download;
  if (/right|own|exclusive|sample|license|licen/.test(t)) return HELP.rights;
  if (/royalt|earn|received|awaiting|estimate|statement/.test(t)) return HELP.money;
  if (/dj|promot|campaign/.test(t)) return HELP.dj;
  return null;
}
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.AUTH_SECRET) return B.J(500, { error: "Server not configured" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  const a = String(b.action || "");
  if (a === "help_ask") { // rules first; works signed out. AI is used only for a question the rules cannot answer, and only when signed in.
    const ctx = ["beat", "checkout", "money", "dj", "coins", "general"].indexOf(b.ctx) >= 0 ? b.ctx : "general", q = clip(b.text, 300);
    if (!q) return B.J(200, { ok: true, answer: HELP[ctx], source: "rules" });
    const hit = helpRule(ctx, q); if (hit) return B.J(200, { ok: true, answer: hit, source: "rules" });
    const tu = M.verifyUser(B.bearer(event)); if (!tu) return B.J(200, { ok: true, answer: HELP[ctx] + " Sign in to ask other questions.", source: "rules" });
    const r = await L.ai("help_ask", tu.uid, L.GUARD + "\nThe person is on the " + ctx + " page of POTENT Music. Facts you may rely on: " + HELP[ctx] + "\nQuestion: " + q + "\nAnswer in under 70 words. State no amounts or percentages other than those in the facts.", ctx + "|" + q);
    return B.J(200, { ok: true, answer: r.text || HELP[ctx], source: r.text ? "ai" : "rules", note: r.text ? null : L.aiNote(r) });
  }
  const u = M.verifyUser(B.bearer(event)); if (!u) return B.J(401, { error: "Sign in first" });
  if (tooMany("rl:" + u.uid, 300)) return B.J(429, { error: "Too many requests" }); note("rl:" + u.uid);

  // user-level (no project)
  if (a === "w_get") return B.J(200, { ok: true, profile: rows(await B.sb("music_writer_profiles?user_id=eq." + u.uid + "&select=*"))[0] || {} });
  if (a === "w_save") {
    const ipi = clip(b.ipi, 20).replace(/\D/g, ""), pipi = clip(b.publisher_ipi, 20).replace(/\D/g, "");
    if ((ipi && (ipi.length < 9 || ipi.length > 11)) || (pipi && (pipi.length < 9 || pipi.length > 11))) return B.J(400, { error: "An IPI/CAE number has 9 to 11 digits" });
    await B.sb("music_writer_profiles", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { user_id: u.uid, legal_name: clip(b.legal_name, 120) || null, ipi: ipi || null, pro: clip(b.pro, 60) || null, publisher_name: clip(b.publisher_name, 120) || null, publisher_ipi: pipi || null, notes: clip(b.notes, 400) || null, updated_at: new Date().toISOString() } });
    return B.J(200, { ok: true });
  }
  if (a === "rem_list") { // reminders that came due turn into in-app notifications exactly once
    const due = rows(await B.sb("music_reminders?user_id=eq." + u.uid + "&done_at=is.null&select=*&order=due_at.asc&limit=100"));
    const now = Date.now();
    for (const r of due) if (!r.notified_at && new Date(r.due_at).getTime() <= now) { const f = await B.sb("music_reminders?id=eq." + r.id + "&notified_at=is.null", { method: "PATCH", prefer: "return=representation", body: { notified_at: new Date().toISOString() } }); if (rows(f).length) await require("./lib/notify")({ user_id: u.uid, kind: "reminder", title: "Reminder: " + r.text, link: r.project_id ? "/music/projects.html" : "/music/account.html" }); }
    return B.J(200, { ok: true, items: due });
  }
  if (a === "rem_add") {
    const d = new Date(b.due_at); if (!isFinite(d.getTime()) || clip(b.text, 200).length < 2) return B.J(400, { error: "Write the reminder and pick a date" });
    let pid = null; if (b.project_id) { if (!UUID.test(String(b.project_id)) || !rows(await B.sb("music_projects?id=eq." + b.project_id + "&owner_user_id=eq." + u.uid + "&select=id")).length) return B.J(403, { error: "Not your project" }); pid = b.project_id; }
    const c = rows(await B.sb("music_reminders?user_id=eq." + u.uid + "&done_at=is.null&select=id&limit=201")); if (c.length > 200) return B.J(409, { error: "Too many open reminders. Finish some first." });
    await B.sb("music_reminders", { method: "POST", prefer: "return=minimal", body: { user_id: u.uid, project_id: pid, text: clip(b.text, 200), due_at: d.toISOString() } }); return B.J(200, { ok: true });
  }
  if (a === "rem_done") { if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" }); await B.sb("music_reminders?id=eq." + b.id + "&user_id=eq." + u.uid, { method: "PATCH", prefer: "return=minimal", body: { done_at: new Date().toISOString() } }); return B.J(200, { ok: true }); }
  if (a === "dj_list") { // directory: everyone's active listings in the chosen city, plus your own
    const city = clip(b.city, 60) || "Atlanta";
    return B.J(200, { ok: true, city: city, djs: rows(await B.sb("music_djs?active=eq.true&city=ilike." + encodeURIComponent(city) + "&select=id,name,kind,city,instagram,bio,owner_user_id&order=name.asc&limit=200")).map(function (d) { return { id: d.id, name: d.name, kind: d.kind, city: d.city, instagram: d.instagram, bio: d.bio, mine: d.owner_user_id === u.uid }; }) });
  }
  if (a === "dj_save") {
    const name = clip(b.name, 100); if (name.length < 2) return B.J(400, { error: "Name is required" });
    const em = clip(b.contact_email, 160).toLowerCase(); if (em && !EMAIL.test(em)) return B.J(400, { error: "Enter a valid contact email" });
    const row = { name: name, kind: ["dj", "promoter", "radio", "blog", "venue"].indexOf(b.kind) >= 0 ? b.kind : "dj", city: clip(b.city, 60) || "Atlanta", contact_email: em || null, instagram: clip(b.instagram, 80) || null, bio: clip(b.bio, 400) || null };
    if (UUID.test(String(b.id || ""))) { const up = await B.sb("music_djs?id=eq." + b.id + "&owner_user_id=eq." + u.uid, { method: "PATCH", prefer: "return=representation", body: row }); return rows(up).length ? B.J(200, { ok: true, id: b.id }) : B.J(404, { error: "Not found" }); }
    const c = rows(await B.sb("music_djs?owner_user_id=eq." + u.uid + "&select=id&limit=101")); if (c.length > 100) return B.J(409, { error: "Too many contacts" });
    const ins = await B.sb("music_djs", { method: "POST", prefer: "return=representation", body: Object.assign({ owner_user_id: u.uid }, row) }); return B.J(200, { ok: true, id: rows(ins)[0] && rows(ins)[0].id });
  }
  if (a === "dj_mine") return B.J(200, { ok: true, djs: rows(await B.sb("music_djs?owner_user_id=eq." + u.uid + "&select=*&order=created_at.desc&limit=100")) });
  if (a === "voice_draft") { // a spoken note becomes a DRAFT project. Nothing is created until the person confirms.
    const text = clip(b.text, 1500); if (text.length < 5) return B.J(400, { error: "Say a little more" });
    const r = await L.ai("voice_draft", u.uid, L.GUARD + "\nTurn this note into a draft music project. Return ONLY JSON {\"title\":string,\"people\":[{\"name\":string,\"role\":string}]}. Use only names and roles stated in the note. Do not invent percentages or money. Note: " + text, text);
    let d = null; try { d = JSON.parse(String(r.text || "").replace(/^```json|```$/g, "").trim()); } catch (e) { /* fall through */ }
    if (!d || !clip(d.title, 140)) { const t = text.split(/[.\n]/)[0]; d = { title: clip(t, 80), people: [] }; return B.J(200, { ok: true, draft: d, ai: false, message: r.text ? "Could not read that clearly. Check the title." : L.aiNote(r) }); }
    d.people = (Array.isArray(d.people) ? d.people : []).slice(0, 12).map(function (x) { return { name: clip(x && x.name, 80), role: clip(x && x.role, 40) }; }).filter(function (x) { return x.name; });
    return B.J(200, { ok: true, draft: { title: clip(d.title, 140), people: d.people }, ai: true, message: "This is only a draft. Nothing has been created yet." });
  }

  // project-level
  const p = await L.loadProject(b.project_id, u.uid);
  if (!p) return B.J(404, { error: "Project not found" });
  const pid = p.id;
  const [workR, regsR] = await Promise.all([B.sb("music_works?project_id=eq." + pid + "&select=*"), B.sb("music_registrations?project_id=eq." + pid + "&select=*&order=created_at.asc")]);
  const work = rows(workR)[0] || null, regs = rows(regsR);
  const fresh = async function () { return B.J(200, { ok: true, tracker: tracker(p, (rows(await B.sb("music_works?project_id=eq." + pid + "&select=*"))[0] || null), rows(await B.sb("music_registrations?project_id=eq." + pid + "&select=*&order=created_at.asc"))) }); };

  if (a === "r_track") {
    const t = tracker(p, work, regs);
    return B.J(200, { ok: true, tracker: t, work: work, registrations: regs, orgs: ORG_NAME, has_audio: !!p.final_audio_ref });
  }
  if (a === "r_work_save") {
    const isrc = normalize("isrc", b.isrc), iswc = normalize("iswc", b.iswc), upc = normalize("upc", b.upc);
    for (const x of [isrc, iswc, upc]) if (!x.ok) return B.J(400, { error: x.e });
    const rd = clip(b.release_date, 10); if (rd && !/^\d{4}-\d{2}-\d{2}$/.test(rd)) return B.J(400, { error: "Use a real release date" });
    await B.sb("music_works", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { project_id: pid, release_title: clip(b.release_title, 140) || null, primary_artist: clip(b.primary_artist, 140) || null, release_date: rd || null, genre: clip(b.genre, 60) || null, label: clip(b.label, 100) || null, isrc: isrc.v, iswc: iswc.v, upc: upc.v, explicit: b.explicit === true, notes: clip(b.notes, 400) || null, updated_at: new Date().toISOString() } });
    return fresh();
  }
  if (a === "r_reg_save") {
    if (ORGS.indexOf(b.org) < 0 || REG_ST.indexOf(b.status) < 0) return B.J(400, { error: "Pick who you are registering with and a status" });
    const name = clip(b.name, 100); if (name.length < 2) return B.J(400, { error: "Name the organization (for example the distributor or PRO)" });
    const ref = clip(b.confirmation_ref, 120);
    if (b.status === "confirmed" && ref.length < 4) return B.J(400, { error: "To mark this confirmed, enter the confirmation number or reference they gave you. Without it, keep it as submitted." });
    const row = { project_id: pid, org: b.org, name: name, status: b.status, confirmation_ref: ref || null, note: clip(b.note, 300) || null };
    const ex = regs.find(function (r) { return r.org === b.org && r.name === name; });
    if (b.status === "submitted" && !(ex && ex.submitted_at)) row.submitted_at = new Date().toISOString();
    if (b.status === "confirmed") row.confirmed_at = new Date().toISOString();
    await B.sb("music_registrations?on_conflict=project_id,org,name", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: row });
    await B.audit("user:" + u.uid, "registration_" + b.status, pid, { org: b.org, name: name });
    return fresh();
  }
  if (a === "r_reg_remove") { if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" }); await B.sb("music_registrations?id=eq." + b.id + "&project_id=eq." + pid, { method: "DELETE", prefer: "return=minimal" }); return fresh(); }
  if (a === "r_audio_url") {
    const name = clip(b.name, 120).replace(/[^A-Za-z0-9._-]/g, "_"); if (!/\.(mp3|wav|m4a|flac|aiff?)$/i.test(name)) return B.J(400, { error: "Upload an audio file (mp3, wav, m4a, flac, aiff)" });
    const path = "projects/" + u.uid + "/" + pid + "/" + Date.now() + "-" + name;
    const sg = await fetch(B.SB + "/storage/v1/object/upload/sign/beat-files/" + path, { method: "POST", headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: "{}" });
    const sj = await sg.json().catch(function () { return {}; }); if (!sg.ok || !sj.url) return B.J(500, { error: "Uploads are not set up yet." });
    return B.J(200, { ok: true, uploadUrl: B.SB + "/storage/v1" + sj.url, ref: "storage:beat-files/" + path });
  }
  if (a === "r_audio_set") {
    const ref = clip(b.ref, 400); if (ref.indexOf("storage:beat-files/projects/" + u.uid + "/" + pid + "/") !== 0) return B.J(400, { error: "That file does not belong to this project" });
    await B.sb("music_projects?id=eq." + pid, { method: "PATCH", prefer: "return=minimal", body: { final_audio_ref: ref } }); p.final_audio_ref = ref; return fresh();
  }
  if (a === "r_audio_get") { if (!p.final_audio_ref) return B.J(404, { error: "No final audio saved" }); const url = await M.signedUrl(p.final_audio_ref, 300); return url ? B.J(200, { ok: true, url: url }) : B.J(404, { error: "File not available" }); }

  // per-person statements built only from recorded revenue and allocations
  if (a === "r_statements") {
    const rv = p.revenue; const ids = rv.map(function (r) { return r.id; });
    const al = ids.length ? rows(await B.sb("music_allocations?revenue_id=in.(" + ids.join(",") + ")&select=revenue_id,contributor_id,cents")) : [];
    const people = p.contributors.map(function (c) {
      const mine = al.filter(function (x) { return x.contributor_id === c.id; }), lines = mine.map(function (x) { const r = rv.find(function (y) { return y.id === x.revenue_id; }) || {}; return { date: r.created_at, category: r.category, source: r.source, reference: r.reference, status: r.status, schedule_version: r.schedule_version, cents: x.cents }; });
      const sum = function (st) { return lines.filter(function (l) { return st(l); }).reduce(function (s, l) { return s + l.cents; }, 0); };
      return { id: c.id, name: c.name, email: c.email, calculated_cents: sum(function () { return true; }), received_cents: sum(function (l) { return l.status === "received"; }), awaiting_cents: sum(function (l) { return l.status !== "received"; }), lines: lines };
    });
    if (b.csv === true) { const out = ["project,person,date,income_type,source,reference,status,split_version,amount"]; people.forEach(function (pp) { pp.lines.forEach(function (l) { out.push([p.title, pp.name, l.date, l.category, l.source, l.reference, l.status, l.schedule_version, (l.cents / 100).toFixed(2)].map(csvq).join(",")); }); }); return B.J(200, { ok: true, name: "statements-" + p.title.replace(/[^A-Za-z0-9]+/g, "-") + ".csv", csv: out.join("\n") }); }
    const facts = people.map(function (pp) { return pp.name + ": calculated " + usd(pp.calculated_cents) + ", confirmed received " + usd(pp.received_cents) + ", still awaiting " + usd(pp.awaiting_cents); }).join("; ");
    let summary = people.length ? facts + "." : "No people on this project yet.";
    if (b.plain === true && people.length) { const r = await L.ai("statement_summary", u.uid, L.GUARD + "\nExplain these project totals in plain English in under 80 words. Use ONLY these numbers exactly, add none, and say 'calculated' is what the agreed split works out to while 'received' means the money was confirmed in. Facts: " + facts, facts); if (r.text) summary = r.text; }
    return B.J(200, { ok: true, people: people, summary: summary, note: "Calculated means what the agreed split works out to. Only 'received' has been confirmed as money in." });
  }
  if (a === "r_import") { // statement CSV: reference,gross,deductions,note. Each row goes through the same rules as a single entry.
    const cat = String(b.category || ""); const lines = String(b.csv || "").split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 201);
    if (lines.length < 2 || lines.length > 201) return B.J(400, { error: "Paste a header row plus up to 200 rows: reference,gross,deductions,note" });
    const head = lines[0].toLowerCase().split(",").map(function (x) { return x.trim(); }); const ix = function (n) { return head.indexOf(n); };
    if (ix("reference") < 0 || ix("gross") < 0) return B.J(400, { error: "The first row must name the columns, including reference and gross" });
    const out = [];
    for (const line of lines.slice(1)) {
      const c = line.split(","), ref = clip(c[ix("reference")], 120), gross = Math.round(parseFloat(String(c[ix("gross")] || "").replace(/[$\s]/g, "")) * 100), ded = ix("deductions") >= 0 ? Math.round((parseFloat(String(c[ix("deductions")] || "0").replace(/[$\s]/g, "")) || 0) * 100) : 0;
      if (!ref || !(gross >= 0)) { out.push({ reference: ref, ok: false, error: "Needs a reference and an amount" }); continue; }
      const r = await RR.handler({ httpMethod: "POST", headers: event.headers, body: JSON.stringify({ action: "p_revenue_add", project_id: pid, category: cat, source: "statement", reference: ref, gross_cents: gross, deductions_cents: ded, note: ix("note") >= 0 ? c[ix("note")] : "" }) });
      const j = JSON.parse(r.body); out.push({ reference: ref, ok: r.statusCode === 200, error: j.error || null });
    }
    return B.J(200, { ok: true, imported: out.filter(function (x) { return x.ok; }).length, rows: out });
  }

  // DJ campaigns for this project
  if (a === "c_list") {
    const cs = rows(await B.sb("music_campaigns?project_id=eq." + pid + "&owner_user_id=eq." + u.uid + "&select=*,music_djs(name,kind,city,instagram),music_campaign_tasks(id,title,due_date,done_at,evidence_url)&order=created_at.desc&limit=100"));
    return B.J(200, { ok: true, campaigns: cs, rule: "Paying or crediting a DJ or promoter for promotion never gives them ownership of the music. Anything percentage-based is recorded under the separate 'promotion' split, which everyone named must approve." });
  }
  if (a === "c_save") {
    const title = clip(b.title, 120); if (title.length < 3) return B.J(400, { error: "Name the campaign" });
    const ct = ["free", "flat", "percent_promo", "other"].indexOf(b.comp_type) >= 0 ? b.comp_type : "free";
    let flat = null, pct = null;
    if (ct === "flat") { flat = Math.round(Number(b.comp_flat_cents)); if (!(flat > 0 && flat < 1e9)) return B.J(400, { error: "Enter the flat fee" }); }
    if (ct === "percent_promo") { pct = Math.round(Number(b.comp_pct) * 1000) / 1000; if (!(pct > 0 && pct <= 100)) return B.J(400, { error: "Enter a percent between 0 and 100" }); if (!p.schedules.some(function (s) { return s.category === "promo" && s.status === "approved"; })) return B.J(409, { error: "A percentage needs an approved 'promotion' split first. Set that up under Splits, then come back." }); }
    let dj = null; if (b.dj_id) { if (!UUID.test(String(b.dj_id)) || !rows(await B.sb("music_djs?id=eq." + b.dj_id + "&active=eq.true&select=id")).length) return B.J(404, { error: "That contact was not found" }); dj = b.dj_id; }
    const due = /^\d{4}-\d{2}-\d{2}$/.test(String(b.due_date || "")) ? b.due_date : null;
    const row = { title: title, brief: clip(b.brief, 1500) || null, due_date: due, dj_id: dj, comp_type: ct, comp_note: clip(b.comp_note, 300) || null, comp_flat_cents: flat, comp_pct: pct };
    if (b.status && ["draft", "sent", "accepted", "declined", "in_progress", "done", "cancelled"].indexOf(b.status) >= 0) row.status = b.status;
    if (UUID.test(String(b.id || ""))) { const up = await B.sb("music_campaigns?id=eq." + b.id + "&project_id=eq." + pid + "&owner_user_id=eq." + u.uid, { method: "PATCH", prefer: "return=representation", body: row }); if (!rows(up).length) return B.J(404, { error: "Not found" }); return B.J(200, { ok: true, id: b.id }); }
    const ins = await B.sb("music_campaigns", { method: "POST", prefer: "return=representation", body: Object.assign({ project_id: pid, owner_user_id: u.uid }, row) }); return B.J(200, { ok: true, id: rows(ins)[0] && rows(ins)[0].id });
  }
  if (a === "c_task") {
    if (!UUID.test(String(b.campaign_id || "")) || !rows(await B.sb("music_campaigns?id=eq." + b.campaign_id + "&project_id=eq." + pid + "&owner_user_id=eq." + u.uid + "&select=id")).length) return B.J(404, { error: "Campaign not found" });
    if (UUID.test(String(b.id || ""))) { await B.sb("music_campaign_tasks?id=eq." + b.id + "&campaign_id=eq." + b.campaign_id, { method: "PATCH", prefer: "return=minimal", body: { done_at: b.done === false ? null : new Date().toISOString(), evidence_url: /^https:\/\//.test(String(b.evidence_url || "")) ? clip(b.evidence_url, 400) : undefined } }); return B.J(200, { ok: true }); }
    const t = clip(b.title, 140); if (t.length < 2) return B.J(400, { error: "Name the task" });
    await B.sb("music_campaign_tasks", { method: "POST", prefer: "return=minimal", body: { campaign_id: b.campaign_id, title: t, due_date: /^\d{4}-\d{2}-\d{2}$/.test(String(b.due_date || "")) ? b.due_date : null } }); return B.J(200, { ok: true });
  }
  if (a === "c_draft") { // outreach message: a plain template first; AI polish only when asked
    const c = rows(await B.sb("music_campaigns?id=eq." + clip(b.campaign_id, 40) + "&project_id=eq." + pid + "&owner_user_id=eq." + u.uid + "&select=*,music_djs(name)"))[0]; if (!c) return B.J(404, { error: "Campaign not found" });
    const who = c.music_djs && c.music_djs.name ? c.music_djs.name : "there";
    const comp = c.comp_type === "flat" ? "I can offer a flat fee of " + usd(c.comp_flat_cents) + "." : c.comp_type === "percent_promo" ? "I can offer " + c.comp_pct + "% of promotion income under a written split we both approve." : c.comp_type === "other" ? (c.comp_note || "Let's talk about terms.") : "This one is unpaid, but I'm happy to credit you.";
    let text = "Hi " + who + ", I'm releasing \"" + (work && work.release_title || p.title) + "\"" + (work && work.release_date ? " on " + work.release_date : "") + ". " + (c.brief ? c.brief + " " : "") + (c.due_date ? "Ideal timing: by " + c.due_date + ". " : "") + comp + " Promoting the song doesn't change who owns it. Let me know if you're in.";
    if (b.polish === true) { const r = await L.ai("dj_outreach", u.uid, L.GUARD + "\nRewrite this DJ outreach message so it sounds warm and natural, under 90 words. Keep every fact, date and term exactly. Add none: " + text, text); if (r.text) text = r.text; else return B.J(200, { ok: true, text: text, note: L.aiNote(r) }); }
    return B.J(200, { ok: true, text: text });
  }
  return B.J(400, { error: "Unknown action" });
};
