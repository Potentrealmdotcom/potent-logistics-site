// netlify/functions/data-api.js
// Tenant gateway: the app's fetch interceptor routes all PL_GATED Supabase
// table requests here instead of hitting the database directly from the
// browser (the tables are RLS-locked; the anon key cannot reach them).
// Uses the service_role key server-side. Staff sign in with their token;
// POTENT staff (no orgId) see everything, tenant companies see only their org.
//
// Authenticated: /.netlify/functions/data-api?t=<table>&q=<url-encoded PostgREST query>
//   GET/POST/PATCH/DELETE, Bearer <staff token>
// Public doors (no token):
//   GET  ?track=<job_id>          -> driver position for the customer tracking page
//   POST ?book=1  (JSON body)     -> public job booking, forced to the POTENT org
//   POST ?bol=1   (JSON body)      -> attach a BOL/photo to a job, or {job_id,check:true} to verify a job exists

var crypto = require("crypto");

var SB = "https://ymvsatlrkzgxwzxybwmk.supabase.co";

// Tables the gateway will serve. Anything else is rejected.
var ALLOWED = ["fleet_vehicles", "fleet_maintenance", "driver_locations", "voice_room_messages",
    "driver_compliance", "brokers_carriers_backup", "storage_partners", "safety_alerts",
    "job_route_legs", "job_events", "job_scope_changes", "vendors", "disposal_facilities",
    "properties", "potent_wallets", "wallet_transactions", "rate_cards", "service_zones",
    "job_templates", "quote_terms_acceptance", "jobs", "job_photos", "junk_jobs", "jobs_backup",
    "audit_log_real", "expenses_real", "commission_rates_real", "payment_references",
    "cost_profiles", "customer_rate_cards", "claims", "change_orders", "addon_authorizations",
    "my_documents", "deadlines", "shift_handoffs", "escalation_timers", "site_profiles",
    "customer_locations", "incoming_loads", "user_display_names", "revoked_users", "receipts",
    "job_communications", "login_log", "push_subscriptions", "griffin_queries",
    "recurring_routes", "reviews", "waitlist", "os_prospects", "business_rules", "leads"];

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
function sbHeaders() {
    var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
}
async function sb(table, qs, opts) {
    opts = opts || {};
    var headers = sbHeaders();
    if (opts.prefer) headers.Prefer = opts.prefer;
    var res = await fetch(SB + "/rest/v1/" + table + (qs || ""), {
        method: opts.method || "GET",
        headers: headers,
        body: opts.body
    });
    var text = await res.text();
    var data; try { data = JSON.parse(text); } catch (e) { data = text; }
    return { status: res.status, data: data };
}

