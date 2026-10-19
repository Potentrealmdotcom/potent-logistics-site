// Run: node tests/vetting.test.js  (no network). Carrier vetting: scoring + server-side lookups + staff actions.
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.GOOGLE_CLIENT_ID = "cid";
process.env.FMCSA_WEBKEY = "wk"; process.env.TWILIO_ACCOUNT_SID = "AC1"; process.env.TWILIO_AUTH_TOKEN = "tt";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const make = require("./_mock.js"); const V = require("../netlify/functions/lib/vetting.js"); const auth = require("../netlify/functions/auth.js");
const good = { company_name: "Acme Freight LLC", fmcsa: { checked: true, found: true, allowed_to_operate: true, legal_name: "ACME FREIGHT LLC", fleet_size: 3 }, phone: { checked: true, line_type: "mobile" }, idv: { live_human: true, doc_matches: true } };
const ev = o => V.evaluate(Object.assign({}, good, o));

(async () => {
  // ── scoring ──
  ok(ev({}).status === "APPROVED" && ev({}).factors.includes("ELD_NOT_CONNECTED"), "clean carrier is recommended; ELD ignored when not connected");
  ok(ev({ idv: {} }).status === "MANUAL_REVIEW", "clean phone alone is NOT enough to approve (needs ID confirmation)");
  ok(ev({ fmcsa: { checked: true, found: true, allowed_to_operate: false } }).status === "REJECTED", "inactive authority rejected");
  ok(ev({ fmcsa: { checked: true, found: true, allowed_to_operate: true, out_of_service: true } }).status === "REJECTED", "out-of-service rejected");
  ok(ev({ fmcsa: { checked: false, error: "down" } }).status === "MANUAL_REVIEW", "FMCSA outage goes to a person, not a reject");
  ok(ev({ fmcsa: { checked: true, found: false } }).status === "MANUAL_REVIEW", "carrier not found at FMCSA goes to a person");
  ok(ev({ phone: { checked: true, line_type: "voip" }, idv: {} }).status === "HOLD_REQUIRES_LIVENESS", "VOIP without ID confirmation is held");
  ok(ev({ phone: { checked: true, line_type: "voip" } }).status === "MANUAL_REVIEW", "VOIP with confirmed ID goes to review (30-15=15)");
  ok(ev({ fmcsa: { checked: true, found: true, allowed_to_operate: true, legal_name: "TOTALLY OTHER CO" } }).factors.includes("NAME_MISMATCH_WITH_FMCSA"), "name mismatch flagged");
  ok(ev({ fmcsa: { checked: true, found: true, allowed_to_operate: true, legal_name: "Acme Freight, Inc." } }).status === "APPROVED", "LLC/Inc suffix differences are not a mismatch");
  ok(ev({ eld: { status: "connected", active_hardware_count: 0 } }).factors.includes("ELD_ZERO_UNITS_VS_FMCSA_FLEET"), "ELD zero units vs FMCSA fleet flagged once connected");
  ok(ev({ eld: { status: "connected", active_hardware_count: 2 } }).factors.includes("ELD_ACTIVE_HARDWARE"), "real ELD units lower risk");
  ok(!ev({ eld: { status: "pending", active_hardware_count: 0 } }).factors.some(f => /^ELD_(ZERO|ACTIVE)/.test(f)), "ELD not counted unless status is connected");
  ok(V.toE164("(470) 453-1616") === "+14704531616" && V.toE164("123") === null, "phone normalising");

  // ── server lookups ──
  const fm = await V.fmcsaLookup({ dot: "123" }, async u => ({ ok: true, json: async () => ({ content: { carrier: { dotNumber: 123, legalName: "ACME FREIGHT LLC", allowedToOperate: "Y", totalPowerUnits: 4 } } }) }));
  ok(fm.found && fm.allowed_to_operate && fm.fleet_size === 4, "FMCSA response parsed");
  ok((await V.fmcsaLookup({ dot: "1" }, async () => { throw new Error("x"); })).checked === false, "FMCSA failure is reported as unchecked");
  const pl = await V.phoneLookup("4704531616", async (u, o) => { ok(/lookups\.twilio\.com\/v2\/PhoneNumbers\/%2B14704531616/.test(u) && /Basic /.test(o.headers.Authorization), "Lookup v2 call is signed"); return { ok: true, json: async () => ({ line_type_intelligence: { type: "nonFixedVoip", carrier_name: "Google" } }) }; });
  ok(pl.line_type === "voip", "nonFixedVoip maps to voip");

  // ── staff flow through auth.js ──
  const T = { organizations: [{ id: "org1", slug: "acme", name: "Acme", status: "active", plan: "starter", license_status: "paid" }],
    org_users: [{ id: "u1", org_id: "org1", email: "owner@acme.com", role: "owner", status: "active", password_hash: "x", name: "Owen" }],
    carrier_profiles: [], carrier_vetting: [], app_flags: [], revoked_users: [], user_password_overrides: [] };
  make(T, {}); const base = global.fetch;
  global.fetch = async (u, o) => {
    u = String(u);
    if (u.startsWith("https://oauth2.googleapis.com/tokeninfo")) return { ok: true, status: 200, json: async () => ({ aud: "cid", iss: "accounts.google.com", exp: String(Math.floor(Date.now() / 1000) + 600), email_verified: "true", sub: "1", email: "owner@acme.com", name: "O" }) };
    if (u.includes("mobile.fmcsa.dot.gov")) return { ok: true, status: 200, json: async () => ({ content: { carrier: { dotNumber: 555, legalName: "ROAD RUNNER LLC", allowedToOperate: u.includes("/555") ? "Y" : "N", totalPowerUnits: 2 } } }) };
    if (u.includes("lookups.twilio.com")) return { ok: true, status: 200, json: async () => ({ line_type_intelligence: { type: u.includes("14705550001") ? "nonFixedVoip" : "mobile" } }) };
    return base(u, o);
  };
  const post = (body, token) => auth.handler({ httpMethod: "POST", headers: { "x-nf-client-connection-ip": "1." + Math.floor(Math.random() * 250) + ".1.1", authorization: token ? "Bearer " + token : "" }, body: JSON.stringify(Object.assign({ token }, body)) }).then(r => [r.statusCode, JSON.parse(r.body)]);
  let [, g] = await post({ action: "googlecompany", credential: "h." + "x".repeat(110) + ".z" }); const tk = g.token; ok(!!tk, "staff signed in");
  const apply = (dot, phone, name) => post({ action: "partnersignup", profile: { company_name: name, phone_number: phone, dot_number: dot, account_password: "secret1", terms_agreed: true, fmcsa_data: { allowedToOperate: "Y" } } });
  T.organizations[0].slug = "potent"; // potentOrgId() looks up the POTENT company
  await apply("555", "4705550002", "Road Runner LLC");
  ok(T.carrier_profiles.length === 1, "application saved");
  let v = T.carrier_vetting[0]; ok(v && v.fmcsa.allowed_to_operate === true && v.phone.line_type === "mobile", "vetting ran on the server, ignoring the browser's fmcsa_data");
  ok(v.status === "MANUAL_REVIEW" && v.factors.includes("IDENTITY_NOT_CONFIRMED"), "no ID confirmation yet -> person reviews");
  await apply("999", "4705550001", "Bad Co"); const bad = T.carrier_vetting[1];
  ok(bad.status === "REJECTED" && bad.fmcsa.allowed_to_operate === false, "inactive authority recorded as REJECTED recommendation");
  T.carrier_profiles.forEach(p => p.org_id = "org1"); T.carrier_vetting.forEach(x => x.profile_id = x.profile_id);
  [, g] = await post({ action: "partnerlist", status: "pending" }, tk); ok(g.ok && g.rows.length === 2 && g.rows.every(r => r.vetting && !r.account_password), "list carries vetting, never the password");
  let [s, r] = await post({ action: "partnerdecide", id: T.carrier_profiles[1].id, status: "verified" }, tk); ok(s === 409 && r.need_override, "approving a REJECTED recommendation needs an explicit override");
  [s, r] = await post({ action: "partnerdecide", id: T.carrier_profiles[1].id, status: "verified", override: true }, tk); ok(s === 200 && T.carrier_profiles[1].verification_status === "verified", "override works and is allowed");
  [s, r] = await post({ action: "partneridv", id: T.carrier_profiles[0].id, live_human: true, doc_matches: true }, tk);
  ok(s === 200 && r.vetting.status === "APPROVED" && T.carrier_vetting[0].idv.source === "staff", "staff-confirmed ID match moves it to APPROVED recommendation");
  [s, r] = await post({ action: "partneridv", id: T.carrier_profiles[0].id, live_human: "yes" }, tk); ok(s === 400, "ID confirmation must be explicit booleans");
  [s, r] = await post({ action: "partneridv", id: T.carrier_profiles[0].id, live_human: true, doc_matches: true }); ok(s === 401 || s === 403, "not available without staff sign-in");
  [s, r] = await post({ action: "partnervet", id: "99999" }, tk); ok(s === 404, "unknown application");
  console.log("vetting: " + n + " assertions PASS"); process.exit(0);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
