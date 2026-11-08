const assert = require("assert"); let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const F = require("../netlify/functions/lib/fuel-prices");
const FN = require("../netlify/functions/get-fuel-prices");

// ── state coverage: every state + DC resolves a region and a chain ──
ok(F.US_STATES.length === 51, "51 jurisdictions (50 states + DC)");
F.US_STATES.forEach(function (s) {
    assert.ok(F.STATE_REGION[s], "region mapped for " + s);
    const chain = F.areaChainForState(s);
    assert.ok(chain.length >= 2 && chain[chain.length - 1].duoarea === "NUS", "chain ends at US average for " + s);
});
n += F.US_STATES.length * 2;
ok(F.normalizeState("ga") === "GA" && F.normalizeState(" Tx ") === "TX", "state input normalized");
ok(F.normalizeState("XX") === null && F.normalizeState("") === null && F.normalizeState(null) === null, "bad state rejected");

// ── the chain matches EIA's real coverage ──
const ga = F.areaChainForState("GA");
ok(ga[0].duoarea === "R1C" && ga[0].level === "region", "GA has NO EIA state series — first try is Lower Atlantic (this is why the old SGA query always came back empty)");
ok(ga[1].duoarea === "R10" && ga[2].duoarea === "NUS", "GA chain: sub-district -> PADD 1 -> US");
const tx = F.areaChainForState("TX");
ok(tx[0].duoarea === "STX" && tx[0].level === "state", "TX has its own EIA series, tried first");
ok(tx[1].duoarea === "R30", "TX then falls to Gulf Coast");
const ca = F.areaChainForState("CA");
ok(ca[0].duoarea === "SCA" && ca[1].duoarea === "R50", "CA: state series then West Coast");
const wy = F.areaChainForState("WY");
ok(wy[0].duoarea === "R40" && wy.length === 2, "WY: Rocky Mountain then US, no state series, no sub-district");
ok(F.areaChainForState("ZZ")[0].duoarea === "NUS", "unknown state goes straight to US average");

// ── price sanity (same bounds the old function used) ──
ok(F.sanitizePrice(3.45, "gas") === 3.45 && F.sanitizePrice("3.45", "gas") === 3.45, "good gas price passes");
ok(F.sanitizePrice(1.20, "gas") === null && F.sanitizePrice(9.99, "gas") === null && F.sanitizePrice("x", "gas") === null, "implausible gas rejected");
ok(F.sanitizePrice(5.72, "diesel") === 5.72 && F.sanitizePrice(8.50, "diesel") === 8.50 && F.sanitizePrice(8.50, "gas") === null, "diesel bound is wider than gas");

// ── EIA URL shape ──
const url = F.buildEiaUrl({ apiKey: "K EY", duoarea: "R1C", product: "EPM0" });
ok(url.indexOf("https://api.eia.gov/v2/petroleum/pri/gnd/data/") === 0, "EIA v2 gnd route");
ok(url.indexOf("facets[duoarea][]=R1C") > -1 && url.indexOf("facets[product][]=EPM0") > -1 && url.indexOf("frequency=weekly") > -1, "weekly facet query");

