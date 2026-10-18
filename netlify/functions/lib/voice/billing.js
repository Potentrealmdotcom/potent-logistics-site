// POTENT VOICE billing: a separate, optional monthly add-on to each one-time POTENT OS license.
// The voice tier is derived from the company's OS plan (starter/growth/fleet/enterprise); entitlements come from voice_plans
// (owner-editable) and are enforced here, on the server. Nothing is "active" until Stripe says so (webhook) or the owner marks a company internal.
const B = require("../beats");
const rows = function (r) { return r.ok && Array.isArray(r.data) ? r.data : []; };
const TIERS = ["starter", "growth", "fleet", "enterprise"];
const SITE = function () { return process.env.URL || B.SITE; };
let _stripe = null;
function stripe() { return _stripe || (_stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)); }
function setStripe(s) { _stripe = s; }

async function audit(org, actor, action, target, before, after) { try { await B.sb("voice_audit_logs", { method: "POST", prefer: "return=minimal", body: { org_id: org || null, actor: String(actor || "system").slice(0, 80), action: action, target: target || null, before: before || null, after: after || null } }); } catch (e) { /* never block */ } }

// OS plan -> voice tier. Unknown plans get no tier (never a silent guess).
function tierForPlan(plan) { const p = String(plan || "").toLowerCase(); return TIERS.indexOf(p) >= 0 ? p : null; }
async function getOrg(orgId) { return rows(await B.sb("organizations?id=eq." + encodeURIComponent(orgId) + "&select=id,name,slug,plan,owner_email,owner_name,license_status,stripe_customer_id&limit=1"))[0] || null; }
async function plans() { return rows(await B.sb("voice_plans?select=*&order=price_cents.asc")); }
async function planOf(tier) { return rows(await B.sb("voice_plans?tier=eq." + encodeURIComponent(tier) + "&select=*&limit=1"))[0] || null; }

// Keep the company's voice record in step with its OS plan. Creates it on first look; follows plan changes automatically.
async function associate(org) {
  const tier = tierForPlan(org.plan);
  let sub = rows(await B.sb("voice_subscriptions?org_id=eq." + org.id + "&select=*&limit=1"))[0];
  if (!sub) {
    const c = await B.sb("voice_subscriptions", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: { org_id: org.id, tier: tier, os_plan: org.plan || null, status: "none" } });
    sub = rows(c)[0] || rows(await B.sb("voice_subscriptions?org_id=eq." + org.id + "&select=*&limit=1"))[0];
    await audit(org.id, "system", "associate", tier || "none", null, { os_plan: org.plan, tier: tier });
  } else if (sub.tier !== tier || sub.os_plan !== (org.plan || null)) {
    const before = { tier: sub.tier, os_plan: sub.os_plan };
    await B.sb("voice_subscriptions?org_id=eq." + org.id, { method: "PATCH", prefer: "return=minimal", body: { tier: tier, os_plan: org.plan || null, updated_at: new Date().toISOString() } });
    await audit(org.id, "system", "tier_follow_os_plan", tier || "none", before, { tier: tier, os_plan: org.plan });
    sub = Object.assign({}, sub, { tier: tier, os_plan: org.plan || null });
  }
  return sub;
}
// Enterprise is "$1,999 or more": an owner-set custom price is honoured only if it is at or above the plan price. Other tiers use the plan price.
function priceFor(plan, sub) {
  const c = sub && sub.custom_price_cents;
  return plan.price_is_minimum && c != null && Number(c) >= plan.price_cents ? Number(c) : plan.price_cents;
}
function windowOf(sub, now) {
  const n = new Date(now || Date.now());
  if (sub && sub.current_period_start && sub.current_period_end && new Date(sub.current_period_end) > n) return { from: sub.current_period_start, to: sub.current_period_end, source: "billing_period" };
  const s = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)), e = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1));
  return { from: s.toISOString(), to: e.toISOString(), source: "calendar_month" };
}
async function usedMinutes(orgId, win) {
  const r = rows(await B.sb("voice_usage_records?org_id=eq." + orgId + "&started_at=gte." + encodeURIComponent(win.from) + "&started_at=lt." + encodeURIComponent(win.to) + "&select=billable_minutes,started_at&limit=100000"));
  return r.filter(function (x) { return String(x.started_at) >= win.from && String(x.started_at) < win.to; }).reduce(function (a, x) { return a + Number(x.billable_minutes || 0); }, 0);
}
function overage(plan, used, included) {
  const over = Math.max(0, used - included);
  return { minutes: over, cents: plan.overage_enabled ? over * plan.overage_cents_per_min : 0 };
}

