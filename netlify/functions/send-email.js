// netlify/functions/send-email.js
// Upload to: potent-logistics-site/netlify/functions/send-email.js
//
// Sends real email via Mailjet’s REST API. Credentials stay server-side here —
// never expose the API key/secret in client-side app.jsx code, since anyone
// could read them from the browser and send spam through your account.

const MAILJET_API_KEY = “a7ffe77f0f2d40545b166ed123572c7a”;
const MAILJET_SECRET_KEY = “928fcab1f666a431a03748049dc3015f”;
const FROM_EMAIL = “potentlogistics@pm.me”; // must be a verified sender in your Mailjet account
const FROM_NAME = “POTENT Logistics”;

exports.handler = async (event) => {
const headers = {
“Access-Control-Allow-Origin”: “*”,
“Access-Control-Allow-Headers”: “Content-Type”,
“Content-Type”: “application/json”
};

if (event.httpMethod !== “POST”) {
return { statusCode: 405, headers, body: JSON.stringify({ error: “POST only” }) };
}

try {
const { to, subject, message } = JSON.parse(event.body || “{}”);
if (!to || !subject || !message) {
return { statusCode: 400, headers, body: JSON.stringify({ error: “Missing to, subject, or message” }) };
}

```
const auth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString("base64");

const res = await fetch("https://api.mailjet.com/v3.1/send", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Basic ${auth}`
  },
  body: JSON.stringify({
    Messages: [{
      From: { Email: FROM_EMAIL, Name: FROM_NAME },
      To: [{ Email: to }],
      Subject: subject,
      TextPart: message
    }]
  })
});

const data = await res.json();

if (!res.ok) {
  return { statusCode: 200, headers, body: JSON.stringify({ sent: false, error: data }) };
}

return { statusCode: 200, headers, body: JSON.stringify({ sent: true, result: data }) };
```

} catch (err) {
return { statusCode: 200, headers, body: JSON.stringify({ sent: false, error: err.message }) };
}
};
