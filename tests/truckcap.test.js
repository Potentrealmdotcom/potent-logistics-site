// Run: node tests/truckcap.test.js   (D6: tenant truck-cap enforcement in data-api, mirroring the driver/dispatch caps in auth.js)
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
function veh(org, i) { return { id: org + "-v" + i, org_id: org, make: "Ford", model: "E-350" }; }
var fleet = [];
for (var i = 0; i < 10; i++) fleet.push(veh("o2", i));       // starter org at its 10-truck cap
for (var j = 0; j < 10; j++) fleet.push(veh("o1", j));       // POTENT's own org (exempt by design)
fleet.push(veh("o4", 0), veh("o4", 1));                      // custom-capped org at its 2-truck cap
const T = {
    organizations: [
        { id: "o1", slug: "potent-logistics", plan: "starter" },
        { id: "o2", slug: "acme", plan: "starter" },
        { id: "o3", slug: "growthco", plan: "growth" },
        { id: "o4", slug: "tiny", plan: "starter", max_trucks: 2 }
    ],
    fleet_vehicles: fleet
};
require("./_mock.js")(T, {});
const D = require("../netlify/functions/data-api.js"), cr = require("crypto");
const b64u = b => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const tok = (uid, role, extra) => { const p = b64u(JSON.stringify(Object.assign({ uid: uid, role: role, exp: Date.now() + 1e6 }, extra || {}))); return p + "." + b64u(cr.createHmac("sha256", "t").update(p).digest()); };
const post = async (t, body) => { const r = await D.handler({ httpMethod: "POST", headers: { authorization: "Bearer " + t }, queryStringParameters: { t: "fleet_vehicles", q: "" }, body: JSON.stringify(body || {}) }); return { s: r.statusCode, j: JSON.parse(r.body) }; };
const OWN2 = tok("owner2", "owner", { orgId: "o2" }), OWN3 = tok("owner3", "owner", { orgId: "o3" }), OWN4 = tok("owner4", "owner", { orgId: "o4" }), POTENT = tok("potent", "owner");
(async () => {
    let r = await post(OWN2, { id: "o2-v10", make: "Ford" });
    ok(r.s === 403 && /allows 10 trucks/.test(r.j.error || ""), "starter tenant at cap: 11th truck refused with the plan message");
    ok(T.fleet_vehicles.filter(v => v.org_id === "o2").length === 10, "refused truck was not written");

    r = await post(OWN2, { id: "o2-v0", make: "Ford", model: "F-150" });
    ok(r.s !== 403, "re-saving one of the tenant's own existing trucks is not counted as new");

    r = await post(OWN3, { id: "o3-v0", make: "Ford" });
    ok(r.s === 200 || r.s === 201, "growth tenant under cap: truck saved");
    ok(T.fleet_vehicles.some(v => v.id === "o3-v0" && v.org_id === "o3"), "growth truck written under its own org");

    r = await post(OWN4, { id: "o4-v2", make: "Ford" });
    ok(r.s === 403 && /allows 2 trucks/.test(r.j.error || ""), "owner-set max_trucks=2 beats the tier default of 10");

    r = await post(POTENT, { id: "o1-v10", make: "Ford" });
    ok(r.s === 200 || r.s === 201, "POTENT's own org is exempt (platform owner), same as before");

    console.log("PASS: " + n + " assertions");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
