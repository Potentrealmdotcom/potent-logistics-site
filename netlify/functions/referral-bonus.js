// netlify/functions/referral-bonus.js  (OWNER ONLY, POTENT's own business)
// Automatic referral bonuses: $25 once per NEW customer after their first completed job,
// $250 total when that customer is on a contract (the $25 already paid is subtracted).
// Credits go straight into the code owner's team wallet. Safe to run as often as you like:
// the referral_bonuses table's unique key means nobody is ever paid twice.
// POST { action:"run" | "list" } + owner Bearer token.   Env: AUTH_SECRET, SUPABASE_SERVICE_ROLE_KEY
var crypto = require("crypto");
var SB = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
var FIRST_CENTS = 2500, CONTRACT_CENTS = 25000;
function J(s, o) { return { statusCode: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(o) }; }
function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function verify(token) {
    if (!token || token.indexOf(".") < 0) return null;
    var p = token.split(".");
    var exp = b64u(crypto.createHmac("sha256", process.env.AUTH_SECRET).update(p[0]).digest());
    var a = Buffer.from(p[1] || ""), b = Buffer.from(exp);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try { var d = JSON.parse(Buffer.from(p[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); return d.exp && d.exp >= Date.now() ? d : null; } catch (e) { return null; }
}
function sb(path, opts) {
    opts = opts || {}; var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    var h = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" }; if (opts.prefer) h.Prefer = opts.prefer;
    return fetch(SB + "/rest/v1/" + path, { method: opts.method || "GET", headers: h, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
        .then(function (r) { return r.text().then(function (t) { var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { d = t; } return { ok: r.ok, status: r.status, data: d }; }); });
}
function custKey(j) {
    var ph = String(j.phone || "").replace(/\D/g, "").slice(-10);
    return ph.length === 10 ? "p" + ph : (String(j.email || "").trim().toLowerCase() || String(j.customer || "").trim().toLowerCase());
}
function isContract(j) { return /contract|recurring/i.test(String(j.service_name || "") + " " + String(j.notes || "")) || !!j.recurring_route_id; }

async function credit(email, name, dollars, note) {
    var w = await sb("team_wallets?member_email=eq." + encodeURIComponent(email) + "&select=*&limit=1");
    var wal = w.ok && Array.isArray(w.data) && w.data[0];
    if (!wal) {
        var c = await sb("team_wallets", { method: "POST", prefer: "return=representation", body: { member_email: email, member_name: name || email, role: "referrer" } });
        wal = c.ok && Array.isArray(c.data) && c.data[0];
    }
    if (!wal) return false;
    var up = await sb("team_wallets?id=eq." + wal.id, { method: "PATCH", prefer: "return=minimal", body: {
        available_balance: Math.round((Number(wal.available_balance || 0) + dollars) * 100) / 100,
        total_earned: Math.round((Number(wal.total_earned || 0) + dollars) * 100) / 100, updated_at: new Date().toISOString() } });
    if (!up.ok) return false;
    await sb("team_wallet_txns", { method: "POST", prefer: "return=minimal", body: { wallet_id: wal.id, type: "bonus", amount: dollars, note: note, actor: "referral-bot" } });
    return true;
}

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") return J(405, { ok: false, error: "POST only" });
    if (!process.env.AUTH_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) return J(500, { ok: false, error: "Server not configured" });
    var h = event.headers || {};
    var tok = verify(String(h.authorization || h.Authorization || "").replace(/^Bearer\s+/i, ""));
    if (!tok || tok.role !== "owner" || tok.orgId) return J(403, { ok: false, error: "Owner only" });
    var b; try { b = JSON.parse(event.body || "{}"); } catch (e) { b = {}; }
    try {
        if (b.action === "list") {
            var l = await sb("referral_bonuses?select=*&order=created_at.desc&limit=200");
            if (!l.ok) return J(500, { ok: false, error: "Run growth-schema.sql in Supabase first." });
            return J(200, { ok: true, bonuses: l.data });
        }
        // run
        var cfg = await sb("safety_alerts?type=eq.referral_codes&select=payload&limit=1");
        var codes = []; try { codes = JSON.parse((cfg.data && cfg.data[0] && cfg.data[0].payload) || "[]"); } catch (e) { }
        var byCode = {}; codes.forEach(function (c) { if (c && c.code) byCode[String(c.code).toUpperCase()] = c; });
        var po = await sb("organizations?slug=eq." + encodeURIComponent(process.env.POTENT_ORG_SLUG || "potent-logistics") + "&select=id");
        var potentId = po.ok && po.data && po.data[0] && po.data[0].id;
        var jobsQ = "jobs?referral_code=not.is.null&status=eq.Completed&select=id,customer,phone,email,service_name,notes,recurring_route_id,referral_code&limit=5000" + (potentId ? "&org_id=eq." + encodeURIComponent(potentId) : "");
        var jr = await sb(jobsQ);
        if (!jr.ok) return J(500, { ok: false, error: "Run growth-schema.sql in Supabase first (adds the referral columns)." });
        var groups = {};
        jr.data.forEach(function (j) {
            var code = String(j.referral_code || "").toUpperCase(); if (!code) return;
            var k = code + "|" + custKey(j); var g = groups[k] = groups[k] || { code: code, key: custKey(j), name: j.customer, jobId: j.id, contract: false };
            if (isContract(j)) g.contract = true;
        });
        var existing = await sb("referral_bonuses?select=code,customer_key,tier,paid_cents,target_cents&limit=10000");
        if (!existing.ok) return J(500, { ok: false, error: "Run growth-schema.sql in Supabase first." });
        var paidMap = {}; existing.data.forEach(function (x) { paidMap[x.code + "|" + x.customer_key + "|" + x.tier] = x; });
        var paidTotal = {}; existing.data.forEach(function (x) { var k = x.code + "|" + x.customer_key; paidTotal[k] = (paidTotal[k] || 0) + x.paid_cents; });
        var paid = [], unassigned = [], total = 0;
        var keys = Object.keys(groups);
        for (var i = 0; i < keys.length; i++) {
            var g = groups[keys[i]], cfgc = byCode[g.code];
            if (!cfgc || cfgc.active === false) continue;
            var email = String(cfgc.payTo || "").trim().toLowerCase();
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { if (unassigned.indexOf(g.code) < 0) unassigned.push(g.code); continue; }
            var tiers = [["first_job", FIRST_CENTS]]; if (g.contract) tiers.push(["contract", CONTRACT_CENTS]);
            for (var t = 0; t < tiers.length; t++) {
                var tier = tiers[t][0], target = tiers[t][1], tk = g.code + "|" + g.key + "|" + tier;
                if (paidMap[tk]) continue;
                var already = paidTotal[g.code + "|" + g.key] || 0;
                var owe = tier === "contract" ? Math.max(0, CONTRACT_CENTS - already) : target;
                // claim first (unique key blocks a double run), then credit; undo the claim if crediting fails
                var claim = await sb("referral_bonuses", { method: "POST", prefer: "return=minimal", body: { code: g.code, customer_key: g.key, customer_name: g.name, tier: tier, target_cents: target, paid_cents: owe, pay_to_email: email, job_id: g.jobId } });
                if (!claim.ok) continue;
                var ok = owe > 0 ? await credit(email, cfgc.source || email, owe / 100, "Referral " + g.code + ": " + (g.name || "new customer") + " (" + (tier === "contract" ? "contract" : "first job") + ")") : true;
                if (!ok) { await sb("referral_bonuses?code=eq." + encodeURIComponent(g.code) + "&customer_key=eq." + encodeURIComponent(g.key) + "&tier=eq." + tier, { method: "DELETE" }); continue; }
                paidTotal[g.code + "|" + g.key] = already + owe; total += owe;
                paid.push({ code: g.code, customer: g.name, tier: tier, dollars: owe / 100, to: email });
            }
        }
        return J(200, { ok: true, paid: paid, totalDollars: total / 100, unassignedCodes: unassigned });
    } catch (e) { console.error("referral-bonus", e && e.message); return J(500, { ok: false, error: "Server error" }); }
};
