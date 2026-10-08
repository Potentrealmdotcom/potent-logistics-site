// netlify/functions/data-api.js
// Tenant gateway for company data. Every request is tied to the signed-in login,
// so one company can never read or change another company's rows, and the
// truck limit for the plan is enforced here (exact, not a browser setting).
//
// Tables served (each has an org_id column; see RUN-THIS-SQL-69.sql):
//   voice_room_messages (team chat), driver_locations, fleet_vehicles,
//   fleet_maintenance, driver_compliance, brokers_carriers_backup,
//   storage_partners, safety_alerts
//
// Browser calls:  /.netlify/functions/data-api?t=<table>&q=<PostgREST query, URL-encoded>
//   with  Authorization: Bearer <login token>   and the same method/body it would have sent to Supabase.
// Public:         /.netlify/functions/data-api?track=<jobId>   -> latest driver position for that one job (customer tracking page)
//
// Env: AUTH_SECRET, SUPABASE_SERVICE_ROLE_KEY   (optional POTENT_ORG_SLUG, default potent-logistics)

var crypto = require("crypto");
var billing = require("./lib/billing");

var SB = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
var TABLES = {
    fleet_vehicles: { limit: "trucks", pk: "id" },
    fleet_maintenance: { pk: "id" },
    driver_locations: { pk: "driver_id" },
    voice_room_messages: { pk: "id" },
    driver_compliance: {},
    brokers_carriers_backup: { prefixId: true }, // fixed ids like "carriers"/"brokers" would collide across companies
    storage_partners: {},
    safety_alerts: {},
    // ── job operations (route legs, clock, scope changes) and vendor lists ──
    job_route_legs: { pk: "id" },
    job_events: { pk: "id", noPatch: true, noDelete: true },                 // audit trail: add-only
    job_scope_changes: { pk: "id", patchRoles: ["owner", "dispatch", "dispatcher"], noDelete: true },
    vendors: { pk: "id", writeRoles: ["owner", "dispatch", "dispatcher"] },
    disposal_facilities: { pk: "id", writeRoles: ["owner", "dispatch", "dispatcher"] },
    properties: { pk: "id", writeRoles: ["owner", "dispatch", "dispatcher"] },
    rate_cards: { pk: "id", writeRoles: ["owner", "dispatch", "dispatcher"], noDelete: true },   // versions are kept for the record
    service_zones: { pk: "id", writeRoles: ["owner", "dispatch", "dispatcher"] },
    job_templates: { pk: "id", writeRoles: ["owner", "dispatch", "dispatcher"] },
    potent_wallets: { pk: "id", writeRoles: [] },        // balances change only through the wallet actions below, never by a direct write
    wallet_transactions: { pk: "id", writeRoles: [] },
    quote_terms_acceptance: { pk: "id", writeRoles: [] },  // read-only for staff; rows are written only by the public booking route below
    // ── office records: staff only, one company each (RUN-THIS-SQL-77.sql adds org_id) ──
    audit_log_real: { pk: "id", noPatch: true, noDelete: true },
    expenses_real: { pk: "id", writeRoles: ["owner", "dispatch", "dispatcher"] },
    commission_rates_real: { writeRoles: ["owner"] },
    payment_references: { pk: "id", writeRoles: ["owner", "dispatch", "dispatcher"] },
    cost_profiles: { writeRoles: ["owner", "dispatch", "dispatcher"] },
    customer_rate_cards: { pk: "id", writeRoles: ["owner", "dispatch", "dispatcher"] },
    claims: { pk: "id", writeRoles: ["owner", "dispatch", "dispatcher"] },
    change_orders: { pk: "id", writeRoles: ["owner", "dispatch", "dispatcher"] },
    addon_authorizations: { pk: "id", writeRoles: ["owner", "dispatch", "dispatcher"] },
    my_documents: { pk: "id", writeRoles: ["owner", "dispatch", "dispatcher"] },
    deadlines: { pk: "id" },
    shift_handoffs: { pk: "id" },
    escalation_timers: { pk: "id" },
    site_profiles: {},
    customer_locations: {},
    incoming_loads: { pk: "id", writeRoles: ["owner", "dispatch", "dispatcher"] },
    user_display_names: {},
    revoked_users: { writeRoles: ["owner"] },
    // tables that customers also write from public forms (signed-out writes still go straight in, insert-only; staff reads come through here)
    receipts: {}, job_communications: {}, login_log: {}, push_subscriptions: {}, griffin_queries: {}, recurring_routes: {}, reviews: { writeRoles: ["owner", "dispatch", "dispatcher"] },
    // POTENT OS sales side: the POTENT login only
    waitlist: { potentOnly: true, writeRoles: ["owner", "dispatch", "dispatcher"] },
    os_prospects: { potentOnly: true, writeRoles: ["owner", "dispatch", "dispatcher"] },
    business_rules: { pk: "id", prefixId: true, writeRoles: ["owner"], noDelete: true },
    // ── core job tables: every row belongs to one company ──
    jobs: { pk: "id" },
    job_photos: { pk: "id" },
    junk_jobs: { pk: "id" },
    jobs_backup: { pk: "id", prefixId: true }                 // each company keeps its own snapshot row (POTENT keeps "all_jobs_snapshot")
};
var STAFF_ROLES = ["owner", "dispatch", "dispatcher", "driver"];

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
function sb(path, opts) {
    opts = opts || {};
    var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    var h = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
    if (opts.prefer) h.Prefer = opts.prefer;
    return fetch(SB + "/rest/v1/" + path, { method: opts.method || "GET", headers: h, body: opts.body })
        .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, status: r.status, text: t }; }); });
}
function parse(t) { try { return JSON.parse(t); } catch (e) { return null; } }

var _potent = null;
async function potentOrgId() {
    if (_potent) return _potent;
    var r = await sb("organizations?slug=eq." + encodeURIComponent(process.env.POTENT_ORG_SLUG || "potent-logistics") + "&select=id");
    var d = r.ok ? parse(r.text) : null;
    _potent = Array.isArray(d) && d[0] ? String(d[0].id) : null;
    return _potent;
}


