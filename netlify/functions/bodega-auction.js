// POTENT Bodega — LIVE DROPS: TikTok-style live auctions in the Bodega.
// Mirrors the Smoke Sessions pattern (netlify/functions/music-smoke.js): an event with a
// queue, one piece live at a time, a countdown the server enforces whenever anyone
// polls, roles (the POTENT owner hosts; everyone else bids with the Bodega email
// identity), and the same self-hosted Jitsi room (meet.potentworld.online) for the
// host video. The pure state machine lives in lib/bodega-auction.js.
// Winning: when the countdown ends the highest bid wins. The winner checks out through
// the EXISTING bodega-buy flow — this function mints a reserved listing at the winning
// price (source 'auction', reserved for the winner's email) and creates the same Stripe
// session bodega-buy creates, so completion, royalties (2.5 / 1.5 / 1) and the ownership
// transfer are 100% the V1 code path. Unsold pieces return to their owner's collection.
// Public payloads never expose a full email (bidders are masked; the winner is private).
const crypto = require("crypto");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const B = require("./lib/bodega");
const CAT = require("./lib/bodega-catalog");
const A = require("./lib/bodega-auction");
const SH = require("./lib/selfhost");

const UUID = /^[0-9a-f-]{36}$/i;
const rows = function (r) { return r.ok && Array.isArray(r.data) ? r.data : []; };

// Same staff-token check as bodega-admin.js: POTENT owner only.
function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function ownerFrom(event) {
  const h = (event && event.headers) || {};
  const m = String(h.authorization || h.Authorization || "").match(/^Bearer\s+(.+)$/i);
  if (!m || !process.env.AUTH_SECRET) return null;
  const token = m[1];
  if (token.indexOf(".") < 0) return null;
  const parts = token.split(".");
  const expect = b64u(crypto.createHmac("sha256", process.env.AUTH_SECRET).update(parts[0]).digest());
  const a = Buffer.from(parts[1] || ""), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return p.exp && p.exp >= Date.now() && p.role === "owner" && !p.orgId && !p.assist ? p : null;
  } catch (e) { return null; }
}

async function auctionById(id) {
  return rows(await B.sb("bodega_auctions?id=eq." + encodeURIComponent(id) + "&select=*&limit=1"))[0] || null;
}
async function itemById(id) {
  return rows(await B.sb("bodega_auction_items?id=eq." + encodeURIComponent(id) + "&select=*&limit=1"))[0] || null;
}
async function ownershipById(id) {
  return rows(await B.sb("bodega_ownership?id=eq." + encodeURIComponent(id) + "&select=*&limit=1"))[0] || null;
}
async function itemsOf(auctionId) {
  return rows(await B.sb("bodega_auction_items?auction_id=eq." + encodeURIComponent(auctionId) + "&select=*&order=position.asc&limit=200"));
}
async function bidsOf(itemId) {
  return rows(await B.sb("bodega_auction_bids?item_id=eq." + encodeURIComponent(itemId) + "&select=*&order=created_at.asc&limit=1000"));
}
function highOf(bids) {
  return bids.reduce(function (m, b) { return Math.max(m, Number(b.amount_cents) || 0); }, 0);
}

function pubAuction(a) {
  return { id: a.id, title: a.title, status: a.status, startsAt: a.starts_at, startedAt: a.started_at, endedAt: a.ended_at };
}
function pubItem(it, bids) {
  const out = {
    id: it.id, productHandle: it.product_handle, editionLabel: it.edition_label,
    startingBidCents: it.starting_bid_cents, durationSeconds: it.duration_seconds,
    status: it.status, endsAt: it.ends_at, position: it.position,
    winningBidCents: it.status === "won" ? it.winning_bid_cents : null
  };
  if (bids) {
    out.currentBidCents = highOf(bids) || null;
    out.bidCount = bids.length;
  }
  return out;
}

