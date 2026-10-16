// netlify/functions/company-data.js
// Data & Imports engine for a company. Every call is tied to the signed-in login (owner or dispatch);
// the company comes from the login token and can never be named by the browser.
//
// POST { action, ... }  + Authorization: Bearer <login token>
//   export                          -> every table this company owns (JSON; the app also offers CSV per table)
//   pull_samsara { apiToken }       -> read-only copy of vehicles / drivers (key used once, never stored)
//   pull_motive  { apiKey }         -> same for Motive
//   ai_map { kind, headers, sample }-> which spreadsheet column is which field (free Gemini if GEMINI_API_KEY is set)
//   import_trucks | import_drivers | import_jobs { rows }
//   help_request { platform, notes, contact } -> "do it for me": emails POTENT with the company's details
// Env: AUTH_SECRET, SUPABASE_SERVICE_ROLE_KEY   (optional: GEMINI_API_KEY, MAILJET_API_KEY, MAILJET_SECRET_KEY, NOTIFY_EMAIL)
var crypto = require("crypto");
var billing = require("./lib/billing");

var SB = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
var ROLES = ["owner", "dispatch", "dispatcher"];
var EXPORT_TABLES = ["jobs", "junk_jobs", "recurring_routes", "fleet_vehicles", "fleet_maintenance", "driver_compliance", "vendors", "properties",
    "rate_cards", "service_zones", "job_templates", "storage_partners", "disposal_facilities"];
var FIELDS = {
    trucks: ["make", "model", "year", "plate", "vin", "color", "policy", "regexpiry", "insexpiry"],
    drivers: ["name", "email", "phone", "cdl", "cdlexpiry", "medexpiry"],
    jobs: ["customer", "company", "phone", "email", "origin", "destination", "service", "date", "price", "status", "paid", "notes", "ref"]
};

