// Bodega office panel. POTENT owner login only (staff token, no company attached). Tenants and other staff are refused.
// POST { action: "overview" }  + Authorization: Bearer <staff token>
const crypto = require("crypto");
const B = require("./lib/bodega");
const CAT = require("./lib/bodega-catalog");

function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function verify(token) {
  if (!token || typeof token !== "string" || token.indexOf(".") < 0 || !process.env.AUTH_SECRET) return null;
  const parts = token.split(".");
  const expect = b64u(crypto.createHmac("sha256", process.env.AUTH_SECRET).update(parts[0]).digest());
  const a = Buffer.from(parts[1] || ""), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return p.exp && p.exp >= Date.now() ? p : null;
  } catch (e) { return null; }
}

async function countRows(path) {
  const r = await B.sb(path);
  return r.ok && Array.isArray(r.data) ? r.data.length : 0;
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return B.J(500, { error: "Server not configured" });
  const h = event.headers || {};
  const m = String(h.authorization || h.Authorization || "").match(/^Bearer\s+(.+)$/i);
  const tok = m ? verify(m[1]) : null;
  if (!tok || tok.role !== "owner" || tok.orgId || tok.assist) return B.J(403, { error: "POTENT owner only" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }

  if (b.action === "overview") {
    const counts = await Promise.all([
      countRows("bodega_collectors?select=id&limit=100000"),
      countRows("bodega_ownership?select=id&limit=100000"),
      countRows("bodega_listings?status=eq.active&select=id&limit=100000"),
      countRows("bodega_sales?select=id&limit=100000")
    ]);
    const led = await B.sb("bodega_royalty_ledger?select=payee_email,role,amount_cents&limit=100000");
    const grouped = {};
    (led.ok && Array.isArray(led.data) ? led.data : []).forEach(function (r) {
      const key = String(r.payee_email || "") + "|" + String(r.role || "");
      if (!grouped[key]) grouped[key] = { payee: r.payee_email, role: r.role, cents: 0 };
      grouped[key].cents += Number(r.amount_cents) || 0;
    });
    return B.J(200, { ok: true,
      products: CAT.HANDLES.length,
      collectors: counts[0],
      ownerships: counts[1],
      listings: counts[2],
      sales: counts[3],
      royaltiesOwed: Object.keys(grouped).sort().map(function (k) { return grouped[k]; })
    });
  }
  return B.J(400, { error: "Unknown action" });
};