// Settle the auction's live item (timer up, host skipped, or host ended the night).
// Won -> reserved listing for the winner (ownership stays 'auction' until the sale
// completes through bodega-buy, so the piece can't be double-sold). Unsold -> the
// ownership returns to 'active' in the owner's collection, listable again.
async function settleItem(auction, item) {
  const bids = await bidsOf(item.id);
  const res = A.settleItem(bids);
  if (res.outcome === "won") {
    const ownership = await ownershipById(item.ownership_id);
    if (!ownership) return res;
    const ins = await B.sb("bodega_listings", { method: "POST", prefer: "return=representation", body: {
      ownership_id: ownership.id, seller_email: ownership.owner_email,
      price_cents: res.winningBidCents, status: "active", source: "auction", reserved_email: res.winnerEmail
    } });
    const listing = Array.isArray(ins.data) && ins.data[0] ? ins.data[0] : null;
    await B.sb("bodega_auction_items?id=eq." + encodeURIComponent(item.id), { method: "PATCH", prefer: "return=minimal", body: {
      status: "won", winning_bid_cents: res.winningBidCents, winner_email: res.winnerEmail, listing_id: listing ? listing.id : null
    } });
    item.status = "won"; item.winning_bid_cents = res.winningBidCents; item.winner_email = res.winnerEmail; item.listing_id = listing ? listing.id : null;
  } else {
    await B.sb("bodega_auction_items?id=eq." + encodeURIComponent(item.id), { method: "PATCH", prefer: "return=minimal", body: { status: "unsold" } });
    await B.sb("bodega_ownership?id=eq." + encodeURIComponent(item.ownership_id), { method: "PATCH", prefer: "return=minimal", body: { status: "active" } });
    item.status = "unsold";
  }
  return res;
}

// Start the next queued item, if any. Returns the started item or null.
async function startNext(auction) {
  const items = await itemsOf(auction.id);
  const next = items.filter(function (i) { return i.status === "queued"; })[0];
  if (!next) {
    await B.sb("bodega_auctions?id=eq." + encodeURIComponent(auction.id), { method: "PATCH", prefer: "return=minimal", body: { current_item_id: null } });
    auction.current_item_id = null;
    return null;
  }
  const endsAt = new Date(A.startEndsAt(Date.now(), next.duration_seconds)).toISOString();
  await B.sb("bodega_auction_items?id=eq." + encodeURIComponent(next.id), { method: "PATCH", prefer: "return=minimal", body: { status: "live", ends_at: endsAt } });
  await B.sb("bodega_auctions?id=eq." + encodeURIComponent(auction.id), { method: "PATCH", prefer: "return=minimal", body: { current_item_id: next.id } });
  next.status = "live"; next.ends_at = endsAt; auction.current_item_id = next.id;
  return next;
}

