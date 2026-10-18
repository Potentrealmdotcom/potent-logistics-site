// Run: node tests/rights.test.js  Splits, revenue separation, approvals, permissions (in-memory database).
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
const assert = require("assert"), R = require("../netlify/functions/lib/rights.js"), M = require("../netlify/functions/lib/music.js"), api = require("../netlify/functions/music-rights.js");
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const T = { music_projects: [], music_contributors: [], music_schedules: [], music_schedule_lines: [], music_schedule_approvals: [], music_revenue: [], music_allocations: [], beat_sales: [{ id: "bbbbbbbb-0000-0000-0000-000000000001", buyer_user_id: "u1", status: "complete", eligible_cents: 50000, gross_cents: 50000, title: "Beat" }], beat_audit: [], music_ai_usage: [], music_ai_cache: [], music_users: [{ id: "u1", help_mode: "guided" }] };
let seq = 0; const uid = () => { const h = (++seq).toString(16).padStart(12, "0"); return "00000000-0000-4000-8000-" + h; };
const uniq = { music_revenue: ["project_id", "category", "reference"], music_contributors: ["project_id", "email"], music_projects: ["beat_sale_id"] };
function filt(tbl, q) { let rows = T[tbl]; q.split("&").forEach(p => { const m = p.match(/^(\w+)=(eq|neq|in)\.(.*)$/); if (!m) return; const [, c, op, v] = m; if (op === "eq") rows = rows.filter(r => String(r[c]) === v); else if (op === "neq") rows = rows.filter(r => String(r[c]) !== v); else if (op === "in") { const set = v.replace(/[()]/g, "").split(","); rows = rows.filter(r => set.includes(String(r[c]))); } }); return rows; }
let gemCalls = 0, gemMode = "ok";
global.fetch = async (u, o) => { o = o || {}; u = String(u);
  if (u.includes("generativelanguage")) { gemCalls++; if (gemMode === "fail") return { ok: false, status: 500, json: async () => ({}) }; return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "Short answer." }] } }], usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 20 } }) }; } const m = o.method || "GET"; const mm = u.match(/rest\/v1\/([a-z_]+)\??(.*)$/); let d = [], st = 200;
  if (mm) { const tbl = mm[1], q = mm[2] || ""; if (!T[tbl]) return { ok: true, status: 200, text: async () => "[]" };
    if (m === "GET") { d = filt(tbl, q).map(r => Object.assign({}, r)); if (tbl === "music_schedules") d.forEach(s => { s.music_schedule_lines = T.music_schedule_lines.filter(l => l.schedule_id === s.id); s.music_schedule_approvals = T.music_schedule_approvals.filter(a => a.schedule_id === s.id); }); if (tbl === "music_revenue") d.forEach(r => r.music_allocations = T.music_allocations.filter(a => a.revenue_id === r.id)); if (tbl === "music_contributors") d.forEach(c => c.music_projects = T.music_projects.find(p => p.id === c.project_id)); if (tbl === "music_allocations") d.forEach(a => a.music_revenue = T.music_revenue.find(r => r.id === a.revenue_id)); }
    else if (m === "POST") { const arr = [].concat(JSON.parse(o.body)); const added = []; for (const r of arr) { r.id = r.id || uid(); const uk = uniq[tbl]; if (uk && uk.every(k => r[k] != null) && T[tbl].some(x => uk.every(k => x[k] === r[k]))) { if (/merge/.test(o.prefer || "")) {} else return { ok: false, status: 409, text: async () => "{}" }; } if (/on_conflict/.test(u) && tbl === "music_schedule_approvals") { const ex = T[tbl].find(x => x.schedule_id === r.schedule_id && x.contributor_id === r.contributor_id); if (ex) { Object.assign(ex, r, { id: ex.id }); continue; } } T[tbl].push(r); added.push(r); } d = added; }
    else if (m === "PATCH") { const rows = filt(tbl, q); rows.forEach(r => Object.assign(r, JSON.parse(o.body))); d = rows; }
    else if (m === "DELETE") { const rows = filt(tbl, q); T[tbl] = T[tbl].filter(r => !rows.includes(r)); } }
  return { ok: st === 200, status: st, text: async () => JSON.stringify(d), json: async () => d }; };

