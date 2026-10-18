// POTENT VOICE plans, subscription and usage. Company logins see and buy only their own company's add-on.
// POTENT's owner login (no company) edits tiers, prices, minutes, overages and features, and sees every company.
const B = require("./lib/beats");
const A = require("./lib/voice/auth");
const V = require("./lib/voice/billing");
const UUID = /^[0-9a-f-]{36}$/i;
const hits = {};
function tooMany(k, max) { const h = hits[k] = (hits[k] || []).filter(function (t) { return Date.now() - t < 6e4; }); h.push(Date.now()); return h.length > max; }

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  const tok = A.verify(A.bearer(event)); if (!tok) return B.J(401, { error: "Sign in first" });
  if (tooMany("u:" + tok.uid, 60)) return B.J(429, { error: "Slow down" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  const act = String(b.action || "");
  // A company login is always pinned to its own company. Only the platform owner may name another.
  let orgId = tok.orgId;
  if (tok.platform) { orgId = b.org_id ? String(b.org_id) : null; if (orgId && !UUID.test(orgId)) return B.J(400, { error: "Bad company" }); }
  try {
    if (act === "plans") { const p = await V.plans(); return B.J(200, { plans: p.map(function (x) { return { tier: x.tier, label: x.label, os_label: x.os_label, price_cents: x.price_cents, price_is_minimum: x.price_is_minimum, included_minutes: x.included_minutes, overage_enabled: x.overage_enabled, overage_cents_per_min: x.overage_cents_per_min, max_concurrent_calls: x.max_concurrent_calls, max_call_minutes: x.max_call_minutes, entitlements: x.entitlements, active: x.active }; }) }); }
    if (act === "status") {
      if (!orgId) return B.J(400, { error: "Pick a company" });
      const s = await V.standing(orgId); if (!s.ok) return B.J(404, { error: s.error });
      return B.J(200, { company: s.org, tier: s.tier, status: s.status, active: s.active, reason: s.reason, comped: s.comped, price_cents: s.price_cents, plan: s.plan, entitlements: s.entitlements, usage: s.usage, window: s.window, needs_stripe_sync: s.needs_stripe_sync, cancel_at_period_end: s.cancel_at_period_end, can_buy: A.can(tok, "owner") });
    }
    if (act === "checkout" || act === "portal" || act === "sync") {
      if (!A.can(tok, "owner")) return B.J(403, { error: "Only the company owner can manage billing" });
      if (!orgId) return B.J(400, { error: "Pick a company" });
      const r = act === "checkout" ? await V.checkout(orgId, tok.uid) : act === "portal" ? await V.portal(orgId) : await V.syncStripe(orgId, tok.uid);
      return B.J(r.status, r);
    }
    // ── platform owner only ──
    if (/^o_/.test(act)) {
      if (!A.can(tok, "platform")) return B.J(403, { error: "POTENT owner only" });
      if (act === "o_overview") return B.J(200, { companies: await V.overview(), plans: await V.plans() });
      if (act === "o_plan_set") { const r = await V.setPlan(String(b.tier || ""), b.patch || {}, tok.uid); return B.J(r.status, r); }
      if (act === "o_org_set") { if (!orgId) return B.J(400, { error: "Pick a company" }); const r = await V.setOrg(orgId, b.patch || {}, tok.uid); return B.J(r.status, r); }
      if (act === "o_audit") { const r = await B.sb("voice_audit_logs?select=*&order=created_at.desc&limit=100"); return B.J(200, { logs: r.ok && Array.isArray(r.data) ? r.data : [] }); }
    }
    return B.J(400, { error: "Unknown action" });
  } catch (e) {
    console.error("voice-billing", e && e.message);
    return B.J(500, { error: "Something went wrong. Nothing was charged by this call." });
  }
};
