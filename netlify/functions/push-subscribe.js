// netlify/functions/push-subscribe.js — where a signed-in device registers for Web Push.
// The app used to write subscriptions straight into Supabase with the anon key: no org, no role, and
// nothing stopping anyone from writing (or reading) rows. This endpoint takes the same signed staff
// token the rest of POTENT OS uses (lib/voice/auth) and stamps the row with the token's org + role,
// which is what lets the voice owner alerts target exactly one company's owner devices — and nothing
// else. Customer/driver tokens are rejected by the verifier itself.
//
// POST { subscription: <PushSubscription JSON>, user_name }  → upsert by endpoint
// POST { action: "unsubscribe", endpoint }                    → delete the caller's own row
const B = require("./lib/beats");
const A = require("./lib/voice/auth");
const rows = function (r) { return r && r.ok && Array.isArray(r.data) ? r.data : []; };
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Content-Type": "application/json" };
const J = function (s, b) { return { statusCode: s, headers: headers, body: JSON.stringify(b) }; };

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return J(200, {});
  if (event.httpMethod !== "POST") return J(405, { error: "POST only" });
  const tok = A.verify(A.bearer(event));
  if (!tok) return J(401, { error: "Sign-in required" });
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return J(400, { error: "Invalid JSON" }); }
  try {
    if (body.action === "unsubscribe") {
      const ep = String(body.endpoint || ""); if (!ep) return J(400, { error: "endpoint required" });
      await B.sb("push_subscriptions?endpoint=eq." + encodeURIComponent(ep) + "&user_id=eq." + encodeURIComponent(tok.uid), { method: "DELETE", prefer: "return=minimal" });
      return J(200, { ok: true, removed: true });
    }
    const sub = body.subscription || {};
    const endpoint = String(sub.endpoint || "");
    if (!/^https:\/\//.test(endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return J(400, { error: "A full push subscription is required" });
    const row = { user_id: tok.uid, user_name: String(body.user_name || "").slice(0, 80) || null, endpoint: endpoint, subscription: sub, org_id: tok.orgId || null, role: tok.role || null, updated_at: new Date().toISOString() };
    const existing = rows(await B.sb("push_subscriptions?endpoint=eq." + encodeURIComponent(endpoint) + "&select=id&limit=1"))[0];
    if (existing) await B.sb("push_subscriptions?id=eq." + encodeURIComponent(existing.id), { method: "PATCH", prefer: "return=minimal", body: row });
    else await B.sb("push_subscriptions", { method: "POST", prefer: "return=minimal", body: row });
    return J(200, { ok: true, owner: tok.role === "owner", org_id: row.org_id });
  } catch (e) { console.error("push-subscribe", e && e.message); return J(500, { error: "Could not save the subscription" }); }
};