// ── WALLET: one prepaid balance per customer email per company. Every change is a ledger row; the browser can never set a balance. ──
async function walletFor(org, email, name, create) {
    var r = await sb("potent_wallets?org_id=eq." + encodeURIComponent(org) + "&customer_email=eq." + encodeURIComponent(email) + "&select=*&limit=1");
    var rows = r.ok ? parse(r.text) : null;
    if (Array.isArray(rows) && rows[0]) return rows[0];
    if (!create) return null;
    var c = await sb("potent_wallets", { method: "POST", prefer: "return=representation", body: JSON.stringify({ org_id: org, customer_email: email, customer_name: name || null, available_balance: 0, reserved_balance: 0 }) });
    var cr = c.ok ? parse(c.text) : null;
    if (Array.isArray(cr) && cr[0]) return cr[0];
    var again = await sb("potent_wallets?org_id=eq." + encodeURIComponent(org) + "&customer_email=eq." + encodeURIComponent(email) + "&select=*&limit=1");   // lost a race with another request
    var ar = again.ok ? parse(again.text) : null;
    return Array.isArray(ar) && ar[0] ? ar[0] : null;
}
// delta > 0 adds, delta < 0 spends. The update only applies if the balance is still what we read (optimistic lock), so two requests can never spend the same dollars.
async function walletChange(org, w, delta, type, note, extra) {
    extra = extra || {};
    delta = Math.round(Number(delta) * 100) / 100;
    if (!isFinite(delta) || delta === 0) return { ok: false, error: "Bad amount" };
    for (var i = 0; i < 5; i++) {
        var cur = await sb("potent_wallets?id=eq." + encodeURIComponent(String(w.id)) + "&org_id=eq." + encodeURIComponent(org) + "&select=*&limit=1");
        var cr = cur.ok ? parse(cur.text) : null; if (!Array.isArray(cr) || !cr[0]) return { ok: false, error: "Wallet not found" };
        var bal = Math.round((Number(cr[0].available_balance) || 0) * 100) / 100, nb = Math.round((bal + delta) * 100) / 100;
        if (nb < 0) return { ok: false, error: "Not enough wallet balance", balance: bal };
        var up = await sb("potent_wallets?id=eq." + encodeURIComponent(String(w.id)) + "&org_id=eq." + encodeURIComponent(org) + "&available_balance=eq." + bal, { method: "PATCH", prefer: "return=representation", body: JSON.stringify({ available_balance: nb, updated_at: new Date().toISOString() }) });
        var ur = up.ok ? parse(up.text) : null;
        if (!up.ok) return { ok: false, error: "Could not update the wallet" };
        if (!Array.isArray(ur) || !ur.length) continue;       // someone else changed it first: read again
        var led = await sb("wallet_transactions", { method: "POST", prefer: "return=minimal", body: JSON.stringify({ wallet_id: w.id, org_id: org, type: type, amount: delta, balance_after: nb, note: String(note || "").slice(0, 200), booking_id: extra.job_id || null, provider_ref: extra.provider_ref || null, actor: extra.actor || null }) });
        if (!led.ok) {      // never leave a balance change without its ledger row: undo it
            await sb("potent_wallets?id=eq." + encodeURIComponent(String(w.id)) + "&org_id=eq." + encodeURIComponent(org) + "&available_balance=eq." + nb, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ available_balance: bal }) });
            return { ok: false, error: "Could not record the transaction" };
        }
        return { ok: true, balance: nb };
    }
    return { ok: false, error: "The wallet was busy. Try again." };
}
async function walletRefUsed(ref) {
    var a = await sb("wallet_transactions?provider_ref=eq." + encodeURIComponent(ref) + "&select=id&limit=1"), ar = a.ok ? parse(a.text) : [];
    var b = await sb("jobs?payment_intent_id=eq." + encodeURIComponent(ref) + "&select=id&limit=1"), br = b.ok ? parse(b.text) : [];
    return (Array.isArray(ar) && ar.length > 0) || (Array.isArray(br) && br.length > 0);
}
function owedOn(x) { return x.payment_status === "paid" ? 0 : Math.max(0, (Number(x.final_price) || 0) - (Number(x.amount_paid) || 0)); }
// pays the given jobs from the wallet, all or nothing
async function walletPayJobs(org, w, jobs, actor) {
    var total = Math.round(jobs.reduce(function (t, x) { return t + owedOn(x); }, 0) * 100) / 100;
    if (total <= 0) return { ok: true, charged: 0, paid: [] };
    var ids = jobs.filter(function (x) { return owedOn(x) > 0; }).map(function (x) { return String(x.id); });
    var ch = await walletChange(org, w, -total, "BOOKING_CAPTURE", "Paid " + ids.join(", "), { job_id: ids.length === 1 ? ids[0] : null, actor: actor });
    if (!ch.ok) return ch;
    for (var i = 0; i < jobs.length; i++) {
        if (owedOn(jobs[i]) <= 0) continue;
        var up = await sb("jobs?id=eq." + encodeURIComponent(String(jobs[i].id)) + "&org_id=eq." + encodeURIComponent(org), { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ payment_status: "paid", amount_paid: Number(jobs[i].final_price) || 0, payment_verified_at: new Date().toISOString(), payment: "wallet" }) });
        if (!up.ok) { await walletChange(org, w, total, "REFUND", "Job update failed; returned", { actor: "system" }); return { ok: false, error: "Could not mark the job paid. Nothing was charged." }; }
    }
    return { ok: true, charged: total, balance: ch.balance, paid: ids };
}
var _stripe = null;
function getStripe() { if (!_stripe) _stripe = require("stripe")(process.env.STRIPE_SECRET_KEY); return _stripe; }
var TERMS_HITS = {};
var SAFE_Q = /^[A-Za-z0-9_.,=&%*()\-:+ ]{0,800}$/;
var SAFE_PREFER = /^[a-z=,\-]+$/;

