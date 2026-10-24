// POST { action: "claim", sessionId } — after a paid Bodega checkout, mint one ownership row per unit bought (idempotent per Stripe session).
// POST { action: "list", email } — the owner's own collection + royalties earned. Purchase prices are never returned.
const crypto = require("crypto");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const B = require("./lib/bodega");
const CAT = require("./lib/bodega-catalog");
const BOX = require("./lib/bodega-boxes");

const HOLD_MS = 180 * 24 * 60 * 60 * 1000;

// The piece's own resale history: sales recorded for this edition (same handle + edition
// label) across its whole ownership chain. The sale that created THIS ownership is
// excluded — a buyer's own purchase price is never returned (the V1 rule above).
async function saleHistoryFor(ownership) {
  if (!ownership.edition_label) return [];
  const chain = await B.sb("bodega_ownership?product_handle=eq." + encodeURIComponent(ownership.product_handle) + "&edition_label=eq." + encodeURIComponent(ownership.edition_label) + "&select=id&limit=500");
  const chainIds = (chain.ok && Array.isArray(chain.data) ? chain.data : []).map(function (r) { return r.id; });
  if (!chainIds.length) return [];
  const lis = await B.sb("bodega_listings?ownership_id=in.(" + chainIds.join(",") + ")&select=id&limit=500");
  const listingIds = (lis.ok && Array.isArray(lis.data) ? lis.data : []).map(function (r) { return r.id; });
  if (!listingIds.length) return [];
  const sal = await B.sb("bodega_sales?listing_id=in.(" + listingIds.join(",") + ")&select=price_cents,sold_at&order=sold_at.desc&limit=50");
  const mine = new Date(ownership.purchased_at).getTime();
  return (sal.ok && Array.isArray(sal.data) ? sal.data : [])
    .filter(function (s) { return Math.abs(new Date(s.sold_at).getTime() - mine) > 10 * 60 * 1000; })
    .map(function (s) { return { priceCents: s.price_cents, soldAt: s.sold_at }; });
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return B.J(500, { error: "Server not configured" });
  let body; try { body = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  const action = String(body.action || "claim");

  if (action === "list") {
    const email = B.safeEmail(body.email);
    if (!email) return B.J(400, { error: "Valid email required" });
    const collector = await B.collectorByEmail(email);
    const own = await B.sb("bodega_ownership?owner_email=eq." + encodeURIComponent(email) + "&status=in.(active,listed,auction)&select=id,product_handle,edition_label,purchased_at,hold_until,resale_floor_cents,status&order=purchased_at.desc&limit=500");
    const roy = await B.sb("bodega_royalty_ledger?payee_email=eq." + encodeURIComponent(email) + "&select=id,role,amount_cents,sale_id,created_at&order=created_at.desc&limit=100");
    const ownRows = own.ok && Array.isArray(own.data) ? own.data : [];
    const ownerships = [];
    for (let i = 0; i < ownRows.length; i++) {
      const o = ownRows[i];
      ownerships.push({ id: o.id, productHandle: o.product_handle, editionLabel: o.edition_label, purchasedAt: o.purchased_at, holdUntil: o.hold_until, resaleFloorCents: o.resale_floor_cents, status: o.status, saleHistory: await saleHistoryFor(o) });
    }
    const royalties = (roy.ok && Array.isArray(roy.data) ? roy.data : []).map(function (r) {
      return { id: r.id, role: r.role, amountCents: r.amount_cents, saleId: r.sale_id, createdAt: r.created_at };
    });
    return B.J(200, { success: true, collectorNo: collector ? collector.collector_no : null, ownerships: ownerships, royalties: royalties });
  }

  if (action !== "claim") return B.J(400, { error: "Unknown action" });
  if (!CAT.isLoaded()) return B.J(500, { error: "Catalog not loaded" });
  const id = String(body.sessionId || "");
  if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(id)) return B.J(400, { error: "Bad session" });
  try {
    const session = await stripe.checkout.sessions.retrieve(id);
    if (!session.metadata || session.metadata.product !== "BODEGA") return B.J(400, { error: "Not a Bodega purchase" });
    if (session.payment_status !== "paid") return B.J(402, { error: "Payment not confirmed yet" });
    const buyer = B.safeEmail((session.customer_details && session.customer_details.email) || session.metadata.email);
    if (!buyer) return B.J(400, { error: "No buyer email on session" });
    const collector = await B.getOrCreateCollector(buyer);
    if (!collector) return B.J(500, { error: "Could not create collector" });

    const items = CAT.decodeItems(session.metadata.items || "");
    const holdUntil = new Date(Date.now() + HOLD_MS).toISOString();
    let created = 0;
    let boxes = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const entry = CAT.CATALOG[it.handle];
      if (!entry) continue;
      // Mystery boxes: contents are unnamed at purchase, so NO ownership is minted.
      // One fulfillment record per box (per session) for the owner to fill by hand.
      if (BOX.isBox(it.handle)) {
        const box = BOX.boxFor(it.handle);
        const ex = await B.sb("bodega_box_orders?stripe_session_id=eq." + encodeURIComponent(session.id) + "&box_key=eq." + encodeURIComponent(box.key) + "&select=id&limit=1");
        if (ex.ok && Array.isArray(ex.data) && ex.data.length) continue; // already recorded — idempotent
        const ins = await B.sb("bodega_box_orders", { method: "POST", prefer: "return=representation", body: {
          box_key: box.key,
          buyer_email: buyer,
          price_cents: entry.priceCents * it.qty,
          qty: it.qty,
          stripe_session_id: session.id,
          status: "pending_fulfillment",
          contents_checklist: box.contents
        } });
        if (ins.ok && Array.isArray(ins.data) && ins.data.length) boxes++;
        else {
          const re = await B.sb("bodega_box_orders?stripe_session_id=eq." + encodeURIComponent(session.id) + "&box_key=eq." + encodeURIComponent(box.key) + "&select=id&limit=1");
          if (!(re.ok && Array.isArray(re.data) && re.data.length)) return B.J(500, { error: "Could not record box order" });
        }
        continue;
      }
      for (let u = 0; u < it.qty; u++) {
        const sourceRef = session.id + "|" + it.handle + "|" + u;
        const ex = await B.sb("bodega_ownership?source_ref=eq." + encodeURIComponent(sourceRef) + "&select=id&limit=1");
        if (ex.ok && Array.isArray(ex.data) && ex.data.length) continue; // already claimed — idempotent
        const ins = await B.sb("bodega_ownership", { method: "POST", prefer: "return=representation", body: {
          product_handle: it.handle,
          owner_email: buyer,
          edition_label: "POTENT-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
          purchase_price_cents: entry.priceCents,
          source_ref: sourceRef,
          status: "active",
          hold_until: holdUntil,
          resale_floor_cents: entry.floorCents,
          creator_key: "POTENT",
          original_buyer_email: buyer
        } });
        if (ins.ok && Array.isArray(ins.data) && ins.data.length) created++;
        else {
          // Unique-violation race on source_ref also counts as already claimed.
          const re = await B.sb("bodega_ownership?source_ref=eq." + encodeURIComponent(sourceRef) + "&select=id&limit=1");
          if (!(re.ok && Array.isArray(re.data) && re.data.length)) return B.J(500, { error: "Could not record ownership" });
        }
      }
    }
    return B.J(200, { success: true, created: created, boxes: boxes, collectorNo: collector.collector_no });
  } catch (e) {
    console.error("bodega-ownership claim failed:", e.message);
    return B.J(500, { error: "Could not claim ownership" });
  }
};
