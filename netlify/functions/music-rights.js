// POTENT Music: projects, contributors, separate split schedules per revenue category, approvals, revenue + allocations, Gemini helpers.
// Owner (artist) calls send the buyer token. Contributors act through their own signed link (no account needed). Money never moves from here:
// this records agreed splits and what each person is owed; payouts are still handled through the wallet / outside payment.
const B = require("./lib/beats");
const M = require("./lib/music");
const R = require("./lib/rights");
const UUID = /^[0-9a-f-]{36}$/i;
const clip = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n); };
const fails = {};
function tooMany(k, max) { const f = fails[k]; return !!(f && f.n >= max && Date.now() - f.t < 36e5); }
function note(k) { const f = fails[k]; if (!f || Date.now() - f.t > 36e5) fails[k] = { n: 1, t: Date.now() }; else { f.n++; f.t = Date.now(); } }
const ip = function (e) { return String((e.headers || {})["x-nf-client-connection-ip"] || "x"); };
const rows = function (r) { return r.ok && Array.isArray(r.data) ? r.data : []; };

// Every model call goes through ai(): checks the daily cap and a repeat-click guard, reuses cached answers, and records usage (tokens, cached, failed).
const crypto = require("crypto"), inflight = {}; const DAILY_CAP = 40;
async function ai(task, uid, prompt, stateKey) {
  const key = crypto.createHash("sha256").update(task + "|" + (uid || "public") + "|" + (stateKey || "") + "|" + prompt).digest("hex");
  const log = function (o) { return B.sb("music_ai_usage", { method: "POST", prefer: "return=minimal", body: Object.assign({ user_id: uid || null, task: task, model: process.env.AI_MODEL || "gemini-flash-latest" }, o) }); };
  const hit = rows(await B.sb("music_ai_cache?key=eq." + key + "&select=value&limit=1"))[0];
  if (hit) { await log({ cached: true }); return { text: hit.value, cached: true }; }
  { const fl = await B.getSetting("music_flags"); if (fl && fl.ai === false) return { text: null, off: true }; }
  if (!process.env.GEMINI_API_KEY) return { text: null, off: true };
  if (inflight[key] && Date.now() - inflight[key] < 4000) return { text: null, busy: true };
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  if (uid) { const used = rows(await B.sb("music_ai_usage?user_id=eq." + uid + "&cached=eq.false&ok=eq.true&created_at=gte." + today.toISOString() + "&select=id&limit=" + (DAILY_CAP + 1))).length; if (used >= DAILY_CAP) return { text: null, limited: true }; }
  inflight[key] = Date.now();
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + (process.env.AI_MODEL || "gemini-flash-latest") + ":generateContent", { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 500 } }) });
    if (!r.ok) { await log({ ok: false }); return { text: null, failed: true }; }
    const d = await r.json(), um = d.usageMetadata || {};
    const text = (((d.candidates || [])[0] || {}).content || { parts: [] }).parts.map(function (p) { return p.text || ""; }).join("").trim();
    if (!text) { await log({ ok: false, tokens_in: um.promptTokenCount }); return { text: null, failed: true }; }
    await Promise.all([B.sb("music_ai_cache", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { key: key, user_id: uid || null, value: text } }), log({ tokens_in: um.promptTokenCount, tokens_out: um.candidatesTokenCount })]);
    return { text: text };
  } catch (e) { await log({ ok: false }); return { text: null, failed: true }; }
}
const aiNote = function (r) { return r.limited ? "You have used today's AI help. Everything else still works." : r.busy ? "One moment, that request is already running." : r.off || r.failed ? "AI help is not available right now. Everything else still works." : ""; };
const GUARD = "You are a helper inside POTENT Music, an independent-artist platform. You advise only. You never claim a registration, distribution, payment or signature happened, never invent percentages, and you say you are not a lawyer when rights or contracts come up. Be short and plain.";

