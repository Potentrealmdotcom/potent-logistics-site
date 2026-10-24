// POTENT Bodega V2 tests — marketing data, mystery boxes, bid/ask matching + market
// stats, and the Live Drops auction state machine (lib + handler level with an
// in-memory PostgREST mock). Also locks the V1 royalty split so V2 can't regress it.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Module = require("module");

// The stripe package is installed by Netlify at deploy, not vendored in this clone. Stub the
// module (same pattern as tests/beat-maker-packs.test.js) — these tests never complete a
// Stripe call; checkout creation is exercised only up to the DB layer.
const origLoad = Module._load;
Module._load = function (req) {
  if (req === "stripe") return function () { return { checkout: { sessions: { create: async () => { throw new Error("stripe is stubbed in tests"); }, retrieve: async () => { throw new Error("stripe is stubbed in tests"); } } } }; };
  return origLoad.apply(this, arguments);
};

const ROOT = path.join(__dirname, "..");
const FN = path.join(ROOT, "netlify", "functions");
const LIB = path.join(FN, "lib");

process.env.SUPABASE_URL = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.STRIPE_SECRET_KEY = "sk_test_bodega_v2";
process.env.AUTH_SECRET = "bodega-v2-test-secret";
process.env.SITE_URL = "https://potentoperations.netlify.app";

