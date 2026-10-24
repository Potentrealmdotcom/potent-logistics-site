// netlify/functions/send-push.js — HTTP front door for Web Push.
// The sending itself lives in lib/push.js (shared with the voice owner alerts); this handler only
// authenticates and routes: { title, body, url, userId } → that user, or everyone when no userId.
//
// Oct 24, 2026 fixes (the "notifications never worked" chain):
//  - VAPID signing now comes from lib/push.js — the key pair that matches the app's subscribe key.
//    (This file previously held the right private key, but app.js subscribed devices with a DIFFERENT
//    public key, so push services rejected every send.)
//  - Subscriptions are read with the service role (via lib/beats sb), not the anon key: with RLS on
//    and no anon policy, the old read silently returned zero devices forever.
//  - The endpoint now requires a signed-in staff token (or the PUSH_INTERNAL_SECRET header for
//    server-to-server callers). It used to accept unauthenticated POSTs from anyone, which meant
//    anyone who found the URL could broadcast a push to every subscribed device.
const PUSH = require("./lib/push");
const A = require("./lib/voice/auth");

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Content-Type": "application/json" };
const J = function (s, b) { return { statusCode: s, headers: headers, body: JSON.stringify(b) }; };

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return J(200, {});
  if (event.httpMethod !== "POST") return J(405, { error: "POST only" });
  const tok = A.verify(A.bearer(event));
  const internal = process.env.PUSH_INTERNAL_SECRET && (event.headers || {})["x-push-secret"] === process.env.PUSH_INTERNAL_SECRET;
  if (!tok && !internal) return J(401, { error: "Sign-in required" });

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return J(400, { error: "Invalid JSON" }); }
  const payload = { title: String(body.title || "POTENT OS").slice(0, 80), body: String(body.body || "").slice(0, 240), url: String(body.url || "/").slice(0, 300), tag: body.tag ? String(body.tag).slice(0, 60) : undefined };
  try {
    const r = body.userId ? await PUSH.pushToUser(String(body.userId), payload) : await PUSH.pushToAll(payload);
    if (!r.totalDevices) return J(200, { sent: 0, note: "No subscribed devices found." });
    return J(200, { sent: r.sent, failed: r.failed, totalDevices: r.totalDevices });
  } catch (e) { console.error("send-push", e && e.message); return J(500, { error: "Push failed" }); }
};
