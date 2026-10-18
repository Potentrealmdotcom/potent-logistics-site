// Who is calling? Staff tokens are the same signed logins the rest of POTENT OS uses (AUTH_SECRET).
// platform = POTENT's own owner login (no company attached). A company login always carries its own orgId.
const crypto = require("crypto");
const b64u = function (b) { return Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
function verify(token) {
  if (!process.env.AUTH_SECRET || !token || typeof token !== "string" || token.indexOf(".") < 0) return null;
  const parts = token.split("."), want = b64u(crypto.createHmac("sha256", process.env.AUTH_SECRET).update(parts[0]).digest());
  const a = Buffer.from(parts[1] || ""), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    if (!p.exp || p.exp < Date.now() || p.assist || p.role === "customer" || p.role === "driver") return null;
    return { uid: String(p.uid || ""), role: String(p.role || ""), orgId: p.orgId ? String(p.orgId) : null, platform: p.role === "owner" && !p.orgId };
  } catch (e) { return null; }
}
function bearer(event) { const h = (event && event.headers) || {}; const m = String(h.authorization || h.Authorization || "").match(/^Bearer\s+(.+)$/i); return m ? m[1] : ""; }
const OFFICE = ["owner", "dispatch", "dispatcher"];
// Roles: owner (everything), dispatch/dispatcher (operate calls, handoffs, bookings), others may only read.
function can(tok, what) {
  if (!tok) return false;
  if (what === "platform") return tok.platform;
  if (what === "owner") return tok.role === "owner";
  if (what === "operate") return OFFICE.indexOf(tok.role) >= 0;
  if (what === "read") return true;
  return false;
}
module.exports = { verify, bearer, can, OFFICE };
