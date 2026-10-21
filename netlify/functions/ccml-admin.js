// CCML office panel. POTENT owner login only (staff token, no company attached). Tenants and other staff are refused.
// POST { action: overview | setdfy | setmail | draftplan, ... }  + Authorization: Bearer <staff token>
const crypto = require("crypto");
const C = require("./lib/ccml");

function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function verify(token) {
  if (!token || typeof token !== "string" || token.indexOf(".") < 0 || !process.env.AUTH_SECRET) return null;
  const parts = token.split(".");
  const expect = b64u(crypto.createHmac("sha256", process.env.AUTH_SECRET).update(parts[0]).digest());
  const a = Buffer.from(parts[1] || ""), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return p.exp && p.exp >= Date.now() ? p : null;
  } catch (e) { return null; }
}
const DFY_STATUS = ["intake_received", "reviewing", "in_progress", "waiting_on_client", "complete"];
const FUND_STATUS = ["not_started", "preparing", "applied", "approved", "funded", "declined"];
const MAIL_STATUS = ["queued", "mailed", "failed"];
const UUID = /^[0-9a-f-]{36}$/i;
const clip = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n); };

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return C.J(405, { error: "POST only" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return C.J(500, { error: "Server not configured" });
  const h = event.headers || {};
  const m = String(h.authorization || h.Authorization || "").match(/^Bearer\s+(.+)$/i);
  const tok = m ? verify(m[1]) : null;
  if (!tok || tok.role !== "owner" || tok.orgId || tok.assist) return C.J(403, { error: "POTENT owner only" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return C.J(400, { error: "Bad request" }); }

  if (b.action === "overview") {
    const [pu, dfy, mail, prof] = await Promise.all([
      C.sb("ccml_purchases?select=*&order=created_at.desc&limit=200"),
      C.sb("ccml_dfy_clients?select=*&order=created_at.desc&limit=200"),
      C.sb("ccml_mail_requests?select=*&order=created_at.desc&limit=200"),
      C.sb("ccml_profiles?select=id,email,full_name,plan,mail_credits&limit=1000")
    ]);
    const pm = {}; (Array.isArray(prof.data) ? prof.data : []).forEach(function (p) { pm[p.id] = p; });
    const purchases = Array.isArray(pu.data) ? pu.data : [];
    const revenueCents = purchases.reduce(function (s, p) { return s + (p.status === "complete" ? (p.amount_cents || 0) : 0); }, 0);
    return C.J(200, { ok: true, revenueCents: revenueCents, members: Object.keys(pm).length,
      purchases: purchases,
      dfy: (Array.isArray(dfy.data) ? dfy.data : []).map(function (d) { const p = pm[d.user_id] || {}; return Object.assign({}, d, { account_email: p.email || null, plan: p.plan || null }); }),
      mail: (Array.isArray(mail.data) ? mail.data : []).map(function (r) { const p = pm[r.user_id] || {}; return Object.assign({}, r, { account_email: p.email || null }); }) });
  }

  if (b.action === "setdfy") {
    if (!UUID.test(String(b.id || ""))) return C.J(400, { error: "Bad id" });
    const patch = { updated_at: new Date().toISOString() };
    if (b.dfy_status !== undefined) { if (DFY_STATUS.indexOf(b.dfy_status) < 0) return C.J(400, { error: "Bad status" }); patch.dfy_status = b.dfy_status; }
    if (b.funding_status !== undefined) { if (FUND_STATUS.indexOf(b.funding_status) < 0) return C.J(400, { error: "Bad funding status" }); patch.funding_status = b.funding_status; }
    if (b.admin_notes !== undefined) patch.admin_notes = clip(b.admin_notes, 2000);
    const r = await C.sb("ccml_dfy_clients?id=eq." + b.id, { method: "PATCH", prefer: "return=representation", body: patch });
    return r.ok && Array.isArray(r.data) && r.data.length ? C.J(200, { ok: true, row: r.data[0] }) : C.J(404, { error: "Not found" });
  }

  if (b.action === "setmail") {
    if (!UUID.test(String(b.id || ""))) return C.J(400, { error: "Bad id" });
    if (MAIL_STATUS.indexOf(b.status) < 0) return C.J(400, { error: "Bad status" });
    const patch = { status: b.status, tracking_number: clip(b.tracking_number, 60) || null, mailed_at: b.status === "mailed" ? new Date().toISOString() : null };
    if (b.status === "mailed" && !patch.tracking_number) return C.J(400, { error: "Enter the certified mail tracking number first." });
    const r = await C.sb("ccml_mail_requests?id=eq." + b.id, { method: "PATCH", prefer: "return=representation", body: patch });
    return r.ok && Array.isArray(r.data) && r.data.length ? C.J(200, { ok: true, row: r.data[0] }) : C.J(404, { error: "Not found" });
  }

  if (b.action === "draftplan") {
    if (!UUID.test(String(b.id || ""))) return C.J(400, { error: "Bad id" });
    if (!process.env.GEMINI_API_KEY) return C.J(503, { error: "GEMINI_API_KEY is not set." });
    const g = await C.sb("ccml_dfy_clients?id=eq." + b.id + "&select=*");
    const c = g.ok && Array.isArray(g.data) && g.data[0];
    if (!c) return C.J(404, { error: "Not found" });
    const facts = ["current_score", "bankruptcy_last2", "negative_items", "total_negative", "goal_amount", "timeline", "funding_use", "llc_state", "trademark_filed"].map(function (k) { return k + ": " + clip(c[k], 400); }).join("\n");
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", { method: "POST",
        headers: { Authorization: "Bearer " + process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ model: process.env.CCML_AI_MODEL || "gemini-3.5-flash-lite", temperature: 0.3, max_tokens: 4000, messages: [
          { role: "system", content: "You draft an internal working plan for a credit coach's staff. Be concrete, flag risks and anything needing a human or attorney, promise no outcomes." },
          { role: "user", content: "Draft a step-by-step funding readiness plan for this client:\n" + facts }] }) });
      if (!r.ok) return C.J(502, { error: "AI is busy. Try again." });
      const d = await r.json();
      const text = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      if (!text) return C.J(502, { error: "No answer" });
      await C.sb("ccml_dfy_clients?id=eq." + b.id, { method: "PATCH", prefer: "return=minimal", body: { ai_plan: text, updated_at: new Date().toISOString() } });
      return C.J(200, { ok: true, ai_plan: text });
    } catch (e) { return C.J(502, { error: "AI is busy. Try again." }); }
  }
  return C.J(400, { error: "Unknown action" });
};