let pass = 0;
function ok(cond, label) { if (cond) { pass++; } else { console.error("FAIL:", label); process.exitCode = 1; } }
function eq(a, b, label) { ok(a === b, label + " (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")"); }
function read(p) { return fs.readFileSync(p, "utf8"); }

// ───────────────────────── 1. V1 regression: royalty split ─────────────────────────
{
  const B = require(path.join(LIB, "bodega.js"));
  const s = B.royaltySplit(100000); // the canonical $1,000 example
  eq(s.creator, 2500, "V1 split: creator 2.5% of $1,000 = $25");
  eq(s.originalBuyer, 1500, "V1 split: original buyer 1.5% of $1,000 = $15");
  eq(s.platform, 1000, "V1 split: POTENT 1% of $1,000 = $10");
  eq(s.sellerPayout, 95000, "V1 split: seller keeps 95% = $950");
  eq(s.creator + s.originalBuyer + s.platform + s.sellerPayout, 100000, "V1 split sums to the price");
  eq(B.safeEmail("  Buyer@Example.COM "), "buyer@example.com", "safeEmail normalizes");
  eq(B.safeEmail("not-an-email"), "", "safeEmail rejects junk");
}

// ───────────────────────── 2. Mystery boxes (lib + catalogs) ─────────────────────────
{
  const BOX = require(path.join(LIB, "bodega-boxes.js"));
  eq(BOX.HANDLES.length, 4, "four mystery boxes");
  const want = {
    "mystery-box-platinum": { price: 29900, value: 59800, items: 3 },
    "mystery-box-diamond": { price: 49900, value: 99800, items: 4 },
    "mystery-box-vault": { price: 89900, value: 179800, items: 4 },
    "mystery-box-black-label": { price: 149900, value: 299800, items: 7 }
  };
  BOX.HANDLES.forEach(function (h) {
    const b = BOX.boxFor(h), w = want[h];
    ok(!!b, "box exists: " + h);
    eq(b.priceCents, w.price, h + " price");
    eq(b.valueCents, w.value, h + " guaranteed value");
    eq(b.valueCents, b.priceCents * 2, h + " guarantees exactly 2x value");
    eq(b.contents.length, w.items, h + " contents checklist length");
    ok(BOX.isBox(h), "isBox: " + h);
  });
  // ALL SALES FINAL rides on the customer-facing catalog descriptions.
  const clientCatalog = JSON.parse(read(path.join(ROOT, "bodega", "catalog.json")));
  BOX.HANDLES.forEach(function (h) {
    const entry = clientCatalog.find(function (p) { return p.handle === h; });
    ok(!!entry && /ALL SALES FINAL/.test(entry.description || ""), h + " catalog description carries ALL SALES FINAL");
    ok(!!entry && /2x|2×|at least 2/.test(entry.description || ""), h + " catalog description states the 2x value guarantee");
  });
  ok(!BOX.isBox("some-jeans"), "isBox rejects catalog pieces");
  ok(/Vault Hit/.test(BOX.boxFor("mystery-box-vault").contents.join(" ")), "Vault box contents mention the Vault Hit chance");

  ["bodega/catalog.json", "bodega/server-catalog.json", "netlify/functions/lib/bodega-server-catalog.json"].forEach(function (rel) {
    const data = JSON.parse(read(path.join(ROOT, rel)));
    const list = Array.isArray(data) ? data : Object.keys(data).map(function (k) { return data[k]; });
    eq(list.length, 317, rel + " carries 313 pieces + 4 boxes");
    BOX.HANDLES.forEach(function (h) {
      const entry = Array.isArray(data) ? list.find(function (p) { return p.handle === h; }) : data[h];
      ok(!!entry, rel + " has " + h);
      const cents = entry.priceCents != null ? entry.priceCents : Math.round(Number(entry.price) * 100);
      eq(cents, BOX.boxFor(h).priceCents, rel + " " + h + " server/client price matches the box lib");
    });
  });
}

// ───────────────────────── 3. Auction state machine (pure lib) ─────────────────────────
{
  const A = require(path.join(LIB, "bodega-auction.js"));
  const T0 = 1000000000000;
  eq(A.clampDuration(5), 15, "duration clamps to 15s min");
  eq(A.clampDuration(99999), 600, "duration clamps to 600s max");
  eq(A.clampDuration(0), 120, "duration defaults to 120s");
  eq(A.startEndsAt(T0, 120), T0 + 120000, "startEndsAt adds the duration");

  const live = { startingBidCents: 50000, currentHighCents: 0, endsAtMs: T0 + 120000 };
  let r = A.applyBid(live, 49999, T0);
  eq(r.ok, false, "first bid below the starting bid is rejected");
  r = A.applyBid(live, 50000, T0);
  eq(r.ok, true, "first bid at the starting bid is accepted");
  eq(r.newHighCents, 50000, "high bid updates");
  eq(r.extended, false, "no extension with plenty of clock left");

  const led = { startingBidCents: 50000, currentHighCents: 50000, endsAtMs: T0 + 120000 };
  eq(A.applyBid(led, 50000, T0).ok, false, "a bid equal to the high bid is rejected");
  eq(A.applyBid(led, 50001, T0).ok, true, "a bid above the high bid is accepted");
  eq(A.applyBid(led, 60000, T0 + 120000).ok, false, "bids after the countdown ends are rejected");
  eq(A.applyBid(null, 60000, T0).ok, false, "no live piece -> no bid");

  // anti-snipe: 10s left -> +15s
  r = A.applyBid({ startingBidCents: 50000, currentHighCents: 50000, endsAtMs: T0 + 10000 }, 60000, T0);
  eq(r.ok, true, "late bid accepted");
  eq(r.extended, true, "bid inside the last 15s extends the clock");
  eq(r.endsAtMs, T0 + 25000, "extension is exactly +15s");
  // 20s left -> no extension
  r = A.applyBid({ startingBidCents: 50000, currentHighCents: 50000, endsAtMs: T0 + 20000 }, 60000, T0);
  eq(r.extended, false, "bid with 20s left does not extend");

  const won = A.settleItem([
    { bidder_email: "a@x.com", amount_cents: 70000, created_at: new Date(T0).toISOString() },
    { bidder_email: "b@x.com", amount_cents: 90000, created_at: new Date(T0 + 1000).toISOString() },
    { bidder_email: "c@x.com", amount_cents: 90000, created_at: new Date(T0 + 2000).toISOString() }
  ]);
  eq(won.outcome, "won", "settle: highest bid wins");
  eq(won.winnerEmail, "b@x.com", "settle: tie goes to the earliest top bid");
  eq(won.winningBidCents, 90000, "settle: winning amount");
  eq(A.settleItem([]).outcome, "unsold", "settle: no bids -> unsold");
  eq(A.maskEmail("collector@example.com"), "co***@example.com", "maskEmail hides the address");
  ok(A.maskEmail("collector@example.com").indexOf("collector@") === -1, "maskEmail never leaks a full email");
}

// ───────────────────────── 4. In-memory PostgREST mock ─────────────────────────
function makeMock(seed) {
  const tables = {};
  Object.keys(seed || {}).forEach(function (k) { tables[k] = (seed[k] || []).map(function (r) { return Object.assign({}, r); }); });
  let seq = 1000;
  function nid() { seq++; return "00000000-0000-4000-8000-" + String(seq).padStart(12, "0"); }
  const EMBEDS = { listing: { table: "bodega_listings", fk: "listing_id" }, ownership: { table: "bodega_ownership", fk: "ownership_id" } };

  function filtered(table, params) {
    let rows = (tables[table] || []).slice();
    params.forEach(function (v, k) {
      if (["select", "order", "limit", "offset"].indexOf(k) !== -1) return;
      const m = /^(eq|neq|gt|gte|lt|lte|in|is)\.(.*)$/.exec(v);
      if (!m) return;
      const op = m[1], val = m[2];
      rows = rows.filter(function (row) {
        const rv = row[k];
        if (op === "is") return val === "null" ? rv == null : String(rv) === val;
        if (op === "in") return val.replace(/^\(|\)$/g, "").split(",").indexOf(String(rv)) !== -1;
        if (op === "eq") return String(rv) === val;
        if (op === "neq") return String(rv) !== val;
        const n = Number(rv), nv = Number(val);
        if (op === "gt") return n > nv; if (op === "gte") return n >= nv;
        if (op === "lt") return n < nv; if (op === "lte") return n <= nv;
        return true;
      });
    });
    const order = params.get("order");
    if (order) {
      order.split(",").reverse().forEach(function (part) {
        const bits = part.split(".");
        const col = bits[0], dir = bits[1] === "desc" ? -1 : 1;
        rows.sort(function (a, b) {
          const av = a[col], bv = b[col];
          if (av == null && bv == null) return 0;
          if (av == null) return 1; if (bv == null) return -1;
          if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
          return String(av) < String(bv) ? -dir : String(av) > String(bv) ? dir : 0;
        });
      });
    }
    const off = Number(params.get("offset") || 0);
    const lim = params.get("limit") ? Number(params.get("limit")) : null;
    if (off) rows = rows.slice(off);
    if (lim != null) rows = rows.slice(0, lim);
    return rows;
  }
  function withEmbeds(table, rows, select) {
    if (!select) return rows;
    const found = [];
    const re = /(\w+):(\w+)\(/g; let m;
    while ((m = re.exec(select))) found.push(m[1]);
    if (!found.length) return rows;
    return rows.map(function (row) {
      const out = Object.assign({}, row);
      found.forEach(function (alias) {
        const e = EMBEDS[alias];
        if (!e) return;
        const target = (tables[e.table] || []).find(function (r) { return r.id === row[e.fk]; });
        out[alias] = target ? Object.assign({}, target) : null;
      });
      return out;
    });
  }
  async function fetchMock(url, opts) {
    opts = opts || {};
    const u = new URL(url);
    const m = /\/rest\/v1\/([a-z_]+)$/.exec(u.pathname);
    if (!m) throw new Error("mock: unrouted URL " + url);
    const table = m[1];
    if (!tables[table]) tables[table] = [];
    const method = (opts.method || "GET").toUpperCase();
    let data = null, status = 200;
    if (method === "GET") {
      data = withEmbeds(table, filtered(table, u.searchParams), u.searchParams.get("select"));
    } else if (method === "POST") {
      const body = JSON.parse(opts.body || "{}");
      const list = Array.isArray(body) ? body : [body];
      data = list.map(function (row) {
        const r = Object.assign({}, row);
        if (!r.id) r.id = nid();
        if (!r.created_at) r.created_at = new Date().toISOString();
        tables[table].push(r);
        return r;
      });
      status = 201;
    } else if (method === "PATCH") {
      const body = JSON.parse(opts.body || "{}");
      const rows = filtered(table, u.searchParams);
      rows.forEach(function (r) { Object.assign(r, body); });
      data = rows;
    } else if (method === "DELETE") {
      const rows = filtered(table, u.searchParams);
      tables[table] = tables[table].filter(function (r) { return rows.indexOf(r) === -1; });
      data = rows;
    }
    return { ok: status < 300, status: status, text: async function () { return JSON.stringify(data); } };
  }
  return { tables: tables, fetch: fetchMock };
}
function callFn(fn, method, body, headers) {
  return fn.handler({ httpMethod: method, headers: headers || {}, body: body ? JSON.stringify(body) : "", queryStringParameters: {} })
    .then(function (res) { return { status: res.statusCode, data: JSON.parse(res.body) }; });
}
function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function ownerHeaders() {
  const p = b64u(JSON.stringify({ role: "owner", name: "Owner", exp: Date.now() + 3600000 }));
  const sig = b64u(crypto.createHmac("sha256", process.env.AUTH_SECRET).update(p).digest());
  return { authorization: "Bearer " + p + "." + sig };
}
const UUID1 = "11111111-1111-4111-8111-111111111111";
const UUID2 = "22222222-2222-4222-8222-222222222222";
const UUID3 = "33333333-3333-4333-8333-333333333333";
const UUID4 = "44444444-4444-4444-8444-444444444444";

// ───────────────────────── 5. Bid/ask matching (handler) ─────────────────────────
async function bidTests() {
  const mock = makeMock({
    bodega_collectors: [],
    bodega_ownership: [
      { id: UUID1, owner_email: "seller@x.com", product_handle: "jeans-x", status: "listed" }
    ],
    bodega_listings: [
      { id: UUID2, ownership_id: UUID1, seller_email: "seller@x.com", price_cents: 100000, status: "active", source: "market", created_at: new Date(Date.now() - 86400000).toISOString() }
    ],
    bodega_bids: []
  });
  global.fetch = mock.fetch;
  delete require.cache[require.resolve(path.join(FN, "bodega-bid.js"))];
  const bid = require(path.join(FN, "bodega-bid.js"));

  let r = await callFn(bid, "POST", { action: "place", email: "buyer@x.com", listingId: UUID2, amountCents: 50000 });
  eq(r.status, 200, "bid: place below ask succeeds");
  eq(r.data.matched, false, "bid: below ask does not match");
  eq(r.data.bid.status, "active", "bid: below ask stays active");
  const expDays = (new Date(r.data.bid.expiresAt).getTime() - Date.now()) / 86400000;
  ok(expDays > 6.9 && expDays <= 7.01, "bid: default expiry is 7 days");

  r = await callFn(bid, "POST", { action: "place", email: "buyer2@x.com", listingId: UUID2, amountCents: 100000 });
  eq(r.data.matched, true, "bid: at the ask matches instantly");
  eq(r.data.bid.status, "matched", "bid: matched status recorded");

  r = await callFn(bid, "POST", { action: "place", email: "seller@x.com", listingId: UUID2, amountCents: 100000 });
  eq(r.status, 400, "bid: cannot bid on your own piece");

  r = await callFn(bid, "POST", { action: "for_listing", listingId: UUID2 });
  eq(r.data.highestBidCents, 100000, "bid: public highest bid is the matched one");
  eq(r.data.bidCount, 2, "bid: public count covers both live bids");
  ok(JSON.stringify(r.data).indexOf("@x.com") === -1, "bid: public view exposes no emails");

  // a fresh bid from buyer@x.com replaces their earlier one
  r = await callFn(bid, "POST", { action: "place", email: "buyer@x.com", listingId: UUID2, amountCents: 60000 });
  eq(r.status, 200, "bid: re-bid succeeds");
  const buyerRows = mock.tables.bodega_bids.filter(function (b) { return b.bidder_email === "buyer@x.com"; });
  eq(buyerRows.filter(function (b) { return b.status === "cancelled"; }).length, 1, "bid: the replaced bid is cancelled");
  eq(buyerRows.filter(function (b) { return b.status === "active"; }).length, 1, "bid: the new bid is the live one");

  // seller accepts the 60000 bid -> matched for checkout at the bid price
  const liveBid = buyerRows.filter(function (b) { return b.status === "active"; })[0];
  r = await callFn(bid, "POST", { action: "accept", email: "intruder@x.com", bidId: liveBid.id });
  eq(r.status, 403, "bid: only the seller can accept");
  r = await callFn(bid, "POST", { action: "accept", email: "seller@x.com", bidId: liveBid.id });
  eq(r.status, 200, "bid: seller accept succeeds");
  eq(r.data.bid.status, "accepted", "bid: accepted status");
  eq(r.data.matched, true, "bid: accept = match");

  // bidder withdraws
  r = await callFn(bid, "POST", { action: "cancel", email: "buyer2@x.com", bidId: mock.tables.bodega_bids.find(function (b) { return b.bidder_email === "buyer2@x.com"; }).id });
  eq(r.status, 200, "bid: bidder can withdraw");
  r = await callFn(bid, "POST", { action: "for_listing", listingId: UUID2 });
  eq(r.data.highestBidCents, 60000, "bid: highest falls to the accepted bid after withdrawal");
  eq(r.data.bidCount, 1, "bid: withdrawn bid leaves the count");

  // expired bids never count
  mock.tables.bodega_bids.push({ id: UUID3, listing_id: UUID2, bidder_email: "ghost@x.com", amount_cents: 999999, status: "active", expires_at: new Date(Date.now() - 1000).toISOString(), created_at: new Date().toISOString() });
  r = await callFn(bid, "POST", { action: "for_listing", listingId: UUID2 });
  eq(r.data.highestBidCents, 60000, "bid: expired bids are invisible");
}

// ───────────────────────── 6. Market stats (handler) ─────────────────────────
async function marketTests() {
  const T1 = new Date(Date.now() - 30 * 86400000).toISOString();
  const T2 = new Date(Date.now() - 10 * 86400000).toISOString();
  const mock = makeMock({
    bodega_ownership: [
      { id: UUID1, owner_email: "now@x.com", product_handle: "jeans-x", edition_label: "Vault #001", resale_floor_cents: 80000, purchased_at: T2, status: "listed" },
      { id: UUID4, owner_email: "first@x.com", product_handle: "jeans-x", edition_label: "Vault #001", resale_floor_cents: 80000, purchased_at: T1, status: "sold" }
    ],
    bodega_listings: [
      { id: UUID2, ownership_id: UUID1, seller_email: "seller@x.com", price_cents: 100000, status: "active", source: "market", created_at: T2 },
      { id: UUID3, ownership_id: UUID4, seller_email: "winner@x.com", price_cents: 70000, status: "active", source: "auction", reserved_email: "winner@x.com", created_at: T2 }
    ],
    bodega_sales: [
      { id: "s1", product_handle: "jeans-x", price_cents: 90000, sold_at: T1 },
      { id: "s2", product_handle: "jeans-x", price_cents: 110000, sold_at: T2 },
      { id: "s3", product_handle: "tee-y", price_cents: 50000, sold_at: T2 }
    ],
    bodega_royalty_ledger: [{ id: "l1" }, { id: "l2" }, { id: "l3" }, { id: "l4" }, { id: "l5" }, { id: "l6" }],
    bodega_bids: [
      { id: "b1", listing_id: UUID2, bidder_email: "b@x.com", amount_cents: 55000, status: "active", expires_at: new Date(Date.now() + 86400000).toISOString(), created_at: T2 },
      { id: "b2", listing_id: UUID2, bidder_email: "c@x.com", amount_cents: 9900000, status: "active", expires_at: new Date(Date.now() - 1000).toISOString(), created_at: T2 }
    ]
  });
  global.fetch = mock.fetch;
  delete require.cache[require.resolve(path.join(FN, "bodega-market.js"))];
  const market = require(path.join(FN, "bodega-market.js"));
  const r = await callFn(market, "GET", null);
  eq(r.status, 200, "market: loads");
  eq(r.data.listings.length, 1, "market: auction-reserved listings never appear");
  const l = r.data.listings[0];
  eq(l.highestBidCents, 55000, "market: highest live bid shown (expired ignored)");
  eq(l.bidCount, 1, "market: bid count is live bids only");
  eq(l.lastSaleCents, 110000, "market: last sale is the most recent sale");
  eq(l.historyCount, 2, "market: history count = sales for the handle");
  eq(l.chain.length, 2, "market: ownership chain carries both owners");
  ok(l.chain.every(function (c) { return !("email" in c) && !("priceCents" in c); }), "market: chain has no emails and no prices");
  eq(r.data.pieceStats["jeans-x"].timesSold, 2, "stats: times sold per piece");
  eq(r.data.pieceStats["jeans-x"].history[0].priceCents, 110000, "stats: price history newest first");
  eq(r.data.stats.totalPiecesSold, 3, "stats: total pieces sold");
  eq(r.data.stats.totalVolumeCents, 250000, "stats: total resale volume");
  eq(r.data.stats.royaltyPayouts, 6, "stats: royalty payouts = ledger rows");
  ok(JSON.stringify(r.data).indexOf("@x.com") === -1, "market: no email leaks anywhere in the payload");
}

// ───────────────────────── 7. Live Drops lifecycle (handler) ─────────────────────────
async function auctionTests() {
  const past = new Date(Date.now() - 86400000).toISOString();
  const mock = makeMock({
    bodega_collectors: [],
    bodega_ownership: [
      { id: UUID1, owner_email: "seller@x.com", product_handle: "jeans-x", edition_label: "Vault #001", resale_floor_cents: 50000, hold_until: past, purchased_at: past, status: "active", creator_email: "creator@x.com", original_buyer_email: "orig@x.com" },
      { id: UUID4, owner_email: "seller@x.com", product_handle: "tee-y", edition_label: "Vault #002", resale_floor_cents: 10000, hold_until: past, purchased_at: past, status: "active", creator_email: "creator@x.com", original_buyer_email: "orig@x.com" }
    ],
    bodega_listings: [], bodega_auctions: [], bodega_auction_items: [], bodega_auction_bids: []
  });
  global.fetch = mock.fetch;
  delete require.cache[require.resolve(path.join(FN, "bodega-auction.js"))];
  const auction = require(path.join(FN, "bodega-auction.js"));
  const OH = ownerHeaders();

  let r = await callFn(auction, "POST", { action: "o_create", title: "Friday Drop" });
  eq(r.status, 403, "auction: owner actions need the owner token");
  r = await callFn(auction, "POST", { action: "o_create", title: "Friday Drop" }, OH);
  eq(r.status, 200, "auction: owner creates a drop");
  const aid = r.data.auction.id;
  eq(r.data.auction.status, "scheduled", "auction: starts scheduled");

  r = await callFn(auction, "POST", { action: "o_add_item", auctionId: aid, ownershipId: UUID1, startingBidCents: 40000, durationSeconds: 120 }, OH);
  eq(r.status, 422, "auction: starting bid below the resale floor is refused");
  r = await callFn(auction, "POST", { action: "o_add_item", auctionId: aid, ownershipId: UUID1, startingBidCents: 50000, durationSeconds: 120 }, OH);
  eq(r.status, 200, "auction: piece queued at the floor");
  const item1 = r.data.item.id;
  eq(mock.tables.bodega_ownership.find(function (o) { return o.id === UUID1; }).status, "auction", "auction: queued piece is locked as 'auction'");
  r = await callFn(auction, "POST", { action: "o_add_item", auctionId: aid, ownershipId: UUID1, startingBidCents: 50000 }, OH);
  eq(r.status, 409, "auction: the same piece cannot queue twice");

  r = await callFn(auction, "POST", { action: "o_add_item", auctionId: aid, ownershipId: UUID4, startingBidCents: 20000, durationSeconds: 120 }, OH);
  eq(r.status, 200, "auction: second piece queued");
  const item2 = r.data.item.id;

  r = await callFn(auction, "POST", { action: "o_start", auctionId: aid }, OH);
  eq(r.status, 200, "auction: drop goes live");
  r = await callFn(auction, "POST", { action: "a_poll", auctionId: aid });
  eq(r.data.auction.status, "live", "auction: poll shows live");
  eq(r.data.current.id, item1, "auction: first queued piece is live first");
  ok(!!r.data.current.endsAt, "auction: live piece carries a countdown end");

  // bidding rules in the room
  r = await callFn(auction, "POST", { action: "a_bid", auctionId: aid, email: "seller@x.com", amountCents: 60000 });
  eq(r.status, 400, "auction: you cannot bid on your own piece");
  r = await callFn(auction, "POST", { action: "a_bid", auctionId: aid, email: "b1@x.com", amountCents: 49999 });
  eq(r.status, 409, "auction: bid below the starting bid refused");
  r = await callFn(auction, "POST", { action: "a_bid", auctionId: aid, email: "b1@x.com", amountCents: 60000 });
  eq(r.status, 200, "auction: opening bid lands");
  eq(r.data.currentBidCents, 60000, "auction: high bid updates");
  r = await callFn(auction, "POST", { action: "a_bid", auctionId: aid, email: "b2@x.com", amountCents: 60000 });
  eq(r.status, 409, "auction: tie bid refused — must beat the high bid");

  // anti-snipe end-to-end: squeeze the clock to 10s, then bid
  const row1 = mock.tables.bodega_auction_items.find(function (i) { return i.id === item1; });
  row1.ends_at = new Date(Date.now() + 10000).toISOString();
  const beforeEnds = new Date(row1.ends_at).getTime();
  r = await callFn(auction, "POST", { action: "a_bid", auctionId: aid, email: "b2@x.com", amountCents: 70000 });
  eq(r.status, 200, "auction: late bid lands");
  eq(r.data.extended, true, "auction: late bid extends the countdown");
  ok(new Date(row1.ends_at).getTime() >= beforeEnds + 14000, "auction: ends_at grew by ~15s");

  // feed is masked
  r = await callFn(auction, "POST", { action: "a_poll", auctionId: aid, email: "b2@x.com" });
  ok(r.data.feed.length >= 2, "auction: poll returns the bid feed");
  ok(JSON.stringify(r.data.feed).indexOf("b1@x.com") === -1 && JSON.stringify(r.data.feed).indexOf("b2@x.com") === -1, "auction: feed never shows full emails");

  // run the clock out -> poll settles: winner + reserved listing; next piece starts
  row1.ends_at = new Date(Date.now() - 1000).toISOString();
  r = await callFn(auction, "POST", { action: "a_poll", auctionId: aid, email: "b2@x.com" });
  const res1 = r.data.results.find(function (x) { return x.id === item1; });
  eq(res1.status, "won", "auction: piece settles as won when the clock dies");
  eq(res1.winningBidCents, 70000, "auction: winning price is the high bid");
  ok(!!r.data.myWin && r.data.myWin.itemId === item1, "auction: the winner sees their win");
  const reserved = mock.tables.bodega_listings.find(function (l) { return l.source === "auction"; });
  ok(!!reserved, "auction: a reserved listing is minted for the winner");
  eq(reserved.price_cents, 70000, "auction: reserved listing is priced at the winning bid");
  eq(reserved.reserved_email, "b2@x.com", "auction: reserved for the winner only");
  eq(reserved.seller_email, "seller@x.com", "auction: reserved listing keeps the seller");
  eq(mock.tables.bodega_ownership.find(function (o) { return o.id === UUID1; }).status, "auction", "auction: ownership stays locked until the winner pays");
  eq(r.data.current.id, item2, "auction: the next queued piece goes live automatically");

  // winner never pays -> owner releases: listing cancelled, piece freed
  r = await callFn(auction, "POST", { action: "o_release", auctionId: aid, itemId: item1 }, OH);
  eq(r.status, 200, "auction: owner can release an unpaid win");
  eq(mock.tables.bodega_listings.find(function (l) { return l.id === reserved.id; }).status, "cancelled", "auction: release cancels the reserved listing");
  eq(mock.tables.bodega_ownership.find(function (o) { return o.id === UUID1; }).status, "active", "auction: release frees the piece");

  // second piece gets no bids -> unsold, returns to the owner
  const row2 = mock.tables.bodega_auction_items.find(function (i) { return i.id === item2; });
  row2.ends_at = new Date(Date.now() - 1000).toISOString();
  r = await callFn(auction, "POST", { action: "a_poll", auctionId: aid });
  const res2 = r.data.results.find(function (x) { return x.id === item2; });
  eq(res2.status, "unsold", "auction: no bids -> unsold");
  eq(mock.tables.bodega_ownership.find(function (o) { return o.id === UUID4; }).status, "active", "auction: unsold piece returns to its owner");
  eq(r.data.auction.status, "live", "auction: room stays live after the queue drains (host ends it)");
  r = await callFn(auction, "POST", { action: "o_end", auctionId: aid }, OH);
  eq(r.status, 200, "auction: owner ends the drop");
  r = await callFn(auction, "POST", { action: "a_poll", auctionId: aid });
  eq(r.data.auction.status, "ended", "auction: poll shows ended");
}

// ───────────────────────── 8. Static checks ─────────────────────────
{
  const schema = read(path.join(ROOT, "bodega-v2-schema.sql"));
  ["bodega_bids", "bodega_box_orders", "bodega_auctions", "bodega_auction_items", "bodega_auction_bids"].forEach(function (t) {
    ok(new RegExp("create table if not exists " + t).test(schema), "schema: creates " + t);
    ok(new RegExp("alter table " + t + " enable row level security").test(schema), "schema: RLS on " + t);
  });
  ok(/add column if not exists source/.test(schema) && /add column if not exists reserved_email/.test(schema), "schema: listings gain source + reserved_email");
  ok(!/create table bodega_/.test(schema.replace(/if not exists/g, "")), "schema: every table create is run-once-safe");

  const html = read(path.join(ROOT, "bodega", "index.html"));
  ok(html.indexOf("https://voice.potentworld.online/static/bodega/media/aegis-key-promo.mp4") !== -1, "page: promo video wired");
  ok(html.indexOf("https://voice.potentworld.online/static/bodega/media/aegis-key-card.mov") !== -1, "page: key video wired");
  ok(/FIRST FASHION LINE WITH ROYALTIES/.test(html), "page: royalties headline present");
  ["$950", "$25", "$15", "$10"].forEach(function (s) { ok(html.indexOf(s) !== -1, "page: $1,000 example shows " + s); });
  ok(/can.t copy the history/i.test(html), "page: verified-history line present");
  ok(/not a guarantee of cash resale value or profit/.test(html), "page: honest disclaimer present");
  ok(/AEGIS KEY/.test(html) && /1-of-1/.test(html), "page: Aegis Key explainer presents the one physical key as 1-of-1");
  ok(!/stockx/i.test(html.replace(/StockX-style/g, "")), "page: no StockX branding beyond the UX reference");

  const live = read(path.join(ROOT, "bodega", "live.html"));
  ok(/meet|JitsiMeetExternalAPI/.test(live), "live room: Jitsi host-video slot present");
  ok(/a_poll/.test(live), "live room: poll-based sync like Smoke Sessions");
  ok(/15 seconds/.test(live), "live room: anti-snipe rule explained in the room");

  const js = read(path.join(ROOT, "bodega", "bodega.js"));
  ["bodega-bid", "bodega-auction"].forEach(function (f) { ok(js.indexOf(f) !== -1, "client: wires " + f); });
  ok(/ELIGIBLE TO LIST/.test(js), "client: hold flip reads ELIGIBLE TO LIST");

  const buy = read(path.join(FN, "bodega-buy.js"));
  ok(/bidId/.test(buy) && /agreed_price_cents/.test(buy), "buy: executes matched bids at the agreed price through the V1 flow");
  const own = read(path.join(FN, "bodega-ownership.js"));
  ok(/bodega_box_orders/.test(own) && /BOX/.test(own), "ownership: box purchases write fulfillment records, not ownership");
}

(async function main() {
  await bidTests();
  await marketTests();
  await auctionTests();
  console.log("bodega-v2.test.js: PASS " + pass + " assertions");
})().catch(function (e) { console.error("FAIL (exception):", e && e.stack || e); process.exit(1); });
