// POST { action: "claim", sessionId } — after a paid Bodega checkout, mint one ownership row per unit bought (idempotent per Stripe session).
// POST { action: "list", email } — the owner's own collection + royalties earned. Purchase prices are never returned.
const crypto = require("crypto");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const B = require("./lib/bodega");
const CAT = require("./lib/bodega-catalog");

const HOLD_MS = 180 * 24 * 60 * 60 * 1000;

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return B.J(500, { error: "Server not configured" });
  let body; try { body = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  const action = String(body.action || "claim");

  if (action === "list") {
    const email = B.safeEmail(body.email);
    if (!email) return B.J(400, { error: "Valid email required" });
    const collector = await B.collectorByEmail(email);
    const own = await B.sb("bodega_ownership?owner_email=eq." + encodeURIComponent(email) + "&status=in.(active,listed)&select=id,product_handle,edition_label,purchased_at,hold_until,resale_floor_cents,status&order=purchased_at.desc&limit=500");
    const roy = await B.sb("bodega_royalty_ledger?payee_email=eq." + encodeURIComponent(email) + "&select=id,role,amount_cents,sale_id,created_at&order=created_at.desc&limit=100");
    const ownerships = (own.ok && Array.isArray(own.data) ? own.data : []).map(function (o) {
      return { id: o.id, productHandle: o.product_handle, editionLabel: o.edition_label, purchasedAt: o.purchased_at, holdUntil: o.hold_until, resaleFloorCents: o.resale_floor_cents, status: o.status };
    });
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
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const entry = CAT.CATALOG[it.handle];
      if (!entry) continue;
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
    return B.J(200, { success: true, created: created, collectorNo: collector.collector_no });
  } catch (e) {
    console.error("bodega-ownership claim failed:", e.message);
    return B.J(500, { error: "Could not claim ownership" });
  }
};
