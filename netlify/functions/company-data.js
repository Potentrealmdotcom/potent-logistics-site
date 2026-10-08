// netlify/functions/company-data.js
// Export and import for ONE company. Everything is tied to the signed-in login:
// the company is read from the token on the server, never from the request, so a
// company can only ever export or import its own data.
//
//   POST { action: "export" }                          owner  -> all of this company's data (no passwords)
//   POST { action: "import_trucks",  rows: [...] }     owner/dispatch -> adds trucks (plan limit enforced)
//   POST { action: "import_drivers", rows: [...] }     owner  -> creates driver logins (plan limit enforced), returns temp passwords
//   POST { action: "pull_samsara",   apiToken }        owner/dispatch -> reads vehicles + drivers from the customer's Samsara
//   POST { action: "pull_motive",    apiKey }          owner/dispatch -> reads vehicles + drivers from the customer's Motive
// Pull actions only READ from the other system and return a preview; the key is used once and never stored.
//
// Env: AUTH_SECRET, SUPABASE_SERVICE_ROLE_KEY   (optional POTENT_ORG_SLUG)

var crypto = require("crypto");
var billing = require("./lib/billing");

var SB = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
var MAX_ROWS = 500;
var SECRET_COLS = ["password", "password_hash", "account_password", "token", "api_key", "secret"];
// Tables included in an export. Each is asked for "org_id = this company"; a table that has no
// org_id column yet is skipped and listed under "notIncluded" instead of leaking anything.
var EXPORT_TABLES = ["jobs", "junk_jobs", "recurring_routes", "job_photos", "fleet_vehicles", "fleet_maintenance",
    "driver_compliance", "storage_partners", "brokers_carriers_backup", "safety_alerts", "voice_room_messages",
    "expenses_real", "customer_rate_cards", "customer_locations", "carrier_profiles", "org_users"];

