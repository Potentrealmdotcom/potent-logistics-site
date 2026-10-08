// netlify/functions/leads-api.js
// The ONLY way to read or write the leads table. Requires a valid POTENT team
// token (issued by auth.js). Customer-company tokens and anonymous callers are refused.
//
// Same env vars as auth.js: SUPABASE_SERVICE_ROLE_KEY, AUTH_SECRET.
//
// Client calls:  /.netlify/functions/leads-api?q=<url-encoded query string, e.g. ?id=eq.5>
//   method GET | POST | PATCH | DELETE, same JSON body and Prefer header as Supabase REST.

var crypto = require("crypto");
var SB = "https://ymvsatlrkzgxwzxybwmk.supabase.co";

function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function verify(token) {
    if (!token || token.indexOf(".") < 0) return null;
    var parts = token.split(".");
    var expect = b64u(crypto.createHmac("sha256", process.env.AUTH_SECRET).update(parts[0]).digest());
    var a = Buffer.from(parts[1] || ""), b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        var p = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
        return p.exp && p.exp > Date.now() ? p : null;
    } catch (e) { return null; }
}
function R(status, body, type) {
    return { statusCode: status, headers: { "Content-Type": type || "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) };
}

exports.handler = async function (event) {
    if (!process.env.AUTH_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) return R(500, { error: "Server not configured" });

    var auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
    var tok = verify(auth.replace(/^Bearer\s+/i, ""));
    if (!tok) return R(401, { error: "Session expired. Sign in again." });
    // POTENT team only: no company org, owner or dispatch role
    if (tok.orgId || (tok.role !== "owner" && tok.role !== "dispatch")) return R(403, { error: "No access to leads" });

    var q = (event.queryStringParameters && event.queryStringParameters.q) || "";
    if (!/^(\?[A-Za-z0-9_=.,&%*()\-:+ ]*)?$/.test(q)) return R(400, { error: "Bad query" });
    var method = event.httpMethod;
    if (["GET", "POST", "PATCH", "DELETE"].indexOf(method) < 0) return R(405, { error: "Method not allowed" });

    var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    var headers = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
    var prefer = event.headers && (event.headers.prefer || event.headers.Prefer);
    if (prefer && /^[A-Za-z0-9=,\- ]+$/.test(prefer)) headers.Prefer = prefer;

    try {
        var res = await fetch(SB + "/rest/v1/leads" + q, { method: method, headers: headers, body: method === "GET" || method === "DELETE" ? undefined : event.body });
        var text = await res.text();
        return R(res.status, text, "application/json");
    } catch (e) {
        return R(502, { error: "Upstream error" });
    }
};