exports.handler = async function (event) {
    if (!process.env.AUTH_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) return J(500, { ok: false, error: "Server not configured" });
    var q = event.queryStringParameters || {};
    var h = event.headers || {};
    var method = (event.httpMethod || "GET").toUpperCase();

    // ── Public doors (no token) ──
    // Customer tracking page: driver position for one job.
    if (q.track) {
        var tr = await sb("driver_locations", "?job_id=eq." + encodeURIComponent(q.track) + "&select=*&order=created_at.desc&limit=1");
        return { statusCode: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(Array.isArray(tr.data) ? tr.data : []) };
    }
    // Public job booking: force to the POTENT org so signed-out customers can book.
    if (q.book === "1" && method === "POST") {
        var body;
        try { body = JSON.parse(event.body || "{}"); } catch (e) { return J(400, { ok: false, error: "Bad request" }); }
        delete body.org_id;
        var br = await sb("jobs", "?select=id", { method: "POST", body: JSON.stringify(body), prefer: "return=representation" });
        return { statusCode: br.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(br.data) };
    }
    // BOL attach / job existence check for the tracking page.
    if (q.bol === "1" && method === "POST") {
        var bbody;
        try { bbody = JSON.parse(event.body || "{}"); } catch (e) { return J(400, { ok: false, error: "Bad request" }); }
        if (bbody.check) {
            var chk = await sb("jobs", "?id=eq." + encodeURIComponent(bbody.job_id) + "&select=id&limit=1");
            return J(200, { ok: !!(chk.data && chk.data.length) });
        }
        if (!bbody.job_id || !bbody.url) return J(400, { ok: false, error: "Missing job_id or url" });
        var pr = await sb("job_photos", "?select=id", { method: "POST", body: JSON.stringify({ job_id: bbody.job_id, url: bbody.url }), prefer: "return=representation" });
        return { statusCode: pr.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(pr.data) };
    }

    // ── Customer portal (customer token, ?portal=<action>) ──
    if (q.portal) {
        var ctok = verify(String(h.authorization || h.Authorization || "").replace(/^Bearer\s+/i, ""));
        if (!ctok || ctok.role !== "customer") return J(401, { ok: false, error: "Sign in again" });
        var cemail = String(ctok.uid || "").replace(/^cust:/, "");
        var corgId = ctok.orgId || null;

        // Wallet: balance + recent transactions for this customer.
        if (q.portal === "wallet" && method === "GET") {
            var wq = "?customer_email=eq." + encodeURIComponent(cemail) + "&select=*&limit=1";
            if (corgId) wq += "&org_id=eq." + encodeURIComponent(corgId);
            var w = await sb("potent_wallets", wq);
            var wallet = (w.data && w.data[0]) || { balance: 0 };
            var tq = "?wallet_id=eq." + encodeURIComponent(wallet.id || "") + "&select=*&order=created_at.desc&limit=20";
            var tx = wallet.id ? await sb("wallet_transactions", tq) : { data: [] };
            return J(200, { ok: true, balance: Number(wallet.balance) || 0, transactions: tx.data || [] });
        }
        // Other portal actions: customer job data, notes, etc.
        if (q.portal === "data" && method === "GET") {
            var dq = "?customer_email=eq." + encodeURIComponent(cemail) + "&select=*&order=created_at.desc&limit=100";
            if (corgId) dq += "&org_id=eq." + encodeURIComponent(corgId);
            var dj = await sb("jobs", dq);
            return J(200, { ok: true, jobs: dj.data || [] });
        }
        return J(400, { ok: false, error: "Unknown portal action" });
    }

    // ── Authenticated gateway ──
    var tok = verify(String(h.authorization || h.Authorization || "").replace(/^Bearer\s+/i, ""));
    if (!tok) return J(401, { ok: false, error: "Sign in again" });

    var table = String(q.t || "");
    if (ALLOWED.indexOf(table) < 0) return J(403, { ok: false, error: "Not allowed" });
    if (["GET", "POST", "PATCH", "DELETE"].indexOf(method) < 0) return J(405, { ok: false, error: "Method not allowed" });

    var qs = String(q.q || "");
    if (qs && qs.charAt(0) !== "?") qs = "?" + qs;

    // Tenant companies only touch their own org's rows.
    if (tok.orgId) {
        var orgFilter = "org_id=eq." + encodeURIComponent(tok.orgId);
        if (method === "GET" || method === "DELETE") {
            qs += (qs.indexOf("?") === 0 && qs.length > 1 ? "&" : (qs ? "&" : "?")) + orgFilter;
            if (qs.charAt(0) !== "?") qs = "?" + qs;
        } else {
            // POST/PATCH: stamp the org onto the body so tenants can't write to other orgs.
            try {
                var wbody = JSON.parse(event.body || "{}");
                if (Array.isArray(wbody)) wbody.forEach(function (r) { r.org_id = tok.orgId; });
                else if (wbody && typeof wbody === "object") wbody.org_id = tok.orgId;
                event.body = JSON.stringify(wbody);
            } catch (e) { }
            // PATCH/DELETE also get the org filter so they can't touch other orgs' rows.
            if (method === "PATCH" || method === "DELETE") {
                qs += (qs && qs.length > 1 ? "&" : "") + orgFilter;
                if (qs.charAt(0) !== "?") qs = "?" + qs;
            }
        }
    }

    var prefer = h.prefer || h.Prefer;
    var out = await sb(table, qs, {
        method: method,
        body: (method === "GET" || method === "DELETE") ? undefined : (event.body || undefined),
        prefer: prefer
    });
    return { statusCode: out.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: typeof out.data === "string" ? out.data : JSON.stringify(out.data) };
};
