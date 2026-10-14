// Shared helpers for Credit Changed My Life (CCML), sold through POTENT's own Stripe account and Supabase project.
// Used by ccml-checkout, ccml-verify, ccml-mail, ccml-ai, ccml-admin and the shared stripe-webhook.

const SB = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
const SITE = "https://potentoperations.netlify.app";

const PRODUCTS = {
  diy: { product: "CCML DIY", name: "Credit Changed My Life - DIY Course", amount: 7900 },
  dfy: { product: "CCML DFY", name: "Credit Changed My Life - Done-For-You", amount: 299900 }
};
const MAIL_PACKS = {
  m1: { qty: 1, amount: 2000, label: "1 certified letter" },
  m2: { qty: 5, amount: 9000, label: "5 certified letters" },
  m3: { qty: 10, amount: 17000, label: "10 certified letters" },
  m4: { qty: 25, amount: 40000, label: "25 certified letters" }
};
const RANK = { free: 0, diy: 1, dfy: 2 };

function J(status, obj) { return { statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(obj) }; }

async function sb(path, opts) {
  opts = opts || {};
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
  if (opts.prefer) headers.Prefer = opts.prefer;
  const r = await fetch(SB + "/rest/v1/" + path, { method: opts.method || "GET", headers: headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { d = t; }
  return { ok: r.ok, status: r.status, data: d };
}

// Who is calling? Ask Supabase Auth to validate the user's own login token. Returns { id, email } or null.
async function userFromEvent(event) {
  const h = (event && event.headers) || {};
  const auth = String(h.authorization || h.Authorization || "");
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    const r = await fetch(SB + "/auth/v1/user", { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + m[1] } });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? { id: u.id, email: String(u.email || "").toLowerCase() } : null;
  } catch (e) { return null; }
}

function safeEmail(e) {
  e = String(e || "").trim().toLowerCase();
  return /^[^\s,()*%_\\]+@[^\s,()*%_\\]+\.[^\s,()*%_\\]+$/.test(e) && e.length <= 200 ? e : "";
}

async function profileById(id) {
  const r = await sb("ccml_profiles?id=eq." + encodeURIComponent(id) + "&select=*");
  return r.ok && Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
}
async function profileByEmail(email) {
  const em = safeEmail(email); if (!em) return null;
  const r = await sb("ccml_profiles?email=ilike." + encodeURIComponent(em) + "&select=*&limit=5");
  const rows = r.ok && Array.isArray(r.data) ? r.data.filter(function (p) { return String(p.email || "").toLowerCase() === em; }) : [];
  return rows[0] || null;
}

// Add letter credits without losing a concurrent update (compare-and-set on the old value).
async function addCredits(profileId, n) {
  for (let i = 0; i < 6; i++) {
    const p = await profileById(profileId); if (!p) return null;
    const next = (Number(p.mail_credits) || 0) + n;
    const r = await sb("ccml_profiles?id=eq." + encodeURIComponent(profileId) + "&mail_credits=eq." + (Number(p.mail_credits) || 0), { method: "PATCH", prefer: "return=representation", body: { mail_credits: next, updated_at: new Date().toISOString() } });
    if (r.ok && Array.isArray(r.data) && r.data.length) return next;
  }
  return null;
}
async function raisePlan(profileId, plan) {
  const p = await profileById(profileId); if (!p) return false;
  if ((RANK[plan] || 0) <= (RANK[p.plan] || 0)) return true;           // never downgrade
  const r = await sb("ccml_profiles?id=eq." + encodeURIComponent(profileId), { method: "PATCH", prefer: "return=minimal", body: { plan: plan, updated_at: new Date().toISOString() } });
  return r.ok;
}

// Turn a PAID Checkout Session into access. Safe to call many times (webhook + the buyer's return visit):
// the purchase row is unique per Stripe session, only the first call adds mail credits.
async function fulfillSession(session) {
  const md = (session && session.metadata) || {};
  if (!md.product || String(md.product).indexOf("CCML") !== 0) return { skipped: true };
  if (session.payment_status !== "paid") return { skipped: true, unpaid: true };
  const plan = md.plan === "dfy" ? "dfy" : md.plan === "diy" ? "diy" : "";
  const qty = md.plan === "mail" ? Math.max(0, Math.min(25, Number(md.qty) || 0)) : 0;
  if (!plan && !qty) return { skipped: true };
  const email = safeEmail((session.customer_details && session.customer_details.email) || session.customer_email || md.email);

  // Who gets it: the signed-in account that started checkout, else the account with the paying email, else the email waits.
  let prof = null;
  if (md.userId) prof = await profileById(md.userId);
  if (!prof && email) prof = await profileByEmail(email);

  const ins = await sb("ccml_purchases", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: {
    user_id: prof ? prof.id : null, email: email || null, product: md.product, plan: plan || "mail", qty: qty, amount_cents: session.amount_total || 0, stripe_session_id: session.id, status: "complete" } });
  if (!ins.ok) return { error: "Could not record the purchase" };
  const first = Array.isArray(ins.data) && ins.data.length > 0;

  if (!prof) {
    if (first && email) await sb("ccml_pending_upgrades", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { email: email, plan: plan || null, mail_credits: qty, stripe_session_id: session.id } });
    return { pending: true, plan: plan || null };
  }
  if (plan) await raisePlan(prof.id, plan);                           // idempotent, safe on every call
  if (qty && first) await addCredits(prof.id, qty);                   // only once per Stripe session
  const now = await profileById(prof.id);
  return { ok: true, userId: prof.id, plan: now ? now.plan : plan, mail_credits: now ? now.mail_credits : 0, first: first };
}

module.exports = { SB, SITE, PRODUCTS, MAIL_PACKS, RANK, J, sb, userFromEvent, safeEmail, profileById, profileByEmail, addCredits, raisePlan, fulfillSession };