// Everything the rest of the app needs to know about one company's voice access.
async function standing(orgId, now) {
  const org = await getOrg(orgId); if (!org) return { ok: false, error: "Company not found" };
  const sub = await associate(org), plan = sub.tier ? await planOf(sub.tier) : null;
  const win = windowOf(sub, now), used = plan ? await usedMinutes(org.id, win) : 0;
  const live = (sub.status === "active" || sub.status === "internal") && !!plan && plan.active;
  const reason = !plan ? "Your POTENT OS plan has no matching POTENT VOICE tier." : !plan.active ? "This POTENT VOICE tier is switched off." : sub.status === "past_due" ? "Your POTENT VOICE payment is past due." : sub.status === "cancelled" ? "POTENT VOICE was cancelled." : sub.status === "pending" ? "Waiting for Stripe to confirm your POTENT VOICE payment." : !live ? "POTENT VOICE is not subscribed." : "";
  const price = plan ? priceFor(plan, sub) : null;
  return { ok: true, org: { id: org.id, name: org.name, slug: org.slug, plan: org.plan, license_status: org.license_status }, tier: sub.tier, status: sub.status, active: live, reason: reason, comped: sub.status === "internal",
    plan: plan, price_cents: price, entitlements: live ? (plan.entitlements || {}) : {}, window: win, usage: plan ? { used: used, included: plan.included_minutes, remaining: Math.max(0, plan.included_minutes - used), overage: overage(plan, used, plan.included_minutes) } : null,
    needs_stripe_sync: !!(sub.stripe_subscription_id && sub.status === "active" && plan && (sub.tier_at_signup !== sub.tier || Number(sub.price_cents_at_signup) !== price)), cancel_at_period_end: !!sub.cancel_at_period_end, sub: sub };
}
async function allow(orgId, feature) { const s = await standing(orgId); return { allowed: !!(s.ok && s.active && s.entitlements[feature] === true), reason: s.ok ? (s.active ? (s.entitlements[feature] === true ? "" : "Your POTENT VOICE " + s.tier + " plan does not include " + feature.replace(/_/g, " ") + ".") : s.reason) : s.error, tier: s.tier }; }

// May a new call start? activeCalls = calls already in progress for this company (counted by the caller from voice_sessions).
async function admit(orgId, o) {
  o = o || {}; const s = await standing(orgId, o.now);
  if (!s.ok) return { ok: false, code: "no_company", reason: s.error };
  if (!s.active) return { ok: false, code: "not_subscribed", reason: s.reason };
  if (o.outbound && s.entitlements.outbound !== true) return { ok: false, code: "no_outbound", reason: "Outbound calling is not part of the " + s.tier + " tier." };
  if (!o.outbound && s.entitlements.inbound !== true) return { ok: false, code: "no_inbound", reason: "Inbound calling is not included." };
  if (Number(o.activeCalls || 0) >= s.plan.max_concurrent_calls) return { ok: false, code: "busy", reason: "All " + s.plan.max_concurrent_calls + " call lines for the " + s.tier + " tier are in use." };
  const u = s.usage, cap = s.sub.overage_cap_minutes_override != null ? s.sub.overage_cap_minutes_override : s.plan.overage_cap_minutes;
  if (u.used >= u.included) {
    if (!s.plan.overage_enabled) return { ok: false, code: "minutes_used", reason: "The " + u.included + " included minutes are used and overage is off." };
    if (cap != null && u.used >= u.included + cap) return { ok: false, code: "overage_cap", reason: "The overage limit of " + cap + " minutes is reached." };
  }
  return { ok: true, tier: s.tier, max_call_seconds: s.plan.max_call_minutes * 60, overage: u.used >= u.included };
}
// One row per call, rounded up to whole minutes. Safe to send twice.
async function recordUsage(orgId, sessionId, seconds, kind, startedAt) {
  const sec = Math.max(0, Math.floor(Number(seconds) || 0)), mins = sec > 0 ? Math.ceil(sec / 60) : 0;
  const r = await B.sb("voice_usage_records", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { org_id: orgId, session_id: String(sessionId).slice(0, 80), kind: kind === "outbound" ? "outbound" : "call", started_at: startedAt || new Date().toISOString(), seconds: sec, billable_minutes: mins } });
  return { ok: r.ok, minutes: mins };
}

