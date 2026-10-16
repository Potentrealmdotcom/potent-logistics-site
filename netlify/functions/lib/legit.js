// Shared helpers for LEGIT: database, tokens, and the two things Stripe can tell us (identity result, payment).
// Used by legit-api and the shared stripe-webhook. Server-side only.
const crypto = require("crypto");
const SB = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
const SITE = "https://potentoperations.netlify.app";
const TTL = 30 * 24 * 3600 * 1000;
const PRICE_CENTS = 3999;

function J(status, obj) { return { statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(obj) }; }
async function sb(path, opts) {
  opts = opts || {};
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const h = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
  if (opts.prefer) h.Prefer = opts.prefer;
  const r = await fetch(SB + "/rest/v1/" + path, { method: opts.method || "GET", headers: h, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { d = t; }
  return { ok: r.ok, status: r.status, data: d };
}
function hashPw(pw) { const s = crypto.randomBytes(16).toString("hex"); return "scrypt$" + s + "$" + crypto.scryptSync(String(pw), s, 32).toString("hex"); }
function checkPw(stored, pw) {
  const p = String(stored || "").split("$"); if (p[0] !== "scrypt" || p.length !== 3) return false;
  const a = Buffer.from(crypto.scryptSync(String(pw), p[1], 32).toString("hex")), b = Buffer.from(p[2]);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function key() { return String(process.env.AUTH_SECRET || "") + "|legit"; }
function sign(uid) { const body = b64u(JSON.stringify({ uid: uid, exp: Date.now() + TTL })); return body + "." + b64u(crypto.createHmac("sha256", key()).update(body).digest()); }
function verify(token) {
  if (!process.env.AUTH_SECRET || !token || typeof token !== "string" || token.indexOf(".") < 0) return null;
  const p = token.split("."), exp = b64u(crypto.createHmac("sha256", key()).update(p[0]).digest());
  const a = Buffer.from(p[1] || ""), b = Buffer.from(exp);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const d = JSON.parse(Buffer.from(p[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); return d.exp >= Date.now() ? d : null; } catch (e) { return null; }
}
function bearer(event) { const h = event.headers || {}; return String(h.authorization || h.Authorization || "").replace(/^Bearer\s+/i, ""); }

// ── what the user is allowed to do right now (decided only here, on the server) ──
function accessOf(u) {
  if (!u) return "login";
  if (u.banned) return "banned";
  if (u.is_admin) return "ok";
  if (!u.identity_verified) return "verify";
  if (u.paid_lifetime_access) return "ok";
  if (u.trial_started_at && new Date(u.trial_started_at).getTime() + 24 * 3600 * 1000 > Date.now()) return "ok";
  return "paywall";
}
async function notify(userId, kind, body) { await sb("legit_notifications", { method: "POST", prefer: "return=minimal", body: { user_id: userId, kind: kind, body: body } }); }

// Stripe Identity says "verified": start the 24-hour trial (only once). Under-18 = removed.
async function applyIdentity(session) {
  const uid = session && session.metadata && session.metadata.legit_uid;
  if (!uid || !/^[0-9a-f-]{36}$/i.test(uid)) return { ok: false };
  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  let dob = null;
  try {
    const full = await stripe.identity.verificationSessions.retrieve(session.id, { expand: ["verified_outputs"] });
    dob = full.verified_outputs && full.verified_outputs.dob;
  } catch (e) { /* restricted key may not allow it; fall back to the age they declared */ }
  const now = new Date();
  if (dob && dob.year) {
    const age = now.getUTCFullYear() - dob.year - ((now.getUTCMonth() + 1 < dob.month || (now.getUTCMonth() + 1 === dob.month && now.getUTCDate() < dob.day)) ? 1 : 0);
    if (age < 18) { await sb("legit_users?id=eq." + uid, { method: "PATCH", prefer: "return=minimal", body: { banned: true, ban_source: "underage" } }); return { ok: true, underage: true }; }
  }
  const cur = await sb("legit_users?id=eq." + uid + "&select=identity_verified,trial_started_at");
  const u = cur.ok && cur.data && cur.data[0]; if (!u) return { ok: false };
  if (u.identity_verified) return { ok: true, already: true };
  await sb("legit_users?id=eq." + uid, { method: "PATCH", prefer: "return=minimal", body: { identity_verified: true, verified_at: now.toISOString(), trial_started_at: u.trial_started_at || now.toISOString(), stripe_verification_session_id: session.id } });
  await notify(uid, "welcome", "You're verified. Your 24-hour full-access trial has started.");
  return { ok: true };
}
// Payment done: unlock for life. Idempotent per Stripe session (unique key).
async function applyPayment(session) {
  const md = session.metadata || {};
  if (md.product !== "LEGIT" || !/^[0-9a-f-]{36}$/i.test(md.legit_uid || "") || session.payment_status !== "paid") return { ok: false };
  const ins = await sb("legit_payments", { method: "POST", prefer: "return=minimal", body: { user_id: md.legit_uid, stripe_session_id: session.id, amount_cents: session.amount_total } });
  if (!ins.ok && ins.status !== 409) return { ok: false, error: true };
  await sb("legit_users?id=eq." + md.legit_uid, { method: "PATCH", prefer: "return=minimal", body: { paid_lifetime_access: true, paid_at: new Date().toISOString() } });
  if (ins.ok) await notify(md.legit_uid, "paid", "Lifetime access unlocked. Thank you!");
  return { ok: true };
}
module.exports = { SB, SITE, PRICE_CENTS, J, sb, hashPw, checkPw, sign, verify, bearer, accessOf, notify, applyIdentity, applyPayment };
