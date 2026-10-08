// netlify/functions/auth.js
// Server-side login for POTENT OS. Passwords never ship in app.js.
//
// Required Netlify environment variables:
//   SUPABASE_SERVICE_ROLE_KEY  - Supabase > Settings > API > service_role (secret!)
//   AUTH_SECRET                - any long random string (signs login tokens)
//   STAFF_PASSWORDS_JSON       - {"potent":{"p":"...","r":"owner"},"dispatch1":{"p":"...","r":"dispatch"},...}
//
// Actions (POST JSON { action, ... }):
//   staff        { userId, password }                 POTENT team login
//   company      { email, password }                  customer-company login (org_users)
//   setpw        { token, userId, newPassword }       POTENT owner changes a team password
//   createorg    { token, org }                       POTENT owner creates company + owner login
//   liststaff    { token }                            company owner: list own staff
//   addstaff     { token, name, email, phone, role }  company owner: add staff (returns temp password)
//   removestaff  { token, id }                        company owner: disable a staff login
//   resetstaff   { token, id }                        company owner: new temp password
//   savepricing  { token, config }                    company owner: their own services/prices
//   setorg       { token, id, fields }                POTENT owner: plan/limits/status for a company
//   custlogin / custsignup / custautopay               customer portal accounts
//   getbranding / savebranding { token, branding }     company: logo/colors/company info (PAID only)
//   mybilling    { token }                             company owner: plan, support, invoices, payout status
//   connectstart / connectstatus { token }             company owner (PAID): connect their OWN Stripe account
//   paylink      { token, amount, description, email } company owner/dispatch (PAID): payment link that pays THEM
//   partnersignup / partnerlogin                       public: carrier partner accounts (hashed passwords)
//   setupstatus / saveprofile / setupmark { token }       Get Started checklist, USDOT/MC, send-from email
//   assist { token, orgId }                              POTENT owner: 60-minute logged session inside a customer account
//   partnerlist / partnerdecide { token }              staff: review partner applications for their own company
//   listorgs / orgdetail { token, id }                 POTENT owner: all customers, license/support status
//   addinvoice / setinvoice / linkinvoices / resetowner POTENT owner: invoices, billing, owner-login reset

var crypto = require("crypto");
var billing = require("./lib/billing");

var SB = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
var TOKEN_TTL_MS = 30 * 24 * 3600 * 1000;

function J(status, obj) {
    return { statusCode: status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}
function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function sign(payload) {
    var body = b64u(JSON.stringify(payload));
    var sig = b64u(crypto.createHmac("sha256", process.env.AUTH_SECRET).update(body).digest());
    return body + "." + sig;
}
function verify(token) {
    if (!token || typeof token !== "string" || token.indexOf(".") < 0) return null;
    var parts = token.split(".");
    var expect = b64u(crypto.createHmac("sha256", process.env.AUTH_SECRET).update(parts[0]).digest());
    var a = Buffer.from(parts[1] || ""), b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        var p = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
        if (!p.exp || p.exp < Date.now()) return null;
        return p;
    } catch (e) { return null; }
}

// stored password formats supported: scrypt$salt$hash (new), 64-hex sha256, plain text (legacy)
function hashPw(pw) {
    var salt = crypto.randomBytes(16).toString("hex");
    var h = crypto.scryptSync(pw, salt, 32).toString("hex");
    return "scrypt$" + salt + "$" + h;
}
function eq(a, b) {
    var x = Buffer.from(String(a)), y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function checkPw(stored, pw) {
    if (!stored || !pw) return false;
    if (stored.indexOf("scrypt$") === 0) {
        var p = stored.split("$");
        return eq(crypto.scryptSync(pw, p[1], 32).toString("hex"), p[2]);
    }
    if (/^[0-9a-f]{64}$/.test(stored)) return eq(crypto.createHash("sha256").update(pw).digest("hex"), stored);
    return eq(stored, pw);
}
function tempPw() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var out = "";
    var bytes = crypto.randomBytes(10);
    for (var i = 0; i < 10; i++) out += chars[bytes[i] % chars.length];
    return out;
}

function sb(path, opts) {
    opts = opts || {};
    var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return fetch(SB + "/rest/v1/" + path, {
        method: opts.method || "GET",
        headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: opts.prefer || "return=representation" },
        body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) { return r.text().then(function (t) { var d; try { d = JSON.parse(t); } catch (e) { d = t; } return { ok: r.ok, status: r.status, data: d }; }); });
}

// brute-force brake (per warm instance)
var fails = {};
function tooMany(key) {
    var now = Date.now();
    var f = (fails[key] || []).filter(function (t) { return now - t < 15 * 60 * 1000; });
    fails[key] = f;
    return f.length >= 8;
}
function noteFail(key) { (fails[key] = fails[key] || []).push(Date.now()); }

// Default seat limits by plan (POTENT can override per company with setorg).
// trucks/drivers: Starter 10, Growth 50, Fleet 150, Enterprise 300. Dispatch profiles: up to 100 on every tier, unlimited on Enterprise.
var TIER_DEFAULTS = billing.TIER_DEFAULTS;
var limitsFor = billing.limitsFor;

// POTENT Care monthly support defaults (POTENT can override per company with support_price)
var SUPPORT_DEFAULTS = { starter: 149, growth: 249, fleet: 399, enterprise: 599 };
var LICENSE_STATUSES = ["unpaid", "paid", "flex_active", "past_due", "suspended"];
var SUPPORT_STATUSES = ["none", "active", "past_due", "cancelled"];
var FLEX_STATUSES = ["active", "past_due", "complete"];
var INVOICE_KINDS = ["license", "flex_down", "flex_installment", "support", "other"];
var INVOICE_STATUSES = ["open", "paid", "failed", "void"];