// ── Stripe ──
async function product(plan) {
  if (plan.stripe_product_id) return plan.stripe_product_id;
  const p = await stripe().products.create({ name: plan.label, metadata: { kind: "voice", tier: plan.tier } }, { idempotencyKey: "voice-prod-" + plan.tier });
  await B.sb("voice_plans?tier=eq." + plan.tier, { method: "PATCH", prefer: "return=minimal", body: { stripe_product_id: p.id } });
  return p.id;
}
async function checkout(orgId, actor) {
  const s = await standing(orgId); if (!s.ok) return { status: 404, error: s.error };
  if (!s.plan) return { status: 409, error: s.reason };
  if (!require("../billing").isPaid(await getOrg(orgId))) return { status: 402, error: "POTENT VOICE is an add-on to a paid POTENT OS license. Finish your license payment first." };
  if (s.status === "active" || s.status === "internal") return { status: 409, error: "POTENT VOICE is already on for this company." };
  const price = s.price_cents, st = stripe(), org = await getOrg(orgId), prod = await product(s.plan);
  const sess = await st.checkout.sessions.create({ mode: "subscription", customer: s.sub.stripe_customer_id || org.stripe_customer_id || undefined, customer_email: (s.sub.stripe_customer_id || org.stripe_customer_id) ? undefined : (org.owner_email || undefined),
    line_items: [{ quantity: 1, price_data: { currency: "usd", product: prod, unit_amount: price, recurring: { interval: "month" } } }],
    metadata: { product: "POTENTVOICE", org_id: orgId, tier: s.tier }, subscription_data: { metadata: { kind: "voice", org_id: orgId, tier: s.tier } },
    success_url: SITE() + "/voice/?billing=returned", cancel_url: SITE() + "/voice/?billing=cancelled" });
  await B.sb("voice_subscriptions?org_id=eq." + orgId, { method: "PATCH", prefer: "return=minimal", body: { status: s.status === "none" || s.status === "cancelled" ? "pending" : s.status, updated_at: new Date().toISOString() } });
  await audit(orgId, actor, "checkout_started", s.tier, null, { price_cents: price });
  return { status: 200, url: sess.url, price_cents: price, tier: s.tier };
}
async function portal(orgId) {
  const sub = rows(await B.sb("voice_subscriptions?org_id=eq." + orgId + "&select=stripe_customer_id&limit=1"))[0];
  if (!sub || !sub.stripe_customer_id) return { status: 404, error: "No Stripe billing record yet." };
  const p = await stripe().billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: SITE() + "/voice/" });
  return { status: 200, url: p.url };
}
async function once(key, type, org, detail) { const r = await B.sb("voice_billing_events", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: { event_key: key, type: type, org_id: org || null, detail: detail || null } }); return r.ok && rows(r).length === 1; }
async function applySub(orgId, sub, status, extra) {
  const patch = Object.assign({ status: status, stripe_subscription_id: sub.id, stripe_customer_id: sub.customer || null, cancel_at_period_end: !!sub.cancel_at_period_end, updated_at: new Date().toISOString() }, extra || {});
  const it = sub.items && sub.items.data && sub.items.data[0];
  if (it) { patch.stripe_item_id = it.id; const ps = it.current_period_start || sub.current_period_start, pe = it.current_period_end || sub.current_period_end; if (ps) patch.current_period_start = new Date(ps * 1000).toISOString(); if (pe) patch.current_period_end = new Date(pe * 1000).toISOString(); }
  const r = await B.sb("voice_subscriptions?org_id=eq." + orgId, { method: "PATCH", prefer: "return=minimal", body: patch });
  return r.ok;
}
const orgFromMeta = function (md) { return md && /^[0-9a-f-]{36}$/i.test(String(md.org_id || "")) ? String(md.org_id) : null; };

