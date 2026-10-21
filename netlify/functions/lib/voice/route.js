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
// Why a route failed is returned (never guessed): routing_not_configured, ors_key_rejected (401/403), ors_rate_limited (429), ors_no_road_near_address (404/2010),
// ors_http_NNN, routing_timeout, routing_unavailable. "detail" carries the service's own error text (never the key). A price is still never given without a verified distance.
// api.openrouteservice.org is deprecated (10% quota since Aug 27, shut down Nov 2-6, 2026). The new host is api.heigit.org; the same key works. ORS_BASE_URL overrides it.
const ORS_HOSTS = function () { const b = String(process.env.ORS_BASE_URL || "https://api.heigit.org/openrouteservice").replace(/\/+$/, ""); return [b, "https://api.openrouteservice.org"].filter(function (x, i, l) { return l.indexOf(x) === i; }); };
async function orsOnce(a, b, base) {
  const key = String(process.env.ORS_API_KEY || "").replace(/\s+/g, "");          // a pasted key often carries a trailing newline/space, which makes the request fail
  const r = await fetch(base + "/v2/directions/driving-car", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: key },
    body: JSON.stringify({ coordinates: [[a.lon, a.lat], [b.lon, b.lat]], radiuses: [-1, -1] }), signal: T(9000) });   // -1 = snap to the nearest road however far (building centers can sit off the road)
  let d = null, raw = ""; try { raw = await r.text(); d = JSON.parse(raw); } catch (e) { }
  const s = r.ok && d && d.routes && d.routes[0] && d.routes[0].summary;
  if (s) return { ok: true, miles: s.distance / 1609.344, minutes: s.duration / 60, source: "openrouteservice" };
  const st = r.status, code = d && d.error && d.error.code, msg = String((d && d.error && (d.error.message || d.error)) || raw || "").replace(/\s+/g, " ").slice(0, 160);
  const reason = st === 401 || st === 403 ? "ors_key_rejected" : st === 429 ? "ors_rate_limited" : (code === 2010 || /routable/i.test(msg)) ? "ors_no_road_near_address" : "ors_http_" + st;
  console.error("route: ORS " + base + " HTTP " + st + " " + msg);   // visible in the Netlify function log
  return { ok: false, reason: reason, detail: "HTTP " + st + (msg ? ": " + msg : ""), retry: st === 429 || st >= 500 };
}
async function distance(a, b) { // a, b: {lat, lon}
  if (!routingOn()) return { ok: false, reason: "routing_not_configured" };
  const fail = function (e) { return { ok: false, reason: e && e.name === "TimeoutError" ? "routing_timeout" : "routing_unavailable", detail: String(e && e.message || e).slice(0, 160), retry: true }; };
  try {
    if (process.env.ROUTING_PROVIDER === "ors") {
      const hosts = ORS_HOSTS(); let r;
      for (let h = 0; h < hosts.length; h++) {   // new host first; the old one only if the new one is unreachable or does not know the route path
        r = await orsOnce(a, b, hosts[h]).catch(fail);
        if (!r.ok && r.retry) { await new Promise(function (ok) { setTimeout(ok, 700); }); r = await orsOnce(a, b, hosts[h]).catch(fail); }
        if (r.ok || !(r.reason === "routing_unavailable" || r.reason === "routing_timeout" || /^ors_http_404$/.test(r.reason))) break;
      }
      return r;
    }
    const base = String(process.env.OSRM_URL).replace(/\/+$/, "");
    const r = await fetch(base + "/route/v1/driving/" + a.lon + "," + a.lat + ";" + b.lon + "," + b.lat + "?overview=false", { signal: T(8000) });
    const d = await r.json(), rt = r.ok && d.routes && d.routes[0];
    return rt ? { ok: true, miles: rt.distance / 1609.344, minutes: rt.duration / 60, source: "osrm" } : { ok: false, reason: "route_not_found" };
  } catch (e) { return fail(e); }
}
module.exports = { verifyAddress, distance, routingOn };