function supportPriceFor(org) {
    var d = SUPPORT_DEFAULTS[String(org.plan || "starter").toLowerCase()] || 0;
    return org.support_price !== null && org.support_price !== undefined && org.support_price !== "" && isFinite(Number(org.support_price)) ? Number(org.support_price) : d;
}
// What a company's own user is allowed to see about its account
function billingView(org) {
    return {
        plan: String(org.plan || "starter").toLowerCase(),
        license_status: org.license_status || "unpaid",
        support_status: org.support_status || "none",
        support_price: supportPriceFor(org),
        flex_status: org.flex_status || null, flex_paid: Number(org.flex_paid || 0), flex_total: Number(org.flex_total || 0),
        payout_status: org.payout_status || "not_connected",
        paid: billing.isPaid(org)
    };
}
var HEX = /^#[0-9a-fA-F]{6}$/;
var LOGO = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/;
// Only what we choose to expose. Logo is stored as a small data URL (no storage bucket for the customer to manage).
function cleanBranding(b, old) {
    b = b || {}; old = old || {};
    var out = {};
    out.companyName = b.companyName !== undefined ? cleanStr(b.companyName, 80) : (old.companyName || "");
    out.tagline = b.tagline !== undefined ? cleanStr(b.tagline, 120) : (old.tagline || "");
    out.phone = b.phone !== undefined ? cleanStr(b.phone, 30) : (old.phone || "");
    out.email = b.email !== undefined ? cleanStr(b.email, 120) : (old.email || "");
    out.website = b.website !== undefined ? cleanStr(b.website, 120) : (old.website || "");
    out.address = b.address !== undefined ? cleanStr(b.address, 160) : (old.address || "");
    out.welcomeMessage = b.welcomeMessage !== undefined ? cleanStr(b.welcomeMessage, 200) : (old.welcomeMessage || "");
    out.primaryColor = b.primaryColor !== undefined ? (HEX.test(b.primaryColor) ? b.primaryColor : (old.primaryColor || "")) : (old.primaryColor || "");
    out.accentColor = b.accentColor !== undefined ? (HEX.test(b.accentColor) ? b.accentColor : (old.accentColor || "")) : (old.accentColor || "");
    if (b.logo === "") out.logo = "";
    else if (typeof b.logo === "string" && b.logo.length <= 250000 && LOGO.test(b.logo)) out.logo = b.logo;
    else out.logo = old.logo || "";
    return out;
}
function flatForm(obj, prefix, out) {
    out = out || [];
    Object.keys(obj).forEach(function (k) {
        var v = obj[k], key = prefix ? prefix + "[" + k + "]" : k;
        if (v === undefined || v === null) return;
        if (typeof v === "object") flatForm(v, key, out); else out.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(v)));
    });
    return out;
}
// Minimal Stripe REST call (no SDK). acct = connected account id for direct charges.
function stripeReq(method, path, params, acct) {
    var h = { Authorization: "Bearer " + process.env.STRIPE_SECRET_KEY, "Content-Type": "application/x-www-form-urlencoded" };
    if (acct) h["Stripe-Account"] = acct;
    return fetch("https://api.stripe.com/v1/" + path, { method: method, headers: h, body: method === "GET" ? undefined : flatForm(params || {}).join("&") })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) { var e = new Error((d.error && d.error.message) || "Stripe error"); e.stripe = true; throw e; } return d; }); });
}
function siteBase() { return process.env.URL || "https://potentoperations.netlify.app"; }
async function loadOrg(id) {
    var r = await sb("organizations?id=eq." + encodeURIComponent(id) + "&select=*");
    return r.ok && Array.isArray(r.data) ? r.data[0] || null : null;
}
// Recompute one company's license/support/Flex status from its invoice rows
async function refreshOrg(orgId) {
    var inv = await sb("license_invoices?org_id=eq." + encodeURIComponent(orgId) + "&select=*&order=created_at.asc");
    var st = billing.deriveStatus(inv.ok && Array.isArray(inv.data) ? inv.data : []);
    var patch = { license_status: st.license_status, support_status: st.support_status, flex_status: st.flex_status, flex_paid: st.flex_paid };
    if (st.flex_total) patch.flex_total = st.flex_total;
    await sb("organizations?id=eq." + encodeURIComponent(orgId), { method: "PATCH", prefer: "return=minimal", body: patch });
    return st;
}


// POTENT's own organization row (partner applications and legacy data belong to it)
var _potentOrg = null;
async function potentOrgId() {
    if (_potentOrg) return _potentOrg;
    var r = await sb("organizations?slug=eq." + encodeURIComponent(process.env.POTENT_ORG_SLUG || "potent-logistics") + "&select=id");
    _potentOrg = r.ok && Array.isArray(r.data) && r.data[0] ? String(r.data[0].id) : null;
    return _potentOrg;
}
var PARTNER_FIELDS = ["dot_number", "mc_number", "company_name", "ein", "phone_number", "id_image_url", "selfie_url", "payment_method", "factoring_company_name", "noa_url", "terms_version"];
function stripSecret(p) { var o = Object.assign({}, p); delete o.account_password; return o; }

function cleanNum(v, max) { var n = Number(v); return isFinite(n) && n >= 0 ? Math.min(Math.round(n * 100) / 100, max || 1000000) : 0; }
function cleanStr(v, n) { return String(v == null ? "" : v).replace(/[<>]/g, "").trim().slice(0, n || 120); }
function cleanPricing(c) {
    c = c || {};
    var out = { services: [], speeds: [], singleItem: null, extraStopFee: cleanNum(c.extraStopFee, 10000), cashDiscountPct: Math.min(cleanNum(c.cashDiscountPct, 100), 50) };
    (Array.isArray(c.services) ? c.services : []).slice(0, 40).forEach(function (sv, i) {
        var model = ["zone", "flat", "permile"].indexOf(sv.model) > -1 ? sv.model : "zone";
        out.services.push({
            id: "svc" + (i + 1), name: cleanStr(sv.name, 60) || ("Service " + (i + 1)), tagline: cleanStr(sv.tagline, 120), desc: cleanStr(sv.desc, 300), model: model,
            local: cleanNum(sv.local, 1000000), regional: cleanNum(sv.regional, 1000000), longdist: cleanNum(sv.longdist, 1000000),
            flat: cleanNum(sv.flat, 1000000), perMile: cleanNum(sv.perMile, 1000), minimum: cleanNum(sv.minimum, 1000000)
        });
    });
    (Array.isArray(c.speeds) ? c.speeds : []).slice(0, 8).forEach(function (sp, i) {
        out.speeds.push({ id: i === 0 ? "standard" : "speed" + i, label: cleanStr(sp.label, 40) || (i === 0 ? "Standard" : "Rush"), mult: i === 0 ? 1 : Math.max(1, Math.min(cleanNum(sp.mult, 10), 10)) });
    });
    if (!out.speeds.length) out.speeds.push({ id: "standard", label: "Standard", mult: 1 });
    if (c.singleItem && c.singleItem.enabled) out.singleItem = { enabled: true, scheduled: cleanNum(c.singleItem.scheduled, 1000000), sameday: cleanNum(c.singleItem.sameday, 1000000), rush: cleanNum(c.singleItem.rush, 1000000) };
    return out;
}

