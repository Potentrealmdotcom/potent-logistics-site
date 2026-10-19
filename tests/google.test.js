// Run: node tests/google.test.js  (no network). "Continue with Google" across POTENT platforms.
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.GOOGLE_CLIENT_ID = "cid.apps.googleusercontent.com";
const assert = require("assert");
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const make = require("./_mock.js");
const G = require("../netlify/functions/lib/google.js");
const auth = require("../netlify/functions/auth.js"), music = require("../netlify/functions/music-api.js");
const legit = require("../netlify/functions/legit-api.js"), beat = require("../netlify/functions/beat-api.js");

// Google's tokeninfo answers come from this table, keyed by the fake token string.
const FAKE = n => "h." + "x".repeat(110) + "." + n;
const GOOD = { aud: "cid.apps.googleusercontent.com", iss: "https://accounts.google.com", exp: String(Math.floor(Date.now() / 1000) + 600), email_verified: "true", sub: "123" };
const TOK = {
  "co": Object.assign({}, GOOD, { email: "Owner@Acme.com", name: "Owen Ner" }),
  "stranger": Object.assign({}, GOOD, { email: "stranger@gmail.com", name: "Sam Stranger" }),
  "cust": Object.assign({}, GOOD, { email: "Buyer@Gmail.com", name: "Bea Buyer" }),
  "wrongapp": Object.assign({}, GOOD, { email: "x@gmail.com", aud: "someone-elses-app" }),
  "unverified": Object.assign({}, GOOD, { email: "x@gmail.com", email_verified: "false" }),
  "expired": Object.assign({}, GOOD, { email: "x@gmail.com", exp: String(Math.floor(Date.now() / 1000) - 5) }),
  "badiss": Object.assign({}, GOOD, { email: "x@gmail.com", iss: "https://evil.example" }),
  "leg": Object.assign({}, GOOD, { email: "lee@gmail.com", name: "Lee Git" }),
  "prod": Object.assign({}, GOOD, { email: "prod@gmail.com", name: "Pro Ducer" }),
  "inactive": Object.assign({}, GOOD, { email: "off@gmail.com" }),
  "mus": Object.assign({}, GOOD, { email: "fan@gmail.com", name: "Fan Girl" })
};
function withGoogle(T) {
  make(T, {});
  const base = global.fetch;
  global.fetch = async (u, o) => {
    u = String(u);
    if (u.startsWith("https://oauth2.googleapis.com/tokeninfo")) {
      const t = decodeURIComponent(u.split("id_token=")[1]); const key = t.split(".").pop(); const d = TOK[key];
      return d ? { ok: true, status: 200, json: async () => d } : { ok: false, status: 400, json: async () => ({ error: "invalid_token" }) };
    }
    return base(u, o);
  };
}
const post = (h, body, extra) => h.handler(Object.assign({ httpMethod: "POST", headers: { "x-nf-client-connection-ip": "9.9.9.9" }, body: JSON.stringify(body) }, extra || {})).then(r => [r.statusCode, JSON.parse(r.body)]);