function J(status, obj) { return { statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(obj) }; }
function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function verify(token) {
    if (!token || typeof token !== "string" || token.indexOf(".") < 0) return null;
    var parts = token.split(".");
    var expect = b64u(crypto.createHmac("sha256", process.env.AUTH_SECRET).update(parts[0]).digest());
    var a = Buffer.from(parts[1] || ""), b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try { var p = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); return p.exp && p.exp >= Date.now() ? p : null; } catch (e) { return null; }
}
function sb(path, opts) {
    opts = opts || {};
    var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    var h = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
    if (opts.prefer) h.Prefer = opts.prefer;
    return fetch(SB + "/rest/v1/" + path, { method: opts.method || "GET", headers: h, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
        .then(function (r) { return r.text().then(function (t) { var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { d = t; } return { ok: r.ok, status: r.status, data: d }; }); });
}
function hashPw(pw) { var salt = crypto.randomBytes(16).toString("hex"); return "scrypt$" + salt + "$" + crypto.scryptSync(pw, salt, 32).toString("hex"); }
function tempPw() { var c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", o = "", b = crypto.randomBytes(10); for (var i = 0; i < 10; i++) o += c[b[i] % c.length]; return o; }
function clip(v, n) { return String(v == null ? "" : v).trim().slice(0, n); }
function rid(p) { return p + crypto.randomBytes(6).toString("hex"); }

// dates from spreadsheets: 2026-03-01, 3/1/2026, 3/1/26, or an Excel serial number
function toDate(v) {
    v = String(v == null ? "" : v).trim(); if (!v) return null;
    var m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2);
    m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) { var y = m[3].length === 2 ? "20" + m[3] : m[3]; return y + "-" + ("0" + m[1]).slice(-2) + "-" + ("0" + m[2]).slice(-2); }
    if (/^\d{5}(\.\d+)?$/.test(v)) { var d = new Date(Math.round((Number(v) - 25569) * 86400000)); return isNaN(d) ? null : d.toISOString().slice(0, 10); }
    return null;
}
function money(v) { var n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")); return isFinite(n) ? Math.round(n * 100) / 100 : null; }

var _potent = null;
async function potentOrgId() {
    if (_potent) return _potent;
    var r = await sb("organizations?slug=eq." + encodeURIComponent(process.env.POTENT_ORG_SLUG || "potent-logistics") + "&select=id");
    _potent = r.ok && Array.isArray(r.data) && r.data[0] ? String(r.data[0].id) : null;
    return _potent;
}
async function limitsOf(orgId) {
    var o = await sb("organizations?id=eq." + encodeURIComponent(orgId) + "&select=*");
    return billing.limitsFor(o.ok && Array.isArray(o.data) && o.data[0] ? o.data[0] : {});
}

// ── vendor APIs (read-only, the customer's own key) ──
async function getJson(url, headers) {
    var r = await fetch(url, { headers: Object.assign({ Accept: "application/json" }, headers) });
    var t = await r.text(); var d = null; try { d = JSON.parse(t); } catch (e) { }
    if (!r.ok) { var e2 = new Error(r.status === 401 || r.status === 403 ? "That key was rejected. Check it has read access." : "The other service answered with an error (" + r.status + ")."); e2.code = r.status; throw e2; }
    return d;
}
async function pullSamsara(token) {
    var H = { Authorization: "Bearer " + token }, trucks = [], drivers = [], after = "", i;
    for (i = 0; i < 40; i++) {
        var v = await getJson("https://api.samsara.com/fleet/vehicles?limit=512" + (after ? "&after=" + encodeURIComponent(after) : ""), H);
        (v.data || []).forEach(function (x) { trucks.push({ make: clip(x.make, 40), model: clip(x.model, 40), year: clip(x.year, 4), plate: clip(x.licensePlate, 20), vin: clip(x.vin, 20), color: "" }); });
        if (v.pagination && v.pagination.hasNextPage && v.pagination.endCursor) after = v.pagination.endCursor; else break;
    }
    after = "";
    for (i = 0; i < 40; i++) {
        var d = await getJson("https://api.samsara.com/fleet/drivers?limit=512" + (after ? "&after=" + encodeURIComponent(after) : ""), H);
        (d.data || []).forEach(function (x) { drivers.push({ name: clip(x.name, 80), email: clip(x.email || "", 120), phone: clip(x.phone, 30), cdl: clip(x.licenseNumber, 30) }); });
        if (d.pagination && d.pagination.hasNextPage && d.pagination.endCursor) after = d.pagination.endCursor; else break;
    }
    return { trucks: trucks, drivers: drivers };
}
async function pullMotive(key) {
    var H = { "X-Api-Key": key }, trucks = [], drivers = [], page = 1;
    for (; page <= 60; page++) {
        var v = await getJson("https://api.gomotive.com/v1/vehicles?per_page=100&page_no=" + page, H);
        var list = v.vehicles || [];
        list.forEach(function (w) { var x = w.vehicle || w; trucks.push({ make: clip(x.make, 40), model: clip(x.model, 40), year: clip(x.year, 4), plate: clip(x.license_plate_number, 20), vin: clip(x.vin, 20), color: "" }); });
        if (list.length < 100) break;
    }
    for (page = 1; page <= 60; page++) {
        var d = await getJson("https://api.gomotive.com/v1/users?role=driver&per_page=100&page_no=" + page, H);
        var us = d.users || [];
        us.forEach(function (w) { var x = w.user || w; drivers.push({ name: clip(((x.first_name || "") + " " + (x.last_name || "")).trim(), 80), email: clip(x.email, 120), phone: clip(x.phone, 30), cdl: clip(x.driver_license_number || x.driver_company_id || "", 30) }); });
        if (us.length < 100) break;
    }
    return { trucks: trucks, drivers: drivers };
}

// ── column matching: heuristics first, Gemini for anything left (optional, free key) ──
async function aiMap(kind, headers, sample) {
    var fields = FIELDS[kind]; if (!fields) return null;
    var key = process.env.GEMINI_API_KEY; if (!key) return null;
    var prompt = "A trucking company is importing a spreadsheet exported from another system (Samsara, Motive, TruckLogics, McLeod, QuickBooks or a custom sheet). " +
        "Match each target field to the ONE best source column header, or null if none fits.\nTarget fields: " + fields.join(", ") +
        "\nSource headers: " + JSON.stringify(headers) + "\nFirst rows: " + JSON.stringify(sample).slice(0, 3000) +
        "\nReply with ONLY a JSON object whose keys are the target fields and whose values are the exact header text or null.";
    var r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + (process.env.AI_MODEL || "gemini-flash-latest") + ":generateContent", {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: "application/json", maxOutputTokens: 600 } })
    });
    if (!r.ok) return null;
    var d = await r.json();
    var txt = ((d.candidates || [])[0] && d.candidates[0].content && d.candidates[0].content.parts || []).map(function (p) { return p.text || ""; }).join("");
    var obj = null; try { obj = JSON.parse(txt); } catch (e) { return null; }
    var out = {};
    fields.forEach(function (f) { var h = obj && obj[f]; if (typeof h === "string" && headers.indexOf(h) >= 0) out[f] = h; });
    return out;
}

