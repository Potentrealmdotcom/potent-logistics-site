// POST { email, ownershipId, priceCents } — list an owned piece for resale (180-day hold + POTENT floor enforced server-side).
// POST { action: "cancel", email, listingId } — pull a listing back down; ownership returns to 'active'.
const B = require("./lib/bodega");

const UUID = /^[0-9a-f-]{36}$/i;

async function ownershipById(id) {
  const r = await B.sb("bodega_ownership?id=eq." + encodeURIComponent(id) + "&select=*&limit=1");
  return r.ok && Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
}
async function listingById(id) {
  const r = await B.sb("bodega_listings?id=eq." + encodeURIComponent(id) + "&select=*&limit=1");
  return r.ok && Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return B.J(500, { error: "Server not configured" });
  let body; try { body = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  const email = B.safeEmail(body.email);
  if (!email) return B.J(400, { error: "Valid email required" });

  if (String(body.action || "") === "cancel") {
    const listingId = String(body.listingId || "");
    if (!UUID.test(listingId)) return B.J(400, { error: "Bad listing id" });
    const listing = await listingById(listingId);
    if (!listing) return B.J(404, { error: "Listing not found" });
    if (String(listing.seller_email || "").toLowerCase() !== email) return B.J(403, { error: "Not your listing" });
    if (listing.status !== "active") return B.J(409, { error: "Listing is not active" });
    const upd = await B.sb("bodega_listings?id=eq." + encodeURIComponent(listingId), { method: "PATCH", prefer: "return=representation", body: { status: "cancelled" } });
    if (!upd.ok) return B.J(500, { error: "Could not cancel listing" });
    await B.sb("bodega_ownership?id=eq." + encodeURIComponent(listing.ownership_id), { method: "PATCH", prefer: "return=minimal", body: { status: "active" } });
    return B.J(200, { success: true, listing: Array.isArray(upd.data) && upd.data[0] ? upd.data[0] : null });
  }

  const ownershipId = String(body.ownershipId || "");
  if (!UUID.test(ownershipId)) return B.J(400, { error: "Bad ownership id" });
  const priceCents = Math.floor(Number(body.priceCents));
  if (!isFinite(priceCents) || priceCents <= 0) return B.J(400, { error: "Bad price" });

  const ownership = await ownershipById(ownershipId);
  if (!ownership) return B.J(404, { error: "Ownership not found" });
  if (String(ownership.owner_email || "").toLowerCase() !== email) return B.J(403, { error: "Not your piece" });
  if (ownership.status !== "active") return B.J(409, { error: "Piece is not available to list" });
  if (Date.now() < new Date(ownership.hold_until).getTime()) return B.J(422, { error: "180-day hold still active" });
  if (priceCents < Number(ownership.resale_floor_cents || 0)) return B.J(422, { error: "Below the POTENT resale floor" });

  const dup = await B.sb("bodega_listings?ownership_id=eq." + encodeURIComponent(ownershipId) + "&status=eq.active&select=id&limit=1");
  if (dup.ok && Array.isArray(dup.data) && dup.data.length) return B.J(409, { error: "Already listed" });

  const ins = await B.sb("bodega_listings", { method: "POST", prefer: "return=representation", body: { ownership_id: ownershipId, seller_email: email, price_cents: priceCents, status: "active" } });
  if (!ins.ok || !Array.isArray(ins.data) || !ins.data[0]) return B.J(500, { error: "Could not create listing" });
  const listing = ins.data[0];
  const patch = await B.sb("bodega_ownership?id=eq." + encodeURIComponent(ownershipId), { method: "PATCH", prefer: "return=minimal", body: { status: "listed" } });
  if (!patch.ok) {
    // Roll the listing back so a piece is never listed without its ownership reflecting it.
    await B.sb("bodega_listings?id=eq." + encodeURIComponent(listing.id), { method: "PATCH", prefer: "return=minimal", body: { status: "cancelled" } });
    return B.J(500, { error: "Could not create listing" });
  }
  return B.J(200, { success: true, listing: listing });
};
