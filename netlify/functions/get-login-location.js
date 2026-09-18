// netlify/functions/get-login-location.js
// Upload to: potent-logistics-site/netlify/functions/get-login-location.js
//
// Captures the REAL visitor IP address (only visible server-side — the browser
// itself has no access to the public IP it’s connecting from) and looks up its
// approximate city/region/ISP using the free ip-api.com service, no key needed.

exports.handler = async (event) => {
const headers = {
“Access-Control-Allow-Origin”: “*”,
“Access-Control-Allow-Headers”: “Content-Type”,
“Content-Type”: “application/json”
};

try {
// Netlify forwards the real visitor IP in this header
const ip = event.headers[“x-nf-client-connection-ip”]
|| (event.headers[“x-forwarded-for”] || “”).split(”,”)[0].trim()
|| null;

```
if (!ip) {
  return { statusCode: 200, headers, body: JSON.stringify({ ip: null, location: "Unknown (no IP detected)" }) };
}

const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp,query`);
const geo = await geoRes.json();

if (geo.status !== "success") {
  return { statusCode: 200, headers, body: JSON.stringify({ ip, location: "Unknown (lookup failed)" }) };
}

const location = `${geo.city}, ${geo.regionName}, ${geo.country} — ISP: ${geo.isp}`;

return { statusCode: 200, headers, body: JSON.stringify({ ip: geo.query, location }) };
```

} catch (err) {
return { statusCode: 200, headers, body: JSON.stringify({ ip: null, location: “Unknown (error: “ + err.message + “)” }) };
}
};
