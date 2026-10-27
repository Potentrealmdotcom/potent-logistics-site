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

// Merge tags (templates in ~/workspace/email-templates):
//   {{IMG_<WORLD>}}     -> the hosted visual for that world, served from the
//                          site itself (email-img/ folder, publish root).
//   {{REFERRAL_CODE}}   -> per-send value (referralCode in the request);
//                          defaults to "" so no tag ever leaks literally.
//   {{UNSUBSCRIBE}}     -> per-send value (unsubscribeUrl in the request);
//                          defaults to a mailto unsubscribe link (see below).
// {{FIRST_NAME}} is personalization the caller resolves before sending —
// it is intentionally NOT touched here.
const SITE_BASE = "https://potentoperations.netlify.app";
const IMG_URLS = {
  IMG_OVERVIEW: "01-everything-potent.png",
  IMG_FREIGHT_DELIVERY: "02-freight-rush.png",
  IMG_WALLET: "03-wallet.png",
  IMG_RECURRING: "04-recurring.png",
  IMG_DEDICATED: "05-dedicated.png",
  IMG_JUNK_REMOVAL: "06-junk-removal.png",
  IMG_POPUP_EVENTS: "07-popup-events.png",
  IMG_REFERRAL: "08-referral.png",
  IMG_POTENT_OS: "09-potent-os.png",
  IMG_ELEVATE: "10-elevate.png",
  IMG_CCML: "11-ccml.png",
  IMG_PLAYBOOK: "12-playbook.png",
  IMG_BODEGA: "13-bodega.png",
  IMG_ACEHEALS: "14-aceheals.png",
  IMG_MUSIC: "15-music.png",
  IMG_ELEVATE_OPERATOR_MODE: "16-elevate-operator-mode.png",
  IMG_PUBLISHING_LOTTERY: "17a-publishing-lottery.png",
  IMG_PUBLISHING_COLORING: "17b-publishing-coloring-series.png",
  IMG_PUBLISHING_HEROES: "17c-publishing-heroes.png",
  IMG_ARMED_SECURITY: "18-armed-security.png"
};
// Default when a send supplies no unsubscribe URL: a mailto back to the
// sending inbox (replies already forward to the owner's Proton inbox).
const DEFAULT_UNSUBSCRIBE = "mailto:" + FROM_EMAIL + "?subject=Unsubscribe";

function resolveMergeTags(str, opts) {
  if (typeof str !== "string" || !str) return str;
  let out = str;
  for (const tag of Object.keys(IMG_URLS)) {
    out = out.split("{{" + tag + "}}").join(SITE_BASE + "/email-img/" + IMG_URLS[tag]);
  }
  out = out.split("{{REFERRAL_CODE}}").join(opts.referralCode || "");
  out = out.split("{{UNSUBSCRIBE}}").join(opts.unsubscribeUrl || DEFAULT_UNSUBSCRIBE);
  return out;
}

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
const { to, subject, message, html, referralCode, unsubscribeUrl } = JSON.parse(event.body || "{}");
if (!to || !subject || !message) {
return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing to, subject, or message" }) };
}

const mergeOpts = { referralCode: referralCode, unsubscribeUrl: unsubscribeUrl };
const payload = {
  from: `${FROM_NAME} <${FROM_EMAIL}>`,
  to: [to],
  subject: subject,
  text: resolveMergeTags(message, mergeOpts)
};
// HTML is optional and additive: text-only sends behave exactly as before.
if (html) {
  payload.html = resolveMergeTags(html, mergeOpts);
}

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${RESEND_API_KEY}`
  },
  body: JSON.stringify(payload)
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