function staffMap() {
    try { return JSON.parse(process.env.STAFF_PASSWORDS_JSON || "{}"); } catch (e) { return {}; }
}

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") return J(405, { ok: false, error: "POST only" });
    if (!process.env.AUTH_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return J(500, { ok: false, error: "Server not configured (missing AUTH_SECRET or SUPABASE_SERVICE_ROLE_KEY)." });
    }
    var body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { return J(400, { ok: false, error: "Bad JSON" }); }
    var action = body.action;

    try {
        // ── POTENT team login ─────────────────────────────────────
        if (action === "staff") {
            var uid = String(body.userId || "");
            var limitKey = "staff:" + uid;
            if (tooMany(limitKey)) return J(429, { ok: false, error: "Too many attempts. Try again in 15 minutes." });
            var rec = staffMap()[uid];
            if (!rec) { noteFail(limitKey); return J(401, { ok: false, error: "Wrong password" }); }

            var rev = await sb("revoked_users?user_id=eq." + encodeURIComponent(uid) + "&select=user_id");
            if (rev.ok && Array.isArray(rev.data) && rev.data.length) return J(403, { ok: false, error: "revoked" });

            var okPw = false;
            var ov = await sb("user_password_overrides?user_id=eq." + encodeURIComponent(uid) + "&select=password");
            if (ov.ok && Array.isArray(ov.data) && ov.data[0] && ov.data[0].password) okPw = checkPw(ov.data[0].password, body.password);
            if (!okPw) okPw = checkPw(rec.p, body.password) && !(ov.ok && Array.isArray(ov.data) && ov.data[0] && ov.data[0].password);
            if (!okPw) { noteFail(limitKey); return J(401, { ok: false, error: "Wrong password" }); }

            var role = rec.r || "dispatch";
            return J(200, { ok: true, token: sign({ uid: uid, role: role, orgId: null, exp: Date.now() + TOKEN_TTL_MS }), role: role });
        }

        // ── Company login ─────────────────────────────────────────
        if (action === "company") {
            var email = String(body.email || "").trim().toLowerCase();
            var limitKey2 = "co:" + email;
            if (tooMany(limitKey2)) return J(429, { ok: false, error: "Too many attempts. Try again in 15 minutes." });
            var u = await sb("org_users?email=ilike." + encodeURIComponent(email) + "&select=*");
            var row = u.ok && Array.isArray(u.data) ? u.data.find(function (r) {
                return (!r.status || r.status === "active") && String(r.email || "").toLowerCase() === email && checkPw(r.password_hash, body.password);
            }) : null;
            if (!row) { noteFail(limitKey2); return J(401, { ok: false, error: "Wrong email or password." }); }
            var o = await sb("organizations?id=eq." + row.org_id + "&select=*");
            var org = o.ok && Array.isArray(o.data) ? o.data[0] : null;
            if (!org) return J(404, { ok: false, error: "Company account not found." });
            if (org.status && ["suspended", "cancelled", "canceled", "inactive"].indexOf(String(org.status).toLowerCase()) > -1) {
                return J(403, { ok: false, error: "This company account is not active. Contact POTENT." });
            }
            return J(200, {
                ok: true,
                token: sign({ uid: "org-" + row.id, role: row.role === "owner" ? "owner" : (row.role || "dispatch"), orgId: org.id, exp: Date.now() + TOKEN_TTL_MS }),
                user: { id: "org-" + row.id, name: row.name || email, role: row.role === "owner" ? "owner" : (row.role || "dispatch") },
                org: { id: org.id, slug: org.slug, name: org.name },
                limits: limitsFor(org),
                pricing: org.pricing_config || null,
                billing: billingView(org),
                branding: billing.isPaid(org) ? (org.branding || null) : null
            });
        }

        // ── Customer portal accounts (customer_accounts) ──────────
        if (action === "custlogin") {
            var cem = String(body.email || "").trim().toLowerCase();
            var ck = "cust:" + cem;
            if (tooMany(ck)) return J(429, { ok: false, error: "Too many attempts. Try again in 15 minutes." });
            var ca = await sb("customer_accounts?email=eq." + encodeURIComponent(cem) + "&select=*");
            var acct = ca.ok && Array.isArray(ca.data) ? ca.data[0] : null;
            if (!acct || !checkPw(acct.password, body.password)) { noteFail(ck); return J(401, { ok: false, error: "Wrong email or password." }); }
            if (String(acct.password).indexOf("scrypt$") !== 0) {
                // upgrade legacy plain-text password to a hash on first successful login
                await sb("customer_accounts?email=eq." + encodeURIComponent(cem), { method: "PATCH", prefer: "return=minimal", body: { password: hashPw(String(body.password)) } });
            }
            return J(200, { ok: true, token: sign({ uid: "cust:" + cem, role: "customer", orgId: null, exp: Date.now() + TOKEN_TTL_MS }), autopay_enabled: !!acct.autopay_enabled, account_role: acct.account_role || "admin" });
        }
        if (action === "custsignup") {
            var sem = String(body.email || "").trim().toLowerCase();
            if (!sem || !body.password || String(body.password).length < 6) return J(400, { ok: false, error: "Enter your email and a password (at least 6 characters)." });
            var ex = await sb("customer_accounts?email=eq." + encodeURIComponent(sem) + "&select=email");
            if (ex.ok && Array.isArray(ex.data) && ex.data.length) return J(409, { ok: false, error: "An account with that email already exists. Use Sign In, or call us to reset it." });
            var mk = await sb("customer_accounts", { method: "POST", prefer: "return=minimal", body: { email: sem, password: hashPw(String(body.password)) } });
            if (!mk.ok) return J(500, { ok: false, error: "Could not create account." });
            return J(200, { ok: true, token: sign({ uid: "cust:" + sem, role: "customer", orgId: null, exp: Date.now() + TOKEN_TTL_MS }), autopay_enabled: false, account_role: "admin" });
        }


        // ── Partner (carrier) accounts: passwords are hashed, never readable with the public key ──
        if (action === "partnersignup") {
            var ip = String((event.headers && (event.headers["x-nf-client-connection-ip"] || event.headers["x-forwarded-for"])) || "x").split(",")[0].trim();
            var pk = "ps:" + ip;
            if (tooMany(pk)) return J(429, { ok: false, error: "Too many submissions. Try again later." });
            noteFail(pk);
            var pf = body.profile || {};
            if (!pf.company_name || !pf.phone_number) return J(400, { ok: false, error: "Company name and phone are required." });
            if (!pf.account_password || String(pf.account_password).length < 6) return J(400, { ok: false, error: "Password must be at least 6 characters." });
            var prow = {};
            PARTNER_FIELDS.forEach(function (k) { if (pf[k] !== undefined && pf[k] !== null) prow[k] = cleanStr(pf[k], 400); });
            prow.verification_status = "pending";
            prow.account_password = hashPw(String(pf.account_password));
            prow.terms_agreed = pf.terms_agreed === true;
            prow.terms_agreed_at = pf.terms_agreed ? new Date().toISOString() : null;
            if (pf.fmcsa_data && typeof pf.fmcsa_data === "object") prow.fmcsa_data = pf.fmcsa_data;
            var po = await potentOrgId(); if (po) prow.org_id = po;
            var pins = await sb("carrier_profiles", { method: "POST", prefer: "return=minimal", body: prow });
            return pins.ok ? J(200, { ok: true }) : J(500, { ok: false, error: "Could not save your application." });
        }
        if (action === "partnerlogin") {
            var dm = String(body.dotOrMc || "").trim();
            if (!/^[A-Za-z0-9\-]{1,20}$/.test(dm) || !body.password) return J(400, { ok: false, error: "Enter your DOT/MC number and password." });
            var plk = "pl:" + dm;
            if (tooMany(plk)) return J(429, { ok: false, error: "Too many attempts. Try again in 15 minutes." });
            var pr = await sb("carrier_profiles?or=(dot_number.eq." + encodeURIComponent(dm) + ",mc_number.eq." + encodeURIComponent(dm) + ")&select=*");
            var pm = pr.ok && Array.isArray(pr.data) ? pr.data.find(function (p) { return checkPw(p.account_password, body.password); }) : null;
            if (!pm) { noteFail(plk); return J(401, { ok: false, error: "No account found with that DOT/MC number and password." }); }
            if (String(pm.account_password).indexOf("scrypt$") !== 0) await sb("carrier_profiles?id=eq." + encodeURIComponent(pm.id), { method: "PATCH", prefer: "return=minimal", body: { account_password: hashPw(String(body.password)) } });
            return J(200, { ok: true, profile: stripSecret(pm), token: sign({ uid: "partner:" + pm.id, role: "partner", orgId: null, exp: Date.now() + TOKEN_TTL_MS }) });
        }

        // everything below needs a valid token
        var tok = verify(body.token);
        if (!tok) return J(401, { ok: false, error: "Session expired. Sign in again." });


        // ── Staff: review partner applications (scoped to the staff member's own company) ──
        if (action === "partnerlist" || action === "partnerdecide") {
            if (tok.role !== "owner" && tok.role !== "dispatch") return J(403, { ok: false, error: "Staff only" });
            var scope = tok.orgId ? String(tok.orgId) : await potentOrgId();
            if (!scope) return J(500, { ok: false, error: "Company not found" });
            if (action === "partnerlist") {
                var pst = ["pending", "verified", "failed"].indexOf(body.status) > -1 ? body.status : "pending";
                var pl = await sb("carrier_profiles?org_id=eq." + encodeURIComponent(scope) + "&verification_status=eq." + pst + "&select=*&order=created_at.desc");
                return J(200, { ok: true, rows: (pl.ok && Array.isArray(pl.data) ? pl.data : []).map(stripSecret) });
            }
            if (["verified", "failed", "pending"].indexOf(body.status) < 0) return J(400, { ok: false, error: "Bad status" });
            var pd = await sb("carrier_profiles?id=eq." + encodeURIComponent(body.id) + "&org_id=eq." + encodeURIComponent(scope), { method: "PATCH", prefer: "return=minimal", body: { verification_status: body.status } });
            return pd.ok ? J(200, { ok: true }) : J(500, { ok: false, error: "Could not update." });
        }

        if (action === "custautopay") {
            if (!tok.uid || tok.uid.indexOf("cust:") !== 0) return J(403, { ok: false, error: "Customers only" });
            var up2 = await sb("customer_accounts?email=eq." + encodeURIComponent(tok.uid.slice(5)), { method: "PATCH", prefer: "return=minimal", body: { autopay_enabled: !!body.enabled, autopay_authorized_at: body.enabled ? new Date().toISOString() : null } });
            return up2.ok ? J(200, { ok: true }) : J(500, { ok: false, error: "Could not update autopay." });
        }


        // ── Company: branding, billing view, payouts (scoped to the token's org) ──
        if (["getbranding", "savebranding", "mybilling", "connectstart", "connectstatus", "paylink"].indexOf(action) > -1) {
            if (!tok.orgId) return J(403, { ok: false, error: "Company accounts only" });
            var myOrg = await loadOrg(tok.orgId);
            if (!myOrg) return J(404, { ok: false, error: "Company not found" });
            var isPaidOrg = billing.isPaid(myOrg);
            var PAID_MSG = "This feature is part of a paid POTENT OS license. Contact POTENT to activate it.";

            if (action === "getbranding") {
                return J(200, { ok: true, paid: isPaidOrg, branding: isPaidOrg ? (myOrg.branding || {}) : null });
            }
            if (tok.role !== "owner" && action !== "paylink") return J(403, { ok: false, error: "Company owner only" });
            if (action === "savebranding") {
                if (!isPaidOrg) return J(403, { ok: false, error: PAID_MSG });
                var nb = cleanBranding(body.branding, myOrg.branding);
                var sbr = await sb("organizations?id=eq." + encodeURIComponent(tok.orgId), { method: "PATCH", prefer: "return=minimal", body: { branding: nb } });
                return sbr.ok ? J(200, { ok: true, branding: nb }) : J(500, { ok: false, error: "Could not save branding." });
            }
            if (action === "mybilling") {
                var myInv = await sb("license_invoices?org_id=eq." + encodeURIComponent(tok.orgId) + "&select=id,kind,description,amount,status,provider,due_date,paid_at,created_at&order=created_at.desc&limit=100");
                return J(200, { ok: true, billing: billingView(myOrg), invoices: myInv.ok && Array.isArray(myInv.data) ? myInv.data : [] });
            }
            if (action === "connectstart") {
                if (!isPaidOrg) return J(403, { ok: false, error: PAID_MSG });
                if (!process.env.STRIPE_SECRET_KEY) return J(500, { ok: false, error: "Payments are not configured yet. Contact POTENT." });
                try {
                    var acctId = myOrg.stripe_account_id;
                    if (!acctId) {
                        var created = await stripeReq("POST", "accounts", { type: "standard", email: myOrg.owner_email || undefined, business_profile: { name: myOrg.name }, metadata: { org_id: String(myOrg.id) } });
                        acctId = created.id;
                        await sb("organizations?id=eq." + encodeURIComponent(tok.orgId), { method: "PATCH", prefer: "return=minimal", body: { stripe_account_id: acctId, payout_status: "pending" } });
                    }
                    var link = await stripeReq("POST", "account_links", { account: acctId, refresh_url: siteBase() + "/?connect=refresh", return_url: siteBase() + "/?connect=return", type: "account_onboarding" });
                    return J(200, { ok: true, url: link.url });
                } catch (e) { return J(502, { ok: false, error: "Could not start payout setup: " + (e.stripe ? e.message : "try again") }); }
            }
            if (action === "connectstatus") {
                if (!myOrg.stripe_account_id) return J(200, { ok: true, status: "not_connected" });
                try {
                    var ac = await stripeReq("GET", "accounts/" + encodeURIComponent(myOrg.stripe_account_id));
                    var st2 = ac.charges_enabled && ac.payouts_enabled ? "active" : (ac.details_submitted ? "pending_review" : "pending");
                    if (st2 !== myOrg.payout_status) await sb("organizations?id=eq." + encodeURIComponent(tok.orgId), { method: "PATCH", prefer: "return=minimal", body: { payout_status: st2 } });
                    return J(200, { ok: true, status: st2 });
                } catch (e) { return J(502, { ok: false, error: "Could not check payout status." }); }
            }
            if (action === "paylink") {
                if (!isPaidOrg) return J(403, { ok: false, error: PAID_MSG });
                if (tok.role !== "owner" && tok.role !== "dispatch") return J(403, { ok: false, error: "Owner or dispatch only" });
                if (!myOrg.stripe_account_id || myOrg.payout_status !== "active") return J(400, { ok: false, error: "Connect your payout account first (Settings > Get Paid)." });
                var amt = Number(body.amount);
                if (!isFinite(amt) || amt < 1 || amt > 100000) return J(400, { ok: false, error: "Enter an amount between $1 and $100,000." });
                try {
                    var sess = await stripeReq("POST", "checkout/sessions", {
                        mode: "payment",
                        line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: Math.round(amt * 100), product_data: { name: cleanStr(body.description, 120) || ("Payment to " + myOrg.name) } } }],
                        customer_email: body.email && String(body.email).indexOf("@") > 0 ? cleanStr(body.email, 120) : undefined,
                        success_url: siteBase() + "/?paid=1", cancel_url: siteBase() + "/?paid=0"
                    }, myOrg.stripe_account_id);
                    return J(200, { ok: true, url: sess.url });
                } catch (e) { return J(502, { ok: false, error: "Could not create the payment link: " + (e.stripe ? e.message : "try again") }); }
            }
        }

        // ── Get Started checklist, trucking profile, send-from email, POTENT-assisted setup ──
        if (["setupstatus", "saveprofile", "setupmark"].indexOf(action) > -1) {
            if (tok.role !== "owner" && !(action === "setupstatus" && (tok.role === "dispatch" || tok.role === "dispatcher"))) return J(403, { ok: false, error: "Company owner only" });
            var sOrgId = tok.orgId ? String(tok.orgId) : await potentOrgId();
            if (!sOrgId) return J(500, { ok: false, error: "Company not found" });
            var sOrg = await loadOrg(sOrgId);
            if (!sOrg) return J(404, { ok: false, error: "Company not found" });
            var SETUP_MANUAL = ["insurance", "authority", "pricing", "firstquote", "compliance"];
            var manual = (sOrg.setup_done && typeof sOrg.setup_done === "object") ? sOrg.setup_done : {};

            if (action === "saveprofile") {
                var pp = {};
                if (body.dot_number !== undefined) { var dn = String(body.dot_number).trim(); if (dn && !/^\d{3,9}$/.test(dn)) return J(400, { ok: false, error: "USDOT number is digits only (3 to 9)." }); pp.dot_number = dn || null; }
                if (body.mc_number !== undefined) { var mn = String(body.mc_number).trim().replace(/^MC[\s-]*/i, ""); if (mn && !/^\d{3,9}$/.test(mn)) return J(400, { ok: false, error: "MC number is digits only." }); pp.mc_number = mn || null; }
                if (body.mail_from_name !== undefined) pp.mail_from_name = cleanStr(body.mail_from_name, 60) || null;
                if (body.mail_reply_to !== undefined) { var rt = String(body.mail_reply_to).trim().toLowerCase(); if (rt && !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(rt)) return J(400, { ok: false, error: "Enter one valid email address." }); pp.mail_reply_to = rt || null; }
                if (body.assist_blocked !== undefined && !tok.assist) pp.assist_blocked = body.assist_blocked === true;
                if (!Object.keys(pp).length) return J(400, { ok: false, error: "Nothing to save" });
                var sv = await sb("organizations?id=eq." + encodeURIComponent(sOrgId), { method: "PATCH", prefer: "return=minimal", body: pp });
                return sv.ok ? J(200, { ok: true }) : J(500, { ok: false, error: "Could not save (has SQL 70 been run?)." });
            }
            if (action === "setupmark") {
                if (SETUP_MANUAL.indexOf(body.key) < 0) return J(400, { ok: false, error: "Unknown step" });
                var nm = Object.assign({}, manual); nm[body.key] = body.done === true;
                var mk2 = await sb("organizations?id=eq." + encodeURIComponent(sOrgId), { method: "PATCH", prefer: "return=minimal", body: { setup_done: nm } });
                return mk2.ok ? J(200, { ok: true, manual: nm }) : J(500, { ok: false, error: "Could not save." });
            }
            // setupstatus
            async function countRows(path) { var r = await sb(path + "&select=id&limit=1000"); return r.ok && Array.isArray(r.data) ? r.data.length : 0; }
            var nTrucks = await countRows("fleet_vehicles?org_id=eq." + encodeURIComponent(sOrgId));
            var nDrivers = await countRows("org_users?org_id=eq." + encodeURIComponent(sOrgId) + "&role=eq.driver&status=eq.active");
            var nDispatch = await countRows("org_users?org_id=eq." + encodeURIComponent(sOrgId) + "&role=in.(dispatch,dispatcher)&status=eq.active");
            var isPotentOrg = !tok.orgId;
            var steps = [
                { id: "profile", done: !!(sOrg.dot_number || sOrg.mc_number), group: "Your authority" },
                { id: "authority", done: manual.authority === true, manual: true, group: "Your authority" },
                { id: "insurance", done: manual.insurance === true, manual: true, group: "Your authority" },
                { id: "branding", done: isPotentOrg || !!(sOrg.branding && sOrg.branding.companyName), group: "Your company" },
                { id: "email", done: !!sOrg.mail_reply_to, group: "Your company" },
                { id: "trucks", done: nTrucks > 0, group: "Your fleet" },
                { id: "drivers", done: nDrivers > 0, group: "Your fleet" },
                { id: "compliance", done: manual.compliance === true, manual: true, group: "Your fleet" },
                { id: "dispatch", done: nDispatch > 0, group: "Your team" },
                { id: "pricing", done: manual.pricing === true, manual: true, group: "Money" },
                { id: "payouts", done: isPotentOrg || sOrg.payout_status === "active", group: "Money" },
                { id: "firstquote", done: manual.firstquote === true, manual: true, group: "Money" }
            ];
            var doneN = steps.filter(function (x) { return x.done; }).length;
            return J(200, { ok: true, steps: steps, percent: Math.round(doneN * 100 / steps.length), counts: { trucks: nTrucks, drivers: nDrivers, dispatch: nDispatch },
                profile: { dot_number: sOrg.dot_number || "", mc_number: sOrg.mc_number || "", mail_from_name: sOrg.mail_from_name || "", mail_reply_to: sOrg.mail_reply_to || "", assist_blocked: sOrg.assist_blocked === true, company: sOrg.name } });
        }

        // POTENT staff opens a customer's account for 60 minutes to set it up for them. Logged. Customers can switch it off.
        if (action === "assist") {
            if (tok.orgId || tok.role !== "owner" || tok.assist) return J(403, { ok: false, error: "POTENT owner only" });
            var tOrg = await loadOrg(body.orgId);
            if (!tOrg) return J(404, { ok: false, error: "Company not found" });
            var potId = await potentOrgId();
            if (String(tOrg.id) === String(potId)) return J(400, { ok: false, error: "That is your own company." });
            if (tOrg.assist_blocked === true) return J(403, { ok: false, error: "This company has turned off POTENT-assisted setup. Ask the owner to switch it on." });
            var ownr = await sb("org_users?org_id=eq." + encodeURIComponent(tOrg.id) + "&role=eq.owner&status=eq.active&select=id,name,email&limit=1");
            var ow = ownr.ok && Array.isArray(ownr.data) ? ownr.data[0] : null;
            if (!ow) return J(404, { ok: false, error: "That company has no active owner login." });
            var untilMs = Date.now() + 60 * 60 * 1000;
            await sb("assist_sessions", { method: "POST", prefer: "return=minimal", body: { org_id: String(tOrg.id), staff_uid: String(tok.uid || "potent"), started_at: new Date().toISOString(), expires_at: new Date(untilMs).toISOString() } });
            return J(200, {
                ok: true, assist: true, until: untilMs,
                token: sign({ uid: "org-" + ow.id, role: "owner", orgId: tOrg.id, assist: true, exp: untilMs }),
                user: { id: "org-" + ow.id, name: ow.name || ow.email, role: "owner" },
                org: { id: tOrg.id, slug: tOrg.slug, name: tOrg.name },
                limits: limitsFor(tOrg), pricing: tOrg.pricing_config || null, billing: billingView(tOrg),
                branding: billing.isPaid(tOrg) ? (tOrg.branding || null) : null
            });
        }

        // ── POTENT owner only ─────────────────────────────────────
        if (action === "setpw") {
            if (tok.orgId || tok.role !== "owner") return J(403, { ok: false, error: "Owner only" });
            if (!body.userId || !body.newPassword || String(body.newPassword).length < 6) return J(400, { ok: false, error: "Password must be at least 6 characters." });
            var up = await sb("user_password_overrides?on_conflict=user_id", {
                method: "POST", prefer: "resolution=merge-duplicates,return=minimal",
                body: { user_id: body.userId, password: hashPw(String(body.newPassword)), updated_at: new Date().toISOString() }
            });
            return up.ok ? J(200, { ok: true }) : J(500, { ok: false, error: "Could not save password." });
        }


        // ── POTENT owner: customers / licenses / invoices ─────────
        if (["listorgs", "orgdetail", "addinvoice", "setinvoice", "linkinvoices", "resetowner"].indexOf(action) > -1) {
            if (tok.orgId || tok.role !== "owner") return J(403, { ok: false, error: "Owner only" });

            if (action === "listorgs") {
                var lo = await sb("organizations?select=*&order=created_at.desc");
                if (!lo.ok) lo = await sb("organizations?select=*");
                var orgs = (lo.ok && Array.isArray(lo.data) ? lo.data : []).map(function (o) {
                    return { id: o.id, slug: o.slug, name: o.name, status: o.status || "active", owner_email: o.owner_email || null, created_at: o.created_at || null,
                        limits: limitsFor(o), billing: billingView(o), billing_notes: o.billing_notes || "", plan_price: o.plan_price || null };
                });
                // paid licenses that have no company account yet
                var un = await sb("license_invoices?org_id=is.null&select=email,company,kind,amount,status,created_at&order=created_at.desc&limit=200");
                var seen = {}, unlinked = [];
                (un.ok && Array.isArray(un.data) ? un.data : []).forEach(function (r) {
                    var k = String(r.email || "").toLowerCase(); if (!k) return;
                    if (!seen[k]) { seen[k] = { email: k, company: r.company || "", invoices: 0, paid: 0, last: r.created_at }; unlinked.push(seen[k]); }
                    seen[k].invoices++; if (r.status === "paid") seen[k].paid += Number(r.amount || 0);
                });
                return J(200, { ok: true, orgs: orgs, unlinked: unlinked });
            }
            if (action === "orgdetail") {
                var od = await loadOrg(body.id);
                if (!od) return J(404, { ok: false, error: "Not found" });
                var oi = await sb("license_invoices?org_id=eq." + encodeURIComponent(body.id) + "&select=*&order=created_at.desc&limit=200");
                var ou2 = await sb("org_users?org_id=eq." + encodeURIComponent(body.id) + "&select=id,name,email,role,status");
                return J(200, { ok: true, org: { id: od.id, slug: od.slug, name: od.name, status: od.status || "active", owner_email: od.owner_email || null, plan: od.plan, plan_price: od.plan_price, support_price: od.support_price, stripe_customer_id: od.stripe_customer_id || null, stripe_account_id: od.stripe_account_id || null, branding: !!od.branding, max_trucks: od.max_trucks === undefined ? null : od.max_trucks, max_drivers: od.max_drivers === undefined ? null : od.max_drivers, max_dispatch: od.max_dispatch === undefined ? null : od.max_dispatch, billing_notes: od.billing_notes || "", limits: limitsFor(od), billing: billingView(od) }, invoices: oi.ok && Array.isArray(oi.data) ? oi.data : [], users: ou2.ok && Array.isArray(ou2.data) ? ou2.data : [] });
            }
            if (action === "addinvoice") {
                var ao = await loadOrg(body.orgId);
                if (!ao) return J(404, { ok: false, error: "Company not found" });
                var kind = INVOICE_KINDS.indexOf(body.kind) > -1 ? body.kind : "other";
                var stt = INVOICE_STATUSES.indexOf(body.status) > -1 ? body.status : "open";
                var amount = cleanNum(body.amount, 10000000);
                var row = { org_id: String(ao.id), email: ao.owner_email || null, company: ao.name, kind: kind, description: cleanStr(body.description, 200), amount: amount, status: stt, provider: ["stripe", "square", "manual"].indexOf(body.provider) > -1 ? body.provider : "manual", due_date: /^\d{4}-\d{2}-\d{2}$/.test(body.due_date || "") ? body.due_date : null, paid_at: stt === "paid" ? new Date().toISOString() : null, meta: kind === "flex_down" && body.flex_total ? { flex_total: cleanNum(body.flex_total, 10000000) } : null };
                var ai = await sb("license_invoices", { method: "POST", body: row });
                if (!ai.ok) return J(500, { ok: false, error: "Could not add invoice (has SQL section 68 been run?)." });
                var st3 = await refreshOrg(ao.id);
                return J(200, { ok: true, invoice: Array.isArray(ai.data) ? ai.data[0] : null, status: st3 });
            }
            if (action === "setinvoice") {
                var si = await sb("license_invoices?id=eq." + encodeURIComponent(body.id) + "&select=*");
                var invRow = si.ok && Array.isArray(si.data) ? si.data[0] : null;
                if (!invRow) return J(404, { ok: false, error: "Invoice not found" });
                if (INVOICE_STATUSES.indexOf(body.status) < 0) return J(400, { ok: false, error: "Bad status" });
                await sb("license_invoices?id=eq." + encodeURIComponent(body.id), { method: "PATCH", prefer: "return=minimal", body: { status: body.status, paid_at: body.status === "paid" ? new Date().toISOString() : null } });
                var st4 = invRow.org_id ? await refreshOrg(invRow.org_id) : null;
                return J(200, { ok: true, status: st4 });
            }
            if (action === "resetowner") {
                var ro = await sb("org_users?org_id=eq." + encodeURIComponent(body.orgId) + "&role=eq.owner&select=id,email");
                var ownerRow = ro.ok && Array.isArray(ro.data) ? ro.data[0] : null;
                if (!ownerRow) return J(404, { ok: false, error: "No owner login found for that company." });
                var rpw = tempPw();
                var rr = await sb("org_users?id=eq." + encodeURIComponent(ownerRow.id), { method: "PATCH", prefer: "return=minimal", body: { password_hash: hashPw(rpw), status: "active" } });
                return rr.ok ? J(200, { ok: true, email: ownerRow.email, tempPassword: rpw }) : J(500, { ok: false, error: "Could not reset." });
            }
            if (action === "linkinvoices") {
                var lk = await loadOrg(body.orgId);
                var lem = String(body.email || "").trim().toLowerCase();
                if (!lk || !lem) return J(400, { ok: false, error: "Company and email required" });
                await sb("license_invoices?org_id=is.null&email=ilike." + encodeURIComponent(lem), { method: "PATCH", prefer: "return=minimal", body: { org_id: String(lk.id) } });
                if (!lk.owner_email) await sb("organizations?id=eq." + encodeURIComponent(lk.id), { method: "PATCH", prefer: "return=minimal", body: { owner_email: lem } });
                var st5 = await refreshOrg(lk.id);
                return J(200, { ok: true, status: st5 });
            }
        }

        if (action === "savepricing") {
            if (!tok.orgId || tok.role !== "owner") return J(403, { ok: false, error: "Company owner only" });
            var cfg = cleanPricing(body.config);
            var sv = await sb("organizations?id=eq." + tok.orgId, { method: "PATCH", prefer: "return=minimal", body: { pricing_config: cfg } });
            return sv.ok ? J(200, { ok: true, pricing: cfg }) : J(500, { ok: false, error: "Could not save pricing (has the pricing_config column been added?)." });
        }

        if (action === "setorg") {
            if (tok.orgId || tok.role !== "owner") return J(403, { ok: false, error: "Owner only" });
            if (!body.id) return J(400, { ok: false, error: "id required" });
            var patch = {}, allowed = ["status", "plan", "max_trucks", "max_drivers", "max_dispatch", "plan_price", "support_plan", "support_price", "license_status", "support_status", "flex_status", "billing_notes", "owner_email"];
            allowed.forEach(function (k) { if (body.fields && body.fields[k] !== undefined) patch[k] = body.fields[k] === "" ? null : body.fields[k]; });
            if (patch.license_status && LICENSE_STATUSES.indexOf(patch.license_status) < 0) return J(400, { ok: false, error: "Unknown license status" });
            if (patch.support_status && SUPPORT_STATUSES.indexOf(patch.support_status) < 0) return J(400, { ok: false, error: "Unknown support status" });
            if (patch.flex_status && FLEX_STATUSES.indexOf(patch.flex_status) < 0) return J(400, { ok: false, error: "Unknown Flex status" });
            if (patch.billing_notes) patch.billing_notes = cleanStr(patch.billing_notes, 1000);
            if (patch.support_status === "active") patch.support_started_at = new Date().toISOString();
            if (patch.plan && !TIER_DEFAULTS[String(patch.plan).toLowerCase()]) return J(400, { ok: false, error: "Unknown plan" });
            if (!Object.keys(patch).length) return J(400, { ok: false, error: "Nothing to update" });
            var so = await sb("organizations?id=eq." + encodeURIComponent(body.id), { method: "PATCH", prefer: "return=minimal", body: patch });
            return so.ok ? J(200, { ok: true }) : J(500, { ok: false, error: "Could not update (have the max_* columns been added?)." });
        }

        if (action === "createorg") {
            if (tok.orgId || tok.role !== "owner") return J(403, { ok: false, error: "Owner only" });
            var data = body.org || {};
            if (!data.slug || !data.owner_email) return J(400, { ok: false, error: "slug and owner_email required" });
            var ins = await sb("organizations", { method: "POST", body: data });
            if (!ins.ok || !Array.isArray(ins.data) || !ins.data[0]) return J(500, { ok: false, error: "Could not create company: " + JSON.stringify(ins.data).slice(0, 200) });
            var pw = tempPw();
            var ou = await sb("org_users", {
                method: "POST",
                body: { org_id: ins.data[0].id, name: data.owner_name, email: String(data.owner_email).trim().toLowerCase(), phone: data.owner_phone, role: "owner", password_hash: hashPw(pw), status: "active" }
            });
            if (!ou.ok) return J(500, { ok: false, error: "Company created but owner login failed: " + JSON.stringify(ou.data).slice(0, 200) });
            var oem = String(data.owner_email).trim().toLowerCase();
            await sb("organizations?id=eq." + encodeURIComponent(ins.data[0].id), { method: "PATCH", prefer: "return=minimal", body: { owner_email: oem } });
            await sb("license_invoices?org_id=is.null&email=ilike." + encodeURIComponent(oem), { method: "PATCH", prefer: "return=minimal", body: { org_id: String(ins.data[0].id) } });
            var stNew = await refreshOrg(ins.data[0].id);
            return J(200, { ok: true, org: ins.data[0], ownerEmail: data.owner_email, ownerPassword: pw, status: stNew });
        }

        // ── Company owner: staff management (scoped to own org) ───
        if (["liststaff", "addstaff", "removestaff", "resetstaff"].indexOf(action) > -1) {
            if (!tok.orgId || tok.role !== "owner") return J(403, { ok: false, error: "Company owner only" });

            if (action === "liststaff") {
                var ls = await sb("org_users?org_id=eq." + tok.orgId + "&select=id,name,email,phone,role,status&order=created_at.asc");
                if (!ls.ok) ls = await sb("org_users?org_id=eq." + tok.orgId + "&select=id,name,email,phone,role,status");
                var org0 = await sb("organizations?id=eq." + tok.orgId + "&select=*");
                var lim = limitsFor(org0.ok && Array.isArray(org0.data) && org0.data[0] ? org0.data[0] : {});
                var list = Array.isArray(ls.data) ? ls.data : [];
                var counts = { dispatch: 0, driver: 0 };
                list.forEach(function (m) { if ((!m.status || m.status === "active") && counts[m.role] !== undefined) counts[m.role]++; });
                return J(200, { ok: true, staff: list, limits: lim, counts: counts });
            }
            if (action === "addstaff") {
                var em = String(body.email || "").trim().toLowerCase();
                if (!body.name || !em) return J(400, { ok: false, error: "Name and email required" });
                var dupe = await sb("org_users?email=ilike." + encodeURIComponent(em) + "&select=id");
                if (dupe.ok && Array.isArray(dupe.data) && dupe.data.length) return J(409, { ok: false, error: "That email already has an account." });
                var r2 = ["dispatch", "driver"].indexOf(body.role) > -1 ? body.role : "dispatch";
                var org1 = await sb("organizations?id=eq." + tok.orgId + "&select=*");
                var lim1 = limitsFor(org1.ok && Array.isArray(org1.data) && org1.data[0] ? org1.data[0] : {});
                var used = await sb("org_users?org_id=eq." + tok.orgId + "&role=eq." + r2 + "&status=eq.active&select=id");
                var usedN = used.ok && Array.isArray(used.data) ? used.data.length : 0;
                var cap = r2 === "driver" ? lim1.drivers : lim1.dispatch;
                if (cap !== null && cap !== undefined && usedN >= cap) return J(403, { ok: false, error: "Your " + lim1.tier.charAt(0).toUpperCase() + lim1.tier.slice(1) + " plan allows " + cap + " " + (r2 === "driver" ? "drivers" : "dispatchers") + ". Contact POTENT to upgrade." });
                var tp = tempPw();
                var ad = await sb("org_users", { method: "POST", body: { org_id: tok.orgId, name: body.name, email: em, phone: body.phone || "", role: r2, password_hash: hashPw(tp), status: "active" } });
                return ad.ok ? J(200, { ok: true, tempPassword: tp }) : J(500, { ok: false, error: "Could not add staff." });
            }
            // remove / reset: confirm the row belongs to this org first
            var tgt = await sb("org_users?id=eq." + encodeURIComponent(body.id) + "&org_id=eq." + tok.orgId + "&select=id,role");
            if (!tgt.ok || !Array.isArray(tgt.data) || !tgt.data[0]) return J(404, { ok: false, error: "Not found" });
            if (tgt.data[0].role === "owner") return J(400, { ok: false, error: "The owner login cannot be changed here." });
            if (action === "removestaff") {
                var rm = await sb("org_users?id=eq." + encodeURIComponent(body.id) + "&org_id=eq." + tok.orgId, { method: "PATCH", prefer: "return=minimal", body: { status: "disabled" } });
                return rm.ok ? J(200, { ok: true }) : J(500, { ok: false, error: "Could not remove." });
            }
            var np = tempPw();
            var rs = await sb("org_users?id=eq." + encodeURIComponent(body.id) + "&org_id=eq." + tok.orgId, { method: "PATCH", prefer: "return=minimal", body: { password_hash: hashPw(np) } });
            return rs.ok ? J(200, { ok: true, tempPassword: np }) : J(500, { ok: false, error: "Could not reset." });
        }

        return J(400, { ok: false, error: "Unknown action" });
    } catch (e) {
        return J(500, { ok: false, error: "Server error" });
    }
};
