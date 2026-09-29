// netlify/functions/send-push.js
// Upload to: potent-logistics-site/netlify/functions/send-push.js
//
// Sends real push notifications to every subscribed device (or one specific
// user), using the real VAPID key pair below. Requires the “web-push” npm
// package — add it to your repo’s package.json dependencies (see note at
// the bottom of this file for the exact steps).

var webpush = require(“web-push”);

var VAPID_PUBLIC_KEY = “BJ5PoBvxHwvSLxIOo6VyNoAmy5sQXsR60mN3aZ0hO5hez1gqhyKXeJl4aYQ1xqR4m2GBcqljNczT3lJu5oVoeSQ”;
var VAPID_PRIVATE_KEY = “RBXmilmfr0S7Yqx5tQ1m9k8G-T1WBwuv_m61JfmtPRI”;
var VAPID_SUBJECT = “mailto:potentlogistics@pm.me”;

var SUPABASE_URL = “https://ymvsatlrkzgxwzxybwmk.supabase.co”;
var SUPABASE_ANON_KEY = “eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltdnNhdGxya3pneHd6eHlid21rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NzgwMTQsImV4cCI6MjEwMzQ1NDAxNH0.KbW0enJr5FOzJmDQnT3Thhr5NJdbI4Ehp1vkhVEyPEg”;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

exports.handler = async function (event) {
var headers = {
“Access-Control-Allow-Origin”: “*”,
“Access-Control-Allow-Headers”: “Content-Type”,
“Content-Type”: “application/json”
};

if (event.httpMethod !== “POST”) {
return { statusCode: 405, headers: headers, body: JSON.stringify({ error: “POST only” }) };
}

var body;
try { body = JSON.parse(event.body); } catch (e) {
return { statusCode: 400, headers: headers, body: JSON.stringify({ error: “Invalid JSON” }) };
}

var title = body.title || “POTENT OS”;
var message = body.body || “”;
var url = body.url || “/”;
var targetUserId = body.userId || null; // if set, only send to that one user’s devices

// Real fetch of every subscribed device from Supabase — never fabricated.
var query = SUPABASE_URL + “/rest/v1/push_subscriptions?select=*”;
if (targetUserId) query += “&user_id=eq.” + encodeURIComponent(targetUserId);

var subsRes = await fetch(query, {
headers: { apikey: SUPABASE_ANON_KEY, Authorization: “Bearer “ + SUPABASE_ANON_KEY }
});
var subs = await subsRes.json();

if (!Array.isArray(subs) || subs.length === 0) {
return { statusCode: 200, headers: headers, body: JSON.stringify({ sent: 0, note: “No subscribed devices found.” }) };
}

var payload = JSON.stringify({ title: title, body: message, url: url });
var results = await Promise.allSettled(subs.map(function (row) {
return webpush.sendNotification(row.subscription, payload).catch(function (err) {
// A 410 Gone means that device unsubscribed — real cleanup, not a silent failure.
if (err.statusCode === 410 || err.statusCode === 404) {
return fetch(SUPABASE_URL + “/rest/v1/push_subscriptions?id=eq.” + row.id, {
method: “DELETE”, headers: { apikey: SUPABASE_ANON_KEY, Authorization: “Bearer “ + SUPABASE_ANON_KEY }
});
}
throw err;
});
}));

var sent = results.filter(function (r) { return r.status === “fulfilled”; }).length;
var failed = results.filter(function (r) { return r.status === “rejected”; }).length;

return { statusCode: 200, headers: headers, body: JSON.stringify({ sent: sent, failed: failed, totalDevices: subs.length }) };
};

// ═══════════════════════════════════════════════════════════════════
// SETUP NOTE — one real step needed before this works:
// In your repo’s package.json (root level), add “web-push” to
// dependencies:
//
//   “dependencies”: { “web-push”: “^3.6.7” }
//
// If you don’t have a package.json yet, create one with just that,
// commit it alongside this file, and Netlify installs it automatically
// on the next deploy. No other setup needed — the real VAPID keys are
// already embedded above, matching the public key used in the app.
// ═══════════════════════════════════════════════════════════════════
