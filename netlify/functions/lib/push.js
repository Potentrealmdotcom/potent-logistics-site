// Web Push sending, shared by the send-push endpoint and the voice owner alerts.
// One VAPID key pair must be used on BOTH sides: the app subscribes devices with the PUBLIC key
// (app.js VAPID_PUBLIC_KEY) and this file signs with the matching PRIVATE key. Until Oct 24, 2026 the
// two sides held DIFFERENT keys (app BBQlQTbR… vs server BJ5PoBvx…), so every subscription the app
// created was encrypted for a key the server cannot sign for and push services rejected every send.
//
// KEY HANDLING: the private key is read from the VAPID_PRIVATE_KEY env var first. The constant below
// is the pair production already uses, kept ONLY as a fallback so pushes do not break before the env
// var is set. ⚠️ ROTATE: this private key has lived in source (and git history). Generate a fresh pair,
// set VAPID_PRIVATE_KEY + VAPID_PUBLIC_KEY in Netlify, put the same public key in app.js, and have each
// device tap "Enable Notifications" once more (old subscriptions are tied to the old key).
const B = require("./beats");
const rows = function (r) { return r && r.ok && Array.isArray(r.data) ? r.data : []; };

const FALLBACK_PUBLIC_KEY = "BJ5PoBvxHwvSLxIOo6VyNoAmy5sQXsR60mN3aZ0hO5hez1gqhyKXeJl4aYQ1xqR4m2GBcqljNczT3lJu5oVoeSQ";
const FALLBACK_PRIVATE_KEY = "RBXmilmfr0S7Yqx5tQ1m9k8G-T1WBwuv_m61JfmtPRI"; // fallback only — see ROTATE note above
const publicKey = function () { return process.env.VAPID_PUBLIC_KEY || FALLBACK_PUBLIC_KEY; };
const subject = function () { return process.env.VAPID_SUBJECT || "mailto:potentlogistics@proton.me"; };
// Lazy require (same pattern as beats.js with stripe): the voice modules must load even where
// node_modules has not been installed; Netlify installs the "web-push" dependency at deploy.
function webpush() { const wp = require("web-push"); wp.setVapidDetails(subject(), publicKey(), process.env.VAPID_PRIVATE_KEY || FALLBACK_PRIVATE_KEY); return wp; }

// The actual send, isolated so tests can stand in for the push services.
let sender = function (subscription, payload) { return webpush().sendNotification(subscription, payload); };
function _setSender(fn) { sender = fn; }

async function dropRow(row) {
  try {
    if (row.id) await B.sb("push_subscriptions?id=eq." + encodeURIComponent(row.id), { method: "DELETE", prefer: "return=minimal" });
    else if (row.endpoint) await B.sb("push_subscriptions?endpoint=eq." + encodeURIComponent(row.endpoint), { method: "DELETE", prefer: "return=minimal" });
  } catch (e) { /* cleanup is best effort */ }
}

// Send one payload to a set of subscription rows. A 410/404 from the push service means the device
// unsubscribed or the subscription expired: the row is deleted, never silently kept.
async function sendToRows(list, payloadObj) {
  const payload = JSON.stringify(payloadObj);
  let sent = 0, failed = 0;
  await Promise.all((list || []).map(async function (row) {
    const sub = row.subscription || (row.endpoint ? { endpoint: row.endpoint, keys: row.keys } : null);
    if (!sub || !sub.endpoint) { failed++; return; }
    try { await sender(sub, payload); sent++; }
    catch (err) {
      if (err && (err.statusCode === 410 || err.statusCode === 404)) { await dropRow(row); failed++; }
      else failed++;
    }
  }));
  return { sent: sent, failed: failed, totalDevices: (list || []).length };
}

async function allSubscriptions() { return rows(await B.sb("push_subscriptions?select=*&limit=500")); }
async function userSubscriptions(userId) { return rows(await B.sb("push_subscriptions?user_id=eq." + encodeURIComponent(userId) + "&select=*&limit=100")); }

// The devices that belong to one company's OWNER: rows the push-subscribe endpoint tagged with the
// org + owner role from the signed-in token. Legacy rows (saved by app.js before the endpoint
// existed) carry no org tag; the platform owner's own legacy rows are matched by user id, and only
// for POTENT's own org, so a tenant's report can never reach the platform owner's phone by accident.
async function ownerSubscriptions(orgId) {
  const tagged = rows(await B.sb("push_subscriptions?org_id=eq." + encodeURIComponent(orgId) + "&role=eq.owner&select=*&limit=100"));
  let legacy = [];
  try {
    const org = rows(await B.sb("organizations?id=eq." + encodeURIComponent(orgId) + "&select=slug&limit=1"))[0];
    const potentSlug = process.env.POTENT_ORG_SLUG || "potent-logistics";
    if (org && org.slug === potentSlug) {
      const ids = String(process.env.VOICE_OWNER_PUSH_USER_IDS || "potent").split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      const byUid = ids.length ? rows(await B.sb("push_subscriptions?org_id=is.null&user_id=in.(" + ids.map(encodeURIComponent).join(",") + ")&select=*&limit=100")) : [];
      const byRole = rows(await B.sb("push_subscriptions?org_id=is.null&role=eq.owner&select=*&limit=100"));
      legacy = byUid.concat(byRole);
    }
  } catch (e) { /* legacy matching is best effort */ }
  const seen = {}, out = [];
  tagged.concat(legacy).forEach(function (r) { const k = r.endpoint || r.id; if (k && !seen[k]) { seen[k] = 1; out.push(r); } });
  return out;
}

async function pushToUser(userId, payloadObj) { return sendToRows(await userSubscriptions(userId), payloadObj); }
async function pushToOwner(orgId, payloadObj) { return sendToRows(await ownerSubscriptions(orgId), payloadObj); }
async function pushToAll(payloadObj) { return sendToRows(await allSubscriptions(), payloadObj); }

module.exports = { publicKey, sendToRows, userSubscriptions, ownerSubscriptions, allSubscriptions, pushToUser, pushToOwner, pushToAll, _setSender };