async function loadProject(id, uid) {
  if (!UUID.test(String(id || ""))) return null;
  const p = rows(await B.sb("music_projects?id=eq." + id + "&owner_user_id=eq." + uid + "&select=*"))[0]; if (!p) return null;
  const [c, s, rv] = await Promise.all([B.sb("music_contributors?project_id=eq." + id + "&select=*&order=created_at.asc"), B.sb("music_schedules?project_id=eq." + id + "&select=*,music_schedule_lines(contributor_id,pct),music_schedule_approvals(contributor_id,decision,note,created_at)&order=category.asc,version.desc"), B.sb("music_revenue?project_id=eq." + id + "&select=*,music_allocations(contributor_id,cents)&order=created_at.desc")]);
  p.contributors = rows(c); p.schedules = rows(s); p.revenue = rows(rv); return p;
}
function checklist(p) {
  const approved = function (cat) { return p.schedules.some(function (s) { return s.category === cat && s.status === "approved"; }); };
  const disputed = p.schedules.some(function (s) { return s.status === "disputed"; });
  const pending = p.schedules.some(function (s) { return s.status === "pending"; });
  return [
    { k: "team", t: "Add everyone who worked on the song", s: p.contributors.length >= 2 ? "COMPLETED" : p.contributors.length ? "IN PROGRESS" : "NOT STARTED" },
    { k: "master", t: "Master recording split approved", s: approved("master") ? "COMPLETED" : p.schedules.some(function (s) { return s.category === "master"; }) ? (disputed ? "ACTION REQUIRED" : "IN PROGRESS") : "NOT STARTED" },
    { k: "publishing", t: "Songwriting (publishing) split approved", s: approved("publishing") ? "COMPLETED" : p.schedules.some(function (s) { return s.category === "publishing"; }) ? (disputed ? "ACTION REQUIRED" : "IN PROGRESS") : "NOT STARTED" },
    { k: "approvals", t: "Waiting on approvals or disputes", s: disputed ? "ACTION REQUIRED" : pending ? "IN PROGRESS" : "COMPLETED" }
  ];
}

