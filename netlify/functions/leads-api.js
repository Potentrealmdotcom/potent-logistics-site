// netlify/functions/leads-api.js
// Staff-only proxy to the Supabase "leads" table. The app's LeadsBoard calls
// this for GET/PATCH/POST; the table is RLS-locked so the browser anon key
// cannot reach it directly. Uses the service_role key server-side.
//
// GET  /.netlify/functions/leads-api?q=<url-encoded PostgREST query>
//      e.g. ?q=%3Fselect%3D*%26limit%3D50000
// PATCH/POST take a JSON body and an optional Prefer header, same q param.

var crypto = require("crypto");

var SB = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
var TABLE = "leads";

function J(s, o) { return { statusCode: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(o) }; }
function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function verify(token) {
    if (!token || typeof token !== "string" || token.indexOf(".") < 0) return null;
    var parts = token.split(".");
    var expect = b64u(crypto.createHmac("sha256", process.env.AUTH_SECRET).update(parts[0]).digest());
    var a = Buffer.from(parts[1] || ""), b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try { var p = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); return p.exp && p.exp >= Date.now() ? p : null; } catch (e) { return null; }
}

exports.handler = async function (event) {
    if (!process.env.AUTH_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) return J(500, { ok: false, error: "Server not configured" });
    var h = event.headers || {};
    var tok = verify(String(h.authorization || h.Authorization || "").replace(/^Bearer\s+/i, ""));
    if (!tok) return J(401, { ok: false, error: "Sign in again" });
    if (tok.orgId) return J(403, { ok: false, error: "POTENT team only" });
    if (["owner", "dispatch", "dispatcher", "driver"].indexOf(tok.role) < 0) return J(403, { ok: false, error: "Not allowed" });

    var method = (event.httpMethod || "GET").toUpperCase();
    if (["GET", "POST", "PATCH", "DELETE"].indexOf(method) < 0) return J(405, { ok: false, error: "Method not allowed" });

    // q is already url-decoded by the platform; just make sure it starts with "?"
    var qs = String(((event.queryStringParameters || {}).q) || "");
    if (qs && qs.charAt(0) !== "?") qs = "?" + qs;

    var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    var headers = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
    var prefer = h.prefer || h.Prefer;
    if (prefer) headers.Prefer = prefer;

    var res = await fetch(SB + "/rest/v1/" + TABLE + qs, {
        method: method,
        headers: headers,
        body: (method === "GET" || method === "DELETE") ? undefined : (event.body || undefined)
    });
    var text = await res.text();
    var data; try { data = JSON.parse(text); } catch (e) { data = text; }
    return { statusCode: res.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: typeof data === "string" ? data : JSON.stringify(data) };
};