(async () => {
  const T = { organizations: [{ id: "org1", slug: "acme", name: "Acme", status: "active", plan: "starter", license_status: "paid" }],
    org_users: [{ id: "u1", org_id: "org1", email: "owner@acme.com", role: "owner", status: "active", password_hash: "x", name: "Owen" },
                { id: "u2", org_id: "org1", email: "gone@acme.com", role: "dispatch", status: "disabled", password_hash: "x" }],
    customer_accounts: [], music_users: [{ id: "mu0", email: "off@gmail.com", active: false, password_hash: "x" }],
    legit_users: [{ id: "lu1", email: "lee@gmail.com", password_hash: "x", name: "Lee" }],
    beat_producers: [{ id: "bp1", email: "prod@gmail.com", active: true, password_hash: "x", kind: "seller" }, { id: "bp2", email: "off@gmail.com", active: false, password_hash: "x" }],
    app_flags: [], music_flags: [], revoked_users: [], user_password_overrides: [] };
  withGoogle(T);

  // ── token checks ──
  const V = c => G.verifyIdToken(FAKE(c));
  ok((await V("co")).ok && (await V("co")).email === "owner@acme.com", "email is lower-cased");
  for (const bad of ["wrongapp", "unverified", "expired", "badiss", "nope"]) ok(!(await V(bad)).ok, "rejects " + bad);
  ok(!(await G.verifyIdToken("short")).ok && !(await G.verifyIdToken(null)).ok && !(await G.verifyIdToken("a.b.c")).ok, "rejects junk tokens without calling Google");
  const saved = process.env.GOOGLE_CLIENT_ID; process.env.GOOGLE_CLIENT_ID = "";
  ok(!(await V("co")).ok, "off until GOOGLE_CLIENT_ID is set");
  let [, cfg] = await post(auth, { action: "googleconfig" }); ok(cfg.enabled === false && cfg.clientId === null, "config says disabled");
  process.env.GOOGLE_CLIENT_ID = saved;
  [, cfg] = await post(auth, { action: "googleconfig" }); ok(cfg.enabled === true && cfg.clientId === saved, "config exposes only the public client id");

  // ── company staff: only emails the owner already added ──
  let [s, r] = await post(auth, { action: "googlecompany", credential: FAKE("co") });
  ok(s === 200 && r.ok && r.user.role === "owner" && r.org.id === "org1" && r.token, "added company owner signs in with Google");
  [s, r] = await post(auth, { action: "googlecompany", credential: FAKE("stranger") });
  ok(s === 403 && !r.token, "an unknown Gmail is NOT given company access");
  ok(!T.org_users.find(u => u.email === "stranger@gmail.com"), "Google never creates company staff");
  T.org_users.push({ id: "u3", org_id: "org1", email: "stranger@gmail.com", role: "dispatch", status: "disabled", password_hash: "x" });
  [s, r] = await post(auth, { action: "googlecompany", credential: FAKE("stranger") });
  ok(s === 403, "a disabled staff login stays disabled");
  [s, r] = await post(auth, { action: "googlecompany", credential: FAKE("wrongapp") }); ok(s === 401, "token for another app refused");
  T.organizations[0].status = "suspended";
  [s, r] = await post(auth, { action: "googlecompany", credential: FAKE("co") }); ok(s === 403, "suspended company still blocked");
  T.organizations[0].status = "active";
  [s, r] = await post(auth, { action: "googlecompany", credential: FAKE("co") }); ok(s === 200, "company works again once active");

  // ── POTENT owner/staff cannot be reached through Google ──
  [s, r] = await post(auth, { action: "staff", userId: "potent", password: "", credential: FAKE("co") }); ok(s !== 200 || !r.token, "staff login ignores a Google credential");
  [s, r] = await post(auth, { action: "googlestaff", credential: FAKE("co") }); ok(!(r && r.token), "no Google path to POTENT owner/staff exists");

  // ── customers: created on first sign-in, customer role only ──
  [s, r] = await post(auth, { action: "googlecust", credential: FAKE("cust") });
  ok(s === 200 && r.token && r.email === "buyer@gmail.com", "customer signs in with Google");
  const tokBody = JSON.parse(Buffer.from(r.token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
  ok(tokBody.role === "customer" && tokBody.uid === "cust:buyer@gmail.com", "token carries ONLY the customer role");
  ok(T.customer_accounts.length === 1 && String(T.customer_accounts[0].password).startsWith("scrypt$"), "account created with an unguessable password");
  [s, r] = await post(auth, { action: "googlecust", credential: FAKE("cust") }); ok(s === 200 && T.customer_accounts.length === 1, "second sign-in reuses the account");
  [s, r] = await post(auth, { action: "custlogin", email: "buyer@gmail.com", password: "" }); ok(s === 401, "Google-made account cannot be entered with a blank password");
  [s, r] = await post(auth, { action: "custlogin", email: "buyer@gmail.com", password: "password" }); ok(s === 401, "…or a guessed one");
  [s, r] = await post(auth, { action: "googlecust", credential: FAKE("cust"), org_slug: "does-not-exist" }); ok(s === 404, "unknown company page refused");

  // ── music buyers ──
  [s, r] = await post(music, { action: "google", credential: FAKE("mus") });
  ok(s === 200 && r.token && T.music_users.find(u => u.email === "fan@gmail.com"), "music buyer created + signed in");
  [s, r] = await post(music, { action: "google", credential: FAKE("inactive") }); ok(s === 403 && !r.token, "turned-off music account refused");
  [s, r] = await post(music, { action: "google", credential: FAKE("wrongapp") }); ok(s === 401, "music rejects a token for another app");

  // ── LEGIT: 18+ and Terms still required for new accounts ──
  [s, r] = await post(legit, { action: "google", credential: FAKE("leg") }); ok(s === 200 && r.token, "existing LEGIT member signs in");
  TOK.newleg = Object.assign({}, GOOD, { email: "new@gmail.com", name: "Nia Wu" });
  [s, r] = await post(legit, { action: "google", credential: FAKE("newleg") }); ok(r.need_signup && !r.token && !T.legit_users.find(u => u.email === "new@gmail.com"), "new LEGIT user must confirm age + Terms first");
  [s, r] = await post(legit, { action: "google", credential: FAKE("newleg"), age: 17, agree: true, name: "Nia" }); ok(!r.token, "under 18 is refused");
  [s, r] = await post(legit, { action: "google", credential: FAKE("newleg"), age: 25, agree: false, name: "Nia" }); ok(!r.token, "must accept Terms");
  [s, r] = await post(legit, { action: "google", credential: FAKE("newleg"), age: 25, agree: true, name: "Nia" }); ok(s === 200 && r.token, "18+ with Terms creates the account");

  // ── beat producers: approved ones only ──
  [s, r] = await post(beat, { action: "google", credential: FAKE("prod") }); ok(s === 200 && r.token, "approved producer signs in");
  [s, r] = await post(beat, { action: "google", credential: FAKE("stranger") }); ok(s === 403 && !r.token && !T.beat_producers.find(p => p.email === "stranger@gmail.com"), "unknown Gmail is not made a producer");
  [s, r] = await post(beat, { action: "google", credential: FAKE("inactive") }); ok(s === 403, "deactivated producer refused");

  console.log("google sign-in: " + n + " assertions PASS"); process.exit(0);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