// Deterministic "what next" from real records. No AI involved.
function nextMove(p) {
  const nm = function (id) { const c = p.contributors.find(function (x) { return x.id === id; }); return c ? c.name : "someone"; };
  if (!p.contributors.length) return { title: "Add the people on this song", why: "Splits need names. Add yourself and everyone who helped.", action: { label: "Add people", go: "team" }, missing: [] };
  const disputed = p.schedules.find(function (s) { return s.status === "disputed"; });
  if (disputed) { const who = disputed.music_schedule_approvals.filter(function (a) { return a.decision === "disputed"; }).map(function (a) { return nm(a.contributor_id); }); return { title: "Resolve the " + disputed.category + " split dispute", why: who.join(", ") + " disagreed. Talk it through, then save a corrected version. Nothing is allocated until everyone approves.", action: { label: "Review splits", go: "splits" }, missing: who }; }
  const pend = p.schedules.find(function (s) { return s.status === "pending"; });
  if (pend) { const miss = pend.music_schedule_lines.filter(function (l) { return !pend.music_schedule_approvals.some(function (a) { return a.contributor_id === l.contributor_id; }); }).map(function (l) { return nm(l.contributor_id); }); return { title: "Waiting on approvals for the " + pend.category + " split", why: "Still to answer: " + miss.join(", ") + ". Send them their link again.", action: { label: "Review splits", go: "splits" }, missing: miss }; }
  const draft = p.schedules.find(function (s) { return s.status === "draft"; });
  if (draft) return { title: "Send the " + draft.category + " split for approval", why: "It is saved but nobody has been asked yet.", action: { label: "Send for approval", go: "splits" }, missing: [] };
  const has = function (c) { return p.schedules.some(function (s) { return s.category === c && s.status === "approved"; }); };
  if (!has("master")) return { title: "Agree how the master recording income is divided", why: "The master is the recording. Without an approved split, income cannot be allocated.", action: { label: "Set master split", go: "splits" }, missing: [] };
  if (!has("publishing")) return { title: "Agree the songwriting (publishing) split", why: "The song itself is split separately from the recording. Rights registration needs it.", action: { label: "Set publishing split", go: "splits" }, missing: [] };
  if (!p.revenue.length) return { title: "You are set up. Record income when a statement arrives", why: "Both splits are approved. Add money only from a real statement or bank record.", action: { label: "Record income", go: "money" }, missing: [] };
  const open = p.revenue.filter(function (r) { return r.status === "calculated"; }).length;
  return open ? { title: "Confirm payments that arrived", why: open + " income entr" + (open > 1 ? "ies are" : "y is") + " calculated but not marked received.", action: { label: "Review income", go: "money" }, missing: [] } : { title: "You are caught up", why: "Everything recorded is approved and received.", action: null, missing: [] };
}
function money(p) {
  const c = function (v) { return "$" + (v / 100).toFixed(2); }, by = {};
  p.revenue.forEach(function (r) { const o = by[r.category] = by[r.category] || { calc: 0, recv: 0 }; if (r.status === "received") o.recv += r.eligible_cents; else o.calc += r.eligible_cents; });
  const k = Object.keys(by); if (!k.length) return "Nothing has been recorded yet. Calculated and received amounts will show here separately.";
  return k.map(function (x) { return x.replace("_", " ") + ": " + c(by[x].recv) + " confirmed received, " + c(by[x].calc) + " calculated but not yet received"; }).join(". ") + ".";
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.AUTH_SECRET) return B.J(500, { error: "Server not configured" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  const a = String(b.action || "");

  // ───── contributor side (signed link) ─────
  if (a === "r_view" || a === "r_decide") {
    if (tooMany("r:" + ip(event), 60)) return B.J(429, { error: "Too many requests" }); note("r:" + ip(event));
    const cid = R.verifyContributor(clip(b.t, 500)); if (!cid) return B.J(403, { error: "This link is not valid" });
    const c = rows(await B.sb("music_contributors?id=eq." + cid + "&select=*,music_projects(title)"))[0]; if (!c) return B.J(404, { error: "Not found" });
    if (a === "r_decide") {
      if (!UUID.test(String(b.schedule_id || "")) || ["approved", "disputed"].indexOf(b.decision) < 0) return B.J(400, { error: "Bad request" });
      const s = rows(await B.sb("music_schedules?id=eq." + b.schedule_id + "&project_id=eq." + c.project_id + "&select=*,music_schedule_lines(contributor_id,pct)"))[0];
      if (!s || s.status !== "pending") return B.J(409, { error: "This split is not waiting for approval" });
      if (!s.music_schedule_lines.some(function (l) { return l.contributor_id === cid; })) return B.J(403, { error: "You are not part of this split" });
      const up = await B.sb("music_schedule_approvals?on_conflict=schedule_id,contributor_id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { schedule_id: s.id, contributor_id: cid, decision: b.decision, note: clip(b.note, 500) || null, created_at: new Date().toISOString() } });
      if (!up.ok) return B.J(500, { error: "Could not save your answer" });
      const ap = rows(await B.sb("music_schedule_approvals?schedule_id=eq." + s.id + "&select=contributor_id,decision"));
      let status = "pending";
      if (ap.some(function (x) { return x.decision === "disputed"; })) status = "disputed";
      else if (s.music_schedule_lines.every(function (l) { return ap.some(function (x) { return x.contributor_id === l.contributor_id && x.decision === "approved"; }); })) status = "approved";
      if (status !== "pending") {
        if (status === "approved") await B.sb("music_schedules?project_id=eq." + s.project_id + "&category=eq." + s.category + "&status=eq.approved&id=neq." + s.id, { method: "PATCH", prefer: "return=minimal", body: { status: "superseded" } });
        await B.sb("music_schedules?id=eq." + s.id, { method: "PATCH", prefer: "return=minimal", body: status === "approved" ? { status: status, approved_at: new Date().toISOString() } : { status: status } });
      }
      await B.audit("contributor:" + c.email, "split_" + b.decision, s.id, { project: s.project_id, version: s.version, status: status });
      return B.J(200, { ok: true, status: status });
    }
    const sc = rows(await B.sb("music_schedules?project_id=eq." + c.project_id + "&status=neq.draft&select=*,music_schedule_lines(contributor_id,pct),music_schedule_approvals(contributor_id,decision)&order=category.asc,version.desc"));
    const people = rows(await B.sb("music_contributors?project_id=eq." + c.project_id + "&select=id,name,roles"));
    const mine = rows(await B.sb("music_allocations?contributor_id=eq." + cid + "&select=cents,music_revenue(category,status,source,eligible_cents,schedule_version,created_at)"));
    return B.J(200, { ok: true, me: { id: c.id, name: c.name, email: c.email, roles: c.roles }, project: c.music_projects && c.music_projects.title, people: people, schedules: sc.filter(function (s) { return s.music_schedule_lines.some(function (l) { return l.contributor_id === cid; }); }), allocations: mine,
      note: "These are recorded splits and amounts calculated from them. Calculated is not the same as received. POTENT does not pay these out automatically." });
  }

  // public plain-language explainer (Gemini, with a fixed fallback)
  if (a === "ai_explain") {
    if (tooMany("x:" + ip(event), 30)) return B.J(429, { error: "Slow down a little" }); note("x:" + ip(event));
    const TERMS = { master: "The master is one specific recorded version of a song. Whoever owns it controls how that recording is released and earns its recording income.", publishing: "Publishing covers the song itself: the lyrics and the music. It earns separately from the recording, through writer and publisher shares.", split: "A split sheet says who gets what share of which income. Every share is a percentage and each income type has its own sheet.", gross: "Gross receipts are the money received before any costs come out. Net receipts are what is left after the costs the agreement allows.", statement: "A royalty statement is a report from a distributor or collection group showing what a song earned. A statement is not the same as money in your account.", distribution: "Distribution is getting the finished recording onto streaming services through a distributor.", registration: "Rights registration tells a rights organization about your song so it can collect writer income. It takes time and has to be accepted by them.", exclusive: "An exclusive beat purchase means you are the only buyer. The agreement lists exactly which rights you get and which stay with the producer.", promo: "A promotional agreement pays a DJ or promoter for work such as sets or social posts. It does not give them ownership of the song unless the agreement clearly says so.", reconciliation: "Payment reconciliation means checking that what was calculated, what a statement says, and what actually arrived all match." };
    const term = clip(b.term, 40).toLowerCase(), fixed = TERMS[term];
    const q = clip(b.question, 300);
    if (q) { const r = await ai("explain", null, GUARD + "\nAnswer this independent artist's question in under 90 words: " + q, "public"); return B.J(200, { ok: true, answer: r.text || (aiNote(r) + " The glossary below covers the main terms."), ai: !!r.text, cached: !!r.cached }); }
    return fixed ? B.J(200, { ok: true, answer: fixed }) : B.J(200, { ok: true, terms: TERMS });
  }

  if (a === "o_ai_stats") { // owner only: where the AI calls go. Tokens come from the provider's own usage report; no dollar guesses.
    if (!B.verifyOwner(B.bearer(event))) return B.J(403, { error: "POTENT owner only" });
    const since = new Date(Date.now() - 30 * 864e5).toISOString(), us = rows(await B.sb("music_ai_usage?created_at=gte." + since + "&select=task,cached,ok,tokens_in,tokens_out&limit=20000")), by = {};
    us.forEach(function (x) { const o = by[x.task] = by[x.task] || { calls: 0, cached: 0, failed: 0, tokens_in: 0, tokens_out: 0 }; if (x.cached) o.cached++; else { o.calls++; if (!x.ok) o.failed++; o.tokens_in += x.tokens_in || 0; o.tokens_out += x.tokens_out || 0; } });
    return B.J(200, { ok: true, days: 30, model: process.env.AI_MODEL || "gemini-flash-latest", configured: !!process.env.GEMINI_API_KEY, dailyCapPerUser: DAILY_CAP, byTask: by });
  }
  // ───── project owner (artist account) ─────
  const u = M.verifyUser(B.bearer(event));
  if (!u) return B.J(401, { error: "Sign in first" });
  if (a === "u_mode") {
    if (b.mode !== undefined) { if (["quick", "guided", "advanced"].indexOf(b.mode) < 0) return B.J(400, { error: "Bad mode" }); await B.sb("music_users?id=eq." + u.uid, { method: "PATCH", prefer: "return=minimal", body: { help_mode: b.mode } }); return B.J(200, { ok: true, mode: b.mode }); }
    const me = rows(await B.sb("music_users?id=eq." + u.uid + "&select=help_mode"))[0]; return B.J(200, { ok: true, mode: (me && me.help_mode) || "guided" });
  }
  if (a === "p_list") {
    const ps = rows(await B.sb("music_projects?owner_user_id=eq." + u.uid + "&select=*&order=created_at.desc&limit=100"));
    const sales = rows(await B.sb("beat_sales?buyer_user_id=eq." + u.uid + "&status=eq.complete&select=id,title,beat_id,created_at&order=created_at.desc&limit=100"));
    return B.J(200, { ok: true, projects: ps, purchases: sales });
  }
  if (a === "p_create") {
    const title = clip(b.title, 140); if (!title) return B.J(400, { error: "Name the project" });
    let sale = null;
    if (b.beat_sale_id) {
      if (!UUID.test(String(b.beat_sale_id))) return B.J(400, { error: "Bad purchase" });
      sale = rows(await B.sb("beat_sales?id=eq." + b.beat_sale_id + "&buyer_user_id=eq." + u.uid + "&status=eq.complete&select=id"))[0];
      if (!sale) return B.J(403, { error: "That purchase is not yours or is not complete" });
    }
    const r = await B.sb("music_projects", { method: "POST", prefer: "return=representation", body: { owner_user_id: u.uid, title: title, beat_sale_id: sale ? sale.id : null } });
    if (!r.ok) return B.J(r.status === 409 ? 409 : 500, { error: r.status === 409 ? "That beat purchase already has a project" : "Could not create" });
    await B.audit("user:" + u.uid, "project_create", r.data[0].id, null); return B.J(200, { ok: true, id: r.data[0].id });
  }
  const p = ["p_get", "p_contrib_add", "p_contrib_remove", "p_schedule_save", "p_schedule_submit", "p_revenue_add", "p_revenue_receive", "p_split_sheet", "p_ai_next", "p_ai_split", "p_ask", "p_draft_invite"].indexOf(a) >= 0 ? await loadProject(b.project_id, u.uid) : null;
  if (a.indexOf("p_") === 0 && a !== "p_list" && a !== "p_create" && !p) return B.J(404, { error: "Project not found" });
  const link = function (cid) { return B.SITE + "/music/approve.html?t=" + R.signContributor(cid); };

  if (a === "p_get") return B.J(200, { ok: true, project: p, checklist: checklist(p), links: p.contributors.reduce(function (o, c) { o[c.id] = link(c.id); return o; }, {}) });
  if (a === "p_contrib_add") {
    const email = clip(b.email, 160).toLowerCase(), name = clip(b.name, 80);
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return B.J(400, { error: "Enter a name and a real email" });
    if (p.contributors.length >= 50) return B.J(400, { error: "50 people per project" });
    const roles = (Array.isArray(b.roles) ? b.roles : []).filter(function (x) { return R.ROLES.indexOf(x) >= 0; });
    const ex = p.contributors.find(function (c) { return c.email === email; });
    const r = ex ? await B.sb("music_contributors?id=eq." + ex.id, { method: "PATCH", prefer: "return=minimal", body: { name: name, roles: Array.from(new Set(ex.roles.concat(roles))) } }) : await B.sb("music_contributors", { method: "POST", prefer: "return=minimal", body: { project_id: p.id, name: name, email: email, roles: roles } });
    return r.ok ? B.J(200, { ok: true, merged: !!ex }) : B.J(500, { error: "Could not save" });
  }
  if (a === "p_contrib_remove") {
    if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" });
    if (p.schedules.some(function (s) { return s.status !== "superseded" && s.music_schedule_lines.some(function (l) { return l.contributor_id === b.id; }); })) return B.J(409, { error: "This person is on a split. Change the split first." });
    await B.sb("music_contributors?id=eq." + b.id + "&project_id=eq." + p.id, { method: "DELETE", prefer: "return=minimal" }); return B.J(200, { ok: true });
  }
  if (a === "p_schedule_save") {
    const cat = String(b.category || ""); if (R.CATEGORIES.indexOf(cat) < 0) return B.J(400, { error: "Pick an income type" });
    const v = R.validateLines(b.lines, p.contributors.map(function (c) { return c.id; })); if (!v.ok) return B.J(400, { error: v.error });
    const base = b.base === "gross" ? "gross" : "net_eligible";
    const ver = p.schedules.filter(function (s) { return s.category === cat; }).reduce(function (m, s) { return Math.max(m, s.version); }, 0) + 1;
    await B.sb("music_schedules?project_id=eq." + p.id + "&category=eq." + cat + "&status=in.(draft,disputed)", { method: "PATCH", prefer: "return=minimal", body: { status: "superseded" } });
    const r = await B.sb("music_schedules", { method: "POST", prefer: "return=representation", body: { project_id: p.id, category: cat, label: clip(b.label, 80) || null, base: base, deductions: clip(b.deductions, 500) || null, version: ver, status: "draft" } });
    if (!r.ok) return B.J(500, { error: "Could not save" });
    const ln = await B.sb("music_schedule_lines", { method: "POST", prefer: "return=minimal", body: v.lines.map(function (l) { return { schedule_id: r.data[0].id, contributor_id: l.contributor_id, pct: l.pct }; }) });
    if (!ln.ok) { await B.sb("music_schedules?id=eq." + r.data[0].id, { method: "DELETE", prefer: "return=minimal" }); return B.J(500, { error: "Could not save" }); }
    await B.audit("user:" + u.uid, "split_draft", r.data[0].id, { category: cat, version: ver }); return B.J(200, { ok: true, id: r.data[0].id, version: ver });
  }
  if (a === "p_schedule_submit") {
    const s = p.schedules.find(function (x) { return x.id === b.id; }); if (!s || s.status !== "draft") return B.J(409, { error: "Only a saved draft can be sent for approval" });
    await B.sb("music_schedules?id=eq." + s.id, { method: "PATCH", prefer: "return=minimal", body: { status: "pending" } });
    await B.audit("user:" + u.uid, "split_submit", s.id, { category: s.category, version: s.version });
    const links = s.music_schedule_lines.map(function (l) { const c = p.contributors.find(function (x) { return x.id === l.contributor_id; }); return { name: c.name, email: c.email, url: link(c.id) }; });
    return B.J(200, { ok: true, links: links, note: "Email does not send from here yet. Copy each link to the person." });
  }
  if (a === "p_revenue_add") {
    const cat = String(b.category || ""); if (R.CATEGORIES.indexOf(cat) < 0) return B.J(400, { error: "Pick an income type" });
    let gross, source, ref = clip(b.reference, 120) || null;
    if (cat === "beat_sale") { // comes only from the real, completed beat sale, never typed in
      if (!p.beat_sale_id) return B.J(400, { error: "This project is not linked to a beat purchase" });
      const sale = rows(await B.sb("beat_sales?id=eq." + p.beat_sale_id + "&status=eq.complete&select=eligible_cents,gross_cents"))[0]; if (!sale) return B.J(409, { error: "That beat sale is not complete" });
      gross = Number(sale.eligible_cents != null ? sale.eligible_cents : sale.gross_cents); source = "sale"; ref = "sale:" + p.beat_sale_id;
    } else { gross = Math.round(Number(b.gross_cents)); source = b.source === "statement" ? "statement" : "self_reported"; }
    if (!(gross >= 0 && gross <= 1e11)) return B.J(400, { error: "Enter a valid amount" });
    const ded = Math.round(Number(b.deductions_cents) || 0); if (ded < 0 || ded > gross) return B.J(400, { error: "Costs cannot be more than the amount received" });
    const sc = p.schedules.find(function (s) { return s.category === cat && s.status === "approved"; });
    if (!sc) return B.J(409, { error: "There is no approved " + cat.replace("_", " ") + " split yet. Nothing was allocated." });
    const eligible = R.eligibleFor(sc.base, gross, ded);
    const rv = await B.sb("music_revenue", { method: "POST", prefer: "return=representation", body: { project_id: p.id, category: cat, source: source, gross_cents: gross, deductions_cents: ded, eligible_cents: eligible, reference: ref, note: clip(b.note, 300) || null, schedule_id: sc.id, schedule_version: sc.version } });
    if (!rv.ok) return B.J(rv.status === 409 ? 409 : 500, { error: rv.status === 409 ? "That statement or reference was already recorded" : "Could not record" });
    const al = R.allocate(eligible, sc.music_schedule_lines);
    const ins = await B.sb("music_allocations", { method: "POST", prefer: "return=minimal", body: al.map(function (x) { return { revenue_id: rv.data[0].id, contributor_id: x.contributor_id, cents: x.cents }; }) });
    if (!ins.ok) { await B.sb("music_revenue?id=eq." + rv.data[0].id, { method: "DELETE", prefer: "return=minimal" }); return B.J(500, { error: "Could not allocate" }); }
    await B.audit("user:" + u.uid, "revenue_add", rv.data[0].id, { category: cat, eligible: eligible, version: sc.version }); return B.J(200, { ok: true, eligible_cents: eligible, allocations: al });
  }
  if (a === "p_revenue_receive") {
    const rv = p.revenue.find(function (x) { return x.id === b.id; }); if (!rv) return B.J(404, { error: "Not found" });
    if (rv.source === "self_reported") return B.J(409, { error: "Self-reported income cannot be marked received. Add the statement or bank reference as a statement entry." });
    await B.sb("music_revenue?id=eq." + rv.id, { method: "PATCH", prefer: "return=minimal", body: { status: "received" } });
    await B.audit("user:" + u.uid, "revenue_received", rv.id, null); return B.J(200, { ok: true });
  }
  if (a === "p_split_sheet") {
    const q = function (v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const out = ["project,income_type,version,status,calculated_on,person,email,roles,share_percent,approval"];
    p.schedules.filter(function (s) { return s.status !== "draft"; }).forEach(function (s) { s.music_schedule_lines.forEach(function (l) { const c = p.contributors.find(function (x) { return x.id === l.contributor_id; }) || {}; const ap = s.music_schedule_approvals.find(function (x) { return x.contributor_id === l.contributor_id; });
      out.push([q(p.title), s.category, s.version, s.status, s.base, q(c.name), q(c.email), q((c.roles || []).join("/")), l.pct, ap ? ap.decision : "no answer yet"].join(",")); }); });
    return B.J(200, { ok: true, csv: out.join("\n") });
  }
  // Rules first. The next move, answers about approvals and money, and the invite text all come from real records with no AI call.
  if (a === "p_ai_next") {
    const m = nextMove(p), cl = checklist(p); let simple = null;
    if (b.simple === true && m.action) { const r = await ai("next_simple", u.uid, GUARD + "\nRewrite this for someone who gets overwhelmed, in 2 short sentences, same facts only: " + m.title + ". " + m.why, JSON.stringify([m.title, m.missing])); simple = r.text; if (!simple) m.aiNote = aiNote(r); }
    return B.J(200, { ok: true, checklist: cl, next: m, simple: simple });
  }
  if (a === "p_ask") {
    const t = clip(b.text, 300).toLowerCase(), m = nextMove(p);
    if (/who.*(approv|answer|sign)|still need/.test(t)) return B.J(200, { ok: true, answer: m.missing.length ? "Still waiting on: " + m.missing.join(", ") + "." : "Nobody is holding up an approval right now.", source: "records" });
    if (/hold|stuck|block|next|finish|release/.test(t)) return B.J(200, { ok: true, answer: m.title + ". " + m.why, source: "records", next: m });
    if (/paid|received|money|earn|owe/.test(t)) return B.J(200, { ok: true, answer: money(p), source: "records" });
    const r = await ai("ask", u.uid, GUARD + "\nProject: " + p.title + ". Next step from records: " + m.title + ". Question: " + clip(b.text, 300) + "\nAnswer in under 70 words. Do not state any amounts or percentages.", JSON.stringify([m.title, p.revenue.length]));
    return B.J(200, { ok: true, answer: r.text || aiNote(r), source: r.text ? "ai" : "none", cached: !!r.cached });
  }
  if (a === "p_draft_invite") { // plain template, no AI
    const c = p.contributors.find(function (x) { return x.id === b.contributor_id; }); if (!c) return B.J(404, { error: "Person not found" });
    return B.J(200, { ok: true, text: "Hey " + c.name.split(" ")[0] + ", I added you to \"" + p.title + "\" on POTENT Music. Please look at your share and approve it or tell me what is off: " + link(c.id) + "\nIt only records the split. Nothing is paid or signed by clicking it." });
  }
  if (a === "p_ai_split") { // turns a sentence into a DRAFT split; nothing is saved and the server still validates when saved
    const names = p.contributors.map(function (c) { return c.name; });
    const r = await ai("split_draft", u.uid, GUARD + "\nPeople: " + JSON.stringify(names) + ". Request: " + clip(b.text, 500) + '\nReturn ONLY a JSON array like [{"name":"...","pct":number}] using only these names and only percentages the request states or that simply fill the remainder to 100 for ONE named person. If it is unclear, return [].', JSON.stringify(names));
    let out = []; try { const j = JSON.parse(String(r.text || "[]").replace(/^```json|```$/g, "").trim()); if (Array.isArray(j)) out = j.filter(function (x) { return names.indexOf(x && x.name) >= 0 && Number(x.pct) > 0; }).map(function (x) { return { contributor_id: p.contributors.find(function (c) { return c.name === x.name; }).id, name: x.name, pct: Math.round(Number(x.pct) * 10000) / 10000 }; }); } catch (e) { }
    return B.J(200, { ok: true, draft: out, ai: !!r.text, message: r.text ? "This is only a draft. Check every number, then save it." : aiNote(r) });
  }
  return B.J(400, { error: "Unknown action" });
};
module.exports.lib = { ai: ai, aiNote: aiNote, GUARD: GUARD, loadProject: loadProject, checklist: checklist, nextMove: nextMove, money: money };
