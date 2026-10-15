// POST { email }  or Authorization: Bearer <supabase access token>.
// Returns the buyer's playbook access: { tier: "none"|"regular"|"deluxe", addons: [...] }.
// Used by the course frontend for returning buyers (no purchase session needed).
const C = require("./lib/playbook");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return C.J(405, { error: "POST only" });
  let body; try { body = JSON.parse(event.body || "{}"); } catch (e) { return C.J(400, { error: "Bad request" }); }
  const user = await C.userFromEvent(event);
  const email = user ? user.email : C.safeEmail(body.email);
  if (!user && !email) return C.J(400, { error: "Sign in or provide your email" });
  try {
    const ent = await C.entitlementsFor({ userId: user ? user.id : null, email: email });
    return C.J(200, ent);
  } catch (e) {
    console.error("playbook-entitlements failed:", e.message);
    return C.J(500, { error: "Could not look up entitlements" });
  }
};
