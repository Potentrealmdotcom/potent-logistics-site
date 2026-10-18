// Run: node tests/voicebilling.test.js  (POTENT VOICE tiers: OS plan -> voice tier, checkout, webhook activation, entitlements, usage, overage, owner edits)
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.STRIPE_SECRET_KEY = "sk_test_x"; process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
const assert = require("assert"), crypto = require("crypto"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const PLANS = [["starter", 19900, false, 300, 50, 2, 15, { recording: false, outbound: false, inbound: true }], ["growth", 49900, false, 1000, 45, 5, 20, { recording: true, outbound: false, inbound: true }], ["fleet", 99900, false, 3000, 40, 15, 30, { recording: true, outbound: true, campaigns: true, inbound: true }], ["enterprise", 199900, true, 10000, 35, 50, 60, { recording: true, outbound: true, priority_support: true, inbound: true }]]
  .map(p => ({ tier: p[0], label: "POTENT VOICE " + p[0], os_label: "x", price_cents: p[1], price_is_minimum: p[2], included_minutes: p[3], overage_enabled: true, overage_cents_per_min: p[4], overage_cap_minutes: null, max_concurrent_calls: p[5], max_call_minutes: p[6], entitlements: p[7], active: true, stripe_product_id: null, version: 1 }));
const OA = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa", OB = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb", OC = "cccccccc-3333-4333-8333-cccccccccccc";
const T = { organizations: [{ id: OA, name: "Alpha Freight", slug: "alpha", plan: "starter", owner_email: "a@x.com", license_status: "paid" }, { id: OB, name: "Bravo Haul", slug: "bravo", plan: "growth", owner_email: "b@x.com", license_status: "paid" }, { id: OC, name: "Cee Unpaid", slug: "cee", plan: "fleet", owner_email: "c@x.com", license_status: "unpaid" }],
  voice_plans: PLANS, voice_subscriptions: [], voice_usage_records: [], voice_billing_events: [], voice_audit_logs: [] };
function cmp(r, p) { const i = p.indexOf("="), k = p.slice(0, i), v = decodeURIComponent(p.slice(i + 1)); if (["select", "order", "limit"].includes(k)) return true; let m;
  if ((m = v.match(/^eq\.(.*)$/))) return String(r[k]) === m[1]; if ((m = v.match(/^gte\.(.*)$/))) return String(r[k]) >= m[1]; if ((m = v.match(/^lt\.(.*)$/))) return String(r[k]) < m[1]; return true; }
const filt = (rows, q) => rows.filter(r => q.split("&").filter(Boolean).every(p => cmp(r, p)));
const PK = { voice_plans: "tier", voice_subscriptions: "org_id", voice_billing_events: "event_key" };
global.fetch = async (u, o) => { o = o || {}; u = String(u); const m = o.method || "GET", t = (u.match(/rest\/v1\/([a-z_]+)/) || [])[1], q = u.split("?")[1] || "", pref = (o.headers && o.headers.Prefer) || ""; const R = (d, s) => ({ ok: (s || 200) < 300, status: s || 200, text: async () => JSON.stringify(d) });
  if (!T[t]) return R([]);
  if (m === "GET") return R(filt(T[t], q).map(r => Object.assign({}, r)));
  if (m === "POST") { const out = []; for (const r0 of [].concat(JSON.parse(o.body))) { const pk = PK[t]; if (pk && T[t].some(x => x[pk] === r0[pk])) { if (/ignore/.test(pref)) continue; return R({}, 409); } if (t === "voice_usage_records" && T[t].some(x => x.org_id === r0.org_id && x.session_id === r0.session_id)) { if (/ignore/.test(pref)) continue; return R({}, 409); } const row = Object.assign({ created_at: new Date().toISOString() }, r0); T[t].push(row); out.push(row); } return R(out); }
  if (m === "PATCH") { const hit = filt(T[t], q); hit.forEach(r => Object.assign(r, JSON.parse(o.body))); return R(hit); }
  if (m === "DELETE") { filt(T[t], q).forEach(r => T[t].splice(T[t].indexOf(r), 1)); return R([]); }
  return R([]); };
// fake Stripe
const CALLS = []; let subN = 0;
const subObj = (id, org, tier, status) => ({ id: id, customer: "cus_" + org.slice(0, 4), status: status || "active", cancel_at_period_end: false, metadata: { kind: "voice", org_id: org, tier: tier }, items: { data: [{ id: "si_" + id, current_period_start: 1760000000, current_period_end: 1762592000 }] } });
const SUBS = {};
const fake = { products: { create: async (a) => { CALLS.push(["product", a]); return { id: "prod_" + a.metadata.tier }; } },
  checkout: { sessions: { create: async (a) => { CALLS.push(["checkout", a]); return { id: "cs_" + (++subN), url: "https://checkout.stripe.test/" + subN }; } } },
  billingPortal: { sessions: { create: async (a) => ({ url: "https://portal.test" }) } },
  subscriptions: { retrieve: async (id) => SUBS[id], update: async (id, a) => { CALLS.push(["subupdate", id, a]); return Object.assign({}, SUBS[id], { metadata: a.metadata }); } },
  invoiceItems: { create: async (a, o) => { CALLS.push(["invitem", a, o]); return { id: "ii_1" }; } },
  webhooks: { constructEvent: (body, sig) => { if (sig !== "good") throw new Error("bad sig"); return JSON.parse(body); } } };
const Module = require("module"), origLoad = Module._load; Module._load = function (r) { if (r === "stripe") return function () { return fake; }; return origLoad.apply(this, arguments); };
const V = require("../netlify/functions/lib/voice/billing.js"); V.setStripe(fake);
const H = require("../netlify/functions/voice-billing.js"), W = require("../netlify/functions/stripe-webhook.js");
const b64u = b => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sign = p => { const body = b64u(JSON.stringify(Object.assign({ exp: Date.now() + 36e5 }, p))); return body + "." + b64u(crypto.createHmac("sha256", "t").update(body).digest()); };
const OWNERA = sign({ uid: "org-a1", role: "owner", orgId: OA }), DISPA = sign({ uid: "org-a2", role: "dispatch", orgId: OA }), OWNERB = sign({ uid: "org-b1", role: "owner", orgId: OB }), OWNERC = sign({ uid: "org-c1", role: "owner", orgId: OC }), PLAT = sign({ uid: "potent", role: "owner", orgId: null }), CUST = sign({ uid: "cust:x", role: "customer", orgId: OA });
let ipn = 0; const call = async (tok, b) => { const r = await H.handler({ httpMethod: "POST", headers: { authorization: tok ? "Bearer " + tok : "" }, body: JSON.stringify(b) }); return { s: r.statusCode, j: JSON.parse(r.body) }; };
const hook = async (type, obj) => { const r = await W.handler({ httpMethod: "POST", headers: { "stripe-signature": "good" }, body: JSON.stringify({ id: "evt_" + (++ipn), type: type, data: { object: obj } }) }); return { s: r.statusCode, j: JSON.parse(r.body) }; };
const row = org => T.voice_subscriptions.find(s => s.org_id === org);
(async () => {
  // ── tiers and prices as specified ──
  let r = await call(OWNERA, { action: "plans" });
  ok(r.s === 200 && r.j.plans.map(p => p.price_cents).join() === "19900,49900,99900,199900", "four tiers at $199 / $499 / $999 / $1,999");
  ok(r.j.plans.find(p => p.tier === "enterprise").price_is_minimum && !r.j.plans.find(p => p.tier === "fleet").price_is_minimum, "only Enterprise is 'or more'");
  ok((await call(null, { action: "plans" })).s === 401 && (await call(CUST, { action: "plans" })).s === 401, "signed-out and customer logins refused");
  // ── automatic association with the OS plan ──
  r = await call(OWNERA, { action: "status" }); ok(r.j.tier === "starter" && r.j.price_cents === 19900 && !r.j.active && r.j.status === "none", "Starter company -> Starter tier, not active yet");
  ok(Object.keys(r.j.entitlements).length === 0, "no entitlements before it is paid for");
  r = await call(OWNERB, { action: "status" }); ok(r.j.tier === "growth" && r.j.price_cents === 49900, "Growth company -> Growth tier");
  ok((await call(OWNERC, { action: "status" })).j.tier === "fleet", "Fleet company -> Fleet tier");
  T.organizations.push({ id: "dddddddd-4444-4444-8444-dddddddddddd", name: "Dee", slug: "dee", plan: "mystery", license_status: "paid" });
  ok((await V.standing("dddddddd-4444-4444-8444-dddddddddddd")).tier === null && /no matching/i.test((await V.standing("dddddddd-4444-4444-8444-dddddddddddd")).reason), "unknown OS plan gets no tier, never a guess");
  // ── nobody gets in without a paid subscription ──
  let a = await V.admit(OA); ok(!a.ok && a.code === "not_subscribed", "calls refused before subscribing");
  ok(!(await V.allow(OA, "inbound")).allowed, "no feature before subscribing");
  // ── checkout ──
  r = await call(OWNERC, { action: "checkout" }); ok(r.s === 402 && !CALLS.some(c => c[0] === "checkout"), "unpaid OS license cannot buy the add-on, Stripe untouched");
  r = await call(DISPA, { action: "checkout" }); ok(r.s === 403, "dispatcher cannot start billing");
  r = await call(OWNERA, { action: "checkout", org_id: OB }); const co = CALLS.filter(c => c[0] === "checkout").pop();
  ok(r.s === 200 && r.j.price_cents === 19900 && co[1].mode === "subscription" && co[1].line_items[0].price_data.unit_amount === 19900 && co[1].line_items[0].price_data.recurring.interval === "month", "Starter checkout = $199/month subscription");
  ok(co[1].metadata.org_id === OA && co[1].subscription_data.metadata.kind === "voice", "company login is pinned to its own company (org_id in request ignored)");
  ok(row(OA).status === "pending" && !(await V.standing(OA)).active, "pending is NOT active");
  a = await V.admit(OA); ok(!a.ok, "still no calls while pending");
  // ── webhook: unpaid, then paid ──
  SUBS.sub_A = subObj("sub_A", OA, "starter");
  r = await hook("checkout.session.completed", { id: "cs_u", payment_status: "unpaid", subscription: "sub_A", metadata: { product: "POTENTVOICE", org_id: OA, tier: "starter" } });
  ok(r.s === 200 && row(OA).status === "pending", "unpaid checkout does not activate");
  r = await W.handler({ httpMethod: "POST", headers: { "stripe-signature": "bad" }, body: "{}" }); ok(r.statusCode === 400, "bad Stripe signature refused");
  r = await hook("checkout.session.completed", { id: "cs_p", payment_status: "paid", subscription: "sub_A", customer: "cus_aaaa", metadata: { product: "POTENTVOICE", org_id: OA, tier: "starter" } });
  ok(r.s === 200 && r.j.voice && row(OA).status === "active" && row(OA).stripe_subscription_id === "sub_A" && row(OA).tier_at_signup === "starter" && row(OA).price_cents_at_signup === 19900, "paid checkout activates Starter");
  ok(row(OA).current_period_end && row(OA).stripe_item_id === "si_sub_A", "billing period and item come from Stripe");
  await hook("checkout.session.completed", { id: "cs_p", payment_status: "paid", subscription: "sub_A", metadata: { product: "POTENTVOICE", org_id: OA, tier: "starter" } });
  ok(T.voice_billing_events.filter(e => e.event_key === "co:cs_p").length === 1, "webhook replay handled once");
  // ── entitlements enforced ──
  let s = await V.standing(OA); ok(s.active && s.entitlements.inbound && !s.entitlements.recording && !s.entitlements.outbound, "Starter: inbound yes, recording/outbound no");
  ok((await V.allow(OA, "inbound")).allowed && !(await V.allow(OA, "recording")).allowed && /does not include recording/.test((await V.allow(OA, "recording")).reason), "allow() blocks features outside the tier");
  a = await V.admit(OA, { outbound: true }); ok(!a.ok && a.code === "no_outbound", "Starter cannot place outbound calls");
  a = await V.admit(OA, { activeCalls: 2 }); ok(!a.ok && a.code === "busy", "Starter limited to 2 concurrent calls");
  a = await V.admit(OA, { activeCalls: 1 }); ok(a.ok && a.max_call_seconds === 900, "1 live call: next call admitted, 15-minute cap");
  // ── usage ──
  await V.recordUsage(OA, "CA1", 61); await V.recordUsage(OA, "CA2", 30); await V.recordUsage(OA, "CA1", 61); await V.recordUsage(OA, "CA0", 0);
  s = await V.standing(OA); ok(s.usage.used === 3 && s.usage.remaining === 297, "61s = 2 min, 30s = 1 min, duplicate ignored, 0s free: used " + s.usage.used);
  ok(s.usage.overage.minutes === 0, "no overage under the included minutes");
  await V.recordUsage(OA, "BIG", 60 * 297 + 1);        // 3 + 298 = 301 -> 1 over
  s = await V.standing(OA); ok(s.usage.used === 301 && s.usage.overage.minutes === 1 && s.usage.overage.cents === 50, "1 minute over x $0.50");
  a = await V.admit(OA); ok(a.ok && a.overage, "overage allowed (flagged) when enabled and uncapped");
  await V.setOrg(OA, {}, "x").catch(() => {}); r = await call(PLAT, { action: "o_org_set", org_id: OA, patch: { overage_cap_minutes_override: 1 } }); ok(r.s === 200, "owner sets a company overage cap");
  a = await V.admit(OA); ok(!a.ok && a.code === "overage_cap", "overage cap stops new calls at included + cap");
  r = await call(PLAT, { action: "o_plan_set", tier: "starter", patch: { overage_enabled: false } }); a = await V.admit(OA); ok(!a.ok && a.code === "minutes_used", "overage switched off -> stops at included minutes");
  await call(PLAT, { action: "o_plan_set", tier: "starter", patch: { overage_enabled: true } }); await call(PLAT, { action: "o_org_set", org_id: OA, patch: { overage_cap_minutes_override: null } });
  // ── usage in other periods does not count ──
  T.voice_usage_records.push({ org_id: OA, session_id: "OLD", started_at: "2025-01-01T00:00:00Z", billable_minutes: 500, seconds: 30000 });
  ok((await V.standing(OA)).usage.used === 301, "calls outside the billing period are not counted");
  // ── invoice failed / paid ──
  SUBS.sub_A = subObj("sub_A", OA, "starter");
  r = await hook("invoice.payment_failed", { id: "in_f1", subscription: "sub_A", amount_due: 19900, billing_reason: "subscription_cycle" });
  ok(r.s === 200 && row(OA).status === "past_due", "failed payment -> past due");
  a = await V.admit(OA); ok(!a.ok && /past due/i.test(a.reason), "past due blocks new calls");
  r = await hook("invoice.paid", { id: "in_p1", subscription: "sub_A", amount_paid: 19900, billing_reason: "subscription_cycle" });
  ok(row(OA).status === "active" && (await V.admit(OA)).ok, "payment received -> active again");
  r = await hook("invoice.paid", { id: "in_p1", subscription: "sub_A", amount_paid: 19900, billing_reason: "subscription_cycle" }); ok(T.voice_billing_events.filter(e => e.event_key === "inv:in_p1:paid").length === 1, "invoice replay handled once");
  // ── overage onto the next invoice ──
  const start = Date.parse("2026-09-01T00:00:00Z") / 1000, end = Date.parse("2026-10-01T00:00:00Z") / 1000;
  T.voice_usage_records.push({ org_id: OA, session_id: "SEP1", started_at: "2026-09-10T00:00:00Z", billable_minutes: 320, seconds: 1 });
  CALLS.length = 0; r = await hook("invoice.created", { id: "in_c1", subscription: "sub_A", customer: "cus_aaaa", billing_reason: "subscription_cycle", status: "draft", period_start: start, period_end: end });
  const ii = CALLS.find(c => c[0] === "invitem"); ok(ii && ii[1].amount === 20 * 50 && ii[1].invoice === "in_c1" && ii[2].idempotencyKey === "voice-ovg-in_c1", "320 min on a 300 plan = 20 over x 50c = $10.00 added to the draft invoice");
  CALLS.length = 0; await hook("invoice.created", { id: "in_c1", subscription: "sub_A", customer: "cus_aaaa", billing_reason: "subscription_cycle", status: "draft", period_start: start, period_end: end }); ok(!CALLS.some(c => c[0] === "invitem"), "overage never billed twice");
  await hook("invoice.created", { id: "in_c2", subscription: "sub_A", customer: "cus_aaaa", billing_reason: "subscription_create", status: "draft", period_start: start, period_end: end }); ok(!CALLS.some(c => c[0] === "invitem"), "first invoice carries no overage");
  // ── OS plan upgrade: tier follows automatically, Stripe price moves on sync ──
  T.organizations[0].plan = "growth";
  s = await V.standing(OA); ok(s.tier === "growth" && s.price_cents === 49900 && s.entitlements.recording === true && s.needs_stripe_sync, "OS upgrade -> Growth tier and features at once; Stripe flagged out of date");
  ok(T.voice_audit_logs.some(l => l.action === "tier_follow_os_plan"), "tier change audited");
  r = await call(DISPA, { action: "sync" }); ok(r.s === 403, "only the owner can move the Stripe price");
  CALLS.length = 0; r = await call(OWNERA, { action: "sync" }); const up = CALLS.find(c => c[0] === "subupdate");
  ok(r.s === 200 && up[2].items[0].price_data.unit_amount === 49900 && up[2].proration_behavior === "create_prorations" && !(await V.standing(OA)).needs_stripe_sync && row(OA).tier_at_signup === "growth", "sync moves the subscription to $499, prorated");
  // ── Fleet / Enterprise features, Enterprise custom price ──
  T.organizations[0].plan = "fleet"; ok((await V.admit(OA, { outbound: true })).ok && (await V.allow(OA, "campaigns")).allowed, "Fleet gets outbound and campaigns");
  T.organizations[0].plan = "enterprise"; s = await V.standing(OA); ok(s.price_cents === 199900 && s.entitlements.priority_support, "Enterprise $1,999 with priority support");
  r = await call(PLAT, { action: "o_org_set", org_id: OA, patch: { custom_price_cents: 150000 } }); ok(r.s === 400, "Enterprise price below $1,999 refused");
  r = await call(PLAT, { action: "o_org_set", org_id: OA, patch: { custom_price_cents: 349900 } }); ok(r.s === 200 && (await V.standing(OA)).price_cents === 349900, "Enterprise custom price $3,499 honoured");
  r = await call(PLAT, { action: "o_org_set", org_id: OB, patch: { custom_price_cents: 90000 } }); ok(r.s === 400 && (await V.standing(OB)).price_cents === 49900, "custom price only for Enterprise");
  T.organizations[0].plan = "starter"; await V.setOrg(OA, { custom_price_cents: null }, "x");
  // ── owner controls ──
  ok((await call(OWNERA, { action: "o_plan_set", tier: "starter", patch: { price_cents: 1 } })).s === 403 && (await call(OWNERA, { action: "o_overview" })).s === 403, "company owners cannot edit tiers or see other companies");
  r = await call(PLAT, { action: "o_plan_set", tier: "growth", patch: { price_cents: 54900, included_minutes: 1200, overage_cents_per_min: 40, entitlements: { outbound: true } } });
  ok(r.s === 200 && r.j.plan.price_cents === 54900 && r.j.plan.included_minutes === 1200 && r.j.plan.entitlements.outbound === true && r.j.plan.entitlements.recording === true && r.j.plan.version === 2, "owner edits price, minutes, overage and features; version bumps");
  ok((await call(PLAT, { action: "o_plan_set", tier: "growth", patch: { entitlements: { teleport: true } } })).s === 400 && (await call(PLAT, { action: "o_plan_set", tier: "growth", patch: { price_cents: -5 } })).s === 400 && (await call(PLAT, { action: "o_plan_set", tier: "growth", patch: { price_cents: 12.5 } })).s === 400 && (await call(PLAT, { action: "o_plan_set", tier: "zzz", patch: { price_cents: 5 } })).s === 400 && (await call(PLAT, { action: "o_plan_set", tier: "growth", patch: { tier: "x" } })).s === 400, "unknown feature, negative/fractional price, bad tier, protected fields all refused");
  ok(T.voice_audit_logs.some(l => l.action === "plan_changed" && l.actor === "potent"), "plan change audited with who did it");
  r = await call(PLAT, { action: "o_overview" }); ok(r.s === 200 && r.j.companies.length >= 3 && r.j.companies.find(c => c.slug === "bravo").tier === "growth", "owner sees every company's tier");
  // ── internal (no-charge) company ──
  r = await call(PLAT, { action: "o_org_set", org_id: OB, patch: { comped: true } }); s = await V.standing(OB);
  ok(r.s === 200 && s.active && s.comped && s.status === "internal" && s.entitlements.recording, "owner can mark a company internal; it is labelled, never shown as paid");
  r = await call(OWNERB, { action: "checkout" }); ok(r.s === 409, "internal company cannot be sent to checkout");
  r = await call(PLAT, { action: "o_org_set", org_id: OA, patch: { comped: true } }); ok(r.s === 409, "cannot mark internal over a paid Stripe subscription");
  // ── cancel ──
  SUBS.sub_A = Object.assign(subObj("sub_A", OA, "starter", "canceled"), {});
  r = await hook("customer.subscription.deleted", SUBS.sub_A); ok(row(OA).status === "cancelled" && !(await V.admit(OA)).ok, "cancelled subscription stops calls");
  console.log("PASS: " + n + " assertions");
})().catch(e => { console.error(e); process.exit(1); });
