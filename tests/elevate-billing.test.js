// Run: node tests/elevate-billing.test.js  (no network; fake Stripe + fake OpenAI). Əlevate AI: $50/month plan, 120 voice minutes, credit packs, metering.
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.GOOGLE_CLIENT_ID = "cid.apps.googleusercontent.com";
process.env.OPENAI_API_KEY = "sk-test"; process.env.ELEVATE_OWNER_EMAILS = "boss@gmail.com"; process.env.STRIPE_SECRET_KEY = "sk_test_x"; process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const make = require("./_mock.js");
const T = { elevate_items: [], elevate_accounts: [], elevate_usage: [], elevate_credits: [] };
make(T, { unique: { elevate_accounts: (x, r) => x.owner_key === r.owner_key, elevate_usage: (x, r) => x.ref === r.ref, elevate_credits: (x, r) => x.ref === r.ref }, defaults: { elevate_credits: { status: "paid" }, elevate_usage: { seconds: 0, from_included: 0, from_credit: 0 }, elevate_items: { done: false } } });
// fake Stripe
const CALLS = [], SUBS = {};
const fake = { checkout: { sessions: { create: async a => { CALLS.push(a); return { id: "cs_" + CALLS.length, url: "https://checkout.stripe.test/" + CALLS.length }; } } },
  subscriptions: { retrieve: async id => SUBS[id] }, webhooks: { constructEvent: (body, sig) => { if (sig !== "good") throw new Error("bad sig"); return JSON.parse(body); } } };
const Module = require("module"), orig = Module._load; Module._load = function (r) { if (r === "stripe") return function () { return fake; }; return orig.apply(this, arguments); };
const dbFetch = global.fetch; let gtok = {}, rt = [];
global.fetch = async (u, o) => { u = String(u);
  if (u.startsWith("https://oauth2.googleapis.com/tokeninfo")) { const d = gtok[decodeURIComponent(u.split("id_token=")[1]).split(".").pop()]; return d ? { ok: true, json: async () => d } : { ok: false, json: async () => ({}) }; }
  if (u.includes("/v1/realtime/client_secrets")) { rt.push(JSON.parse(o.body)); return { ok: true, json: async () => ({ value: "ek_test" }) }; }
  if (u.includes("api.mailjet.com")) return { ok: true, json: async () => ({}) };
  return dbFetch(u, o); };
