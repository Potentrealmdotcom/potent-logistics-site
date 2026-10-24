// Shared helpers for POTENT Bodega (resale engine), sold through POTENT's own Stripe account and Supabase project.
// Used by bodega-checkout, bodega-ownership, bodega-list, bodega-market, bodega-buy and bodega-admin.
// Mirrors lib/ccml.js patterns exactly: CommonJS, J() JSON responses, Supabase via REST.

const SB = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
const SITE = "https://potentoperations.netlify.app";

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

function safeEmail(e) {
  e = String(e || "").trim().toLowerCase();
  return /^[^\s,()*%_\\]+@[^\s,()*%_\\]+\.[^\s,()*%_\\]+$/.test(e) && e.length <= 200 ? e : "";
}

// Same origin rule as ccml-checkout: a netlify.app origin or the canonical SITE, else SITE.
function originFromEvent(event) {
  const h = (event && event.headers) || {};
  const origin = String(h.origin || "");
  return /^https:\/\/([a-z0-9-]+\.)*netlify\.app$/.test(origin) || origin === SITE ? origin : SITE;
}

async function collectorByEmail(email) {
  const em = safeEmail(email); if (!em) return null;
  const r = await sb("bodega_collectors?email=ilike." + encodeURIComponent(em) + "&select=*&limit=5");
  const rows = r.ok && Array.isArray(r.data) ? r.data.filter(function (p) { return String(p.email || "").toLowerCase() === em; }) : [];
  return rows[0] || null;
}

// Find the collector for an email, creating one (with the next collector number) if missing.
// On a unique-violation race, re-select and return the row that won.
async function getOrCreateCollector(email) {
  const em = safeEmail(email); if (!em) return null;
  const existing = await collectorByEmail(em);
  if (existing) return existing;
  const ins = await sb("bodega_collectors", { method: "POST", prefer: "return=representation", body: { email: em } });
  if (ins.ok && Array.isArray(ins.data) && ins.data[0]) return ins.data[0];
  // Unique violation (or any insert failure): the row may already exist — re-select before giving up.
  const again = await collectorByEmail(em);
  return again || null;
}

// Resale royalty split on the sale price: creator 2.5%, original buyer 1.5%, platform 1%.
// The seller keeps the rest.
function royaltySplit(priceCents) {
  const p = Math.max(0, Math.floor(Number(priceCents) || 0));
  const creator = Math.round(p * 0.025);
  const originalBuyer = Math.round(p * 0.015);
  const platform = Math.round(p * 0.01);
  const sellerPayout = p - creator - originalBuyer - platform;
  return { creator: creator, originalBuyer: originalBuyer, platform: platform, sellerPayout: sellerPayout };
}

module.exports = { SB: SB, SITE: SITE, J: J, sb: sb, safeEmail: safeEmail, originFromEvent: originFromEvent, collectorByEmail: collectorByEmail, getOrCreateCollector: getOrCreateCollector, royaltySplit: royaltySplit };
