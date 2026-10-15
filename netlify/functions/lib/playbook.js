// Shared helpers for the Potent Playbook, sold through POTENT's own Stripe account and Supabase project.
// Used by playbook-checkout, playbook-verify, playbook-entitlements and the shared stripe-webhook.

const SB = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
const SITE = "https://potentoperations.netlify.app";

// Prices live HERE, never trusted from the browser. Amounts are in cents. All sales final.
const PRODUCTS = {
  regular:    { product: "PLAYBOOK Regular",    name: "Potent Playbook — Regular",                             amount: 10000 },
  deluxe:     { product: "PLAYBOOK Deluxe",     name: "Potent Playbook — Deluxe",                              amount: 29700 },
  themes:     { product: "PLAYBOOK Themes",     name: "Potent Playbook — Streetwear Website Themes (2)",        amount: 30000 },
  calendar:   { product: "PLAYBOOK Calendar",   name: "Potent Playbook — 30-Day Launch Calendar",              amount: 4700 },
  calculator: { product: "PLAYBOOK Calculator", name: "Potent Playbook — Drop Profit Calculator",              amount: 2700 },
  techpack:   { product: "PLAYBOOK Techpack",   name: "Potent Playbook — Tech Pack Template",                  amount: 3700 },
  vault:      { product: "PLAYBOOK Vault",      name: "Potent Playbook — AI Prompt Vault",                     amount: 2700 }
};
const TIERS = ["regular", "deluxe"];                                        // unlocks the course
const ADDONS = ["themes", "calendar", "calculator", "techpack", "vault"];  // bonus products
const RANK = { none: 0, regular: 1, deluxe: 2 };

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

// A buyer's current access: the highest tier they ever paid for (never downgrades)
// plus every bonus addon. Primary lookup is by signed-in user id, email is the fallback.
async function entitlementsFor(opts) {
  opts = opts || {};
  let rows = [];
  if (opts.userId) {
    const r = await sb("playbook_purchases?user_id=eq." + encodeURIComponent(opts.userId) + "&select=tier,addon&order=created_at.desc");
    if (r.ok && Array.isArray(r.data)) rows = r.data;
  }
  const email = safeEmail(opts.email);
  if (!rows.length && email) {
    const r = await sb("playbook_purchases?email=ilike." + encodeURIComponent(email) + "&select=tier,addon&order=created_at.desc&limit=50");
    rows = r.ok && Array.isArray(r.data) ? r.data : [];
  }
  let tier = "none";
  const addons = [];
  rows.forEach(function (r) {
    const t = String(r.tier || "");
    if ((RANK[t] || 0) > (RANK[tier] || 0)) tier = t;                      // never downgrade
    const a = String(r.addon || "");
    if (a && ADDONS.indexOf(a) > -1 && addons.indexOf(a) === -1) addons.push(a);
  });
  return { tier: tier, addons: addons };
}

// Turn a PAID Checkout Session into access. Safe to call many times (webhook + the buyer's return visit):
// the purchase row is unique per Stripe session + product, so duplicates are ignored on insert.
async function fulfillSession(session) {
  const md = (session && session.metadata) || {};
  if (!md.product || String(md.product).indexOf("PLAYBOOK") !== 0) return { skipped: true };
  if (session.payment_status !== "paid") return { skipped: true, unpaid: true };
  const items = String(md.items || "").split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(function (s) { return PRODUCTS[s]; });
  if (!items.length) return { skipped: true };
  const email = safeEmail((session.customer_details && session.customer_details.email) || session.customer_email || md.email);

  let first = false;
  for (const item of items) {
    const p = PRODUCTS[item];
    const ins = await sb("playbook_purchases", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: {
      user_id: md.userId || null, email: email || null, product: p.product,
      tier: TIERS.indexOf(item) > -1 ? item : null,
      addon: ADDONS.indexOf(item) > -1 ? item : null,
      amount_cents: p.amount, stripe_session_id: session.id, status: "complete" } });
    if (!ins.ok) return { error: "Could not record the purchase" };
    if (Array.isArray(ins.data) && ins.data.length) first = true;
  }
  const ent = await entitlementsFor({ userId: md.userId || null, email: email });
  return { ok: true, tier: ent.tier, addons: ent.addons, first: first };
}

module.exports = { SB, SITE, PRODUCTS, TIERS, ADDONS, RANK, J, sb, userFromEvent, safeEmail, entitlementsFor, fulfillSession };