const E = require("../netlify/functions/lib/elevate.js"), B = require("../netlify/functions/lib/elevate-billing.js"), api = require("../netlify/functions/elevate-api.js"), W = require("../netlify/functions/stripe-webhook.js"), P = require("../netlify/functions/lib/elevate-phone.js");
const call = (tok, body, ip) => api.handler({ httpMethod: "POST", headers: Object.assign({ "x-nf-client-connection-ip": ip || "1.1.1.1" }, tok ? { authorization: "Bearer " + tok } : {}), body: JSON.stringify(body) }).then(r => [r.statusCode, JSON.parse(r.body)]);
const GOOD = { aud: "cid.apps.googleusercontent.com", iss: "accounts.google.com", exp: String(Math.floor(Date.now() / 1000) + 600), email_verified: "true", sub: "1" };
const gt = (name, email) => { gtok[name] = Object.assign({}, GOOD, { email: email }); return "h." + "x".repeat(110) + "." + name; };
let evn = 0; const hook = async (type, obj) => { const r = await W.handler({ httpMethod: "POST", headers: { "stripe-signature": "good" }, body: JSON.stringify({ id: "evt_" + (++evn), type: type, data: { object: obj } }) }); return [r.statusCode, JSON.parse(r.body)]; };
const T0 = Date.parse("2026-10-20T12:00:00Z"), MIN = 60;
(async () => {
  // ── who counts as paid / free / owner ──
  let st = await B.standing("new@x.com", T0); ok(!st.can_use && !st.can_sign_in && !st.comped, "a stranger has no minutes and cannot sign in");
  st = await B.standing("boss@gmail.com", T0); ok(st.comped && st.can_use && st.total_left_s === null, "owner is never blocked");
  ok(B.PRICE_CENTS === 5000 && B.INCLUDED_S === 7200 && Object.keys(B.PACKS).every(c => B.PACKS[c] / 60 * 25 === Number(c)), "$50 plan, 120 minutes, every pack is $0.25 a minute");
  // ── sign in / subscribe through Google (email is proven by Google) ──
  let [s, r] = await call(null, { action: "google", credential: gt("a", "new@x.com") }); ok(s === 403 && /Subscribe/.test(r.error), "unlisted person is told how to subscribe, gets no token");
  [s, r] = await call(null, { action: "google", credential: gt("b", "new@x.com"), intent: "sub" }, "2.2.2.2"); ok(s === 200 && r.url === "https://checkout.stripe.test/1" && !r.token, "subscribe returns a checkout link, not a login");
  let c = CALLS[0]; ok(c.mode === "subscription" && c.line_items[0].price_data.unit_amount === 5000 && c.line_items[0].price_data.recurring.interval === "month", "plan is $50 every month");
  ok(c.metadata.product === "ELEVATE" && c.metadata.owner_key === "new@x.com" && c.subscription_data.metadata.kind === "elevate" && c.customer_email === "new@x.com", "checkout is tied to the proven email");
  [s, r] = await call(null, { action: "google", credential: gt("c", "new@x.com"), intent: "pack:2500" }, "3.3.3.3"); c = CALLS[1]; ok(s === 200 && c.mode === "payment" && c.line_items[0].price_data.unit_amount === 2500 && /100 minutes/.test(c.line_items[0].price_data.product_data.name), "$25 pack = 100 minutes");
  [s, r] = await call(null, { action: "google", credential: gt("d", "new@x.com"), intent: "pack:999" }, "4.4.4.4"); ok(s === 400, "unknown pack refused");
  // ── webhook: subscription starts ──
  const ps = Math.floor(Date.parse("2026-10-20T00:00:00Z") / 1000), pe = ps + 30 * 86400;
  SUBS.sub_1 = { id: "sub_1", customer: "cus_1", status: "active", metadata: { kind: "elevate", owner_key: "new@x.com" }, current_period_start: ps, current_period_end: pe };
  [s, r] = await hook("checkout.session.completed", { id: "cs_1", mode: "subscription", status: "complete", subscription: "sub_1", payment_status: "paid", metadata: { product: "ELEVATE", what: "sub", owner_key: "new@x.com" } }); ok(s === 200 && r.elevate, "webhook activates the plan");
  [s, r] = await hook("checkout.session.completed", { id: "cs_1", mode: "subscription", status: "complete", subscription: "sub_1", payment_status: "paid", metadata: { product: "ELEVATE", what: "sub", owner_key: "new@x.com" } }); ok(s === 200 && T.elevate_accounts.length === 1, "a repeated webhook does not duplicate the account");
  st = await B.standing("new@x.com", T0); ok(st.subscribed && st.can_sign_in && st.included_left_s === 7200 && st.credits_left_s === 0, "subscriber has 120 minutes");
  [s, r] = await call(null, { action: "google", credential: gt("e", "new@x.com") }, "5.5.5.5"); ok(s === 200 && r.token, "subscriber can now sign in");
  const tok = E.mint("new@x.com");
  // ── metering ──
  let v = await B.start("new@x.com", "voice", T0); ok(v.ok && v.max_seconds === 900, "a call can run at most 15 minutes");
  let v2 = await B.start("new@x.com", "voice", T0 + 1000); ok(!v2.ok && v2.status === 409, "only one voice session at a time");
  let e = await B.end("new@x.com", v.ref, T0 + 300 * 1000); ok(e.ok && e.seconds === 300, "5 minutes on the clock = 300 seconds charged");
  e = await B.end("new@x.com", v.ref, T0 + 999 * 1000); ok(e.already && e.seconds === 300, "ending twice charges once");
  st = await B.standing("new@x.com", T0 + 301000); ok(st.included_left_s === 7200 - 300, "included minutes go down");
  v = await B.start("new@x.com", "voice", T0 + 400 * 1000); await B.ping("new@x.com", v.ref, T0 + 520 * 1000);
  st = await B.standing("new@x.com", T0 + 400 * 1000 + 10 * 60000); ok(st.included_left_s === 7200 - 300 - 180, "a vanished page is charged up to its last ping plus a minute: " + st.included_left_s);
  // ── running out, credits ──
  T.elevate_usage.push({ id: "u1", owner_key: "new@x.com", kind: "voice", ref: "bulk", state: "closed", started_at: new Date(T0 + 1e6).toISOString(), seconds: 6600, from_included: 6600, from_credit: 0 });
  st = await B.standing("new@x.com", T0 + 2e6); ok(st.included_left_s === 7200 - 300 - 180 - 6600 && st.included_left_s === 120, "120 seconds left");
  v = await B.start("new@x.com", "voice", T0 + 2e6); ok(v.ok && v.max_seconds === 120, "a session can't be longer than the minutes left");
  await B.end("new@x.com", v.ref, T0 + 2e6 + 120 * 1000); st = await B.standing("new@x.com", T0 + 2.5e6); ok(st.included_left_s === 0 && !st.can_use, "all included minutes used");
  let [s2, r2] = await call(tok, { action: "voice_session" }); ok(s2 === 402 && /Add credits/.test(r2.error), "out of minutes: voice refused with a clear message (nothing opened)");
  ok(T.elevate_usage.filter(u => u.state === "open").length === 0, "refused start leaves no open session");
  // buy a pack through the webhook
  const pack = { id: "cs_p1", mode: "payment", payment_status: "paid", amount_total: 2500, payment_intent: "pi_1", metadata: { product: "ELEVATE", what: "pack", owner_key: "new@x.com", cents: "2500" } };
  [s, r] = await hook("checkout.session.completed", pack); ok(s === 200 && T.elevate_credits.length === 1 && T.elevate_credits[0].seconds === 6000, "a $25 pack adds 100 minutes");
  [s, r] = await hook("checkout.session.completed", pack); ok(T.elevate_credits.length === 1, "the same payment is never credited twice");
  await hook("checkout.session.completed", Object.assign({}, pack, { id: "cs_p2", amount_total: 2400, metadata: Object.assign({}, pack.metadata, { cents: "2500" }) })); ok(T.elevate_credits.length === 1, "an amount that does not match a pack adds nothing");
  await hook("checkout.session.completed", Object.assign({}, pack, { id: "cs_p3", payment_status: "unpaid" })); ok(T.elevate_credits.length === 1, "unpaid session adds nothing");
  st = await B.standing("new@x.com", T0 + 3e6); ok(st.credits_left_s === 6000 && st.can_use, "100 credit minutes available");
  v = await B.start("new@x.com", "voice", T0 + 3e6); await B.end("new@x.com", v.ref, T0 + 3e6 + 600 * 1000); st = await B.standing("new@x.com", T0 + 4e6); ok(st.credits_left_s === 5400 && st.included_left_s === 0, "10 minutes of a call came out of credits");
  // credits expire after 12 months
  st = await B.standing("new@x.com", T0 + 400 * 86400e3); ok(st.credits_left_s === 0, "credits are gone after 12 months");
  // refunds and disputes
  [s, r] = await hook("charge.refunded", { id: "ch_1", payment_intent: "pi_1", amount: 2500, amount_refunded: 2500 }); ok(T.elevate_credits[0].status === "refunded", "refund takes the credits back");
  [s, r] = await hook("charge.dispute.closed", { id: "dp_1", payment_intent: "pi_1", status: "won" }); ok(T.elevate_credits[0].status === "refunded", "a won dispute does not revive a refunded pack");
  T.elevate_credits[0].status = "paid"; await hook("charge.dispute.created", { id: "dp_2", payment_intent: "pi_1" }); ok(T.elevate_credits[0].status === "disputed", "dispute freezes the credits");
  await hook("charge.dispute.closed", { id: "dp_2", payment_intent: "pi_1", status: "won" }); ok(T.elevate_credits[0].status === "paid", "winning the dispute restores them");
  // renewal, failure, cancel
  const ps2 = pe, pe2 = ps2 + 30 * 86400; SUBS.sub_1 = Object.assign({}, SUBS.sub_1, { current_period_start: ps2, current_period_end: pe2 });
  [s, r] = await hook("invoice.paid", { id: "in_2", subscription: "sub_1", amount_paid: 5000, billing_reason: "subscription_cycle" }); ok(s === 200 && r.elevate, "renewal invoice recognised");
  st = await B.standing("new@x.com", (ps2 + 100) * 1000); ok(st.subscribed && st.included_left_s === 7200, "a new month brings 120 fresh minutes");
  SUBS.sub_1 = Object.assign({}, SUBS.sub_1, { status: "past_due" }); await hook("invoice.payment_failed", { id: "in_3", subscription: "sub_1", amount_due: 5000 }); ok(T.elevate_accounts[0].sub_status === "past_due", "failed payment is recorded");
  await hook("customer.subscription.deleted", { id: "sub_1", customer: "cus_1", status: "canceled", metadata: { kind: "elevate", owner_key: "new@x.com" } }); st = await B.standing("new@x.com", (ps2 + 200) * 1000);
  ok(!st.subscribed && st.included_left_s === 0 && T.elevate_accounts[0].mode === "free", "cancelled plan stops the monthly minutes");
  ok(st.credits_left_s > 0, "bought credits survive a cancelled plan");
  // ── owner, comped, grants ──
  [s, r] = await call(tok, { action: "o_credit_grant", email: "friend@x.com", minutes: 10 }); ok(s === 403, "only the owner can grant minutes");
  const boss = E.mint("boss@gmail.com");
  [s, r] = await call(boss, { action: "o_credit_grant", email: "friend@x.com", minutes: 10 }); ok(s === 200, "owner grants 10 minutes");
  st = await B.standing("friend@x.com", Date.now()); ok(st.credits_left_s === 600 && st.can_sign_in, "a grant lets that person in and use voice");
  [s, r] = await call(boss, { action: "o_credit_grant", email: "friend@x.com", minutes: 9999 }); ok(s === 400, "grant size is limited");
  [s, r] = await call(boss, { action: "o_account_set", email: "partner@x.com", mode: "comped" }); st = await B.standing("partner@x.com", Date.now()); ok(s === 200 && st.comped && st.can_use, "owner can comp a person");
  v = await B.start("partner@x.com", "voice", T0); await B.end("partner@x.com", v.ref, T0 + 120000); ok(T.elevate_usage.find(u => u.ref === v.ref).seconds === 120 && T.elevate_usage.find(u => u.ref === v.ref).from_credit === 0, "comped calls are logged but cost no minutes");
  await hook("customer.subscription.updated", { id: "sub_9", customer: "cus_9", status: "active", metadata: { kind: "elevate", owner_key: "partner@x.com" }, current_period_start: ps, current_period_end: pe }); ok(T.elevate_accounts.find(a => a.owner_key === "partner@x.com").mode === "comped", "a Stripe event never downgrades a comped account");
  // ── API: billing view, ping/end, gating of chat ──
  [s, r] = await call(boss, { action: "billing" }); ok(r.unlimited && r.plan.price_cents === 5000 && r.packs.length === 3 && r.packs[1].minutes === 100, "billing view shows plan and packs");
  [s, r] = await call(E.mint("nobody@x.com"), { action: "chat", messages: [{ role: "user", content: "hi" }] }); ok(s === 402, "someone with no plan and no credits cannot use the assistant");
  [s, r] = await call(boss, { action: "voice_session" }); ok(s === 200 && r.ref && r.max_minutes === 15 && rt.length === 1, "owner voice session starts with a 15 minute cap and a session ref");
  [s, r2] = await call(boss, { action: "voice_ping", ref: r.ref }); ok(r2.ok, "ping accepted");
  [s, r2] = await call(boss, { action: "voice_end", ref: r.ref }); ok(s === 200 && r2.ok, "end accepted");
  [s, r2] = await call(E.mint("friend@x.com"), { action: "voice_end", ref: r.ref }); ok(s === 404, "nobody can end someone else's session");
  // ── phone line is logged, once ──
  await B.recordPhone("boss@gmail.com", "elv-xyz", 95, T0); await B.recordPhone("boss@gmail.com", "elv-xyz", 95, T0); ok(T.elevate_usage.filter(u => u.ref === "elv-xyz").length === 1 && T.elevate_usage.find(u => u.ref === "elv-xyz").seconds === 95 && T.elevate_usage.find(u => u.ref === "elv-xyz").kind === "phone", "phone call logged once");
  [s, r] = await call(null, { action: "billing" }); ok(s === 401, "billing needs a login");
  [s, r] = await call(null, { action: "buy", what: "sub" }); ok(s === 401, "buying from inside needs a login");
  [s, r] = await call(null, { action: "o_credit_grant", email: "a@b.co", minutes: 5 }); ok(s === 401, "owner actions need a login");
  const v3 = await B.start("friend@x.com", "voice", Date.now()); [s, r] = await call(null, { action: "voice_end", ref: v3.ref, token: E.mint("friend@x.com") }); ok(s === 200 && r.ok, "the page's last-gasp beacon can end a session with the token in its body");
  [s, r] = await call(null, { action: "voice_end", ref: "x", token: "junk" }); ok(s === 401, "a junk token in the body is refused");
  console.log("elevate billing: " + n + " assertions PASS"); process.exit(0);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