// The countdown is enforced here, on read — the same trick Smoke Sessions use for
// turn timers, so the room keeps moving even if the host steps away.
async function tick(auction) {
  if (auction.status !== "live" || !auction.current_item_id) return auction;
  const item = await itemById(auction.current_item_id);
  if (!item || item.status !== "live") return auction;
  if (item.ends_at && Date.now() > new Date(item.ends_at).getTime()) {
    await settleItem(auction, item);
    await startNext(auction);
  }
  return auction;
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") return B.J(405, { error: "POST only" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return B.J(500, { error: "Server not configured" });
  let body = {};
  if (event.httpMethod === "POST") { try { body = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); } }
  const action = String(body.action || (event.queryStringParameters && event.queryStringParameters.action) || "");
  const owner = ownerFrom(event);

  // ───────── public: what's on ─────────
  if (action === "a_list") {
    const upcoming = rows(await B.sb("bodega_auctions?status=in.(scheduled,live)&select=*&order=starts_at.asc&limit=50"));
    const ended = rows(await B.sb("bodega_auctions?status=eq.ended&select=*&order=ended_at.desc&limit=5"));
    return B.J(200, { success: true, auctions: upcoming.concat(ended).map(pubAuction) });
  }

  // ───────── owner: run the night ─────────
  if (action.indexOf("o_") === 0) {
    if (!owner) return B.J(403, { error: "POTENT owner only" });

    if (action === "o_create") {
      const title = String(body.title || "").trim().slice(0, 90);
      if (title.length < 3) return B.J(400, { error: "Give the drop a title" });
      let startsAt = null;
      if (body.startsAt) { const d = new Date(body.startsAt); if (isNaN(d)) return B.J(400, { error: "Bad start time" }); startsAt = d.toISOString(); }
      const live = body.startNow === true;
      const ins = await B.sb("bodega_auctions", { method: "POST", prefer: "return=representation", body: {
        title: title, status: live ? "live" : "scheduled", starts_at: startsAt, started_at: live ? new Date().toISOString() : null
      } });
      if (!ins.ok || !Array.isArray(ins.data) || !ins.data[0]) return B.J(500, { error: "Could not create the drop" });
      return B.J(200, { success: true, auction: pubAuction(ins.data[0]) });
    }

    const auctionId = String(body.auctionId || "");
    if (!UUID.test(auctionId)) return B.J(400, { error: "Bad auction id" });
    const auction = await auctionById(auctionId);
    if (!auction) return B.J(404, { error: "Auction not found" });

    if (action === "o_add_item") {
      if (auction.status === "ended" || auction.status === "cancelled") return B.J(409, { error: "That drop is over" });
      const ownershipId = String(body.ownershipId || "");
      if (!UUID.test(ownershipId)) return B.J(400, { error: "Bad ownership id" });
      const startingBidCents = Math.floor(Number(body.startingBidCents));
      if (!isFinite(startingBidCents) || startingBidCents <= 0) return B.J(400, { error: "Bad starting bid" });
      const ownership = await ownershipById(ownershipId);
      if (!ownership) return B.J(404, { error: "Piece not found" });
      if (ownership.status !== "active") return B.J(409, { error: "Piece is not available (status: " + ownership.status + ")" });
      if (Date.now() < new Date(ownership.hold_until).getTime()) return B.J(422, { error: "180-day hold still active" });
      if (startingBidCents < Number(ownership.resale_floor_cents || 0)) return B.J(422, { error: "Starting bid is below the POTENT resale floor" });
      const items = await itemsOf(auctionId);
      if (items.some(function (i) { return i.ownership_id === ownershipId && i.status !== "unsold"; })) return B.J(409, { error: "Piece is already in this drop" });
      const ins = await B.sb("bodega_auction_items", { method: "POST", prefer: "return=representation", body: {
        auction_id: auctionId, ownership_id: ownershipId, product_handle: ownership.product_handle,
        edition_label: ownership.edition_label, starting_bid_cents: startingBidCents,
        duration_seconds: A.clampDuration(body.durationSeconds), position: items.length, status: "queued"
      } });
      if (!ins.ok || !Array.isArray(ins.data) || !ins.data[0]) return B.J(500, { error: "Could not queue the piece" });
      await B.sb("bodega_ownership?id=eq." + encodeURIComponent(ownershipId), { method: "PATCH", prefer: "return=minimal", body: { status: "auction" } });
      return B.J(200, { success: true, item: pubItem(ins.data[0]) });
    }

    if (action === "o_start") {
      if (auction.status === "ended") return B.J(409, { error: "That drop has ended" });
      await B.sb("bodega_auctions?id=eq." + encodeURIComponent(auctionId), { method: "PATCH", prefer: "return=minimal", body: { status: "live", started_at: auction.started_at || new Date().toISOString() } });
      auction.status = "live";
      if (!auction.current_item_id) await startNext(auction);
      return B.J(200, { success: true, auction: pubAuction(auction) });
    }

    if (action === "o_next") {
      if (auction.status !== "live") return B.J(409, { error: "Drop is not live" });
      if (auction.current_item_id) {
        const cur = await itemById(auction.current_item_id);
        if (cur && cur.status === "live") await settleItem(auction, cur);
      }
      const next = await startNext(auction);
      if (!next) {
        await B.sb("bodega_auctions?id=eq." + encodeURIComponent(auctionId), { method: "PATCH", prefer: "return=minimal", body: { status: "ended", ended_at: new Date().toISOString(), current_item_id: null } });
        return B.J(200, { success: true, ended: true });
      }
      return B.J(200, { success: true, currentItemId: next.id });
    }

    if (action === "o_end") {
      if (auction.current_item_id) {
        const cur = await itemById(auction.current_item_id);
        if (cur && cur.status === "live") await settleItem(auction, cur);
      }
      // Anything still queued goes home untouched.
      const items = await itemsOf(auctionId);
      for (let i = 0; i < items.length; i++) {
        if (items[i].status === "queued") {
          await B.sb("bodega_auction_items?id=eq." + encodeURIComponent(items[i].id), { method: "PATCH", prefer: "return=minimal", body: { status: "unsold" } });
          await B.sb("bodega_ownership?id=eq." + encodeURIComponent(items[i].ownership_id), { method: "PATCH", prefer: "return=minimal", body: { status: "active" } });
        }
      }
      await B.sb("bodega_auctions?id=eq." + encodeURIComponent(auctionId), { method: "PATCH", prefer: "return=minimal", body: { status: "ended", ended_at: new Date().toISOString(), current_item_id: null } });
      return B.J(200, { success: true });
    }

    if (action === "o_release") {
      // Winner never paid: cancel the reserved listing and free the piece.
      const itemId = String(body.itemId || "");
      if (!UUID.test(itemId)) return B.J(400, { error: "Bad item id" });
      const item = await itemById(itemId);
      if (!item || item.auction_id !== auctionId) return B.J(404, { error: "Item not found" });
      if (item.status !== "won" || !item.listing_id) return B.J(409, { error: "Item is not awaiting a winner checkout" });
      const listing = rows(await B.sb("bodega_listings?id=eq." + encodeURIComponent(item.listing_id) + "&select=*&limit=1"))[0];
      if (listing && listing.status === "sold") return B.J(409, { error: "Already sold — too late to release" });
      if (listing) await B.sb("bodega_listings?id=eq." + encodeURIComponent(listing.id), { method: "PATCH", prefer: "return=minimal", body: { status: "cancelled" } });
      await B.sb("bodega_auction_items?id=eq." + encodeURIComponent(item.id), { method: "PATCH", prefer: "return=minimal", body: { status: "unsold", winner_email: null, winning_bid_cents: null, listing_id: null } });
      await B.sb("bodega_ownership?id=eq." + encodeURIComponent(item.ownership_id), { method: "PATCH", prefer: "return=minimal", body: { status: "active" } });
      return B.J(200, { success: true });
    }

    return B.J(400, { error: "Unknown action" });
  }

  // ───────── everyone: the room ─────────
  const auctionId = String(body.auctionId || "");
  if (!UUID.test(auctionId)) return B.J(400, { error: "Bad auction id" });
  let auction = await auctionById(auctionId);
  if (!auction) return B.J(404, { error: "Auction not found" });

  if (action === "a_poll") {
    auction = await tick(auction);
    const items = await itemsOf(auctionId);
    const current = auction.current_item_id ? items.filter(function (i) { return i.id === auction.current_item_id; })[0] || null : null;
    let feed = [], currentBids = [];
    if (current) {
      currentBids = await bidsOf(current.id);
      feed = currentBids.slice(-30).reverse().map(function (b) {
        return { amountCents: Number(b.amount_cents) || 0, bidder: A.maskEmail(b.bidder_email), at: b.created_at };
      });
    }
    const email = B.safeEmail(body.email);
    let myWin = null;
    if (email) {
      const won = items.filter(function (i) { return i.status === "won" && String(i.winner_email || "").toLowerCase() === email && i.listing_id; })[0];
      if (won) myWin = { itemId: won.id, productHandle: won.product_handle, winningBidCents: won.winning_bid_cents, listingId: won.listing_id };
    }
    return B.J(200, {
      success: true,
      now: new Date().toISOString(),
      auction: pubAuction(auction),
      isOwner: !!owner,
      current: current ? pubItem(current, currentBids) : null,
      feed: feed,
      queue: items.filter(function (i) { return i.status === "queued"; }).map(function (i) { return pubItem(i); }),
      results: items.filter(function (i) { return i.status === "won" || i.status === "unsold"; }).map(function (i) { return pubItem(i); }),
      myWin: myWin
    });
  }

  if (action === "a_bid") {
    const email = B.safeEmail(body.email);
    if (!email) return B.J(400, { error: "Valid email required" });
    if (auction.status !== "live") return B.J(409, { error: "This drop is not live" });
    if (!auction.current_item_id) return B.J(409, { error: "No piece is live right now" });
    const item = await itemById(auction.current_item_id);
    if (!item || item.status !== "live") return B.J(409, { error: "No piece is live right now" });
    const ownership = await ownershipById(item.ownership_id);
    if (ownership && String(ownership.owner_email || "").toLowerCase() === email) return B.J(400, { error: "You cannot bid on your own piece" });
    const bids = await bidsOf(item.id);
    const verdict = A.applyBid({
      startingBidCents: item.starting_bid_cents,
      currentHighCents: highOf(bids),
      endsAtMs: item.ends_at ? new Date(item.ends_at).getTime() : 0
    }, body.amountCents, Date.now());
    if (!verdict.ok) return B.J(409, { error: verdict.reason });
    const ins = await B.sb("bodega_auction_bids", { method: "POST", prefer: "return=representation", body: {
      item_id: item.id, bidder_email: email, amount_cents: verdict.newHighCents
    } });
    if (!ins.ok) return B.J(500, { error: "Could not place bid" });
    if (verdict.extended) {
      await B.sb("bodega_auction_items?id=eq." + encodeURIComponent(item.id), { method: "PATCH", prefer: "return=minimal", body: { ends_at: new Date(verdict.endsAtMs).toISOString() } });
    }
    return B.J(200, { success: true, currentBidCents: verdict.newHighCents, endsAt: new Date(verdict.endsAtMs).toISOString(), extended: verdict.extended });
  }

  if (action === "a_checkout") {
    // Winner-only: creates the same Stripe session bodega-buy creates for the
    // reserved listing, so completion runs the untouched V1 sale path.
    const email = B.safeEmail(body.email);
    if (!email) return B.J(400, { error: "Valid email required" });
    const itemId = String(body.itemId || "");
    if (!UUID.test(itemId)) return B.J(400, { error: "Bad item id" });
    const item = await itemById(itemId);
    if (!item || item.auction_id !== auctionId) return B.J(404, { error: "Item not found" });
    if (item.status !== "won" || !item.listing_id) return B.J(409, { error: "This win is not ready to check out" });
    if (String(item.winner_email || "").toLowerCase() !== email) return B.J(403, { error: "Only the winner can check this piece out" });
    const listing = rows(await B.sb("bodega_listings?id=eq." + encodeURIComponent(item.listing_id) + "&select=*&limit=1"))[0];
    if (!listing) return B.J(404, { error: "Listing not found" });
    if (listing.status !== "active") return B.J(409, { error: "This win has already been settled" });
    const ownership = await ownershipById(listing.ownership_id);
    const handle = ownership ? ownership.product_handle : item.product_handle;
    const entry = CAT.CATALOG[handle];
    const title = entry && entry.title ? entry.title : handle;
    const origin = B.originFromEvent(event);
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: email,
        line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: listing.price_cents, product_data: { name: title + " — Live Drops Win", description: "ALL SALES FINAL." } } }],
        metadata: { product: "BODEGA_RESALE", listing_id: listing.id, email: email },
        custom_text: { submit: { message: "All sales are final." } },
        success_url: origin + "/bodega/?resale_session={CHECKOUT_SESSION_ID}",
        cancel_url: origin + "/bodega/?canceled=1"
      });
      return B.J(200, { url: session.url, sessionId: session.id });
    } catch (e) {
      console.error("bodega-auction checkout failed:", e.message);
      return B.J(500, { error: "Could not start checkout" });
    }
  }

  if (action === "a_av_token") {
    // The host video room on POTENT's own Jitsi — same gate as Smoke Sessions:
    // only while the drop is live, tokens only for people in the room.
    if (!SH.jitsiOn()) return B.J(200, { success: true, available: false });
    if (auction.status !== "live") return B.J(409, { error: "The room opens when the drop goes live" });
    const email = B.safeEmail(body.email);
    const room = "bodega-" + auction.id;
    const isHost = !!owner;
    return B.J(200, {
      success: true, available: true, domain: process.env.JITSI_DOMAIN, room: room,
      jwt: SH.jitsiToken(room, { id: isHost ? "potent-host" : (email || "guest"), name: isHost ? "POTENT Host" : (email ? A.maskEmail(email) : "Guest") }, isHost),
      moderator: isHost
    });
  }

  return B.J(400, { error: "Unknown action" });
};
