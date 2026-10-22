// Telephone adapter: Twilio Programmable Voice (inbound webhooks, Media Streams, transfer, SMS). Replaceable: the rest of the app only calls the functions exported here.
const crypto = require("crypto");
const esc = function (s) { return String(s == null ? "" : s).replace(/[<>&"']/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]; }); };
const eqs = function (a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
// Twilio signs: base64(HMAC-SHA1(authToken, fullUrl + each POST param name+value sorted by name)).
function signature(token, url, params) { const s = Object.keys(params || {}).sort().reduce(function (a, k) { return a + k + params[k]; }, url); return crypto.createHmac("sha1", token).update(Buffer.from(s, "utf8")).digest("base64"); }
function validate(token, url, params, header) { return !!(token && header && eqs(signature(token, url, params), header)); }
function parseForm(body, isB64) { const raw = isB64 ? Buffer.from(body || "", "base64").toString("utf8") : String(body || ""); const o = {}; raw.split("&").filter(Boolean).forEach(function (p) { const i = p.indexOf("="); const k = decodeURIComponent((i < 0 ? p : p.slice(0, i)).replace(/\+/g, " ")), v = i < 0 ? "" : decodeURIComponent(p.slice(i + 1).replace(/\+/g, " ")); o[k] = v; }); return o; }
const xml = function (inner) { return '<?xml version="1.0" encoding="UTF-8"?><Response>' + inner + "</Response>"; };
const say = function (t) { return "<Say>" + esc(t) + "</Say>"; };
// Short-lived signed token so only calls we accepted can open the audio socket.
function streamToken(secret, callSid, orgId, exp, extra) { const body = Buffer.from(JSON.stringify(Object.assign({}, extra || {}, { c: callSid, o: orgId, e: exp }))).toString("base64url"); return body + "." + crypto.createHmac("sha256", secret).update(body).digest("base64url"); }
function readStreamToken(secret, t, now) { const p = String(t || "").split("."); if (p.length !== 2 || !eqs(crypto.createHmac("sha256", secret).update(p[0]).digest("base64url"), p[1])) return null; try { const j = JSON.parse(Buffer.from(p[0], "base64url").toString()); return j.e > (now || Date.now()) ? j : null; } catch (e) { return null; } }
function twimlStream(wsUrl, params, action) { return xml("<Connect" + (action ? ' action="' + esc(action) + '"' : "") + "><Stream url=\"" + esc(wsUrl) + "\">" + Object.keys(params || {}).map(function (k) { return '<Parameter name="' + esc(k) + '" value="' + esc(params[k]) + '"/>'; }).join("") + "</Stream></Connect>"); }
// Card payment by keypad. <Pay> collects the digits itself and sends them straight to Stripe: they never touch our servers, the bridge or the AI.
// The amount, connector and description are set by us; the caller only types the card.
const twimlPay = function (o) { return xml('<Pay chargeAmount="' + esc(o.amount) + '" currency="usd" paymentConnector="' + esc(o.connector) + '" action="' + esc(o.action) + '" method="POST" maxAttempts="3" timeout="20" paymentMethod="credit-card" tokenType="one-time" validCardTypes="visa mastercard amex discover" description="' + esc(String(o.description || "").slice(0, 100)) + '"/>'); };
const twimlSay = function (t) { return xml(say(t) + "<Hangup/>"); };
const twimlDial = function (num, cb, say1) { return xml((say1 ? say(say1) : "") + '<Dial timeout="20" answerOnBridge="true"' + (cb ? ' action="' + esc(cb) + '" method="POST"' : "") + "><Number>" + esc(num) + "</Number></Dial>" + say("Sorry, no one could take the call. We will call you back.") + "<Hangup/>"); };
async function api(path, form) {
  const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN; if (!sid || !tok) return { ok: false, reason: "twilio_not_configured" };
  try {
    const r = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + sid + path, { method: "POST", headers: { Authorization: "Basic " + Buffer.from(sid + ":" + tok).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form).toString(), signal: AbortSignal.timeout(8000) });
    const d = await r.json().catch(function () { return {}; }); return r.ok ? { ok: true, data: d } : { ok: false, reason: "twilio_" + r.status, detail: d.message };
  } catch (e) { return { ok: false, reason: "twilio_unreachable" }; }
}
// Move a live call to the human line. The TwiML is fetched from our own signed URL, never supplied by the model.
const transfer = function (callSid, twimlUrl) { return api("/Calls/" + encodeURIComponent(callSid) + ".json", { Url: twimlUrl, Method: "POST" }); };
const hangup = function (callSid) { return api("/Calls/" + encodeURIComponent(callSid) + ".json", { Status: "completed" }); };
const startRecording = function (callSid, cb) { return api("/Calls/" + encodeURIComponent(callSid) + "/Recordings.json", cb ? { RecordingStatusCallback: cb } : {}); };
const sms = function (to, body) { if (!process.env.TWILIO_SMS_FROM) return Promise.resolve({ ok: false, reason: "sms_not_configured" }); return api("/Messages.json", { To: to, From: process.env.TWILIO_SMS_FROM, Body: String(body).slice(0, 600) }); };
const configured = function () { return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN); };
module.exports = { name: "twilio", signature, validate, parseForm, twimlStream, twimlSay, twimlPay, twimlDial, streamToken, readStreamToken, transfer, hangup, startRecording, sms, configured, esc };