const call = async (t, body) => { const r = await api.handler({ httpMethod: "POST", headers: t ? { authorization: "Bearer " + t } : {}, body: JSON.stringify(body) }); return [r.statusCode, JSON.parse(r.body)]; };

(async () => {
  // pure math
  const ten = Array.from({ length: 10 }, (_, i) => ({ contributor_id: "c" + i, pct: 10 }));
  ok(R.validateLines(ten, ten.map(x => x.contributor_id)).ok, "ten contributors at 10% validate");
  ok(!R.validateLines([{ contributor_id: "a", pct: 60 }, { contributor_id: "b", pct: 39.99 }], ["a", "b"]).ok, "99.99 rejected");
  ok(!R.validateLines([{ contributor_id: "a", pct: 50 }, { contributor_id: "a", pct: 50 }], ["a"]).ok, "same person twice rejected");
  ok(!R.validateLines([{ contributor_id: "zz", pct: 100 }], ["a"]).ok, "stranger rejected");
  const sp = R.allocate(1000000, [{ contributor_id: "artist", pct: 98 }, { contributor_id: "breeze", pct: 1 }, { contributor_id: "potent", pct: 1 }]);
  ok(sp[0].cents === 980000 && sp[1].cents === 10000 && sp[2].cents === 10000, "98/1/1 on $10,000 = 9800/100/100");
  for (const amt of [1, 7, 999, 123457]) ok(R.allocate(amt, [{ pct: 33.3333 }, { pct: 33.3333 }, { pct: 33.3334 }]).reduce((a, x) => a + x.cents, 0) === amt, "allocations sum exactly " + amt);
  ok(R.eligibleFor("net_eligible", 1000, 300) === 700 && R.eligibleFor("gross", 1000, 300) === 1000, "gross vs net base");
  const t1 = R.signContributor("abc"); ok(R.verifyContributor(t1) === "abc" && R.verifyContributor(t1 + "x") === null, "contributor links verify");

  // flows
  const owner = M.signUser("u1"), other = M.signUser("u2");
  ok(owner && other, "tokens");
  let [c, j] = await call(null, { action: "p_list" }); ok(c === 401, "must sign in");
  [c, j] = await call(owner, { action: "p_create", title: "Song", beat_sale_id: "bbbbbbbb-0000-0000-0000-000000000001" }); ok(c === 200, "project from my beat purchase"); const pid = j.id;
  [c] = await call(other, { action: "p_create", title: "Steal", beat_sale_id: "bbbbbbbb-0000-0000-0000-000000000001" }); ok(c === 403, "cannot use someone else's purchase");
  [c] = await call(other, { action: "p_get", project_id: pid }); ok(c === 404, "other user cannot open my project");
  const ids = {};
  for (let i = 0; i < 10; i++) { [c, j] = await call(owner, { action: "p_contrib_add", project_id: pid, name: "P" + i, email: "p" + i + "@x.co", roles: i === 0 ? ["lead_artist", "songwriter"] : ["songwriter"] }); ok(c === 200, "add contributor " + i); }
  [c, j] = await call(owner, { action: "p_contrib_add", project_id: pid, name: "P0", email: "p0@x.co", roles: ["producer"] }); ok(j.merged, "same person merges roles instead of duplicating");
  [c, j] = await call(owner, { action: "p_get", project_id: pid }); const people = j.project.contributors; ok(people.length === 10, "ten people"); ok(people[0].roles.length === 3, "roles merged");
  const mk = pcts => people.map((x, i) => ({ contributor_id: x.id, pct: pcts[i] })).filter(l => l.pct > 0);
  // revenue before any approved split is blocked
  [c, j] = await call(owner, { action: "p_revenue_add", project_id: pid, category: "master", gross_cents: 100000, source: "statement", reference: "S1" }); ok(c === 409, "no approved split: nothing allocated");
  // bad split
  [c] = await call(owner, { action: "p_schedule_save", project_id: pid, category: "master", lines: mk([90, 5, 0, 0, 0, 0, 0, 0, 0, 0]) }); ok(c === 400, "split of 95 rejected");
  // master 98/1/1, publishing 10 x 10%
  [c, j] = await call(owner, { action: "p_schedule_save", project_id: pid, category: "master", base: "net_eligible", lines: mk([98, 1, 1, 0, 0, 0, 0, 0, 0, 0]) }); ok(c === 200, "master draft"); const mid = j.id;
  [c, j] = await call(owner, { action: "p_schedule_save", project_id: pid, category: "publishing", base: "gross", lines: mk([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]) }); ok(c === 200, "publishing draft"); const pubId = j.id;
  [c, j] = await call(owner, { action: "p_schedule_submit", project_id: pid, id: mid }); ok(c === 200 && j.links.length === 3, "master sent to 3 people");
  [c, j] = await call(owner, { action: "p_schedule_submit", project_id: pid, id: pubId }); ok(j.links.length === 10, "publishing sent to 10 people");
  const tk = i => R.signContributor(people[i].id);
  // approvals: strangers and non-members blocked
  [c] = await call(null, { action: "r_decide", t: "bad", schedule_id: mid, decision: "approved" }); ok(c === 403, "bad link rejected");
  [c] = await call(null, { action: "r_decide", t: tk(5), schedule_id: mid, decision: "approved" }); ok(c === 403, "person not on this split cannot approve it");
  [c, j] = await call(null, { action: "r_decide", t: tk(0), schedule_id: mid, decision: "approved" }); ok(j.status === "pending", "one approval is not enough");
  [c, j] = await call(null, { action: "r_decide", t: tk(1), schedule_id: mid, decision: "approved" }); ok(j.status === "pending", "two of three is still pending");
  [c, j] = await call(owner, { action: "p_revenue_add", project_id: pid, category: "master", gross_cents: 100000, source: "statement", reference: "S1" }); ok(c === 409, "still blocked while pending");
  [c, j] = await call(null, { action: "r_decide", t: tk(2), schedule_id: mid, decision: "approved" }); ok(j.status === "approved", "all three approved");
  // master revenue: allocates only by the master split and no beat fee is applied
  [c, j] = await call(owner, { action: "p_revenue_add", project_id: pid, category: "master", gross_cents: 1000000, deductions_cents: 0, source: "statement", reference: "S1" });
  ok(c === 200 && j.eligible_cents === 1000000, "master: full $10,000 eligible, no marketplace fee taken");
  ok(j.allocations.map(x => x.cents).join() === "980000,10000,10000", "master allocations 9800/100/100");
  [c] = await call(owner, { action: "p_revenue_add", project_id: pid, category: "master", gross_cents: 1000000, source: "statement", reference: "S1" }); ok(c === 409, "same statement cannot be recorded twice");
  [c, j] = await call(owner, { action: "p_revenue_add", project_id: pid, category: "master", gross_cents: 100000, deductions_cents: 20000, source: "statement", reference: "S2" }); ok(j.eligible_cents === 80000, "net base removes costs");
  [c] = await call(owner, { action: "p_revenue_add", project_id: pid, category: "master", gross_cents: 100, deductions_cents: 500, source: "statement", reference: "S3" }); ok(c === 400, "costs above income rejected");
  // publishing is separate: 9 approvals + 1 dispute
  for (let i = 0; i < 9; i++) await call(null, { action: "r_decide", t: tk(i), schedule_id: pubId, decision: "approved" });
  [c, j] = await call(null, { action: "r_decide", t: tk(9), schedule_id: pubId, decision: "disputed", note: "I wrote more" }); ok(j.status === "disputed", "one dispute flags the whole schedule");
  [c] = await call(owner, { action: "p_revenue_add", project_id: pid, category: "publishing", gross_cents: 5000, source: "statement", reference: "P1" }); ok(c === 409, "disputed schedule allocates nothing");
  [c, j] = await call(owner, { action: "p_get", project_id: pid }); ok(j.checklist.find(x => x.k === "publishing").s === "ACTION REQUIRED", "dispute shows as action required");
  // master schedule untouched by publishing dispute
  ok(j.project.schedules.find(s => s.category === "master" && s.status === "approved"), "master split still approved");
  // changing an approved split creates a new version and needs new approval
  [c, j] = await call(owner, { action: "p_schedule_save", project_id: pid, category: "master", lines: mk([97, 1, 1, 1, 0, 0, 0, 0, 0, 0]) }); ok(j.version === 2, "change creates version 2");
  [c, j] = await call(owner, { action: "p_get", project_id: pid }); ok(j.project.schedules.find(s => s.category === "master" && s.version === 1).status === "approved", "v1 stays approved until v2 is approved");
  // beat sale revenue comes only from the real sale; cannot be typed in
  [c] = await call(owner, { action: "p_schedule_save", project_id: pid, category: "beat_sale", lines: mk([0, 0, 0, 0, 0, 0, 0, 0, 0, 100]) }); ok(c === 200, "beat-sale split saved");
  // receive rules
  [c, j] = await call(owner, { action: "p_get", project_id: pid }); const rv = j.project.revenue.find(x => x.reference === "S1");
  [c] = await call(owner, { action: "p_revenue_receive", project_id: pid, id: rv.id }); ok(c === 200, "statement entry can be marked received");
  [c, j] = await call(owner, { action: "p_split_sheet", project_id: pid }); ok(c === 200 && j.csv.split("\n").length > 10, "split sheet csv");
  [c, j] = await call(null, { action: "r_view", t: tk(0) }); ok(c === 200 && j.allocations.length >= 1, "contributor sees own allocations");
  // ───── AI: rules first, cache, cap, fallback, monitoring ─────
  delete process.env.GEMINI_API_KEY;
  [c, j] = await call(owner, { action: "p_ai_next", project_id: pid }); ok(c === 200 && /Resolve the publishing split dispute/.test(j.next.title), "next move comes from real records (dispute)");
  ok(j.next.missing.join() === "P9", "names who disagreed");
  [c, j] = await call(owner, { action: "p_ask", project_id: pid, text: "Who still needs to approve?" }); ok(j.source === "records", "approval question answered from records");
  [c, j] = await call(owner, { action: "p_ask", project_id: pid, text: "show me what I have been paid" }); ok(/confirmed received/.test(j.answer) && /calculated but not yet received/.test(j.answer), "money answer separates received from calculated");
  ok(gemCalls === 0 && T.music_ai_usage.length === 0, "no AI calls for rules-based answers");
  [c, j] = await call(owner, { action: "p_ask", project_id: pid, text: "explain a bridge" }); ok(/not available/.test(j.answer) && gemCalls === 0, "AI off: friendly fallback, app still works");
  [c, j] = await call(owner, { action: "p_schedule_save", project_id: pid, category: "other", lines: mk([50, 50, 0, 0, 0, 0, 0, 0, 0, 0]) }); ok(c === 200, "core features work with AI off");
  process.env.GEMINI_API_KEY = "x";
  [c, j] = await call(owner, { action: "p_ask", project_id: pid, text: "explain a bridge" }); ok(j.source === "ai" && gemCalls === 1, "AI used when rules cannot answer");
  [c, j] = await call(owner, { action: "p_ask", project_id: pid, text: "explain a bridge" }); ok(j.cached === true && gemCalls === 1, "same question reuses cache, no second call");
  ok(T.music_ai_usage.filter(x => x.cached).length === 1 && T.music_ai_usage.find(x => !x.cached).tokens_in === 120, "usage logs tokens and cache reuse");
  [c, j] = await call(other, { action: "p_ask", project_id: pid, text: "explain a bridge" }); ok(c === 404, "another user cannot use my project context or cache");
  gemMode = "fail"; [c, j] = await call(owner, { action: "p_ask", project_id: pid, text: "what is a hook" }); ok(/not available/.test(j.answer), "provider error: graceful message"); ok(T.music_ai_usage.some(x => x.ok === false), "failed call logged");
  gemMode = "ok"; for (let i = 0; i < 40; i++) T.music_ai_usage.push({ user_id: "u1", cached: false, ok: true, created_at: new Date().toISOString() });
  const before = gemCalls; [c, j] = await call(owner, { action: "p_ask", project_id: pid, text: "brand new question" }); ok(/today's AI help/.test(j.answer) && gemCalls === before, "daily cap stops further calls");
  [c, j] = await call(owner, { action: "u_mode", mode: "quick" }); ok(j.mode === "quick", "help mode saved"); [c, j] = await call(owner, { action: "u_mode" }); ok(j.mode === "quick", "help mode remembered");
  [c] = await call(owner, { action: "o_ai_stats" }); ok(c === 403, "AI stats are owner only");
  [c, j] = await call(owner, { action: "p_draft_invite", project_id: pid, contributor_id: people[0].id }); ok(/approve\.html\?t=/.test(j.text) && gemCalls === before, "invite text is a template, no AI");
  console.log("PASS: " + n + " assertions");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
