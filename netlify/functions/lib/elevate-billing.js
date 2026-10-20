// lib/elevate-billing.js — Əlevate AI: $50/month (120 voice minutes) + prepaid voice credits ($0.25/minute packs).
// Minutes are counted on the SERVER (the browser talks to OpenAI directly, so the server times each session itself:
// it opens a session row when it mints the voice key, the page pings every minute, and the row is closed when the
// page says it is done or, if the page vanished, from the last ping). Text chat is not metered (it costs almost nothing).
// The owner's own accounts (ELEVATE_OWNER_EMAILS and the POTENT OS owner) and any account the owner marks "comped" are never blocked, but still logged.
const E = require("./elevate");
const rows = function (r) { return r && r.ok && Array.isArray(r.data) ? r.data : []; };
const q = E.q, iso = function (ms) { return new Date(ms).toISOString(); };
const PRICE_CENTS = 5000, INCLUDED_S = 7200, MAX_CALL_S = 900, STALE_MS = 150000, CREDIT_MONTHS = 12, GRACE_MS = 3 * 86400e3;
const PACKS = { 1000: 2400, 2500: 6000, 5000: 12000 };           // cents -> seconds: always $0.25 a minute
let _stripe = null; const stripe = function () { return _stripe || (_stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)); };
const SITE = function () { return process.env.URL || "https://potentoperations.netlify.app"; };
const lower = function (s) { return String(s || "").trim().toLowerCase(); };
const isOwner = function (k) { k = lower(k); return E.owners().indexOf(k) >= 0 || k === "potent-owner"; };
const monthStart = function (now) { const d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
const sum = function (a, f) { return a.reduce(function (t, x) { return t + (Number(f(x)) || 0); }, 0); };

async function account(k) { return rows(await E.sb("elevate_accounts?owner_key=eq." + q(lower(k)) + "&limit=1"))[0] || null; }
function subscribed(acc, now) {
  if (!acc || acc.mode !== "paid" || ["active", "trialing", "past_due"].indexOf(acc.sub_status) < 0) return false;
  return !acc.period_end || Date.parse(acc.period_end) + GRACE_MS > (now || Date.now());
}
async function creditsOf(k) { return rows(await E.sb("elevate_credits?owner_key=eq." + q(lower(k)) + "&limit=500")); }
async function usageOf(k) { return rows(await E.sb("elevate_usage?owner_key=eq." + q(lower(k)) + "&limit=5000")); }

// What this person has left. No side effects.
async function balances(k, now) {
  now = now || Date.now(); k = lower(k);
  const acc = await account(k), comped = isOwner(k) || !!(acc && acc.mode === "comped"), sub = !comped && subscribed(acc, now);
  const usage = await usageOf(k), credits = await creditsOf(k);
  const ps = sub && acc.period_start ? Date.parse(acc.period_start) : monthStart(now);
  const usedInc = sum(usage.filter(function (u) { return u.state === "closed" && Date.parse(u.started_at) >= ps; }), function (u) { return u.from_included; });
  const incLeft = sub ? Math.max(0, INCLUDED_S - usedInc) : 0;
  const total = sum(credits.filter(function (c) { return c.status === "paid" && Date.parse(c.expires_at) > now; }), function (c) { return c.seconds; });
  const credLeft = Math.max(0, total - sum(usage, function (u) { return u.from_credit; }));
  return { acc: acc, comped: comped, subscribed: sub, inc_left: incLeft, cred_left: credLeft, usage: usage, credits: credits, period_end: sub ? acc.period_end : null };
}
async function close(k, row, seconds, now) {
  const b = await balances(k, now), s = Math.max(0, Math.min(Math.floor(seconds), MAX_CALL_S));
  const fromInc = b.comped ? 0 : Math.min(b.inc_left, s), fromCred = b.comped ? 0 : s - fromInc;
  const up = await E.sb("elevate_usage?id=eq." + row.id + "&state=eq.open", { method: "PATCH", body: { state: "closed", ended_at: iso(now || Date.now()), seconds: s, from_included: fromInc, from_credit: fromCred } });
  return rows(up).length ? { closed: true, seconds: s } : { closed: false };
}
async function settleStale(k, now) {
  now = now || Date.now();
  for (const r of (await usageOf(k)).filter(function (u) { return u.state === "open"; })) {
    const seen = Date.parse(r.last_seen || r.started_at);
    if (now - seen > STALE_MS) await close(k, r, (seen - Date.parse(r.started_at)) / 1000 + 60, now);
  }
}
async function standing(k, now) {
  now = now || Date.now(); k = lower(k); await settleStale(k, now);
  const b = await balances(k, now), left = b.inc_left + b.cred_left;
  return { owner: k, comped: b.comped, subscribed: b.subscribed, sub_status: b.acc && b.acc.sub_status || null, period_end: b.period_end,
    included_minutes: INCLUDED_S / 60, included_left_s: b.inc_left, credits_left_s: b.cred_left, total_left_s: b.comped ? null : left,
    can_use: b.comped || left > 0, can_sign_in: b.comped || b.subscribed || b.cred_left > 0 };
}
async function canSignIn(email) { return (await standing(email)).can_sign_in; }

// Voice session: reserve before the key is minted.
async function start(k, kind, now) {
  now = now || Date.now(); k = lower(k); const st = await standing(k, now);
  if (!st.can_use) return { ok: false, status: 402, error: st.subscribed ? "You have used this month's voice minutes. Add credits in Settings." : "Voice needs minutes. Subscribe or add credits in Settings." };
  if ((await usageOf(k)).some(function (u) { return u.state === "open"; })) return { ok: false, status: 409, error: "Voice is already running (maybe on another device). End it there first." };
  const ref = "v-" + require("crypto").randomBytes(9).toString("hex");
  const ins = await E.sb("elevate_usage", { method: "POST", body: { owner_key: k, kind: kind || "voice", ref: ref, state: "open", started_at: iso(now), last_seen: iso(now) } });
  if (!ins.ok) return { ok: false, status: 500, error: "Could not start voice. Try again." };
  return { ok: true, ref: ref, max_seconds: st.comped ? MAX_CALL_S : Math.min(MAX_CALL_S, st.total_left_s) };
}
async function ping(k, ref, now) {
  const r = await E.sb("elevate_usage?ref=eq." + q(String(ref)) + "&owner_key=eq." + q(lower(k)) + "&state=eq.open", { method: "PATCH", body: { last_seen: iso(now || Date.now()) } });
  return { ok: rows(r).length > 0 };
}
async function end(k, ref, now) {
  now = now || Date.now(); const row = rows(await E.sb("elevate_usage?ref=eq." + q(String(ref)) + "&owner_key=eq." + q(lower(k)) + "&limit=1"))[0];
  if (!row) return { ok: false, status: 404, error: "No such session." };
  if (row.state === "closed") return { ok: true, seconds: row.seconds, already: true };
  const r = await close(k, row, (now - Date.parse(row.started_at)) / 1000, now);
  return { ok: true, seconds: r.seconds || 0 };
}
// Phone calls are timed by the audio bridge; the owner's line is comped but still logged.
async function recordPhone(k, ref, seconds, now) {
  now = now || Date.now(); k = lower(k);
  const ins = await E.sb("elevate_usage", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: { owner_key: k, kind: "phone", ref: String(ref), state: "open", started_at: iso(now - seconds * 1000), last_seen: iso(now) } });
  const row = rows(ins)[0]; if (!row) return { ok: true, duplicate: true };
  return Object.assign({ ok: true }, await close(k, row, seconds, now));
}