exports.handler = async function (event) {
    if (!process.env.AUTH_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) return J(500, { error: "Server not configured" });
    var qs = event.queryStringParameters || {};

    // ── public: customer tracking for ONE job ───────────────────
    if (qs.track) {
        var jid = String(qs.track);
        if (!/^[A-Za-z0-9\-_.]{1,60}$/.test(jid)) return J(400, { error: "Bad job id" });
        var tr = await sb("driver_locations?job_id=eq." + encodeURIComponent(jid) + "&select=*&order=updated_at.desc&limit=1");
        var rows = tr.ok ? parse(tr.text) : null;
        if (!Array.isArray(rows)) return J(200, []);
        // only what the tracking map needs
        return J(200, rows.map(function (r) { return { job_id: r.job_id, lat: r.lat, lng: r.lng, lon: r.lon, heading: r.heading, speed: r.speed, updated_at: r.updated_at, status: r.status }; }));
    }

    // ── public: how many hours per weekday are already committed to recurring routes (for the recurring request form) ──
    if (qs.capacity) {
        var cpo = await potentOrgId();
        if (!cpo) return J(500, { error: "Company not found" });
        var cr = await sb("recurring_routes?status=eq.active&org_id=eq." + encodeURIComponent(cpo) + "&select=days_of_week,base_hours");
        var crr = cr.ok ? parse(cr.text) : null;
        return J(200, (Array.isArray(crr) ? crr : []).map(function (x) { return { days_of_week: x.days_of_week, base_hours: x.base_hours }; }));
    }

    // ── public: record that a customer accepted the terms at booking ──
    // Writes ONE row into quote_terms_acceptance for POTENT's own booking site. IP and device come from the request, not the browser.
    if (qs.terms) {
        if (event.httpMethod !== "POST") return J(405, { error: "POST only" });
        var hh = event.headers || {};
        var ip = String(hh["x-nf-client-connection-ip"] || hh["X-Nf-Client-Connection-Ip"] || String(hh["x-forwarded-for"] || "").split(",")[0] || "").trim().slice(0, 64);
        var nowH = Math.floor(Date.now() / 3600000), rk = ip + ":" + nowH;
        TERMS_HITS[rk] = (TERMS_HITS[rk] || 0) + 1;
        if (TERMS_HITS[rk] > 40) return J(429, { error: "Too many requests" });
        var tb = parse(event.body || "null");
        if (!tb || typeof tb !== "object" || !/^[A-Za-z0-9\-_.]{1,60}$/.test(String(tb.job_id || ""))) return J(400, { error: "Bad request" });
        var potentId = await potentOrgId();
        if (!potentId) return J(500, { error: "Company not found" });
        var clip = function (v, n) { return v == null ? null : String(v).slice(0, n); };
        var row = { org_id: potentId, job_id: String(tb.job_id), terms_version: clip(tb.terms_version, 20), tos_version: clip(tb.tos_version, 20), accepted: true,
            customer_name: clip(tb.customer_name, 120), customer_email: clip(tb.customer_email, 160), source: clip(tb.source, 30) || "booking",
            ip: ip || null, user_agent: clip(hh["user-agent"] || hh["User-Agent"], 300), accepted_at: new Date().toISOString() };
        var ins = await sb("quote_terms_acceptance", { method: "POST", body: JSON.stringify(row), prefer: "return=minimal" });
        return J(ins.ok ? 200 : 500, { ok: !!ins.ok });
    }

    // ── public: a customer books a job (no login). Only whitelisted fields; the company comes from the site, never from the browser's claim of a row id ──
    var JOB_COLS = ["id", "customer", "phone", "email", "service", "service_name", "origin", "destination", "zone", "speed", "base_price", "final_price", "status", "payment", "discreet",
        "is_business", "customer_type", "company_name", "payment_terms", "date", "time_slot", "notes", "miles", "fuel_cost", "helper_hours", "weight_tier", "payment_intent_id", "paid_online",
        "heavy_fee", "heavy_lbs", "heavy_items", "est_total_lbs", "trips"];
    if (qs.book) {
        if (event.httpMethod !== "POST") return J(405, { error: "POST only" });
        var hb = event.headers || {};
        var ipb = String(hb["x-nf-client-connection-ip"] || hb["X-Nf-Client-Connection-Ip"] || String(hb["x-forwarded-for"] || "").split(",")[0] || "").trim().slice(0, 64);
        var kb = "b:" + ipb + ":" + Math.floor(Date.now() / 3600000);
        TERMS_HITS[kb] = (TERMS_HITS[kb] || 0) + 1;
        if (TERMS_HITS[kb] > 25) return J(429, { error: "Too many requests" });
        if ((event.body || "").length > 20000) return J(413, { error: "Too large" });
        var bb = parse(event.body || "null");
        if (!bb || typeof bb !== "object" || !/^[A-Za-z0-9\-_.]{1,60}$/.test(String(bb.id || ""))) return J(400, { error: "Bad request" });
        var slug = String(bb.org_slug || process.env.POTENT_ORG_SLUG || "potent-logistics");
        if (!/^[a-z0-9\-]{1,60}$/.test(slug)) return J(400, { error: "Bad company" });
        var orr = await sb("organizations?slug=eq." + encodeURIComponent(slug) + "&select=id");
        var od0 = orr.ok ? parse(orr.text) : null;
        if (!Array.isArray(od0) || !od0[0]) return J(404, { error: "Company not found" });
        var rowb = {};
        JOB_COLS.forEach(function (c) { if (bb[c] !== undefined) rowb[c] = bb[c]; });
        rowb.org_id = String(od0[0].id);
        rowb.status = ["New", "Confirmed", "Pending Quote"].indexOf(rowb.status) >= 0 ? rowb.status : "New";   // a customer can never create a job already assigned or paid
        var insb = await sb("jobs", { method: "POST", body: JSON.stringify(rowb), prefer: "resolution=ignore-duplicates,return=minimal" });
        return J(insb.ok ? 200 : 500, { ok: !!insb.ok });
    }

    // ── public: a customer attaches a photo of their paperwork (BOL) to their own job ──
    if (qs.bol) {
        if (event.httpMethod !== "POST") return J(405, { error: "POST only" });
        var hp = event.headers || {};
        var ipp = String(hp["x-nf-client-connection-ip"] || hp["X-Nf-Client-Connection-Ip"] || String(hp["x-forwarded-for"] || "").split(",")[0] || "").trim().slice(0, 64);
        var kp = "p:" + ipp + ":" + Math.floor(Date.now() / 3600000);
        TERMS_HITS[kp] = (TERMS_HITS[kp] || 0) + 1;
        if (TERMS_HITS[kp] > 30) return J(429, { error: "Too many requests" });
        var pb = parse(event.body || "null");
        if (!pb || !/^[A-Za-z0-9\-_.]{1,60}$/.test(String(pb.job_id || ""))) return J(400, { error: "Bad request" });
        var jr = await sb("jobs?id=eq." + encodeURIComponent(String(pb.job_id)) + "&select=id,org_id&limit=1");
        var jrows = jr.ok ? parse(jr.text) : null;
        if (pb.check) return J(200, { ok: Array.isArray(jrows) && jrows.length > 0 });       // "does this job id exist" for the upload page; reveals nothing else
        if (!Array.isArray(jrows) || !jrows.length) return J(404, { error: "Job not found" });
        if (typeof pb.url !== "string" || pb.url.indexOf(SB + "/storage/v1/object/public/job-photos/") !== 0 || pb.url.length > 400) return J(400, { error: "Bad photo" });
        var insp = await sb("job_photos", { method: "POST", body: JSON.stringify({ job_id: String(pb.job_id), org_id: jrows[0].org_id, url: pb.url, photo_type: "customer_bol", uploaded_by: "Customer" }), prefer: "return=minimal" });
        return J(insp.ok ? 200 : 500, { ok: !!insp.ok });
    }

    // ── customer portal: a signed-in CUSTOMER sees only the jobs booked with their own email ──
    // ?portal=data  -> their jobs, completion photos, matching rate cards and properties
    // ?portal=repeat (POST {job_id, date, time_slot}) -> a repeat request, created as "Pending Quote" for the office to confirm
    if (qs.portal) {
        var ph = event.headers || {};
        var ptok = verify(String(ph.authorization || ph.Authorization || "").replace(/^Bearer\s+/i, ""));
        if (!ptok || ptok.role !== "customer" || String(ptok.uid || "").indexOf("cust:") !== 0) return J(401, { error: "Sign in again" });
        var pemail = String(ptok.uid).slice(5).toLowerCase();
        if (!pemail || pemail.length > 160 || /[\s,()*%]/.test(pemail)) return J(400, { error: "Bad account" });
        var porg = await potentOrgId();
        if (!porg) return J(500, { error: "Company not found" });
        var pk = "pt:" + pemail + ":" + Math.floor(Date.now() / 60000);
        TERMS_HITS[pk] = (TERMS_HITS[pk] || 0) + 1;
        if (TERMS_HITS[pk] > 40) return J(429, { error: "Too many requests" });
        // ilike treats _ and % as wildcards, so the result is re-checked for an exact (case-insensitive) match
        var mine = async function () {
            var r = await sb("jobs?org_id=eq." + encodeURIComponent(porg) + "&email=ilike." + encodeURIComponent(pemail.replace(/[%_]/g, "*")) + "&select=*&order=date.desc&limit=500");
            var rows = r.ok ? parse(r.text) : null;
            return Array.isArray(rows) ? rows.filter(function (x) { return String(x.email || "").trim().toLowerCase() === pemail; }) : null;
        };
        if (qs.portal === "data") {
            var myJobs = await mine();
            if (!myJobs) return J(500, { error: "Could not load your jobs" });
            var SAFE = ["id", "customer", "phone", "email", "service", "service_name", "origin", "destination", "date", "time_slot", "status", "base_price", "final_price", "heavy_fee", "payment", "paid_online", "payment_status", "amount_paid", "payment_terms", "company_name", "customer_type", "is_business", "miles", "weight_tier"];
            var outJobs = myJobs.map(function (x) { var o = {}; SAFE.forEach(function (c) { o[c] = x[c]; }); return o; });
            var ids = outJobs.map(function (x) { return String(x.id); }).filter(function (x) { return /^[A-Za-z0-9\-_.]{1,60}$/.test(x); }).slice(0, 100);
            var photos = [];
            if (ids.length) {
                var pr = await sb("job_photos?org_id=eq." + encodeURIComponent(porg) + "&job_id=in.(" + ids.map(encodeURIComponent).join(",") + ")&stage=in.(after,complete,disposal)&select=job_id,url,stage,taken_at&limit=300");
                var pp = pr.ok ? parse(pr.text) : null;
                if (Array.isArray(pp)) photos = pp;
            }
            var names = {}; outJobs.forEach(function (x) { [x.customer, x.company_name].forEach(function (n) { n = String(n || "").trim().toLowerCase(); if (n) names[n] = 1; }); });
            var cards = [], props = [];
            var rc = await sb("rate_cards?org_id=eq." + encodeURIComponent(porg) + "&status=eq.active&select=name,version,effective_date,customer,rates,notes&limit=200");
            var rcr = rc.ok ? parse(rc.text) : null;
            if (Array.isArray(rcr)) cards = rcr.filter(function (c) { return c.customer && names[String(c.customer).trim().toLowerCase()]; });
            var pq = await sb("properties?org_id=eq." + encodeURIComponent(porg) + "&select=company,name,address,access_notes,hours&limit=300");
            var pqr = pq.ok ? parse(pq.text) : null;
            if (Array.isArray(pqr)) props = pqr.filter(function (p) { return p.company && names[String(p.company).trim().toLowerCase()]; }).map(function (p) { return { company: p.company, name: p.name, address: p.address }; });
            return J(200, { ok: true, jobs: outJobs, photos: photos, rate_cards: cards, properties: props });
        }
        if (qs.portal === "repeat") {
            if (event.httpMethod !== "POST") return J(405, { error: "POST only" });
            var rb = parse(event.body || "null");
            if (!rb || !/^[A-Za-z0-9\-_.]{1,60}$/.test(String(rb.job_id || ""))) return J(400, { error: "Bad request" });
            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(rb.date || "")) || rb.date < new Date().toISOString().slice(0, 10)) return J(400, { error: "Pick a date that is today or later." });
            var all = await mine();
            var src = all && all.find(function (x) { return String(x.id) === String(rb.job_id); });
            if (!src) return J(404, { error: "Job not found on your account" });
            var COPY = ["customer", "phone", "email", "service", "service_name", "origin", "destination", "zone", "speed", "base_price", "final_price", "payment", "discreet", "is_business", "customer_type", "company_name", "payment_terms", "weight_tier", "heavy_fee", "heavy_lbs", "heavy_items", "est_total_lbs", "trips", "miles"];
            var nr = {}; COPY.forEach(function (c) { if (src[c] !== undefined && src[c] !== null) nr[c] = src[c]; });
            nr.id = "RPT-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
            nr.org_id = porg; nr.status = "Pending Quote"; nr.date = rb.date;
            nr.time_slot = String(rb.time_slot || "").slice(0, 40);
            nr.notes = "REPEAT REQUEST of " + src.id + " from the customer portal. Office confirms the date and price.";
            nr.paid_online = false; nr.payment_intent_id = null;
            var ins = await sb("jobs", { method: "POST", body: JSON.stringify(nr), prefer: "return=minimal" });
            return J(ins.ok ? 200 : 500, ins.ok ? { ok: true, id: nr.id } : { error: "Could not save the request" });
        }
        // Notes thread on one of the customer's own jobs (they can read it and add a message; nothing else)
        if (qs.portal === "notes") {
            if (event.httpMethod !== "POST") return J(405, { error: "POST only" });
            var nb = parse(event.body || "null");
            var njid = String((nb && nb.job_id) || "");
            if (!/^[A-Za-z0-9\-_.]{1,60}$/.test(njid)) return J(400, { error: "Bad request" });
            var nall = await mine(); var nmine = nall ? nall.filter(function (x) { return String(x.id) === njid; }) : [];
            if (!nmine.length) return J(404, { error: "Job not found on your account" });
            if (!nb.read) {
                var nmsg = String((nb && nb.message) || "").trim().slice(0, 1000);
                if (!nmsg) return J(400, { error: "Write a message first" });
                var nins = await sb("job_communications", { method: "POST", prefer: "return=minimal", body: JSON.stringify({ job_id: njid, org_id: porg, author: "Customer", message: nmsg, source: "customer_message" }) });
                return nins.ok ? J(200, { ok: true }) : J(500, { error: "Could not save your message" });
            }
            var nr = await sb("job_communications?job_id=eq." + encodeURIComponent(njid) + "&org_id=eq." + encodeURIComponent(porg) + "&source=eq.customer_message&select=author,message,source,created_at&order=created_at.asc&limit=200");
            var nrows = nr.ok ? parse(nr.text) : [];
            return J(200, { ok: true, messages: Array.isArray(nrows) ? nrows : [] });
        }
        if (qs.portal === "wallet") {
            var w0 = await walletFor(porg, pemail, null, true);
            if (!w0) return J(500, { error: "Could not open your wallet" });
            var tx = await sb("wallet_transactions?wallet_id=eq." + encodeURIComponent(String(w0.id)) + "&select=type,amount,note,created_at,balance_after&order=created_at.desc&limit=30");
            var txr = tx.ok ? parse(tx.text) : [];
            return J(200, { ok: true, balance: Number(w0.available_balance) || 0, reserved: Number(w0.reserved_balance) || 0, txns: Array.isArray(txr) ? txr : [] });
        }
        // Add money: only after Stripe confirms the payment. The credit is the amount Stripe actually collected.
        if (qs.portal === "walletfund") {
            if (event.httpMethod !== "POST") return J(405, { error: "POST only" });
            var fb = parse(event.body || "null"); var fpi = fb ? String(fb.payment_intent_id || "") : "";
            if (!/^pi_[A-Za-z0-9_]{6,100}$/.test(fpi)) return J(400, { error: "Bad request" });
            var fpiObj;
            try { fpiObj = await getStripe().paymentIntents.retrieve(fpi); } catch (e) { return J(502, { error: "Could not confirm the payment with Stripe" }); }
            if (!fpiObj || fpiObj.status !== "succeeded") return J(402, { error: "Stripe has not confirmed this payment" });
            if (await walletRefUsed(fpi)) return J(409, { error: "This payment was already applied" });
            var fw = await walletFor(porg, pemail, null, true); if (!fw) return J(500, { error: "Could not open your wallet" });
            var fch = await walletChange(porg, fw, fpiObj.amount / 100, "PURCHASE", "Wallet funding", { provider_ref: fpi, actor: pemail });
            return fch.ok ? J(200, { ok: true, balance: fch.balance }) : J(500, { error: fch.error + (fch.error === "Could not record the transaction" ? ". Call us; do not pay again." : "") });
        }
        if (qs.portal === "walletpay") {
            if (event.httpMethod !== "POST") return J(405, { error: "POST only" });
            var wb = parse(event.body || "null");
            var wids = wb && Array.isArray(wb.job_ids) ? wb.job_ids.map(String).filter(function (x) { return /^[A-Za-z0-9\-_.]{1,60}$/.test(x); }).slice(0, 50) : [];
            if (!wids.length) return J(400, { error: "Bad request" });
            var wall = await mine(); var wmine = wall ? wall.filter(function (x) { return wids.indexOf(String(x.id)) >= 0; }) : [];
            if (!wmine.length || wmine.length !== wids.length) return J(404, { error: "Job not found on your account" });
            var ww = await walletFor(porg, pemail, null, true); if (!ww) return J(500, { error: "Could not open your wallet" });
            var wp = await walletPayJobs(porg, ww, wmine, pemail);
            return wp.ok ? J(200, wp) : J(wp.error === "Not enough wallet balance" ? 402 : 500, { error: wp.error, balance: wp.balance });
        }
        // The browser says "I paid"; the server asks Stripe. Jobs are marked paid only when Stripe confirms a succeeded payment that covers them.
        if (qs.portal === "paid") {
            if (event.httpMethod !== "POST") return J(405, { error: "POST only" });
            var yb = parse(event.body || "null");
            var yids = yb && Array.isArray(yb.job_ids) ? yb.job_ids.map(String).filter(function (x) { return /^[A-Za-z0-9\-_.]{1,60}$/.test(x); }).slice(0, 50) : [];
            var piId = yb ? String(yb.payment_intent_id || "") : "";
            if (!yids.length || !/^pi_[A-Za-z0-9_]{6,100}$/.test(piId)) return J(400, { error: "Bad request" });
            var yall = await mine();
            var ymine = yall ? yall.filter(function (x) { return yids.indexOf(String(x.id)) >= 0; }) : [];
            if (!ymine.length || ymine.length !== yids.length) return J(404, { error: "Job not found on your account" });
            var pi;
            try { pi = await getStripe().paymentIntents.retrieve(piId); } catch (e) { return J(502, { error: "Could not confirm the payment with Stripe" }); }
            if (!pi || pi.status !== "succeeded") return J(402, { error: "Stripe has not confirmed this payment" });
            var owed = ymine.reduce(function (t, x) { return t + (x.payment_status === "paid" ? 0 : Math.max(0, (Number(x.final_price) || 0) - (Number(x.amount_paid) || 0))); }, 0);
            if (pi.amount < Math.round(owed * 100)) return J(402, { error: "The payment does not cover these jobs" });
            if (await sb("wallet_transactions?provider_ref=eq." + encodeURIComponent(piId) + "&select=id&limit=1").then(function (x) { var d = x.ok ? parse(x.text) : []; return Array.isArray(d) && d.length > 0; })) return J(409, { error: "This payment was already applied to your wallet" });
            var dup = await sb("jobs?payment_intent_id=eq." + encodeURIComponent(piId) + "&select=id");
            var dr = dup.ok ? parse(dup.text) : [];
            if (Array.isArray(dr) && dr.some(function (x) { return yids.indexOf(String(x.id)) < 0; })) return J(409, { error: "This payment was already applied to other jobs" });
            for (var yi = 0; yi < ymine.length; yi++) {
                var yj = ymine[yi];
                var up = await sb("jobs?id=eq." + encodeURIComponent(String(yj.id)) + "&org_id=eq." + encodeURIComponent(porg), { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ payment_status: "paid", amount_paid: Number(yj.final_price) || 0, payment_verified_at: new Date().toISOString(), payment_intent_id: piId, paid_online: true }) });
                if (!up.ok) return J(500, { error: "Payment confirmed but the job could not be updated. Call us; do not pay again." });
            }
            return J(200, { ok: true, paid: yids });
        }
        return J(400, { error: "Unknown portal request" });
    }

    var h = event.headers || {};
    var auth = h.authorization || h.Authorization || "";
    var tok = verify(auth.replace(/^Bearer\s+/i, ""));
    if (!tok) return J(401, { error: "Sign in again" });
    if (STAFF_ROLES.indexOf(tok.role) < 0) return J(403, { error: "Not allowed" });

    // ── payout method: each signed-in person sets and sees only their own; the owner can see the list. Bank numbers are refused. ──
    if (qs.payout) {
        if (event.httpMethod !== "POST") return J(405, { error: "POST only" });
        var yorg = tok.orgId ? String(tok.orgId) : await potentOrgId();
        if (!yorg) return J(500, { error: "Company not found" });
        var yuid = String(tok.uid || "").slice(0, 80);
        if (!yuid) return J(400, { error: "Sign in again" });
        var yb = parse(event.body || "null") || {};
        if (qs.payout === "get") {
            var gy = await sb("payout_methods?org_id=eq." + encodeURIComponent(yorg) + "&user_id=eq." + encodeURIComponent(yuid) + "&select=method,handle,address,note&limit=1");
            var gyr = gy.ok ? parse(gy.text) : [];
            return J(200, { ok: true, row: Array.isArray(gyr) && gyr[0] ? gyr[0] : null });
        }
        if (qs.payout === "list") {
            if (tok.role !== "owner") return J(403, { error: "Only the owner can see everyone's payout method." });
            var ly = await sb("payout_methods?org_id=eq." + encodeURIComponent(yorg) + "&select=user_id,user_name,method,handle,address,note&order=updated_at.desc&limit=300");
            var lyr = ly.ok ? parse(ly.text) : [];
            return J(200, { ok: true, rows: Array.isArray(lyr) ? lyr : [] });
        }
        if (qs.payout === "set") {
            var METHODS = ["zelle", "cash_app", "check", "stripe_connect", "other"];
            var ym = String(yb.method || "");
            if (METHODS.indexOf(ym) < 0) return J(400, { error: "Pick a payout method." });
            var cl = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n); };
            var yrow = { org_id: yorg, user_id: yuid, user_name: cl(yb.user_name || tok.name || yuid, 80), method: ym, handle: cl(yb.handle, 120), address: cl(yb.address, 200), note: cl(yb.note, 200), updated_at: new Date().toISOString() };
            // a bank account or routing number has no place here (Stripe collects those securely)
            if ([yrow.handle, yrow.address, yrow.note].some(function (v) { var dg = v.replace(/\D/g, ""); return dg.length >= 8 && !/@/.test(v) && !((dg.length === 10 || dg.length === 11) && /^[\d\s().+\-]+$/.test(v)); })) return J(400, { error: "That looks like a bank number. Do not type bank numbers here. Choose Direct deposit through Stripe instead." });
            if (ym === "check" && !yrow.address) return J(400, { error: "Enter the mailing address for checks." });
            if ((ym === "zelle" || ym === "cash_app" || ym === "other") && !yrow.handle) return J(400, { error: "Enter your Zelle, Cash App or payout details." });
            var ex = await sb("payout_methods?org_id=eq." + encodeURIComponent(yorg) + "&user_id=eq." + encodeURIComponent(yuid) + "&select=user_id&limit=1");
            var exr = ex.ok ? parse(ex.text) : [];
            var wr = Array.isArray(exr) && exr[0]
                ? await sb("payout_methods?org_id=eq." + encodeURIComponent(yorg) + "&user_id=eq." + encodeURIComponent(yuid), { method: "PATCH", body: JSON.stringify(yrow), prefer: "return=minimal" })
                : await sb("payout_methods", { method: "POST", body: JSON.stringify(yrow), prefer: "return=minimal" });
            return wr.ok ? J(200, { ok: true }) : J(500, { error: "Could not save" });
        }
        return J(400, { error: "Unknown payout action" });
    }

    // ── staff wallet actions: charge a wallet (dispatch/owner), add money received outside the app (owner), auto-charge a finished job ──
    if (qs.wallet) {
        if (tok.role === "driver") return J(403, { error: "Only the owner or dispatch can use wallets." });
        if (event.httpMethod !== "POST") return J(405, { error: "POST only" });
        var sorg = tok.orgId ? String(tok.orgId) : await potentOrgId();
        if (!sorg) return J(500, { error: "Company not found" });
        var sb0 = parse(event.body || "null") || {};
        var actor = String(tok.uid || tok.role).slice(0, 60);
        if (qs.wallet === "autocharge") {
            var ajid = String(sb0.job_id || ""); if (!/^[A-Za-z0-9\-_.]{1,60}$/.test(ajid)) return J(400, { error: "Bad job id" });
            var aj = await sb("jobs?id=eq." + encodeURIComponent(ajid) + "&org_id=eq." + encodeURIComponent(sorg) + "&select=*&limit=1"), ajr = aj.ok ? parse(aj.text) : null;
            if (!Array.isArray(ajr) || !ajr[0]) return J(200, { ok: true, charged: 0, reason: "job not found" });
            var jemail = String(ajr[0].email || "").trim().toLowerCase();
            if (!jemail) return J(200, { ok: true, charged: 0, reason: "no customer email" });
            if (owedOn(ajr[0]) <= 0) return J(200, { ok: true, charged: 0, reason: "already paid" });
            var acct = await sb("customer_accounts?email=eq." + encodeURIComponent(jemail) + "&select=autopay_enabled&limit=1"), acr = acct.ok ? parse(acct.text) : null;
            if (!Array.isArray(acr) || !acr[0] || !acr[0].autopay_enabled) return J(200, { ok: true, charged: 0, reason: "autopay is off" });
            var aw = await walletFor(sorg, jemail, null, false);
            if (!aw) return J(200, { ok: true, charged: 0, reason: "no wallet" });
            if ((Number(aw.available_balance) || 0) < owedOn(ajr[0])) return J(200, { ok: true, charged: 0, reason: "balance too low" });
            var ap = await walletPayJobs(sorg, aw, [ajr[0]], "autopay");
            return J(200, ap.ok ? { ok: true, job_id: ajid, charged: ap.charged, balance: ap.balance } : { ok: false, error: ap.error });
        }
        var wem = String(sb0.email || "").trim().toLowerCase(), wamt = Math.round(Number(sb0.amount) * 100) / 100;
        if (!wem || wem.length > 160 || !(wamt > 0) || wamt > 100000) return J(400, { error: "Enter the customer's email and an amount." });
        var note = String(sb0.note || "").slice(0, 160);
        if (qs.wallet === "credit") {
            if (tok.role !== "owner") return J(403, { error: "Only the owner can add money to a wallet." });
            if (!note) return J(400, { error: "Add a note saying where the money came from (cash, check, refund...)." });
            var cw = await walletFor(sorg, wem, sb0.name, true); if (!cw) return J(500, { error: "Could not open the wallet" });
            var cc = await walletChange(sorg, cw, wamt, "CREDIT", note, { actor: actor });
            return cc.ok ? J(200, { ok: true, balance: cc.balance }) : J(500, { error: cc.error });
        }
        if (qs.wallet === "charge") {
            var gw = await walletFor(sorg, wem, null, false);
            if (!gw) return J(404, { error: "That customer has no wallet." });
            var gc = await walletChange(sorg, gw, -wamt, "BOOKING_CAPTURE", note || "Charge", { job_id: sb0.job_id ? String(sb0.job_id).slice(0, 60) : null, actor: actor });
            return gc.ok ? J(200, { ok: true, balance: gc.balance }) : J(gc.error === "Not enough wallet balance" ? 402 : 500, { error: gc.error, balance: gc.balance });
        }
        return J(400, { error: "Unknown wallet action" });
    }

    var table = String(qs.t || "");
    var cfg = TABLES[table];
    if (!cfg) return J(400, { error: "Unknown table" });
    var orgId = tok.orgId ? String(tok.orgId) : await potentOrgId();
    if (!orgId) return J(500, { error: "Company not found" });
    var isPotent = !tok.orgId;
    if (cfg.potentOnly && !isPotent) return J(403, { error: "Not available for your company." });

    var q = String(qs.q || "");
    try { q = decodeURIComponent(q); } catch (e) { /* keep as is */ }
    if (!SAFE_Q.test(q) || /org_id/i.test(q)) return J(400, { error: "Bad query" });
    var method = event.httpMethod;
    if (["GET", "POST", "PATCH", "DELETE"].indexOf(method) < 0) return J(405, { error: "Method not allowed" });
    if (method === "DELETE" && !q) return J(400, { error: "Filter required" });
    if (method !== "GET") {
        if (cfg.writeRoles && cfg.writeRoles.indexOf(tok.role) < 0) return J(403, { error: "Only the owner or dispatch can change this." });
        if (method === "PATCH" && (cfg.noPatch || (cfg.patchRoles && cfg.patchRoles.indexOf(tok.role) < 0))) return J(403, { error: "Only the owner or dispatch can change this." });
        if (method === "DELETE" && cfg.noDelete) return J(403, { error: "This record cannot be deleted." });
    }

    // drivers can ask, not decide: no assigning jobs, no price changes
    var DRIVER_LOCKED = ["assigned_driver", "assigned_to", "assignedTo", "assigned_driver_name", "final_price", "price_total", "price_job", "base_price", "heavy_fee", "status_override"];
    if (tok.role === "driver" && method === "PATCH" && (table === "junk_jobs" || table === "jobs")) {
        var pbody = parse(event.body || "null");
        if (pbody && typeof pbody === "object" && DRIVER_LOCKED.some(function (k) { return Object.prototype.hasOwnProperty.call(pbody, k); })) return J(403, { error: "Only dispatch can assign jobs or change prices. Send a request instead." });
    }
    if (tok.role === "driver" && method === "DELETE" && (table === "junk_jobs" || table === "jobs" || table === "job_photos")) return J(403, { error: "Drivers cannot delete job records." });
    if (table === "job_events" && method === "POST") {
        var evBody = parse(event.body || "null"); var evList = Array.isArray(evBody) ? evBody : [evBody];
        var PHOTO_REQ = { ARRIVED: "arrival", LOADING_START: "before", LOADING_END: "loaded", UNLOADING_END: "dropoff", JOB_COMPLETE: "complete" };
        for (var ei = 0; ei < evList.length; ei++) {
            var ev0 = evList[ei] || {};
            if ((ev0.event === "CLAIM_APPROVED" || ev0.event === "CLAIM_DECLINED") && ["owner", "dispatch", "dispatcher"].indexOf(tok.role) < 0) return J(403, { error: "Only dispatch can approve a job request." });
            if (tok.role === "driver" && ev0.kind === "stage" && PHOTO_REQ[ev0.event]) {
                if (/PHOTO SKIPPED/i.test(String(ev0.note || ""))) return J(403, { error: "Only the office can skip a photo." });
                var ph = await sb("job_photos?job_id=eq." + encodeURIComponent(String(ev0.job_id || "")) + "&stage=eq." + PHOTO_REQ[ev0.event] + "&org_id=eq." + encodeURIComponent(orgId) + "&select=id&limit=1");
                var phr = ph.ok ? parse(ph.text) : null;
                if (!Array.isArray(phr) || !phr.length) return J(409, { error: "A photo is required for this step. Take it first." });
            }
        }
    }

    // fixed ids are namespaced per company (POTENT's existing rows keep their ids)
    var prefix = cfg.prefixId && !isPotent ? orgId + ":" : "";
    if (prefix) {
        if (/(^|&)id=in\./.test(q)) return J(400, { error: "Unsupported filter" });
        q = q.replace(/(^|&)id=(eq|neq)\.([^&]*)/g, function (m, a, op, v) { return a + "id=" + op + "." + prefix + v; });
    }
    var path = table + "?" + q + (q ? "&" : "") + "org_id=eq." + encodeURIComponent(orgId);

    var opts = { method: method };
    var pref = h.prefer || h.Prefer;
    if (pref && SAFE_PREFER.test(pref)) opts.prefer = pref;

    if (method === "POST" || method === "PATCH") {
        var data = parse(event.body || "null");
        if (data === null || typeof data !== "object") return J(400, { error: "Bad body" });
        var list = Array.isArray(data) ? data : [data];
        if (method === "POST") {
            list = list.map(function (r) {
                var o = Object.assign({}, r); o.org_id = orgId;
                if (table === "job_events" || table === "job_scope_changes") { o.actor = tok.uid || null; o.actor_role = tok.role; }
                if (table === "job_scope_changes" && tok.role === "driver") { // a driver can ask, never decide or price
                    o.status = "pending"; delete o.new_price; delete o.decided_at; delete o.decided_by;
                }
                if (prefix && o.id !== undefined) o.id = prefix + o.id;
                return o;
            });
            // never let an upsert take over another company's row that happens to share an id
            if (cfg.pk) {
                var ids = list.map(function (r) { return r[cfg.pk]; }).filter(function (v) { return v !== undefined && v !== null; }).map(String);
                if (ids.some(function (v) { return !/^[A-Za-z0-9_.:\-]{1,80}$/.test(v); })) return J(400, { error: "Bad id" });
                if (ids.length) {
                    var own = await sb(table + "?" + cfg.pk + "=in.(" + ids.map(encodeURIComponent).join(",") + ")&select=" + cfg.pk + ",org_id");
                    var ownRows = own.ok ? parse(own.text) : [];
                    if ((Array.isArray(ownRows) ? ownRows : []).some(function (r) { return r.org_id !== null && r.org_id !== undefined && String(r.org_id) !== orgId; })) return J(403, { error: "That record belongs to another company." });
                }
            }
            // exact seat limit for trucks, from the company's plan
            if (cfg.limit && !isPotent) {
                var org = await sb("organizations?id=eq." + encodeURIComponent(orgId) + "&select=*");
                var od = org.ok ? parse(org.text) : null;
                var lim = billing.limitsFor(Array.isArray(od) && od[0] ? od[0] : {});
                var cap = lim[cfg.limit];
                if (cap !== null && cap !== undefined) {
                    var ex = await sb(table + "?org_id=eq." + encodeURIComponent(orgId) + "&select=id");
                    var have = ex.ok ? parse(ex.text) : [];
                    var haveIds = {}; (Array.isArray(have) ? have : []).forEach(function (r) { haveIds[String(r.id)] = true; });
                    var fresh = list.filter(function (r) { return r.id === undefined || !haveIds[String(r.id)]; }).length;
                    if ((Array.isArray(have) ? have.length : 0) + fresh > cap) {
                        return J(403, { error: "Your " + lim.tier.charAt(0).toUpperCase() + lim.tier.slice(1) + " plan allows " + cap + " trucks. Contact POTENT to upgrade.", limit: cap });
                    }
                }
            }
            opts.body = JSON.stringify(Array.isArray(data) ? list : list[0]);
        } else {
            var patch = Object.assign({}, list[0]); delete patch.org_id; delete patch.id;
            if (table === "job_scope_changes") { delete patch.actor; delete patch.actor_role; if (patch.status) { patch.decided_by = tok.uid || null; patch.decided_at = new Date().toISOString(); } }
            opts.body = JSON.stringify(patch);
        }
    }

    var r = await sb(path, opts);
    var out = r.text;
    if (prefix && r.ok && out) {
        var rows2 = parse(out);
        if (Array.isArray(rows2)) {
            rows2.forEach(function (row) { if (row && typeof row.id === "string" && row.id.indexOf(prefix) === 0) row.id = row.id.slice(prefix.length); });
            out = JSON.stringify(rows2);
        }
    }
    return { statusCode: r.status, headers: { "Content-Type": "application/json" }, body: out || "" };
};
