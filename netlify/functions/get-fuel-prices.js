// netlify/functions/get-fuel-prices.js
// Upload to: potent-logistics-site/netlify/functions/get-fuel-prices.js
//
// Fetches live gas + diesel prices from EIA server-side. The EIA API does not
// reliably allow direct browser requests (CORS), which is why the app was
// always silently falling back to the hardcoded default price. Running this
// fetch on Netlify’s server instead of the browser avoids that entirely.

const EIA_API_KEY = “QYc4D6uqgsUFT4nyTwFNlv7PeHeS7xDhl80SHYmX”;

exports.handler = async (event) => {
const headers = {
“Access-Control-Allow-Origin”: “*”,
“Access-Control-Allow-Headers”: “Content-Type”,
“Content-Type”: “application/json”
};

try {
const gasUrl = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${EIA_API_KEY}&frequency=weekly&data[0]=value&facets[duoarea][]=SGA&facets[product][]=EPM0&sort[0][column]=period&sort[0][direction]=desc&length=1`;
const dieselUrl = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${EIA_API_KEY}&frequency=weekly&data[0]=value&facets[duoarea][]=SGA&facets[product][]=EPD2D&sort[0][column]=period&sort[0][direction]=desc&length=1`;

```
const [gasRes, dieselRes] = await Promise.all([
  fetch(gasUrl),
  fetch(dieselUrl)
]);

const gasJson = await gasRes.json();
const dieselJson = await dieselRes.json();

const gasData = gasJson?.response?.data?.[0];
const dieselData = dieselJson?.response?.data?.[0];

const gasPrice = gasData?.value;
const dieselPrice = dieselData?.value;

return {
  statusCode: 200,
  headers,
  body: JSON.stringify({
    gas: (gasPrice && gasPrice > 2 && gasPrice < 8) ? parseFloat(gasPrice) : null,
    gasPeriod: gasData?.period || null,
    diesel: (dieselPrice && dieselPrice > 2 && dieselPrice < 9) ? parseFloat(dieselPrice) : null,
    dieselPeriod: dieselData?.period || null,
  })
};
```

} catch (err) {
return {
statusCode: 200, // still 200 so the app can read the error and fall back gracefully
headers,
body: JSON.stringify({ gas: null, diesel: null, error: err.message })
};
}
};
