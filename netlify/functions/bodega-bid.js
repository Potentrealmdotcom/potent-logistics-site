// POTENT Bodega — bid/ask layer on top of the V1 marketplace.
// The ASK is the listing's price (bodega_listings.price_cents, floor + hold already
// enforced by bodega-list). Anyone with the Bodega email identity can place a BID on a
// listed piece: no payment at bid time. A bid MATCHES the ask when it is placed at or
// above the ask, or when the seller accepts it — then the sale executes through the
// EXISTING bodega-buy flow at the agreed (bid) price and the royalty split runs
// unchanged (see bodega-buy.js, which validates the bid on checkout + completion).
// POST { action: "place", email, listingId, amountCents, expiresDays? }
// POST { action: "accept", email, bidId }   — seller accepts a bid on their listing
// POST { action: "cancel", email, bidId }    — bidder withdraws their own bid
// POST { action: "for_listing", listingId }  — public: highest bid + count (no emails)
// POST { action: "my_bids", email }          — bids this email has placed
// POST { action: "for_seller", email }       — live bids on this email's listings
const B = require("./lib/bodega");

const UUID = /^[0-9a-f-]{36}$/i;
const LIVE = ["active", "matched", "accepted"];

async function listingById(id) {
  const r = await B.sb("bodega_listings?id=eq." + encodeURIComponent(id) + "&select=*&limit=1");
  return r.ok && Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
}
async function bidById(id) {
  const r = await B.sb("bodega_bids?id=eq." + encodeURIComponent(id) + "&select=*&limit=1");
  return r.ok && Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
}
async function bidsForListing(listingId) {
  const r = await B.sb("bodega_bids?listing_id=eq." + encodeURIComponent(listingId) + "&select=*&order=amount_cents.desc&limit=500");
  return r.ok && Array.isArray(r.data) ? r.data : [];
}
function isLive(bid, now) {
  return LIVE.indexOf(bid.status) !== -1 && new Date(bid.expires_at).getTime() > now;
}
function publicBid(bid) {
  return { id: bid.id, amountCents: bid.amount_cents, status: bid.status, expiresAt: bid.expires_at, createdAt: bid.created_at };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return B.J(500, { error: "Server not configured" });
  let body; try { body = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  const action = String(body.action || "");
  const now = Date.now();

  if (action === "for_listing") {
    const listingId = String(body.listingId || "");
    if (!UUID.test(listingId)) return B.J(400, { error: "Bad listing id" });
    const listing = await listingById(listingId);
    if (!listing) return B.J(404, { error: "Listing not found" });
    const live = (await bidsForListing(listingId)).filter(function (b) { return isLive(b, now); });
    const highest = live.length ? Math.max.apply(null, live.map(function (b) { return Number(b.amount_cents) || 0; })) : 0;
    return B.J(200, { success: true, listingId: listingId, askCents: listing.price_cents, highestBidCents: highest || null, bidCount: live.length });
  }

  const email = B.safeEmail(body.email);
  if (!email) return B.J(400, { error: "Valid email required" });

  if (action === "place") {
    const listingId = String(body.listingId || "");
    if (!UUID.test(listingId)) return B.J(400, { error: "Bad listing id" });
    const amountCents = Math.floor(Number(body.amountCents));
    if (!isFinite(amountCents) || amountCents <= 0) return B.J(400, { error: "Bad bid amount" });
    let days = Math.floor(Number(body.expiresDays) || 7);
    if (days < 1) days = 1; if (days > 30) days = 30;
    const listing = await listingById(listingId);
    if (!listing) return B.J(404, { error: "Listing not found" });
    if (listing.status !== "active") return B.J(409, { error: "Listing is no longer active" });
    if (String(listing.seller_email || "").toLowerCase() === email) return B.J(400, { error: "You cannot bid on your own piece" });
    if (listing.reserved_email && String(listing.reserved_email).toLowerCase() !== email) return B.J(409, { error: "This piece is reserved for an auction winner" });
    // One live bid per bidder per listing: a new bid replaces the old one.
    const mine = (await bidsForListing(listingId)).filter(function (b) {
      return String(b.bidder_email || "").toLowerCase() === email && isLive(b, now);
    });
    for (let i = 0; i < mine.length; i++) {
      await B.sb("bodega_bids?id=eq." + encodeURIComponent(mine[i].id), { method: "PATCH", prefer: "return=minimal", body: { status: "cancelled", updated_at: new Date().toISOString() } });
    }
    const matched = amountCents >= Number(listing.price_cents);
    const ins = await B.sb("bodega_bids", { method: "POST", prefer: "return=representation", body: {
      listing_id: listingId,
      bidder_email: email,
      amount_cents: amountCents,
      status: matched ? "matched" : "active",
      expires_at: new Date(now + days * 24 * 60 * 60 * 1000).toISOString()
    } });
    if (!ins.ok || !Array.isArray(ins.data) || !ins.data[0]) return B.J(500, { error: "Could not place bid" });
    return B.J(200, { success: true, bid: publicBid(ins.data[0]), matched: matched, askCents: listing.price_cents });
  }

  if (action === "accept") {
    const bidId = String(body.bidId || "");
    if (!UUID.test(bidId)) return B.J(400, { error: "Bad bid id" });
    const bid = await bidById(bidId);
    if (!bid) return B.J(404, { error: "Bid not found" });
    const listing = await listingById(bid.listing_id);
    if (!listing) return B.J(404, { error: "Listing not found" });
    if (String(listing.seller_email || "").toLowerCase() !== email) return B.J(403, { error: "Not your listing" });
    if (listing.status !== "active") return B.J(409, { error: "Listing is no longer active" });
    if (bid.status !== "active" || new Date(bid.expires_at).getTime() <= now) return B.J(409, { error: "Bid is no longer live" });
    // Accepting a second bid releases the first accepted one back to active.
    const others = (await bidsForListing(listing.id)).filter(function (b) { return b.status === "accepted" && b.id !== bid.id; });
    for (let i = 0; i < others.length; i++) {
      await B.sb("bodega_bids?id=eq." + encodeURIComponent(others[i].id), { method: "PATCH", prefer: "return=minimal", body: { status: "active", updated_at: new Date().toISOString() } });
    }
    const upd = await B.sb("bodega_bids?id=eq." + encodeURIComponent(bidId), { method: "PATCH", prefer: "return=representation", body: { status: "accepted", updated_at: new Date().toISOString() } });
    if (!upd.ok) return B.J(500, { error: "Could not accept bid" });
    return B.J(200, { success: true, bid: publicBid(Array.isArray(upd.data) && upd.data[0] ? upd.data[0] : bid), matched: true, askCents: listing.price_cents });
  }

  if (action === "cancel") {
    const bidId = String(body.bidId || "");
    if (!UUID.test(bidId)) return B.J(400, { error: "Bad bid id" });
    const bid = await bidById(bidId);
    if (!bid) return B.J(404, { error: "Bid not found" });
    if (String(bid.bidder_email || "").toLowerCase() !== email) return B.J(403, { error: "Not your bid" });
    if (LIVE.indexOf(bid.status) === -1) return B.J(409, { error: "Bid is no longer live" });
    const upd = await B.sb("bodega_bids?id=eq." + encodeURIComponent(bidId), { method: "PATCH", prefer: "return=minimal", body: { status: "cancelled", updated_at: new Date().toISOString() } });
    if (!upd.ok) return B.J(500, { error: "Could not cancel bid" });
    return B.J(200, { success: true });
  }

  if (action === "my_bids") {
    const r = await B.sb("bodega_bids?bidder_email=eq." + encodeURIComponent(email) + "&select=*,listing:bodega_listings(price_cents,status,ownership_id)&order=created_at.desc&limit=200");
    const rowsOut = (r.ok && Array.isArray(r.data) ? r.data : []).map(function (b) {
      const out = publicBid(b);
      out.listingId = b.listing_id;
      out.askCents = b.listing ? b.listing.price_cents : null;
      out.listingStatus = b.listing ? b.listing.status : null;
      out.expired = new Date(b.expires_at).getTime() <= now && LIVE.indexOf(b.status) !== -1;
      return out;
    });
    return B.J(200, { success: true, bids: rowsOut });
  }

  if (action === "for_seller") {
    const lr = await B.sb("bodega_listings?seller_email=eq." + encodeURIComponent(email) + "&status=eq.active&select=id,price_cents,ownership_id&limit=200");
    const listings = lr.ok && Array.isArray(lr.data) ? lr.data : [];
    const out = [];
    for (let i = 0; i < listings.length; i++) {
      const live = (await bidsForListing(listings[i].id)).filter(function (b) { return isLive(b, now); });
      live.forEach(function (b) {
        const pub = publicBid(b);
        pub.listingId = listings[i].id;
        pub.askCents = listings[i].price_cents;
        pub.ownershipId = listings[i].ownership_id;
        out.push(pub);
      });
    }
    out.sort(function (a, b) { return b.amountCents - a.amountCents; });
    return B.J(200, { success: true, bids: out });
  }

  return B.J(400, { error: "Unknown action" });
};
