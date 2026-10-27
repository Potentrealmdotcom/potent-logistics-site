// netlify/functions/send-email.js
// Upload to: potent-logistics-site/netlify/functions/send-email.js
//
// Sends real email via Resend's REST API. Credentials stay server-side here —
// never expose the API key/secret in client-side app.jsx code, since anyone
// could read them from the browser and send spam through your account.

// Credentials come from Netlify environment variables (never hardcode them —
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.MAIL_FROM_EMAIL || "info@potentworld.online"; // verified sender domain in Resend
const FROM_NAME = "POTENT Logistics";

exports.handler = async (event) => {
const headers = {
"Access-Control-Allow-Origin": "*",
"Access-Control-Allow-Headers": "Content-Type",
"Content-Type": "application/json"
};

if (event.httpMethod !== "POST") {
return { statusCode: 405, headers, body: JSON.stringify({ error: "POST only" }) };
}

try {
const { to, subject, message } = JSON.parse(event.body || "{}");
if (!to || !subject || !message) {
return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing to, subject, or message" }) };
}

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${RESEND_API_KEY}`
  },
  body: JSON.stringify({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [to],
    subject: subject,
    text: message
  })
});

const data = await res.json();

if (!res.ok) {
  return { statusCode: 200, headers, body: JSON.stringify({ sent: false, error: data }) };
}

return { statusCode: 200, headers, body: JSON.stringify({ sent: true, result: data }) };

} catch (err) {
return { statusCode: 200, headers, body: JSON.stringify({ sent: false, error: err.message }) };
}
};
