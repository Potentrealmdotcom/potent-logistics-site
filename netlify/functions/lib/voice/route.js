// Address verification and driving distance. Nothing here guesses: if a service is not configured or returns nothing, the answer is "unknown".
// Addresses: US Census geocoder (free, official). Distance: OpenRouteService (ORS_API_KEY) or an OSRM server you run/pay for (OSRM_URL). The public OSRM demo is not used for production.
const T = function (ms) { return AbortSignal.timeout(ms); };
async function verifyAddress(addr) {
  try {
    const r = await fetch("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=" + encodeURIComponent(addr) + "&benchmark=Public_AR_Current&format=json", { signal: T(5000) });
    if (!r.ok) return { ok: false, unknown: true, reason: "address_service_unavailable" };
    const d = await r.json(), m = d && d.result && d.result.addressMatches;
    if (!m || !m.length) return { ok: false, unknown: false, reason: "address_not_found" };
    if (m.length > 1 && m[0].matchedAddress !== m[1].matchedAddress && m.length > 3) return { ok: false, unknown: false, reason: "address_ambiguous" };
    const x = m[0], c = x.addressComponents || {};
    return { ok: true, matched: x.matchedAddress, lat: x.coordinates.y, lon: x.coordinates.x, state: c.state || null, city: c.city || null, zip: c.zip || null };
  } catch (e) { return { ok: false, unknown: true, reason: "address_service_unavailable" }; }
}
function routingOn() { return !!((process.env.ROUTING_PROVIDER === "ors" && process.env.ORS_API_KEY) || (process.env.ROUTING_PROVIDER === "osrm" && process.env.OSRM_URL)); }
async function distance(a, b) { // a, b: {lat, lon}
  if (!routingOn()) return { ok: false, reason: "routing_not_configured" };
  try {
    if (process.env.ROUTING_PROVIDER === "ors") {
      const r = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", { method: "POST", headers: { "Content-Type": "application/json", Authorization: process.env.ORS_API_KEY }, body: JSON.stringify({ coordinates: [[a.lon, a.lat], [b.lon, b.lat]] }), signal: T(8000) });
      const d = await r.json(), s = r.ok && d.routes && d.routes[0] && d.routes[0].summary;
      return s ? { ok: true, miles: s.distance / 1609.344, minutes: s.duration / 60, source: "openrouteservice" } : { ok: false, reason: "route_not_found" };
    }
    const base = String(process.env.OSRM_URL).replace(/\/+$/, "");
    const r = await fetch(base + "/route/v1/driving/" + a.lon + "," + a.lat + ";" + b.lon + "," + b.lat + "?overview=false", { signal: T(8000) });
    const d = await r.json(), rt = r.ok && d.routes && d.routes[0];
    return rt ? { ok: true, miles: rt.distance / 1609.344, minutes: rt.duration / 60, source: "osrm" } : { ok: false, reason: "route_not_found" };
  } catch (e) { return { ok: false, reason: "routing_unavailable" }; }
}
module.exports = { verifyAddress, distance, routingOn };