async function mailTony(subject, text) {
    var key = process.env.MAILJET_API_KEY, secret = process.env.MAILJET_SECRET_KEY;
    var from = process.env.MAILJET_FROM_EMAIL || "potentlogistics@proton.me", to = process.env.NOTIFY_EMAIL || "potentlogistics@proton.me";
    console.log("POTENT migration help request: " + subject + "\n" + text);
    if (!key || !secret) return false;
    try {
        var r = await fetch("https://api.mailjet.com/v3.1/send", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Basic " + Buffer.from(key + ":" + secret).toString("base64") },
            body: JSON.stringify({ Messages: [{ From: { Email: from, Name: "POTENT OS" }, To: [{ Email: to }], Subject: subject, TextPart: text }] }) });
        return r.ok;
    } catch (e) { return false; }
}

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") return J(405, { ok: false, error: "POST only" });
    if (!process.env.AUTH_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) return J(500, { ok: false, error: "Server not configured" });
    var h = event.headers || {};
    var tok = verify(String(h.authorization || h.Authorization || "").replace(/^Bearer\s+/i, ""));
    if (!tok) return J(401, { ok: false, error: "Sign in again" });
    if (ROLES.indexOf(tok.role) < 0) return J(403, { ok: false, error: "Owner or dispatch only" });
    if (tok.assist) return J(403, { ok: false, error: "Not available in a support session" });
    if ((event.body || "").length > 3500000) return J(413, { ok: false, error: "That batch is too big. Send fewer rows at a time." });
    var b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return J(400, { ok: false, error: "Bad request" }); }
    var potent = await potentOrgId();
    var orgId = tok.orgId ? String(tok.orgId) : potent;
    if (!orgId) return J(500, { ok: false, error: "Company not found" });
    var isPotent = potent && orgId === potent;
    var a = String(b.action || "");

    try {
        // ───────── export ─────────
        if (a === "export") {
            var tables = {};
            for (var ti = 0; ti < EXPORT_TABLES.length; ti++) {
                var t = EXPORT_TABLES[ti];
                var r = await sb(t + "?org_id=eq." + encodeURIComponent(orgId) + "&select=*&limit=50000");
                if (r.ok && Array.isArray(r.data) && r.data.length) tables[t] = r.data;
            }
            var staff = await sb("org_users?org_id=eq." + encodeURIComponent(orgId) + "&select=id,name,email,phone,role,status,created_at&limit=5000");   // never password data
            if (staff.ok && Array.isArray(staff.data) && staff.data.length) tables.team = staff.data;
            return J(200, { ok: true, export: { generated: new Date().toISOString(), tables: tables } });
        }

        // ───────── pull from Samsara / Motive ─────────
        if (a === "pull_samsara" || a === "pull_motive") {
            var k = clip(a === "pull_samsara" ? b.apiToken : b.apiKey, 400);
            if (k.length < 10) return J(400, { ok: false, error: "Paste the key first." });
            var got;
            try { got = a === "pull_samsara" ? await pullSamsara(k) : await pullMotive(k); }
            catch (e) { return J(502, { ok: false, error: e.message || "Could not connect." }); }
            return J(200, { ok: true, trucks: got.trucks, drivers: got.drivers });
        }

        // ───────── smart column matching ─────────
        if (a === "ai_map") {
            var kind = String(b.kind || ""), headers = Array.isArray(b.headers) ? b.headers.slice(0, 80).map(function (x) { return clip(x, 80); }) : [];
            if (!FIELDS[kind] || !headers.length) return J(400, { ok: false, error: "Bad request" });
            var mapped = null; try { mapped = await aiMap(kind, headers, Array.isArray(b.sample) ? b.sample.slice(0, 5) : []); } catch (e) { mapped = null; }
            return J(200, { ok: true, ai: !!mapped, mapping: mapped || {} });
        }

        // ───────── done-for-you request ─────────
        if (a === "help_request") {
            var org = await sb("organizations?id=eq." + encodeURIComponent(orgId) + "&select=name,slug,owner_email");
            var o = org.ok && Array.isArray(org.data) && org.data[0] || {};
            var sent = await mailTony("Migration help requested: " + (o.name || orgId),
                "A company asked POTENT to move their data over.\n\nCompany: " + (o.name || "") + " (" + (o.slug || orgId) + ")\nOwner email: " + (o.owner_email || "") +
                "\nContact: " + clip(b.contact, 200) + "\nMoving from: " + clip(b.platform, 120) + "\nNotes: " + clip(b.notes, 1500));
            return J(200, { ok: true, emailed: sent });
        }

        // ───────── imports ─────────
        var rows = Array.isArray(b.rows) ? b.rows : null;
        if (a === "import_trucks" || a === "import_drivers" || a === "import_jobs") {
            if (!rows || !rows.length) return J(400, { ok: false, error: "Nothing to import" });
            if (rows.length > 1000) return J(400, { ok: false, error: "Send 1000 rows or fewer at a time" });
            var skipped = [];
            var low = function (s) { return String(s || "").trim().toLowerCase(); };

            if (a === "import_trucks") {
                var have = await sb("fleet_vehicles?org_id=eq." + encodeURIComponent(orgId) + "&select=id,vin,plate&limit=10000");
                var existing = Array.isArray(have.data) ? have.data : [];
                var seenV = {}, seenP = {};
                existing.forEach(function (x) { if (x.vin) seenV[low(x.vin)] = 1; if (x.plate) seenP[low(x.plate)] = 1; });
                var room = Infinity;
                if (!isPotent) { var lim = await limitsOf(orgId); if (lim.trucks !== null && lim.trucks !== undefined) room = Math.max(0, lim.trucks - existing.length); }
                var out = [];
                rows.forEach(function (x, i) {
                    var vin = clip(x.vin, 20).toUpperCase(), plate = clip(x.plate, 20).toUpperCase();
                    if (!vin && !plate && !(x.make && x.model)) { skipped.push({ row: i + 2, why: "No VIN, plate or make/model" }); return; }
                    if ((vin && seenV[low(vin)]) || (plate && seenP[low(plate)])) { skipped.push({ row: i + 2, why: "Already in your fleet" }); return; }
                    if (out.length >= room) { skipped.push({ row: i + 2, why: "Over your plan's truck limit" }); return; }
                    if (vin) seenV[low(vin)] = 1; if (plate) seenP[low(plate)] = 1;
                    out.push({ id: rid("imp_"), org_id: orgId, make: clip(x.make, 40), model: clip(x.model, 40), year: clip(x.year, 4), plate: plate, color: clip(x.color, 30), vin: vin,
                        ins_policy: clip(x.policy, 60), reg_expiry: toDate(x.regexpiry), ins_expiry: toDate(x.insexpiry), updated_at: new Date().toISOString() });
                });
                if (out.length) {
                    var ins = await sb("fleet_vehicles", { method: "POST", prefer: "return=minimal", body: out });
                    if (!ins.ok) return J(500, { ok: false, error: "Could not save the trucks. Nothing was added." });
                }
                return J(200, { ok: true, added: out.length, skipped: skipped });
            }

            if (a === "import_drivers") {
                var lim2 = isPotent ? null : await limitsOf(orgId);
                var act = await sb("org_users?org_id=eq." + encodeURIComponent(orgId) + "&role=eq.driver&status=eq.active&select=id&limit=10000");
                var used = Array.isArray(act.data) ? act.data.length : 0;
                var created = [], seenE = {};
                for (var i = 0; i < rows.length; i++) {
                    var x = rows[i], em = low(x.email), nm = clip(x.name, 80);
                    if (!nm) { skipped.push({ row: i + 2, why: "No name" }); continue; }
                    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { skipped.push({ row: i + 2, why: "Needs a valid email" }); continue; }
                    if (seenE[em]) { skipped.push({ row: i + 2, why: "Email repeated in this file" }); continue; }
                    if (lim2 && lim2.drivers !== null && lim2.drivers !== undefined && used + created.length >= lim2.drivers) { skipped.push({ row: i + 2, why: "Over your plan's driver limit" }); continue; }
                    var dupe = await sb("org_users?email=ilike." + encodeURIComponent(em) + "&select=id&limit=1");
                    if (dupe.ok && Array.isArray(dupe.data) && dupe.data.length) { skipped.push({ row: i + 2, why: "That email already has a login" }); continue; }
                    seenE[em] = 1;
                    var tp = tempPw();
                    var ad = await sb("org_users", { method: "POST", prefer: "return=representation", body: { org_id: orgId, name: nm, email: em, phone: clip(x.phone, 30), role: "driver", password_hash: hashPw(tp), status: "active" } });
                    var row = ad.ok && Array.isArray(ad.data) && ad.data[0];
                    if (!row) { skipped.push({ row: i + 2, why: "Could not create the login" }); continue; }
                    created.push({ name: nm, email: em, tempPassword: tp });
                    var cdlE = toDate(x.cdlexpiry), medE = toDate(x.medexpiry);
                    if (row.id && (cdlE || medE || x.cdl)) {
                        await sb("driver_compliance", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { user_id: String(row.id), org_id: orgId, cdl_number: clip(x.cdl, 40) || null, cdl_expiry: cdlE, med_card_expiry: medE } });
                    }
                }
                return J(200, { ok: true, added: created.length, created: created, skipped: skipped });
            }

            // import_jobs: past loads. Imported history is marked so it is easy to find.
            var JS = ["Completed", "Cancelled", "Confirmed", "New"];
            var jobs = [];
            rows.forEach(function (x, i) {
                var cust = clip(x.customer || x.company, 120);
                if (!cust) { skipped.push({ row: i + 2, why: "No customer name" }); return; }
                var price = money(x.price);
                var st = JS.filter(function (s) { return low(s) === low(x.status); })[0] || "Completed";
                jobs.push({ id: "IMP-" + crypto.randomBytes(5).toString("hex").toUpperCase(), org_id: orgId, customer: clip(x.customer || x.company, 120), company_name: clip(x.company, 120) || null,
                    phone: clip(x.phone, 30) || null, email: clip(x.email, 120) || null, origin: clip(x.origin, 200) || null, destination: clip(x.destination, 200) || null,
                    service: "imported", service_name: clip(x.service, 80) || "Imported load", date: toDate(x.date) || new Date().toISOString().slice(0, 10),
                    base_price: price, final_price: price, status: st, payment: /^(y|yes|true|paid|1)$/i.test(String(x.paid || "")) ? "paid" : "invoice",
                    notes: ("Imported" + (x.ref ? " · ref " + clip(x.ref, 40) : "") + (x.notes ? " · " + clip(x.notes, 400) : "")).slice(0, 600) });
            });
            if (jobs.length) {
                var ij = await sb("jobs", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: jobs });
                if (!ij.ok) return J(500, { ok: false, error: "Could not save the loads. Nothing was added." });
            }
            return J(200, { ok: true, added: jobs.length, skipped: skipped });
        }
        return J(400, { ok: false, error: "Unknown action" });
    } catch (e) {
        console.error("company-data failed:", e && e.message);
        return J(500, { ok: false, error: "Server error" });
    }
};
