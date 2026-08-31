// Improved geocoder — tries US Census Bureau first, falls back to OpenStreetMap Nominatim
// Nominatim handles partial addresses, non-standard formats, and out-of-state addresses

exports.handler = async function(event) {
  const address = event.queryStringParameters?.address;
  if (!address || address.trim().length < 4) {
    return { statusCode: 400, body: JSON.stringify({ found: false, error: 'No address provided' }) };
  }

  const clean = address.trim();

  // ── Try US Census Bureau first (fast, no limits, US only) ──────
  try {
    const censusUrl = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(clean)}&benchmark=2020&format=json`;
    const res = await fetch(censusUrl, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      const matches = data?.result?.addressMatches;
      if (matches && matches.length > 0) {
        const m = matches[0];
        const coords = m.coordinates;
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            found: true,
            lat: coords.y,
            lon: coords.x,
            formatted: m.matchedAddress,
            source: 'census'
          })
        };
      }
    }
  } catch (e) {
    console.log('Census geocoder failed:', e.message);
  }

  // ── Fallback: OpenStreetMap Nominatim (works worldwide, partial addresses) ──
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(clean)}&format=json&limit=1&countrycodes=us`;
    const res = await fetch(nomUrl, {
      headers: { 'User-Agent': 'PotentLogistics/1.0 (potentlogistics@pm.me)' },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        const m = data[0];
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            found: true,
            lat: parseFloat(m.lat),
            lon: parseFloat(m.lon),
            formatted: m.display_name,
            source: 'nominatim'
          })
        };
      }
    }
  } catch (e) {
    console.log('Nominatim geocoder failed:', e.message);
  }

  // ── Both failed ───────────────────────────────────────────────
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ found: false, error: 'Address not found' })
  };
};