// ── resolver with a scripted EIA stand-in ──
function eiaStub(table) { // table: "DUOAREA|PRODUCT" -> {value, period} | null | "throw"
    const calls = [];
    const fn = async function (u) {
        calls.push(u);
        const duo = decodeURIComponent((u.match(/facets\[duoarea\]\[\]=([^&]+)/) || [])[1] || "");
        const prod = decodeURIComponent((u.match(/facets\[product\]\[\]=([^&]+)/) || [])[1] || "");
        const row = table[duo + "|" + prod];
        if (row === "throw") throw new Error("network down");
        return { json: async () => (row ? { response: { data: [{ value: row.value, period: row.period }] } } : { response: { data: [] } }) };
    };
    fn.calls = calls;
    return fn;
}
(async function () {
    // GA: gas resolves at sub-district, diesel only at national (independent chains)
    F._clearCache();
    let stub = eiaStub({ "R1C|EPM0": { value: 3.11, period: "2026-11-02" }, "NUS|EPD2D": { value: 3.87, period: "2026-11-02" } });
    let r = await F.resolveFuelPrices({ state: "GA", apiKey: "TEST", fetchImpl: stub });
    ok(r.gas === 3.11 && r.gasLevel === "region" && r.gasArea.indexOf("Lower Atlantic") > -1, "GA gas priced live from Lower Atlantic");
    ok(r.diesel === 3.87 && r.dieselLevel === "national", "GA diesel fell through to the US average on its own chain");
    ok(r.asOf === "2026-11-02" && !r.error, "as-of week carried through");

    // TX: state series wins for gas; diesel has no TX series in the stub -> PADD
    F._clearCache();
    stub = eiaStub({ "STX|EPM0": { value: 2.91, period: "2026-11-02" }, "R30|EPD2D": { value: 3.41, period: "2026-11-02" } });
    r = await F.resolveFuelPrices({ state: "tx", apiKey: "TEST", fetchImpl: stub });
    ok(r.state === "TX" && r.gas === 2.91 && r.gasLevel === "state", "TX gas from its own EIA series");
    ok(r.diesel === 3.41 && r.dieselLevel === "region", "TX diesel from Gulf Coast");

    // total failure: nulls + error, never a throw, never a made-up price
    F._clearCache();
    stub = eiaStub({ "R40|EPM0": "throw", "R40|EPD2D": "throw", "NUS|EPM0": "throw", "NUS|EPD2D": "throw" });
    r = await F.resolveFuelPrices({ state: "WY", apiKey: "TEST", fetchImpl: stub });
    ok(r.gas === null && r.diesel === null && /network down/.test(r.error), "EIA down -> nulls + error so the app uses its last known price");

    // no key configured: explicit error, zero EIA calls
    F._clearCache();
    stub = eiaStub({});
    r = await F.resolveFuelPrices({ state: "GA", apiKey: "", fetchImpl: stub });
    ok(r.error && r.error.indexOf("EIA_API_KEY") > -1 && stub.calls.length === 0, "missing env key -> clean error, no calls");

    // bad rows are skipped down the chain, not priced
    F._clearCache();
    stub = eiaStub({ "R1C|EPM0": { value: 0.42, period: "2026-11-02" }, "R10|EPM0": { value: 3.30, period: "2026-11-02" }, "R1C|EPD2D": { value: 3.60, period: "2026-11-02" } });
    r = await F.resolveFuelPrices({ state: "GA", apiKey: "TEST", fetchImpl: stub });
    ok(r.gas === 3.30 && r.gasArea.indexOf("East Coast") > -1, "implausible sub-district price rejected, PADD price used");

    // weekly cache: second resolve inside the TTL makes no new EIA calls
    const before = stub.calls.length;
    r = await F.resolveFuelPrices({ state: "GA", apiKey: "TEST", fetchImpl: stub });
    ok(stub.calls.length === before && r.gas === 3.30, "cache hit inside 6h TTL — no repeat EIA calls");
    r = await F.resolveFuelPrices({ state: "GA", apiKey: "TEST", fetchImpl: stub, now: Date.now() + F.CACHE_TTL_MS + 1 });
    ok(stub.calls.length > before, "cache expires after the TTL");

    // ── the Netlify function itself: shape + state param + legacy fields ──
    process.env.EIA_API_KEY = "TEST";
    global.fetch = eiaStub({ "SCA|EPM0": { value: 4.51, period: "2026-11-02" }, "SCA|EPD2D": { value: 5.02, period: "2026-11-02" } });
    F._clearCache();
    let resp = await FN.handler({ queryStringParameters: { state: "ca" } });
    let body = JSON.parse(resp.body);
    ok(resp.statusCode === 200 && body.state === "CA" && body.gas === 4.51 && body.diesel === 5.02, "function returns CA live prices");
    ok(body.gasPeriod === "2026-11-02" && body.asOf === "2026-11-02" && body.gasLevel === "state", "function carries period + level (legacy gasPeriod kept)");
    ok(resp.headers["Cache-Control"].indexOf("max-age=21600") > -1, "weekly data gets a 6h CDN cache header");
    resp = await FN.handler({ queryStringParameters: { state: "bogus" } });
    body = JSON.parse(resp.body);
    ok(body.state === "GA", "bad state param falls back to GA, the historic default");
    delete process.env.EIA_API_KEY;
    F._clearCache();
    resp = await FN.handler({ queryStringParameters: {} });
    body = JSON.parse(resp.body);
    ok(resp.statusCode === 200 && body.gas === null && /EIA_API_KEY/.test(body.error), "no env key -> 200 with nulls + error (app falls back gracefully)");

    console.log("fuel prices: " + n + " assertions PASS");
})().catch(function (e) { console.error(e); process.exit(1); });
