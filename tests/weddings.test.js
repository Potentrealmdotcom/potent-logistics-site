// Run: node tests/weddings.test.js  (LEGIT Weddings slice: Georgia-only gate, request vs booking, admin-only controls)
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const ADM = "11111111-1111-1111-1111-111111111111", USR = "22222222-2222-2222-2222-222222222222";
const T = { legit_users: [{ id: ADM, is_admin: true, banned: false }, { id: USR, is_admin: false, banned: false }], legit_wedding_areas: [{ state: "GA", name: "Georgia", enabled: true }, { state: "FL", name: "Florida", enabled: false }],
  legit_wedding_packages: [{ key: "signature", title: "S", price_cents: 1000000, active: true, sort: 1 }, { key: "vip", title: "V", price_cents: 2500000, active: true, sort: 2 }], legit_wedding_requests: [], legit_admin_log: [] };
require("./_mock.js")(T, { unique: { legit_wedding_packages: (x, r) => x.key === r.key, legit_wedding_areas: (x, r) => x.state === r.state } });
const W = require("../netlify/functions/legit-weddings.js"), L = require("../netlify/functions/lib/legit.js");
let ipn = 0; const call = async (b, uid) => { const r = await W.handler({ httpMethod: "POST", headers: Object.assign({ "x-nf-client-connection-ip": "1.1.1." + (++ipn) }, uid ? { authorization: "Bearer " + L.sign(uid) } : {}), body: JSON.stringify(b) }); return { s: r.statusCode, j: JSON.parse(r.body) }; };
const good = { action: "request", name: "Ann Lee", email: "ann@x.com", venue_state: "ga", venue_city: "Atlanta", package_key: "vip" };
(async () => {
  let r = await call({ action: "packages" }); ok(r.s === 200 && r.j.packages.length === 2 && /Georgia only/.test(r.j.notice), "packages + Georgia notice");
  r = await call(good); ok(r.s === 200 && r.j.status === "requested" && T.legit_wedding_requests.length === 1 && T.legit_wedding_requests[0].venue_state === "GA", "Georgia request saved as 'requested', no account needed");
  r = await call(Object.assign({}, good, { venue_state: "FL" })); ok(r.s === 422 && r.j.outOfArea && T.legit_wedding_requests.length === 1, "Florida rejected on the server, nothing stored");
  r = await call(Object.assign({}, good, { venue_state: "ZZ" })); ok(r.s === 400, "unknown state rejected");
  r = await call(Object.assign({}, good, { venue_state: "TX" })); ok(r.s === 422, "state with no row is out of area");
  r = await call(Object.assign({}, good, { package_key: "gold" })); ok(r.s === 400, "unlisted package rejected");
  r = await call(Object.assign({}, good, { email: "nope" })); ok(r.s === 400, "bad email rejected");
  r = await call(Object.assign({}, good, { event_date: "2020-01-01" })); ok(r.s === 400, "past date rejected");
  r = await call(Object.assign({}, good, { website: "spam" })); ok(r.s === 200 && T.legit_wedding_requests.length === 1, "honeypot silently ignored");
  r = await call({ action: "a_list" }); ok(r.s === 401, "admin list needs sign-in");
  r = await call({ action: "a_list" }, USR); ok(r.s === 403, "normal user cannot see requests");
  r = await call({ action: "a_area_set", state: "FL", enabled: true }, USR); ok(r.s === 403 && !T.legit_wedding_areas.find(a => a.state === "FL").enabled, "normal user cannot open a state");
  r = await call({ action: "a_list" }, ADM); ok(r.s === 200 && r.j.requests.length === 1, "admin sees requests");
  const id = T.legit_wedding_requests[0].id;
  r = await call({ action: "a_status", id: id, status: "proposal_sent", staff_note: "sent" }, ADM); ok(r.s === 200 && T.legit_wedding_requests[0].status === "proposal_sent" && T.legit_admin_log.length === 1, "status change logged");
  r = await call({ action: "a_status", id: id, status: "paid" }, ADM); ok(r.s === 400, "no 'paid/booked' status exists");
  r = await call({ action: "a_area_set", state: "FL", enabled: true }, ADM); r = await call(Object.assign({}, good, { venue_state: "FL" })); ok(r.s === 200, "admin can open a new state");
  r = await call({ action: "a_pkg_set", key: "signature", title: "S", price_cents: 1000000, includes: ["a"], guest_limit: 80 }, ADM); ok(r.s === 200 && T.legit_wedding_packages.find(p => p.key === "signature").guest_limit === 80, "admin edits package without code");
  console.log("PASS: " + n + " assertions");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