async function onCheckout(session) {
  const md = (session && session.metadata) || {}; if (md.product !== "POTENTVOICE") return { skipped: true };
  const orgId = orgFromMeta(md); if (!orgId) return { bad: true };
  if (session.payment_status !== "paid" || !session.subscription) return { unpaid: true };       // never activate on an unpaid session
  if (!(await once("co:" + session.id, "checkout", orgId, { tier: md.tier }))) return { duplicate: true };
  const org = await getOrg(orgId); if (!org) return { bad: true };
  const sub = await stripe().subscriptions.retrieve(session.subscription, { expand: ["items.data"] });
  const cur = await associate(org), plan = cur.tier ? await planOf(cur.tier) : null;
  const ok = await applySub(orgId, sub, "active", { tier_at_signup: cur.tier, price_cents_at_signup: plan ? priceFor(plan, cur) : null });
  if (!ok) { await B.sb("voice_billing_events?event_key=eq." + encodeURIComponent("co:" + session.id), { method: "DELETE", prefer: "return=minimal" }); return { error: "save" }; }
  await audit(orgId, "stripe", "subscription_active", cur.tier, null, { subscription: sub.id });
  return { ok: true, org_id: orgId };
}
async function onInvoice(inv, paid, sub) {
  const orgId = orgFromMeta(sub && sub.metadata); if (!orgId) return { bad: true };
  if (!(await once("inv:" + inv.id + ":" + (paid ? "paid" : "failed"), "invoice", orgId, { amount: paid ? inv.amount_paid : inv.amount_due }))) return { duplicate: true };
  if (paid && !(inv.amount_paid > 0)) return { ok: true, ignored: "zero" };
  const cur = rows(await B.sb("voice_subscriptions?org_id=eq." + orgId + "&select=status&limit=1"))[0];
  if (cur && cur.status === "internal") return { ok: true, ignored: "internal" };
  const ok = await applySub(orgId, sub, paid ? "active" : "past_due");
  await audit(orgId, "stripe", paid ? "invoice_paid" : "invoice_failed", inv.id, null, { amount: paid ? inv.amount_paid : inv.amount_due });
  return ok ? { ok: true } : { error: "save" };
}
// Close of a billing period: add the overage minutes of the period that just ended onto the new draft invoice. Once per invoice.
async function onInvoiceCreated(inv, sub) {
  const orgId = orgFromMeta(sub && sub.metadata); if (!orgId) return { bad: true };
  if (inv.billing_reason !== "subscription_cycle" || inv.status !== "draft") return { skipped: true };
  const row = rows(await B.sb("voice_subscriptions?org_id=eq." + orgId + "&select=tier,status&limit=1"))[0]; if (!row || !row.tier) return { skipped: true };
  const plan = await planOf(row.tier); if (!plan || !plan.overage_enabled) return { ok: true, cents: 0 };
  const win = { from: new Date(inv.period_start * 1000).toISOString(), to: new Date(inv.period_end * 1000).toISOString() };
  const o = overage(plan, await usedMinutes(orgId, win), plan.included_minutes);
  if (o.cents <= 0) return { ok: true, cents: 0 };
  if (!(await once("ovg:" + inv.id, "overage", orgId, o))) return { duplicate: true };
  try {
    await stripe().invoiceItems.create({ customer: inv.customer, invoice: inv.id, amount: o.cents, currency: "usd", description: "POTENT VOICE overage: " + o.minutes + " min x $" + (plan.overage_cents_per_min / 100).toFixed(2), metadata: { kind: "voice_overage", org_id: orgId } }, { idempotencyKey: "voice-ovg-" + inv.id });
  } catch (e) { await B.sb("voice_billing_events?event_key=eq." + encodeURIComponent("ovg:" + inv.id), { method: "DELETE", prefer: "return=minimal" }); return { error: "stripe" }; }
  await audit(orgId, "stripe", "overage_billed", inv.id, null, o);
  return { ok: true, cents: o.cents, minutes: o.minutes };
}
async function onSubscription(sub, deleted) {
  const orgId = orgFromMeta(sub && sub.metadata); if (!orgId || (sub.metadata || {}).kind !== "voice") return { skipped: true };
  const cur = rows(await B.sb("voice_subscriptions?org_id=eq." + orgId + "&select=status&limit=1"))[0]; if (cur && cur.status === "internal") return { ok: true, ignored: "internal" };
  const map = { active: "active", trialing: "active", past_due: "past_due", unpaid: "past_due", canceled: "cancelled", incomplete_expired: "cancelled", incomplete: "pending", paused: "past_due" };
  const st = deleted ? "cancelled" : map[sub.status]; if (!st) return { skipped: true };
  return (await applySub(orgId, sub, st)) ? { ok: true, status: st } : { error: "save" };
}
// Move an active subscription to the company's current tier/price (after an OS plan change or an owner price change). Prorated by Stripe.
async function syncStripe(orgId, actor) {
  const s = await standing(orgId); if (!s.ok) return { status: 404, error: s.error };
  if (!s.sub.stripe_subscription_id || !s.sub.stripe_item_id) return { status: 409, error: "No Stripe subscription to update." };
  if (s.status !== "active") return { status: 409, error: "Only an active subscription can be changed." };
  if (!s.plan) return { status: 409, error: s.reason };
  const prod = await product(s.plan), price = s.price_cents;
  const u = await stripe().subscriptions.update(s.sub.stripe_subscription_id, { items: [{ id: s.sub.stripe_item_id, price_data: { currency: "usd", product: prod, unit_amount: price, recurring: { interval: "month" } } }], proration_behavior: "create_prorations", metadata: { kind: "voice", org_id: orgId, tier: s.tier } });
  await applySub(orgId, u, "active", { tier_at_signup: s.tier, price_cents_at_signup: price });
  await audit(orgId, actor, "stripe_synced", s.tier, { tier: s.sub.tier_at_signup, price_cents: s.sub.price_cents_at_signup }, { tier: s.tier, price_cents: price });
  return { status: 200, tier: s.tier, price_cents: price };
}
const PLAN_FIELDS = { price_cents: "int", included_minutes: "int", overage_cents_per_min: "int", max_concurrent_calls: "int1", max_call_minutes: "int1", overage_enabled: "bool", active: "bool", price_is_minimum: "bool", overage_cap_minutes: "intnull", label: "str" };
const FEATURES = ["inbound", "quotes", "booking", "handoff", "callbacks", "notifications", "transcripts", "recording", "analytics_export", "custom_knowledge", "multi_vehicle", "outbound", "campaigns", "contractors", "api_access", "priority_support"];
// Owner-only edit of one tier. Changes apply to new sign-ups and to usage rules at once; existing Stripe prices change only when synced.
async function setPlan(tier, patch, actor) {
  if (TIERS.indexOf(tier) < 0) return { status: 400, error: "Unknown tier" };
  const before = await planOf(tier); if (!before) return { status: 404, error: "Tier not found" };
  const out = {};
  for (const k of Object.keys(patch || {})) {
    const t = PLAN_FIELDS[k], v = patch[k];
    if (k === "entitlements") { if (!v || typeof v !== "object") return { status: 400, error: "Bad entitlements" }; const e = Object.assign({}, before.entitlements); for (const f of Object.keys(v)) { if (FEATURES.indexOf(f) < 0) return { status: 400, error: "Unknown feature " + f }; e[f] = v[f] === true; } out.entitlements = e; continue; }
    if (!t) return { status: 400, error: "Cannot change " + k };
    if (t === "bool") { if (typeof v !== "boolean") return { status: 400, error: k + " must be true or false" }; out[k] = v; }
    else if (t === "str") { out[k] = String(v).trim().slice(0, 80); if (!out[k]) return { status: 400, error: "Name required" }; }
    else if (t === "intnull" && (v === null || v === "")) out[k] = null;
    else { const n = Number(v); if (!Number.isInteger(n) || n < (t === "int1" ? 1 : 0) || n > 100000000) return { status: 400, error: k + " must be a whole number" }; out[k] = n; }
  }
  if (!Object.keys(out).length) return { status: 400, error: "Nothing to change" };
  out.version = before.version + 1; out.updated_by = String(actor || "owner").slice(0, 80); out.updated_at = new Date().toISOString();
  const r = await B.sb("voice_plans?tier=eq." + tier, { method: "PATCH", prefer: "return=representation", body: out });
  if (!r.ok) return { status: 500, error: "Could not save" };
  await audit(null, actor, "plan_changed", tier, before, rows(r)[0] || out);
  return { status: 200, plan: rows(r)[0] || Object.assign({}, before, out) };
}
// Owner marks a company as internal (no charge, e.g. POTENT's own company) or sets an enterprise custom price / overage cap.
async function setOrg(orgId, patch, actor) {
  const org = await getOrg(orgId); if (!org) return { status: 404, error: "Company not found" };
  const cur = await associate(org), out = {};
  if (patch.comped !== undefined) { if (typeof patch.comped !== "boolean") return { status: 400, error: "comped must be true or false" }; if (patch.comped && !cur.tier) return { status: 409, error: "No matching tier" }; out.status = patch.comped ? "internal" : (cur.stripe_subscription_id ? "none" : "none"); }
  if (patch.custom_price_cents !== undefined) { const v = patch.custom_price_cents; if (v === null) out.custom_price_cents = null; else { const n = Number(v); if (!Number.isInteger(n) || n < 0 || n > 100000000) return { status: 400, error: "Bad price" }; if (cur.tier !== "enterprise") return { status: 400, error: "Custom price is for Enterprise only" }; const pl = await planOf("enterprise"); if (n < pl.price_cents) return { status: 400, error: "Enterprise starts at $" + (pl.price_cents / 100).toLocaleString("en-US") }; out.custom_price_cents = n; } }
  if (patch.overage_cap_minutes_override !== undefined) { const v = patch.overage_cap_minutes_override; if (v === null) out.overage_cap_minutes_override = null; else { const n = Number(v); if (!Number.isInteger(n) || n < 0) return { status: 400, error: "Bad cap" }; out.overage_cap_minutes_override = n; } }
  if (!Object.keys(out).length) return { status: 400, error: "Nothing to change" };
  if (out.status === "internal" && cur.stripe_subscription_id && cur.status === "active") return { status: 409, error: "This company has a paid Stripe subscription. Cancel it first." };
  out.updated_at = new Date().toISOString();
  await B.sb("voice_subscriptions?org_id=eq." + orgId, { method: "PATCH", prefer: "return=minimal", body: out });
  await audit(orgId, actor, "company_changed", org.slug, cur, out);
  return { status: 200 };
}
async function overview() {
  const orgs = rows(await B.sb("organizations?select=id,name,slug,plan,license_status&order=created_at.asc&limit=500")), out = [];
  for (const o of orgs) { const s = await standing(o.id); out.push({ org_id: o.id, name: o.name, slug: o.slug, os_plan: o.plan, license_status: o.license_status, tier: s.tier, status: s.status, active: s.active, price_cents: s.price_cents, used: s.usage && s.usage.used, included: s.usage && s.usage.included, overage_cents: s.usage && s.usage.overage.cents, needs_stripe_sync: s.needs_stripe_sync }); }
  return out;
}
module.exports = { TIERS, FEATURES, tierForPlan, plans, planOf, associate, priceFor, windowOf, usedMinutes, overage, standing, allow, admit, recordUsage, checkout, portal, onCheckout, onInvoice, onInvoiceCreated, onSubscription, syncStripe, setPlan, setOrg, overview, audit, setStripe, getOrg };
