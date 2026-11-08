"use strict";
// ─── FUEL PRICES — live EIA weekly prices for ALL US states ──────────────
// Shared logic for netlify/functions/get-fuel-prices.js (and its tests).
//
// Source: U.S. EIA API v2, route petroleum/pri/gnd (Weekly Retail Gasoline
// and Diesel Prices), frequency=weekly. Prices are weekly, published Monday.
//
// Coverage reality (EIA, verified Nov 2026): EIA publishes its own weekly
// retail series for only 9 states — CA, CO, FL, MA, MN, NY, OH, TX, WA —
// plus the 5 PADD districts, the 3 PADD-1 sub-districts, and the US average.
// There is NO Georgia state series (the old function's facets[duoarea]=SGA
// query returned no rows, which is why the app always fell back to the
// hardcoded table). So every state resolves down a chain and the response
// says honestly which level priced it:
//   state series  ->  PADD sub-district (PADD 1 only)  ->  PADD  ->  US avg
// Diesel note: EIA publishes state-level weekly diesel for CA only; other
// states resolve diesel at PADD / national level. Gas and diesel resolve
// independently, so a state can get state-level gas and PADD-level diesel.
//
// The API key is passed in by the caller (from the EIA_API_KEY env var).
// No key is ever hardcoded here.

var US_STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
    "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
    "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
    "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

// States with their own EIA weekly retail series (duoarea "S" + state code).
var EIA_STATE_SERIES = { CA: 1, CO: 1, FL: 1, MA: 1, MN: 1, NY: 1, OH: 1, TX: 1, WA: 1 };

// State -> EIA district. padd = duoarea code, sub = PADD-1 sub-district
// duoarea code (East Coast only), label = the district's plain name.
var STATE_REGION = {
    CT: { padd: "R10", sub: "R1A", label: "New England (PADD 1A)" },
    ME: { padd: "R10", sub: "R1A", label: "New England (PADD 1A)" },
    MA: { padd: "R10", sub: "R1A", label: "New England (PADD 1A)" },
    NH: { padd: "R10", sub: "R1A", label: "New England (PADD 1A)" },
    RI: { padd: "R10", sub: "R1A", label: "New England (PADD 1A)" },
    VT: { padd: "R10", sub: "R1A", label: "New England (PADD 1A)" },
    DE: { padd: "R10", sub: "R1B", label: "Central Atlantic (PADD 1B)" },
    DC: { padd: "R10", sub: "R1B", label: "Central Atlantic (PADD 1B)" },
    MD: { padd: "R10", sub: "R1B", label: "Central Atlantic (PADD 1B)" },
    NJ: { padd: "R10", sub: "R1B", label: "Central Atlantic (PADD 1B)" },
    NY: { padd: "R10", sub: "R1B", label: "Central Atlantic (PADD 1B)" },
    PA: { padd: "R10", sub: "R1B", label: "Central Atlantic (PADD 1B)" },
    FL: { padd: "R10", sub: "R1C", label: "Lower Atlantic (PADD 1C)" },
    GA: { padd: "R10", sub: "R1C", label: "Lower Atlantic (PADD 1C)" },
    NC: { padd: "R10", sub: "R1C", label: "Lower Atlantic (PADD 1C)" },
    SC: { padd: "R10", sub: "R1C", label: "Lower Atlantic (PADD 1C)" },
    VA: { padd: "R10", sub: "R1C", label: "Lower Atlantic (PADD 1C)" },
    WV: { padd: "R10", sub: "R1C", label: "Lower Atlantic (PADD 1C)" },
    IL: { padd: "R20", sub: null, label: "Midwest (PADD 2)" },
    IN: { padd: "R20", sub: null, label: "Midwest (PADD 2)" },
    IA: { padd: "R20", sub: null, label: "Midwest (PADD 2)" },
    KS: { padd: "R20", sub: null, label: "Midwest (PADD 2)" },
    KY: { padd: "R20", sub: null, label: "Midwest (PADD 2)" },
    MI: { padd: "R20", sub: null, label: "Midwest (PADD 2)" },
    MN: { padd: "R20", sub: null, label: "Midwest (PADD 2)" },
    MO: { padd: "R20", sub: null, label: "Midwest (PADD 2)" },
    NE: { padd: "R20", sub: null, label: "Midwest (PADD 2)" },
    ND: { padd: "R20", sub: null, label: "Midwest (PADD 2)" },
    OH: { padd: "R20", sub: null, label: "Midwest (PADD 2)" },
    OK: { padd: "R20", sub: null, label: "Midwest (PADD 2)" },
    SD: { padd: "R20", sub: null, label: "Midwest (PADD 2)" },
    TN: { padd: "R20", sub: null, label: "Midwest (PADD 2)" },
    WI: { padd: "R20", sub: null, label: "Midwest (PADD 2)" },
    AL: { padd: "R30", sub: null, label: "Gulf Coast (PADD 3)" },
    AR: { padd: "R30", sub: null, label: "Gulf Coast (PADD 3)" },
    LA: { padd: "R30", sub: null, label: "Gulf Coast (PADD 3)" },
    MS: { padd: "R30", sub: null, label: "Gulf Coast (PADD 3)" },
    NM: { padd: "R30", sub: null, label: "Gulf Coast (PADD 3)" },
    TX: { padd: "R30", sub: null, label: "Gulf Coast (PADD 3)" },
    CO: { padd: "R40", sub: null, label: "Rocky Mountain (PADD 4)" },
    ID: { padd: "R40", sub: null, label: "Rocky Mountain (PADD 4)" },
    MT: { padd: "R40", sub: null, label: "Rocky Mountain (PADD 4)" },
    UT: { padd: "R40", sub: null, label: "Rocky Mountain (PADD 4)" },
    WY: { padd: "R40", sub: null, label: "Rocky Mountain (PADD 4)" },
    AK: { padd: "R50", sub: null, label: "West Coast (PADD 5)" },
    AZ: { padd: "R50", sub: null, label: "West Coast (PADD 5)" },
    CA: { padd: "R50", sub: null, label: "West Coast (PADD 5)" },
    HI: { padd: "R50", sub: null, label: "West Coast (PADD 5)" },
    NV: { padd: "R50", sub: null, label: "West Coast (PADD 5)" },
    OR: { padd: "R50", sub: null, label: "West Coast (PADD 5)" },
    WA: { padd: "R50", sub: null, label: "West Coast (PADD 5)" }
};

