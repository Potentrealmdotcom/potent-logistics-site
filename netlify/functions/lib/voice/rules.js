// Eligibility engine: can THIS vehicle profile carry THIS shipment? Deterministic and config-driven; the AI never decides this.
// Result: status "eligible" | "blocked" | "review". Blocked = a hard limit is exceeded. Review = a human must look (unknown, unverified or unusual).
const DEFAULT_PROFILE = { // verified starting values for POTENT's current truck; an administrator maintains the real record (voice_vehicle_profiles)
  name: "2022 Ford E350 16-ft Morgan box truck", max_payload_lb: 4500, interior_l_in: 190, interior_w_in: 94, interior_h_in: 80, door_w_in: 86.5, door_h_in: 71,
  equipment: { dock_height: true, liftgate: false, pallet_jack: false, crew_loads: true, blankets: true, e_track: true, load_bars: true }, service_area: { states: ["GA"] }, interstate_authorized: false, authorized: true };

function pieceList(d) { const out = []; (d.pieces || []).forEach(function (p) { out.push(p); }); if (!out.length && d.total_dims) out.push(d.total_dims); return out; }
// Fits if sorted dimensions fit the interior and the two smaller ones pass through the rear door.
function fits(p, v) {
  const a = [p.l, p.w, p.h].sort(function (x, y) { return x - y; });
  const door = v.door_w_in && v.door_h_in ? (a[1] <= v.door_w_in && a[0] <= v.door_h_in) : true;
  const inside = (!v.interior_l_in || a[2] <= v.interior_l_in) && (!v.interior_w_in || a[1] <= v.interior_w_in) && (!v.interior_h_in || a[0] <= v.interior_h_in);
  return { door: door, inside: inside };
}
function evaluate(d, v) {
  v = v || DEFAULT_PROFILE; const blocks = [], reviews = [], eq = v.equipment || {};
  if (!v.authorized) blocks.push({ code: "vehicle_not_authorized", text: "This vehicle is not verified and authorized for booking." });
  if (v.kind === "contractor" && !v.verified_at) blocks.push({ code: "contractor_unverified", text: "Contractor is not verified." });
  const w = Number(d.total_weight_lb) || 0;
  if (!(w > 0)) reviews.push({ code: "weight_missing", text: "Total weight is not verified." });
  else if (w > v.max_payload_lb) blocks.push({ code: "over_payload", text: "Shipment weight " + w + " lb is over the " + v.max_payload_lb + " lb limit." });
  const ps = pieceList(d);
  if (!ps.length) reviews.push({ code: "dimensions_missing", text: "Dimensions are not verified." });
  ps.forEach(function (p, i) {
    const f = fits(p, v);
    if (!f.inside) blocks.push({ code: "too_big_for_interior", text: "Item " + (i + 1) + " (" + p.l + "x" + p.w + "x" + p.h + " in) does not fit the truck interior." });
    else if (!f.door) blocks.push({ code: "too_big_for_door", text: "Item " + (i + 1) + " (" + p.l + "x" + p.w + "x" + p.h + " in) does not fit through the rear door." });
  });
  if (d.needs_liftgate && !eq.liftgate) blocks.push({ code: "liftgate_required", text: "A liftgate is required and this vehicle has none." });
  if (d.needs_pallet_jack && !eq.pallet_jack && !d.site_has_pallet_jack) blocks.push({ code: "pallet_jack_required", text: "A pallet jack is required and neither the vehicle nor the site has one." });
  // A non-dock site only needs a human when THIS company has no ground-level way to load: no liftgate and no crew that hand-loads.
  // A company whose crew hand-loads (equipment.crew_loads, set on its own vehicle profile) books ground-level work normally.
  if (d.pickup_dock === false && !d.forklift_pickup && !eq.liftgate && !eq.crew_loads) reviews.push({ code: "pickup_not_dock", text: "Pickup is not at dock height and has no forklift; loading method must be confirmed." });
  if (d.delivery_dock === false && !d.forklift_delivery && !eq.liftgate && !eq.crew_loads) reviews.push({ code: "delivery_not_dock", text: "Delivery is not at dock height and has no forklift; unloading method must be confirmed." });
  if (d.hazmat) blocks.push({ code: "hazmat", text: "Hazardous materials are not accepted by this booking system." });
  if (d.special_handling) reviews.push({ code: "special_handling", text: "Special handling requested: a person must approve it." });
  const states = (v.service_area && v.service_area.states) || [];
  [["pickup", d.pickup_state], ["delivery", d.delivery_state]].forEach(function (x) {
    if (!x[1]) reviews.push({ code: x[0] + "_area_unknown", text: "Could not confirm the " + x[0] + " state." });
    else if (states.indexOf(x[1]) < 0) blocks.push({ code: "outside_service_area", text: "The " + x[0] + " location (" + x[1] + ") is outside the authorized service area (" + states.join(", ") + ")." });
  });
  if (d.pickup_state && d.delivery_state && d.pickup_state !== d.delivery_state && !v.interstate_authorized) blocks.push({ code: "interstate", text: "Interstate work is not authorized for this vehicle." });
  const status = blocks.length ? "blocked" : reviews.length ? "review" : "eligible";
  return { status: status, blocks: blocks, reviews: reviews, vehicle: v.name, profile_version: v.version || 1 };
}
module.exports = { DEFAULT_PROFILE, evaluate, fits };
