// netlify/functions/lib/provision.js
// Shared company provisioning for POTENT OS (Shopify-style onboarding).
// Used by both auth.js (manual createorg) and stripe-webhook.js (auto-provision on payment).
// A company buys POTENT OS -> payment arrives -> company record + unique slug +
// owner login + paid license + page at /?c=<slug>, with zero manual work.
//
// sb: Supabase service-role helper — function(path, opts) returning { ok, status, data }
// hashPw, tempPw: password helpers (scrypt hash, random temp password)

var crypto = require("crypto");

var RESERVED_SLUGS = ["potent-logistics"];

function hashPw(pw) {
    var salt = crypto.randomBytes(16).toString("hex");
    var h = crypto.scryptSync(pw, salt, 32).toString("hex");
    return "scrypt$" + salt + "$" + h;
}

function tempPw() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var out = "";
    var bytes = crypto.randomBytes(10);
    for (var i = 0; i < 10; i++) out += chars[bytes[i] % chars.length];
    return out;
}

// "Acme Trucking LLC" -> "acme-trucking-llc". Lowercase, spaces to dashes,
// strip everything else, collapse repeats, 2-60 chars.
function slugify(name) {
    var s = String(name || "").toLowerCase().trim()
        .replace(/[\s_]+/g, "-")
        .replace(/[^a-z0-9\-]/g, "")
        .replace(/\-+/g, "-")
        .replace(/^\-+|\-+$/g, "")
        .slice(0, 60);
    if (s.length < 2) s = "company-" + Date.now().toString(36).slice(-4);
    return s;
}

// Returns a slug guaranteed unique in organizations (appends -2, -3, ...).
// potent-logistics is reserved for POTENT itself.
async function uniqueSlug(sb, base) {
    var slug = base;
    var n = 1;
    for (;;) {
        if (RESERVED_SLUGS.indexOf(slug) === -1) {
            var ex = await sb("organizations?slug=eq." + encodeURIComponent(slug) + "&select=id&limit=1");
            if (!ex.ok || !Array.isArray(ex.data) || !ex.data.length) return slug;
        }
        n++;
        // keep within 60 chars: trim base so base + "-NN" fits
        var suffix = "-" + n;
        slug = base.slice(0, 60 - suffix.length) + suffix;
    }
}

// Find an existing company by stripe customer id or owner email (any of the three lookups).
async function findOrg(sb, email, customerId) {
    var em = String(email || "").trim().toLowerCase();
    if (customerId) {
        var c = await sb("organizations?stripe_customer_id=eq." + encodeURIComponent(customerId) + "&select=*");
        if (c.ok && Array.isArray(c.data) && c.data[0]) return c.data[0];
    }
    if (em) {
        var o = await sb("organizations?owner_email=ilike." + encodeURIComponent(em) + "&select=*");
        if (o.ok && Array.isArray(o.data) && o.data[0]) return o.data[0];
        var u = await sb("org_users?email=ilike." + encodeURIComponent(em) + "&role=eq.owner&select=org_id");
        if (u.ok && Array.isArray(u.data) && u.data[0]) {
            var o2 = await sb("organizations?id=eq." + encodeURIComponent(u.data[0].org_id) + "&select=*");
            if (o2.ok && Array.isArray(o2.data) && o2.data[0]) return o2.data[0];
        }
    }
    return null;
}

// Create the company + owner login. Idempotent on email/customer id:
// if a company already exists for this buyer, returns it instead of creating a dupe.
// opts: { companyName, ownerEmail, ownerName, ownerPhone, tier, plan, licenseStatus,
//         stripeCustomerId, planPrice, supportMonthly }
// Returns { org, tempPassword, created } — tempPassword only when a new login was created.
async function provisionCompany(sb, opts) {
    var email = String(opts.ownerEmail || "").trim().toLowerCase();
    if (!email) throw new Error("ownerEmail required");

    // Idempotency: never create two companies for the same buyer.
    var existing = await findOrg(sb, email, opts.stripeCustomerId);
    if (existing) return { org: existing, tempPassword: null, created: false };

    var slug = await uniqueSlug(sb, slugify(opts.companyName));
    var now = new Date().toISOString();

    var orgBody = {
        slug: slug,
        name: String(opts.companyName || email).slice(0, 120),
        owner_email: email,
        plan: opts.plan || opts.tier || "starter",
        plan_price: opts.planPrice || null,
        license_status: opts.licenseStatus || "paid",
        support_status: "active",
        support_started_at: now,
        stripe_customer_id: opts.stripeCustomerId || null,
        created_at: now
    };
    var ins = await sb("organizations", { method: "POST", body: orgBody });
    if (!ins.ok || !Array.isArray(ins.data) || !ins.data[0]) {
        throw new Error("Could not create company: " + JSON.stringify(ins.data).slice(0, 200));
    }
    var org = ins.data[0];

    var pw = tempPw();
    var ou = await sb("org_users", {
        method: "POST",
        body: {
            org_id: org.id,
            name: String(opts.ownerName || email).slice(0, 120),
            email: email,
            phone: String(opts.ownerPhone || "").slice(0, 30),
            role: "owner",
            password_hash: hashPw(pw),
            status: "active"
        }
    });
    if (!ou.ok) {
        // Roll back the org row so a retry starts clean.
        await sb("organizations?id=eq." + encodeURIComponent(org.id), { method: "DELETE", prefer: "return=minimal" });
        throw new Error("Company created but owner login failed: " + JSON.stringify(ou.data).slice(0, 200));
    }

    // Link any earlier license_invoices that arrived before the company existed.
    await sb("license_invoices?org_id=is.null&email=ilike." + encodeURIComponent(email),
        { method: "PATCH", prefer: "return=minimal", body: { org_id: String(org.id) } });
    if (opts.stripeCustomerId) {
        await sb("organizations?id=eq." + encodeURIComponent(org.id),
            { method: "PATCH", prefer: "return=minimal", body: { stripe_customer_id: opts.stripeCustomerId } });
    }

    return { org: org, tempPassword: pw, created: true };
}

module.exports = { slugify: slugify, uniqueSlug: uniqueSlug, findOrg: findOrg, provisionCompany: provisionCompany, hashPw: hashPw, tempPw: tempPw };
