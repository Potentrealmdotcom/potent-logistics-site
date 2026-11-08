// netlify/functions/get-fuel-prices.js
//
// Fetches live gas + diesel prices from EIA server-side, for ANY US state:
//   /.netlify/functions/get-fuel-prices?state=TX   (state optional, default GA)
// The EIA API does not reliably allow direct browser requests (CORS), which
// is why the app used to silently fall back to a hardcoded default price.
// Running the fetch on Netlify's server avoids that entirely.
//
// All-states reality (see lib/fuel-prices.js): EIA publishes its own weekly
// series for 9 states only; every other state is priced live from its EIA
// district (PADD / PADD-1 sub-district), then the US average. The response
// names the level that priced each fuel (gasArea/gasLevel, dieselArea/
// dieselLevel) plus the EIA week (period / asOf) so the app can show an
// honest "as of" date instead of pretending every state has its own series.
//
// The API key comes from the EIA_API_KEY environment variable (Netlify site
// settings) — it is never hardcoded in the repo. If the variable is missing
// the function still answers 200 with nulls + an error string, so the app
// falls back to its last known price exactly like before.
//
// Response shape (legacy fields kept, new fields added):
//   { gas, gasPeriod, diesel, dieselPeriod,
//     state, gasArea, gasLevel, dieselArea, dieselLevel, asOf, error? }

const FUEL = require("./lib/fuel-prices");

exports.handler = async (event) => {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json",
        // EIA prices are weekly — let the CDN hold a response for 6 hours.
        "Cache-Control": "public, max-age=21600"
    };
    const state = FUEL.normalizeState(event && event.queryStringParameters && event.queryStringParameters.state) || "GA";
    try {
        const r = await FUEL.resolveFuelPrices({ state: state, apiKey: process.env.EIA_API_KEY });
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                gas: r.gas,
                gasPeriod: r.gasPeriod,
                diesel: r.diesel,
                dieselPeriod: r.dieselPeriod,
                state: r.state,
                gasArea: r.gasArea,
                gasLevel: r.gasLevel,
                dieselArea: r.dieselArea,
                dieselLevel: r.dieselLevel,
                asOf: r.asOf,
                ...(r.error ? { error: r.error } : {})
            })
        };
    } catch (err) {
        return {
            statusCode: 200, // still 200 so the app can read the error and fall back gracefully
            headers,
            body: JSON.stringify({ gas: null, diesel: null, state: state, error: err.message })
        };
    }
};
