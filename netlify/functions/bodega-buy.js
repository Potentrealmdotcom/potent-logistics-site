// POST { action: "checkout", listingId, email } — start Stripe checkout for a verified resale listing at the LISTING's price.
// POST { action: "complete", sessionId } — after payment: record the sale, split royalties, transfer ownership to the buyer.
// The original buyer keeps royalty rights forever (original_buyer_email is carried over unchanged); the floor also persists.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const B = require("./lib/bodega");
const CAT = require("./lib/bodega-catalog");

const UUID = /^[0-9a-f-]{36}$/i;
const HOLD_MS = 180 * 24 * 60 * 60 * 1000;

async function listingById(id) {
  const r = await B.sb("bodega_listings?id=eq." + encodeURIComponent(id) + "&select=*&limit=1");
  return r.ok && Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
}
async function ownershipById(id) {
  const r = await B.sb("bodega_ownership?id=eq." + encodeURIComponent(id) + "&select=*&limit=1");
  return r.ok && Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return B.J(500, { error: "Server not configured" });
  let body; try { body = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  const action = String(body.action || "");

  if (action === "checkout") {
    const email = B.safeEmail(body.email);
    if (!email) return B.J(400, { error: "Valid email required" });
    const listingId = String(body.listingId || "");
    if (!UUID.test(listingId)) return B.J(400, { error: "Bad listing id" });
    const listing = await listingById(listingId);
    if (!listing) return B.J(404, { error: "Listing not found" });
    if (listing.status !== "active") return B.J(409, { error: "Listing is no longer active" });
    const ownership = await ownershipById(listing.ownership_id);
    if (!ownership) return B.J(404, { error: "Piece not found" });
    const entry = CAT.CATALOG[ownership.product_handle];
    const title = entry && entry.title ? entry.title : ownership.product_handle;
    const origin = B.originFromEvent(event);
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: email,
        line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: listing.price_cents, product_data: { name: title + " — Verified Resale", description: "ALL SALES FINAL." } } }],
        metadata: { product: "BODEGA_RESALE", listing_id: listingId, email: email },
        custom_text: { submit: { message: "All sales are final." } },
        success_url: origin + "/bodega/?resale_session={CHECKOUT_SESSION_ID}",
        cancel_url: origin + "/bodega/?canceled=1"
      });
      return B.J(200, { url: session.url, sessionId: session.id });
    } catch (e) {
      console.error("bodega-buy checkout failed:", e.message);
      return B.J(500, { error: "Could not start checkout" });
    }
  }

  if (action === "complete") {
    const id = String(body.sessionId || "");
    if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(id)) return B.J(400, { error: "Bad session" });
    let session;
    try { session = await stripe.checkout.sessions.retrieve(id); } catch (e) { return B.J(500, { error: "Could not verify payment" }); }
    if (!session.metadata || session.metadata.product !== "BODEGA_RESALE") return B.J(400, { error: "Not a resale purchase" });
    if (session.payment_status !== "paid") return B.J(402, { error: "Payment not confirmed yet" });
    const buyer = B.safeEmail((session.customer_details && session.customer_details.email) || session.metadata.email);
    if (!buyer) return B.J(400, { error: "No buyer email on session" });

    // Idempotency: a sale already recorded for this Stripe session wins.
    const prior = await B.sb("bodega_sales?stripe_session_id=eq." + encodeURIComponent(session.id) + "&select=id&limit=1");
    if (prior.ok && Array.isArray(prior.data) && prior.data.length) return B.J(200, { success: true, duplicate: true });

    const listingId = String(session.metadata.listing_id || "");
    if (!UUID.test(listingId)) return B.J(400, { error: "Bad listing on session" });
    const listing = await listingById(listingId);
    if (!listing) return B.J(404, { error: "Listing not found" });
    if (listing.status !== "active") return B.J(409, { error: "Listing is no longer active" });
    const ownership = await ownershipById(listing.ownership_id);
    if (!ownership) return B.J(404, { error: "Piece not found" });

    const split = B.royaltySplit(listing.price_cents);

    // (1) Record the sale.
    const saleIns = await B.sb("bodega_sales", { method: "POST", prefer: "return=representation", body: {
      listing_id: listing.id,
      product_handle: ownership.product_handle,
      buyer_email: buyer,
      price_cents: listing.price_cents,
      royalty_creator_cents: split.creator,
      royalty_original_buyer_cents: split.originalBuyer,
      royalty_platform_cents: split.platform,
      seller_payout_cents: split.sellerPayout,
      stripe_session_id: session.id
    } });
    if (!saleIns.ok || !Array.isArray(saleIns.data) || !saleIns.data[0]) {
      const re = await B.sb("bodega_sales?stripe_session_id=eq." + encodeURIComponent(session.id) + "&select=id&limit=1");
      if (re.ok && Array.isArray(re.data) && re.data.length) return B.J(200, { success: true, duplicate: true });
      return B.J(500, { error: "Could not record sale" });
    }
    const sale = saleIns.data[0];

    // (2) Royalty ledger: creator, original buyer, platform. Zero-amount rows are skipped.
    const ledgerRows = [
      { payee_email: ownership.creator_key === "POTENT" ? "POTENT" : ownership.creator_key, role: "creator", amount_cents: split.creator, sale_id: sale.id },
      { payee_email: ownership.original_buyer_email, role: "original_buyer", amount_cents: split.originalBuyer, sale_id: sale.id },
      { payee_email: "POTENT", role: "platform", amount_cents: split.platform, sale_id: sale.id }
    ].filter(function (r) { return r.amount_cents > 0; });
    if (ledgerRows.length) {
      const led = await B.sb("bodega_royalty_ledger", { method: "POST", prefer: "return=minimal", body: ledgerRows });
      if (!led.ok) return B.J(500, { error: "Could not record royalties" });
    }

    // (3) Listing is sold.
    const lUpd = await B.sb("bodega_listings?id=eq." + encodeURIComponent(listing.id), { method: "PATCH", prefer: "return=minimal", body: { status: "sold" } });
    if (!lUpd.ok) return B.J(500, { error: "Could not close listing" });

    // (4) Old ownership transfers out.
    const oUpd = await B.sb("bodega_ownership?id=eq." + encodeURIComponent(ownership.id), { method: "PATCH", prefer: "return=minimal", body: { status: "transferred" } });
    if (!oUpd.ok) return B.J(500, { error: "Could not transfer ownership" });

    // (5) New ownership for the buyer: same edition + floor, fresh 180-day hold, original buyer unchanged.
    const collector = await B.getOrCreateCollector(buyer);
    if (!collector) return B.J(500, { error: "Could not create collector" });
    const newOwn = await B.sb("bodega_ownership", { method: "POST", prefer: "return=representation", body: {
      product_handle: ownership.product_handle,
      owner_email: buyer,
      edition_label: ownership.edition_label,
      purchase_price_cents: listing.price_cents,
      source_ref: session.id,
      status: "active",
      hold_until: new Date(Date.now() + HOLD_MS).toISOString(),
      resale_floor_cents: ownership.resale_floor_cents,
      creator_key: ownership.creator_key,
      original_buyer_email: ownership.original_buyer_email
    } });
    if (!newOwn.ok) return B.J(500, { error: "Could not create buyer ownership" });

    return B.J(200, { success: true, saleId: sale.id });
  }

  return B.J(400, { error: "Unknown action" });
};
