// GET (also accepts POST) — the public Bodega resale market: active listings + per-handle resale history counts.
// Never exposes any purchase price or any email.
const B = require("./lib/bodega");
const CAT = require("./lib/bodega-catalog");

exports.handler = async function (event) {
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") return B.J(405, { error: "GET or POST only" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return B.J(500, { error: "Server not configured" });

  const lr = await B.sb("bodega_listings?status=eq.active&select=*,ownership:bodega_ownership(product_handle,edition_label,resale_floor_cents)&order=created_at.desc&limit=500");
  if (!lr.ok) return B.J(500, { error: "Could not load market" });
  const sr = await B.sb("bodega_sales?select=product_handle&limit=100000");
  const history = {};
  (sr.ok && Array.isArray(sr.data) ? sr.data : []).forEach(function (s) {
    const h = String(s.product_handle || "");
    if (h) history[h] = (history[h] || 0) + 1;
  });

  const listings = (Array.isArray(lr.data) ? lr.data : []).map(function (l) {
    const o = l.ownership || {};
    const handle = String(o.product_handle || "");
    const entry = CAT.CATALOG[handle];
    return {
      id: l.id,
      productHandle: handle,
      title: entry && entry.title ? entry.title : handle,
      editionLabel: o.edition_label || null,
      priceCents: l.price_cents,
      floorCents: o.resale_floor_cents != null ? o.resale_floor_cents : null,
      historyCount: history[handle] || 0
    };
  });
  return B.J(200, { listings: listings, history: history });
};