async function addCredit(k, seconds, ref, source, cents, pi, now) {
  now = now || Date.now(); const d = new Date(now); d.setUTCMonth(d.getUTCMonth() + CREDIT_MONTHS);
  const r = await E.sb("elevate_credits", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: { owner_key: lower(k), seconds: seconds, expires_at: d.toISOString(), ref: ref, source: source, cents: cents || null, payment_intent: pi || null } });
  return { ok: r.ok, added: rows(r).length > 0 };
}
async function setAccount(k, patch) {
  k = lower(k); const body = Object.assign({ owner_key: k, updated_at: iso(Date.now()) }, patch);
  const r = await E.sb("elevate_accounts?on_conflict=owner_key", { method: "POST", prefer: "resolution=merge-duplicates,return=representation", body: body });
  return { ok: r.ok };
}

// ── Stripe ──
async function checkout(email, what) {
  const k = lower(email), acc = await account(k), md = { product: "ELEVATE", owner_key: k };
  const cust = acc && acc.stripe_customer ? { customer: acc.stripe_customer } : { customer_email: k };
  const back = { success_url: SITE() + "/elevate/?billing=returned", cancel_url: SITE() + "/elevate/?billing=cancelled" };
  if (what === "sub") {
    if (subscribed(acc)) return { ok: false, status: 409, error: "You are already subscribed." };
    const s = await stripe().checkout.sessions.create(Object.assign({ mode: "subscription", line_items: [{ quantity: 1, price_data: { currency: "usd", product_data: { name: "Əlevate AI (120 voice minutes a month)" }, unit_amount: PRICE_CENTS, recurring: { interval: "month" } } }],
      metadata: Object.assign({ what: "sub" }, md), subscription_data: { metadata: { kind: "elevate", owner_key: k } } }, cust, back));
    return { ok: true, status: 200, url: s.url, price_cents: PRICE_CENTS };
  }
  const m = /^pack:(\d+)$/.exec(String(what)), cents = m ? Number(m[1]) : 0;
  if (!PACKS[cents]) return { ok: false, status: 400, error: "Pick one of the credit packs." };
  const s = await stripe().checkout.sessions.create(Object.assign({ mode: "payment", line_items: [{ quantity: 1, price_data: { currency: "usd", product_data: { name: "Əlevate voice credits (" + PACKS[cents] / 60 + " minutes)" }, unit_amount: cents } }],
    metadata: Object.assign({ what: "pack", cents: String(cents) }, md), payment_intent_data: { metadata: { kind: "elevate", owner_key: k } } }, cust.customer ? { customer: cust.customer } : { customer_email: k }, back));
  return { ok: true, status: 200, url: s.url, price_cents: cents, minutes: PACKS[cents] / 60 };
}
async function portal(k) {
  const acc = await account(k); if (!acc || !acc.stripe_customer) return { ok: false, status: 404, error: "No subscription to manage yet." };
  const p = await stripe().billingPortal.sessions.create({ customer: acc.stripe_customer, return_url: SITE() + "/elevate/" });
  return { ok: true, status: 200, url: p.url };
}
async function applySub(sub, deleted) {
  const md = (sub && sub.metadata) || {}, k = lower(md.owner_key); if (!k) return { skipped: true };
  const it = sub.items && sub.items.data && sub.items.data[0] || {}, ps = sub.current_period_start || it.current_period_start, pe = sub.current_period_end || it.current_period_end;
  const status = deleted ? "canceled" : String(sub.status || "");
  const patch = { mode: ["active", "trialing", "past_due"].indexOf(status) >= 0 ? "paid" : "free", sub_status: status, stripe_customer: typeof sub.customer === "string" ? sub.customer : null, stripe_sub: sub.id || null };
  if (ps) patch.period_start = iso(ps * 1000); if (pe) patch.period_end = iso(pe * 1000);
  const acc = await account(k); if (acc && acc.mode === "comped") delete patch.mode;     // never downgrade a comped account by accident
  const r = await setAccount(k, patch); return r.ok ? { ok: true } : { error: "Could not save the subscription" };
}
async function onCheckout(session) {
  const md = (session && session.metadata) || {}; if (md.product !== "ELEVATE") return { skipped: true };
  const k = lower(md.owner_key); if (!k) return { ok: true, bad: true };
  if (md.what === "sub") {
    if (session.status && session.status !== "complete") return { skipped: true };
    const subId = typeof session.subscription === "string" ? session.subscription : session.subscription && session.subscription.id;
    const sub = subId ? await stripe().subscriptions.retrieve(subId) : null; if (!sub) return { error: "no subscription" };
    if (!sub.metadata || !sub.metadata.owner_key) sub.metadata = Object.assign({}, sub.metadata, { owner_key: k });
    return applySub(sub, false);
  }
  if (md.what === "pack") {
    if (session.payment_status !== "paid") return { skipped: true, unpaid: true };
    const secs = PACKS[Number(session.amount_total)]; if (!secs || Number(md.cents) !== Number(session.amount_total)) return { ok: true, bad: true };
    const pi = typeof session.payment_intent === "string" ? session.payment_intent : null;
    const r = await addCredit(k, secs, "pack:" + session.id, "purchase", Number(session.amount_total), pi);
    return r.ok ? { ok: true } : { error: "Could not add credits" };
  }
  return { skipped: true };
}
async function onRefund(charge) {
  if (!charge || !charge.payment_intent || !(Number(charge.amount_refunded) >= Number(charge.amount) && Number(charge.amount) > 0)) return { skipped: true };
  const r = await E.sb("elevate_credits?payment_intent=eq." + q(charge.payment_intent) + "&status=eq.paid", { method: "PATCH", body: { status: "refunded" } });
  return { ok: r.ok, changed: rows(r).length };
}
async function onDispute(d, closed) {
  if (!d || !d.payment_intent) return { skipped: true };
  if (!closed) { const r = await E.sb("elevate_credits?payment_intent=eq." + q(d.payment_intent) + "&status=eq.paid", { method: "PATCH", body: { status: "disputed" } }); return { ok: r.ok }; }
  if (d.status !== "won") return { skipped: true };
  const r2 = await E.sb("elevate_credits?payment_intent=eq." + q(d.payment_intent) + "&status=eq.disputed", { method: "PATCH", body: { status: "paid" } }); return { ok: r2.ok };
}
module.exports = { PRICE_CENTS, INCLUDED_S, MAX_CALL_S, PACKS, CREDIT_MONTHS, isOwner, account, subscribed, standing, canSignIn, start, ping, end, recordPhone, addCredit, setAccount, checkout, portal, applySub, onCheckout, onRefund, onDispute, balances };