var PADD_LABEL = {
    R10: "East Coast (PADD 1)", R20: "Midwest (PADD 2)", R30: "Gulf Coast (PADD 3)",
    R40: "Rocky Mountain (PADD 4)", R50: "West Coast (PADD 5)"
};

var PRODUCTS = { gas: "EPM0", diesel: "EPD2D" }; // regular gasoline / on-highway diesel

// Same sanity bounds the old function used: reject anything implausible
// rather than pricing a quote off a bad row.
function sanitizePrice(value, kind) {
    var v = parseFloat(value);
    if (!isFinite(v)) return null;
    if (kind === "diesel") return (v > 2 && v < 9) ? v : null;
    return (v > 2 && v < 8) ? v : null;
}

function normalizeState(input) {
    var s = String(input || "").trim().toUpperCase();
    return US_STATES.indexOf(s) > -1 ? s : null;
}

// Ordered list of EIA areas to try for a state, most specific first.
// Each entry: { duoarea, level: "state"|"region"|"national", label }
function areaChainForState(state) {
    var st = normalizeState(state);
    if (!st) return [{ duoarea: "NUS", level: "national", label: "U.S. average" }];
    var chain = [];
    if (EIA_STATE_SERIES[st]) chain.push({ duoarea: "S" + st, level: "state", label: st });
    var region = STATE_REGION[st];
    if (region) {
        if (region.sub) chain.push({ duoarea: region.sub, level: "region", label: region.label });
        chain.push({ duoarea: region.padd, level: "region", label: PADD_LABEL[region.padd] });
    }
    chain.push({ duoarea: "NUS", level: "national", label: "U.S. average" });
    return chain;
}