function J(status, obj) { return { statusCode: status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) }; }
function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function verify(token) {
    if (!token || typeof token !== "string" || token.indexOf(".") < 0) return null;
    var parts = token.split(".");
    var expect = b64u(crypto.createHmac("sha256", process.env.AUTH_SECRET).update(parts[0]).digest());
    var a = Buffer.from(parts[1] || ""), b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        var p = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
        return p.exp && p.exp >= Date.now() ? p : null;
    } catch (e) { return null; }
}
function parse(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function sb(path, opts) {
    opts = opts || {};
    var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    var h = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
    if (opts.prefer) h.Prefer = opts.prefer;
    return fetch(SB + "/rest/v1/" + path, { method: opts.method || "GET", headers: h, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
        .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, status: r.status, data: parse(t) }; }); });
}
function hashPw(pw) {
    var salt = crypto.randomBytes(16).toString("hex");
    return "scrypt$" + salt + "$" + crypto.scryptSync(pw, salt, 32).toString("hex");
}
function tempPw() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", out = "", bytes = crypto.randomBytes(10);
    for (var i = 0; i < 10; i++) out += chars[bytes[i] % chars.length];
    return out;
}
var _potent = null;
async function potentOrgId() {
    if (_potent) return _potent;
    var r = await sb("organizations?slug=eq." + encodeURIComponent(process.env.POTENT_ORG_SLUG || "potent-logistics") + "&select=id");
    _potent = r.ok && Array.isArray(r.data) && r.data[0] ? String(r.data[0].id) : null;
    return _potent;
}
function clean(v, n) { return String(v == null ? "" : v).replace(/[<>]/g, "").trim().slice(0, n || 120); }
function cleanYear(v) { var n = parseInt(v, 10); return n >= 1980 && n <= 2100 ? String(n) : ""; }
function cleanVin(v) { return clean(v, 24).toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function stripSecrets(row) {
    var o = {};
    Object.keys(row).forEach(function (k) { if (!SECRET_COLS.some(function (s) { return k.toLowerCase().indexOf(s) >= 0; })) o[k] = row[k]; });
    return o;
}

// ── read-only pulls from the customer's own telematics account ──────────
async function getJson(url, headers) {
    var r = await fetch(url, { headers: headers });
    var t = await r.text();
    return { ok: r.ok, status: r.status, data: parse(t) };
}
async function pullSamsara(token) {
    var H = { Authorization: "Bearer " + token, Accept: "application/json" };
    var trucks = [], drivers = [], after = "", guard = 0;
    do {
        var v = await getJson("https://api.samsara.com/fleet/vehicles?limit=512" + (after ? "&after=" + encodeURIComponent(after) : ""), H);
        if (!v.ok) return { error: v.status === 401 || v.status === 403 ? "Samsara rejected that API token. Check it has Vehicles and Drivers read access." : "Samsara did not answer (" + v.status + ")." };
        ((v.data && v.data.data) || []).forEach(function (x) {
            trucks.push({ make: x.make || "", model: x.model || "", year: x.year || "", plate: x.licensePlate || "", vin: x.vin || "", color: "", nickname: x.name || "" });
        });
        var pg = v.data && v.data.pagination; after = pg && pg.hasNextPage ? pg.endCursor : "";
    } while (after && ++guard < 20 && trucks.length < MAX_ROWS);
    after = ""; guard = 0;
    do {
        var d = await getJson("https://api.samsara.com/fleet/drivers?limit=512" + (after ? "&after=" + encodeURIComponent(after) : ""), H);
        if (!d.ok) break; // drivers are optional; trucks already worked
        ((d.data && d.data.data) || []).forEach(function (x) { drivers.push({ name: x.name || "", email: x.email || "", phone: x.phone || "" }); });
        var pg2 = d.data && d.data.pagination; after = pg2 && pg2.hasNextPage ? pg2.endCursor : "";
    } while (after && ++guard < 20 && drivers.length < MAX_ROWS);
    return { trucks: trucks, drivers: drivers };
}
async function pullMotive(key) {
    var H = { "X-Api-Key": key, Accept: "application/json" };
    var trucks = [], drivers = [], page = 1;
    while (page <= 20 && trucks.length < MAX_ROWS) {
        var v = await getJson("https://api.gomotive.com/v1/vehicles?per_page=100&page_no=" + page, H);
        if (!v.ok) return { error: v.status === 401 || v.status === 403 ? "Motive rejected that API key." : "Motive did not answer (" + v.status + ")." };
        var list = (v.data && v.data.vehicles) || [];
        list.forEach(function (w) {
            var x = w.vehicle || w;
            trucks.push({ make: x.make || "", model: x.model || "", year: x.year || "", plate: x.license_plate_number || "", vin: x.vin || "", color: "", nickname: x.number || "" });
        });
        if (list.length < 100) break; page++;
    }
    page = 1;
    while (page <= 20 && drivers.length < MAX_ROWS) {
        var u = await getJson("https://api.gomotive.com/v1/users?role=driver&per_page=100&page_no=" + page, H);
        if (!u.ok) break;
        var ul = (u.data && u.data.users) || [];
        ul.forEach(function (w) { var x = w.user || w; drivers.push({ name: ((x.first_name || "") + " " + (x.last_name || "")).trim(), email: x.email || "", phone: x.phone || "" }); });
        if (ul.length < 100) break; page++;
    }
    return { trucks: trucks, drivers: drivers };
}

var rate = {};
function limited(key, max, ms) {
    var now = Date.now(), f = (rate[key] || []).filter(function (t) { return now - t < ms; });
    rate[key] = f; if (f.length >= max) return true; f.push(now); return false;
}

exports.handler = async function (event) {
    if (!process.env.AUTH_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) return J(500, { ok: false, error: "Server not configured" });
    if (event.httpMethod !== "POST") return J(405, { ok: false, error: "Method not allowed" });
    try {
        var h = event.headers || {};
        var tok = verify(String(h.authorization || h.Authorization || "").replace(/^Bearer\s+/i, ""));
        if (!tok) return J(401, { ok: false, error: "Sign in again." });
        if (["owner", "dispatch", "dispatcher"].indexOf(tok.role) < 0) return J(403, { ok: false, error: "Not allowed" });
        var body = parse(event.body || "{}") || {};
        var action = body.action;
        // the company ALWAYS comes from the login, never from the request
        var orgId = tok.orgId ? String(tok.orgId) : await potentOrgId();
        if (!orgId) return J(500, { ok: false, error: "Company not found" });
        var isPotent = !tok.orgId;
        var enc = encodeURIComponent(orgId);

        // ── EXPORT ───────────────────────────────────────────────
        if (action === "export") {
            if (tok.role !== "owner" || tok.assist) return J(403, { ok: false, error: "Only the company owner can export data." });
            if (limited("exp:" + orgId, 5, 60 * 60 * 1000)) return J(429, { ok: false, error: "Export limit reached. Try again in an hour." });
            var org = await sb("organizations?id=eq." + enc + "&select=name,slug,plan");
            var out = { company: org.ok && org.data && org.data[0] ? { name: org.data[0].name, slug: org.data[0].slug, plan: org.data[0].plan } : {}, exportedAt: new Date().toISOString(), tables: {}, notIncluded: [] };
            for (var i = 0; i < EXPORT_TABLES.length; i++) {
                var t = EXPORT_TABLES[i];
                var r = await sb(t + "?org_id=eq." + enc + "&select=*&limit=50000");
                if (!r.ok || !Array.isArray(r.data)) { out.notIncluded.push(t); continue; }
                var rows = r.data.map(stripSecrets);
                if (t === "brokers_carriers_backup") rows.forEach(function (x) { if (typeof x.id === "string" && x.id.indexOf(orgId + ":") === 0) x.id = x.id.slice(orgId.length + 1); });
                if (rows.length) out.tables[t] = rows;
            }
            return J(200, { ok: true, export: out });
        }

        // ── PULL from Samsara / Motive (read-only preview) ───────
        if (action === "pull_samsara" || action === "pull_motive") {
            var secret = String(body.apiToken || body.apiKey || "").trim();
            if (!/^[A-Za-z0-9._\-]{10,300}$/.test(secret)) return J(400, { ok: false, error: "Paste the API token exactly as shown, with no spaces." });
            if (limited("pull:" + orgId, 10, 60 * 60 * 1000)) return J(429, { ok: false, error: "Too many tries. Wait a few minutes." });
            var got;
            try { got = action === "pull_samsara" ? await pullSamsara(secret) : await pullMotive(secret); }
            catch (e) { return J(502, { ok: false, error: "Could not reach that service. Try again." }); }
            if (got.error) return J(400, { ok: false, error: got.error });
            return J(200, { ok: true, trucks: got.trucks.slice(0, MAX_ROWS), drivers: got.drivers.slice(0, MAX_ROWS) });
        }

        // ── IMPORT TRUCKS ────────────────────────────────────────
        if (action === "import_trucks") {
            var inRows = Array.isArray(body.rows) ? body.rows.slice(0, MAX_ROWS) : [];
            if (!inRows.length) return J(400, { ok: false, error: "No rows to import." });
            var ex = await sb("fleet_vehicles?org_id=eq." + enc + "&select=id,vin,plate");
            var have = ex.ok && Array.isArray(ex.data) ? ex.data : [];
            var seenVin = {}, seenPlate = {};
            have.forEach(function (x) { if (x.vin) seenVin[String(x.vin).toUpperCase()] = 1; if (x.plate) seenPlate[String(x.plate).toUpperCase()] = 1; });
            var add = [], skipped = [];
            inRows.forEach(function (x, idx) {
                var vin = cleanVin(x.vin), plate = clean(x.plate, 12).toUpperCase();
                var make = clean(x.make, 40), model = clean(x.model, 40);
                if (!make && !model && !vin && !plate) { skipped.push({ row: idx + 1, why: "empty" }); return; }
                if ((vin && seenVin[vin]) || (plate && seenPlate[plate])) { skipped.push({ row: idx + 1, why: "already in your fleet" }); return; }
                if (vin) seenVin[vin] = 1; if (plate) seenPlate[plate] = 1;
                add.push({ id: "imp-" + Date.now().toString(36) + "-" + idx + "-" + crypto.randomBytes(2).toString("hex"), org_id: orgId, make: make, model: model, year: cleanYear(x.year), plate: plate, vin: vin, color: clean(x.color, 20), updated_at: new Date().toISOString() });
            });
            if (!isPotent && add.length) {
                var o2 = await sb("organizations?id=eq." + enc + "&select=*");
                var lim = billing.limitsFor(o2.ok && Array.isArray(o2.data) && o2.data[0] ? o2.data[0] : {});
                if (lim.trucks !== null && lim.trucks !== undefined && have.length + add.length > lim.trucks) {
                    var room = Math.max(0, lim.trucks - have.length);
                    return J(403, { ok: false, error: "Your " + lim.tier.charAt(0).toUpperCase() + lim.tier.slice(1) + " plan allows " + lim.trucks + " trucks. You have " + have.length + " and tried to add " + add.length + (room ? " (room for " + room + ")." : ".") + " Contact POTENT to upgrade.", limit: lim.trucks });
                }
            }
            if (add.length) {
                var ins = await sb("fleet_vehicles", { method: "POST", prefer: "return=minimal", body: add });
                if (!ins.ok) return J(500, { ok: false, error: "Could not save the trucks." });
            }
            return J(200, { ok: true, added: add.length, skipped: skipped });
        }

        // ── IMPORT DRIVERS (creates logins with one-time passwords) ──
        if (action === "import_drivers") {
            if (tok.role !== "owner") return J(403, { ok: false, error: "Only the company owner can add driver logins." });
            var dr = Array.isArray(body.rows) ? body.rows.slice(0, MAX_ROWS) : [];
            if (!dr.length) return J(400, { ok: false, error: "No rows to import." });
            var cap = null, lim2 = { tier: "enterprise" };
            if (!isPotent) {
                var o3 = await sb("organizations?id=eq." + enc + "&select=*");
                lim2 = billing.limitsFor(o3.ok && Array.isArray(o3.data) && o3.data[0] ? o3.data[0] : {});
                cap = lim2.drivers;
            }
            var used = await sb("org_users?org_id=eq." + enc + "&role=eq.driver&status=eq.active&select=id");
            var usedN = used.ok && Array.isArray(used.data) ? used.data.length : 0;
            var created = [], skippedD = [];
            for (var k = 0; k < dr.length; k++) {
                var x = dr[k], name = clean(x.name, 80), email = clean(x.email, 120).toLowerCase();
                if (!name) { skippedD.push({ row: k + 1, why: "no name" }); continue; }
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skippedD.push({ row: k + 1, why: "needs a valid email to log in" }); continue; }
                if (cap !== null && cap !== undefined && usedN + created.length >= cap) { skippedD.push({ row: k + 1, why: "plan limit of " + cap + " drivers reached" }); continue; }
                var dupe = await sb("org_users?email=ilike." + encodeURIComponent(email) + "&select=id");
                if (dupe.ok && Array.isArray(dupe.data) && dupe.data.length) { skippedD.push({ row: k + 1, why: "that email already has an account" }); continue; }
                var pw = tempPw();
                var ad = await sb("org_users", { method: "POST", prefer: "return=minimal", body: { org_id: orgId, name: name, email: email, phone: clean(x.phone, 30), role: "driver", password_hash: hashPw(pw), status: "active" } });
                if (ad.ok) created.push({ name: name, email: email, tempPassword: pw }); else skippedD.push({ row: k + 1, why: "could not save" });
            }
            return J(200, { ok: true, added: created.length, created: created, skipped: skippedD });
        }

        return J(400, { ok: false, error: "Unknown action" });
    } catch (e) {
        return J(500, { ok: false, error: "Server error" });
    }
};
