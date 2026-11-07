// Address verification and driving distance. Nothing here guesses: if a service is not configured or returns nothing, the answer is "unknown".
// Addresses: US Census geocoder (free, official). Distance: OpenRouteService (ORS_API_KEY) or an OSRM server you run/pay for (OSRM_URL). The public OSRM demo is not used for production.
const T = function (ms) { return AbortSignal.timeout(ms); };
async function verifyAddress(addr) {
  try {
    addr = require("./intake").canon(addr);
    const r = await fetch("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=" + encodeURIComponent(addr) + "&benchmark=Public_AR_Current&format=json", { signal: T(5000) });
    if (!r.ok) return { ok: false, unknown: true, reason: "address_service_unavailable" };
    const d = await r.json(), m = d && d.result && d.result.addressMatches;
    if (!m || !m.length) return { ok: false, unknown: false, reason: "address_not_found" };
    if (m.length > 1 && new Set(m.map(function (z) { return String((z.addressComponents || {}).city || "").toUpperCase(); })).size > 1) return { ok: false, unknown: false, reason: "address_ambiguous" };
    const x = m[0], c = x.addressComponents || {};
    return { ok: true, matched: x.matchedAddress, lat: x.coordinates.y, lon: x.coordinates.x, state: c.state || null, city: c.city || null, zip: c.zip || null };
  } catch (e) { return { ok: false, unknown: true, reason: "address_service_unavailable" }; }
}
function routingOn() { return !!((process.env.ROUTING_PROVIDER === "ors" && process.env.ORS_API_KEY) || (process.env.ROUTING_PROVIDER === "osrm" && process.env.OSRM_URL)); }
// Why a route failed is returned (never guessed): routing_not_configured, ors_key_rejected (401/403), ors_rate_limited (429), ors_no_road_near_address (404/2010),
// ors_http_NNN, routing_timeout, routing_unavailable. "detail" carries the service's own error text (never the key). A price is still never given without a verified distance.
// api.openrouteservice.org is deprecated (10% quota since Aug 27, shut down Nov 2-6, 2026). The new host is api.heigit.org; the same key works. ORS_BASE_URL overrides it.
const ORS_HOSTS = function () { const b = String(process.env.ORS_BASE_URL || "https://api.heigit.org/openrouteservice").replace(/\/+$/, ""); return [b]; };   // bundle 2026-11-07a: api.openrouteservice.org is GONE from the fallback list — it shut down Nov 2-6, 2026, so every trip to it was a multi-second timeout burned inside a live call for nothing.
async function orsOnce(a, b, base, budgetMs) {
  const key = String(process.env.ORS_API_KEY || "").replace(/\s+/g, "");          // a pasted key often carries a trailing newline/space, which makes the request fail
  const r = await fetch(base + "/v2/directions/driving-car", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: key },
    body: JSON.stringify({ coordinates: [[a.lon, a.lat], [b.lon, b.lat]], radiuses: [-1, -1] }), signal: T(Math.max(1200, Math.min(9000, budgetMs || 9000))) });   // -1 = snap to the nearest road however far (building centers can sit off the road); the timeout is the caller's REMAINING budget (2026-11-07a), never a fresh 9 s
  let d = null, raw = ""; try { raw = await r.text(); d = JSON.parse(raw); } catch (e) { }
  const s = r.ok && d && d.routes && d.routes[0] && d.routes[0].summary;
  if (s) return { ok: true, miles: s.distance / 1609.344, minutes: s.duration / 60, source: "openrouteservice" };
  const st = r.status, code = d && d.error && d.error.code, msg = String((d && d.error && (d.error.message || d.error)) || raw || "").replace(/\s+/g, " ").slice(0, 160);
  const reason = st === 401 || st === 403 ? "ors_key_rejected" : st === 429 ? "ors_rate_limited" : (code === 2010 || /routable/i.test(msg)) ? "ors_no_road_near_address" : "ors_http_" + st;
  console.error("route: ORS " + base + " HTTP " + st + " " + msg);   // visible in the Netlify function log
  return { ok: false, reason: reason, detail: "HTTP " + st + (msg ? ": " + msg : ""), retry: st === 429 || st >= 500 };
}
// Backup (owner approved Oct 21, 2026): the public OSRM server, used ONLY when the main service cannot give a distance. Labelled "osrm_public_backup" on every quote.
// It is a shared demo server meant for light use: set ROUTE_BACKUP=off to turn it off, or OSRM_BACKUP_URL to point at your own server.
async function osrmBackup(a, b) {
  if (String(process.env.ROUTE_BACKUP || "").toLowerCase() === "off") return null;
  const base = String(process.env.OSRM_BACKUP_URL || "https://router.project-osrm.org").replace(/\/+$/, "");
  try {
    const r = await fetch(base + "/route/v1/driving/" + a.lon + "," + a.lat + ";" + b.lon + "," + b.lat + "?overview=false", { signal: T(3000), headers: { Accept: "application/json", "User-Agent": "POTENT-Voice/1.0 (potentlogistics@proton.me)" } });   // 9 s -> 3 s (2026-11-07a): the backup only runs inside what is left of the caller's window
    const d = await r.json(), rt = r.ok && d && d.code === "Ok" && d.routes && d.routes[0];
    if (rt && rt.distance > 0) return { ok: true, miles: rt.distance / 1609.344, minutes: rt.duration / 60, source: "osrm_public_backup" };
    console.error("route: backup OSRM HTTP " + r.status + " " + String(d && d.code || "").slice(0, 60));
  } catch (e) { console.error("route: backup OSRM failed " + String(e && e.message || e).slice(0, 80)); }
  return null;
}
async function distance(a, b) {
  const t0 = Date.now();
  const main = await mainDistance(a, b);
  if (main.ok) return main;
  if (Date.now() - t0 > 4500) return main;   // the backup would land outside the caller's window too (see mainDistance): the honest failure now beats a late success nobody hears. Gate tightened 11000 -> 4500 (2026-11-07a) so main + backup together still land inside the bridge's tool window.
  const bk = await osrmBackup(a, b);
  return bk ? Object.assign(bk, { primary_failure: main.reason + (main.detail ? " - " + main.detail : "") }) : main;
}
async function mainDistance(a, b) { // a, b: {lat, lon}
  if (!routingOn()) return { ok: false, reason: "routing_not_configured" };
  const fail = function (e) { return { ok: false, reason: e && e.name === "TimeoutError" ? "routing_timeout" : "routing_unavailable", detail: String(e && e.message || e).slice(0, 160), retry: true }; };
  // OVERALL DEADLINE (Nov 4, 2026): the retry chain below could burn ~37 s (two hosts × two 9 s
  // attempts + waits) while the voice bridge gives up on a tool at 15 s — the quote then landed
  // in a dead call and the caller heard a 26 s hole. A route answer, even an honest failure,
  // must land inside the caller's window: once ~10 s is spent, no new attempt starts.
  const t0 = Date.now(), spent = function () { return Date.now() - t0 > 6000; };   // overall deadline 10000 -> 6000 (2026-11-07a, the Nov 6 stall: graded silences of 19 s / 18 s / 36 s on one call — the whole route answer, even a failure, must land well inside the bridge's 12 s tool window alongside the quote's own database reads and writes)
  try {
    if (process.env.ROUTING_PROVIDER === "ors") {
      const hosts = ORS_HOSTS(); let r;
      for (let h = 0; h < hosts.length; h++) {   // new host first; the old one only if the new one is unreachable or does not know the route path
        r = await orsOnce(a, b, hosts[h], 6000 - (Date.now() - t0)).catch(fail);
        if (!r.ok && r.retry && !spent() && Date.now() - t0 < 2500) { await new Promise(function (ok) { setTimeout(ok, 700); }); r = await orsOnce(a, b, hosts[h], 6000 - (Date.now() - t0)).catch(fail); }   // a retry is earned only by a FAST failure (2026-11-07a): retrying a slow timeout just doubles the caller's silence
        if (r.ok || spent() || !(r.reason === "routing_unavailable" || r.reason === "routing_timeout" || /^ors_http_404$/.test(r.reason))) break;
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