function buildEiaUrl(opts) {
    return "https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=" + encodeURIComponent(opts.apiKey)
        + "&frequency=weekly&data[0]=value"
        + "&facets[duoarea][]=" + encodeURIComponent(opts.duoarea)
        + "&facets[product][]=" + encodeURIComponent(opts.product)
        + "&sort[0][column]=period&sort[0][direction]=desc&length=1";
}

// Prices are weekly, so a 6-hour server cache is generous and keeps EIA
// well inside its free-tier rate limits. (Netlify function instances are
// ephemeral — this cache is per warm instance; the CDN header on the
// function response is the durable layer.)
var CACHE_TTL_MS = 6 * 60 * 60 * 1000;
var _cache = {}; // state -> { at, result }

function _clearCache() { _cache = {}; }

// Walks the area chain for one fuel until EIA returns a usable row.
// Returns { price, period, duoarea, level, label } or null.
async function fetchOneFuel(kind, chain, apiKey, fetchImpl) {
    var lastErr = null;
    for (var i = 0; i < chain.length; i++) {
        var area = chain[i];
        try {
            var res = await fetchImpl(buildEiaUrl({ apiKey: apiKey, duoarea: area.duoarea, product: PRODUCTS[kind] }));
            var json = await res.json();
            var row = json && json.response && json.response.data && json.response.data[0];
            var price = row ? sanitizePrice(row.value, kind) : null;
            if (price !== null) {
                return { price: price, period: row.period || null, duoarea: area.duoarea, level: area.level, label: area.label };
            }
            if (json && json.error) lastErr = new Error(String(json.error).slice(0, 120));
        } catch (e) { lastErr = e; }
    }
    if (lastErr) throw lastErr;
    return null;
}

// Resolve live gas + diesel for a state. Never throws: on total failure it
// returns nulls + error so the caller can fall back to its last known price.
async function resolveFuelPrices(opts) {
    opts = opts || {};
    var fetchImpl = opts.fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
    var now = opts.now || Date.now();
    var st = normalizeState(opts.state) || "GA";
    var hit = _cache[st];
    if (!opts.noCache && hit && (now - hit.at) < CACHE_TTL_MS) return hit.result;
    var out = {
        state: st,
        gas: null, gasPeriod: null, gasArea: null, gasLevel: null,
        diesel: null, dieselPeriod: null, dieselArea: null, dieselLevel: null,
        asOf: null, error: null
    };
    if (!opts.apiKey) { out.error = "EIA_API_KEY is not configured on the server"; return out; }
    if (!fetchImpl) { out.error = "fetch is not available on the server"; return out; }
    var chain = areaChainForState(st);
    var results = await Promise.all([
        fetchOneFuel("gas", chain, opts.apiKey, fetchImpl).catch(function (e) { return { err: e }; }),
        fetchOneFuel("diesel", chain, opts.apiKey, fetchImpl).catch(function (e) { return { err: e }; })
    ]);
    var g = results[0], d = results[1];
    if (g && !g.err && g.price !== undefined && g.price !== null) {
        out.gas = g.price; out.gasPeriod = g.period; out.gasArea = g.label; out.gasLevel = g.level;
    }
    if (d && !d.err && d.price !== undefined && d.price !== null) {
        out.diesel = d.price; out.dieselPeriod = d.period; out.dieselArea = d.label; out.dieselLevel = d.level;
    }
    out.asOf = out.gasPeriod || out.dieselPeriod || null;
    if (out.gas === null && out.diesel === null) {
        var e = (g && g.err) || (d && d.err);
        out.error = e ? (e.message || String(e)) : "EIA returned no usable data for " + st;
    }
    if (!out.error) _cache[st] = { at: now, result: out };
    return out;
}

module.exports = {
    US_STATES: US_STATES,
    EIA_STATE_SERIES: EIA_STATE_SERIES,
    STATE_REGION: STATE_REGION,
    PADD_LABEL: PADD_LABEL,
    PRODUCTS: PRODUCTS,
    CACHE_TTL_MS: CACHE_TTL_MS,
    sanitizePrice: sanitizePrice,
    normalizeState: normalizeState,
    areaChainForState: areaChainForState,
    buildEiaUrl: buildEiaUrl,
    resolveFuelPrices: resolveFuelPrices,
    _clearCache: _clearCache
};
