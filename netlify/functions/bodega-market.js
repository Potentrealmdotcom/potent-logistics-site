// GET (also accepts POST) — the public Bodega resale market: active listings + per-handle resale history counts.
// V2 adds the StockX-style layer: market stats (pieces sold, resale volume, royalty
// payouts), each listing's highest live bid, last sale price, and anonymous ownership
// chain (editions + dates only). Never exposes any purchase price or any email.
const B = require("./lib/bodega");
const CAT = require("./lib/bodega-catalog");

exports.handler = async function (event) {
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") return B.J(405, { error: "GET or POST only" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return B.J(500, { error: "Server not configured" });

  const lr = await B.sb("bodega_listings?status=eq.active&select=*,ownership:bodega_ownership(product_handle,edition_label,resale_floor_cents)&order=created_at.desc&limit=500");
  if (!lr.ok) return B.J(500, { error: "Could not load market" });
  // Auction-win listings are reserved for one winner — they never appear on the open market.
  const listingRows = (Array.isArray(lr.data) ? lr.data : []).filter(function (l) { return l.source !== "auction"; });

  const sr = await B.sb("bodega_sales?select=product_handle,price_cents,sold_at&order=sold_at.desc&limit=100000");
  const sales = sr.ok && Array.isArray(sr.data) ? sr.data : [];
  const history = {};
  const pieceStats = {};
  let totalVolumeCents = 0;
  sales.forEach(function (s) {
    const h = String(s.product_handle || "");
    if (!h) return;
    history[h] = (history[h] || 0) + 1;
    totalVolumeCents += Number(s.price_cents) || 0;
    if (!pieceStats[h]) pieceStats[h] = { lastSaleCents: Number(s.price_cents) || 0, timesSold: 0, history: [] };
    pieceStats[h].timesSold++;
    if (pieceStats[h].history.length < 10) pieceStats[h].history.push({ priceCents: Number(s.price_cents) || 0, soldAt: s.sold_at });
  });

  // Royalty payouts recorded (one count for the whole ledger).
  const led = await B.sb("bodega_royalty_ledger?select=id&limit=100000");
  const royaltyPayouts = led.ok && Array.isArray(led.data) ? led.data.length : 0;

  // Live bids -> highest bid + count per listing (expired bids filtered out here).
  const br = await B.sb("bodega_bids?status=in.(active,matched,accepted)&select=listing_id,amount_cents,expires_at&limit=100000");
  const now = Date.now();
  const bidsByListing = {};
  (br.ok && Array.isArray(br.data) ? br.data : []).forEach(function (b) {
    if (new Date(b.expires_at).getTime() <= now) return;
    const id = String(b.listing_id || "");
    if (!id) return;
    if (!bidsByListing[id]) bidsByListing[id] = { highest: 0, count: 0 };
    bidsByListing[id].count++;
    if ((Number(b.amount_cents) || 0) > bidsByListing[id].highest) bidsByListing[id].highest = Number(b.amount_cents) || 0;
  });

  // Anonymous ownership chains: for each listed edition, every recorded owner change
  // (dates + edition only — no emails, no prices). "You can copy the piece.
  // You can't copy the history."
  const chainByKey = {};
  const chainKeys = {};
  listingRows.forEach(function (l) {
    const o = l.ownership || {};
    if (o.product_handle && o.edition_label) chainKeys[o.product_handle + "|" + o.edition_label] = { handle: o.product_handle, edition: o.edition_label };
  });
  const keyList = Object.keys(chainKeys);
  for (let i = 0; i < keyList.length; i++) {
    const k = chainKeys[keyList[i]];
    const cr = await B.sb("bodega_ownership?product_handle=eq." + encodeURIComponent(k.handle) + "&edition_label=eq." + encodeURIComponent(k.edition) + "&select=edition_label,purchased_at,status&order=purchased_at.asc&limit=100");
    chainByKey[keyList[i]] = (cr.ok && Array.isArray(cr.data) ? cr.data : []).map(function (r) {
      return { editionLabel: r.edition_label, since: r.purchased_at, current: r.status === "active" || r.status === "listed" || r.status === "auction" };
    });
  }

  const listings = listingRows.map(function (l) {
    const o = l.ownership || {};
    const handle = String(o.product_handle || "");
    const entry = CAT.CATALOG[handle];
    const bids = bidsByListing[String(l.id)] || { highest: 0, count: 0 };
    const ps = pieceStats[handle];
    return {
      id: l.id,
      productHandle: handle,
      title: entry && entry.title ? entry.title : handle,
      editionLabel: o.edition_label || null,
      priceCents: l.price_cents,
      floorCents: o.resale_floor_cents != null ? o.resale_floor_cents : null,
      historyCount: history[handle] || 0,
      highestBidCents: bids.count ? bids.highest : null,
      bidCount: bids.count,
      lastSaleCents: ps ? ps.lastSaleCents : null,
      chain: o.edition_label ? (chainByKey[handle + "|" + o.edition_label] || []) : []
    };
  });
  return B.J(200, {
    listings: listings,
    history: history,
    pieceStats: pieceStats,
    stats: { totalPiecesSold: sales.length, totalVolumeCents: totalVolumeCents, royaltyPayouts: royaltyPayouts }
  });
};
