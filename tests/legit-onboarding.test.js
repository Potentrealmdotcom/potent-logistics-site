// Run: node tests/legit-onboarding.test.js  (no network). LEGIT step-by-step onboarding: optional lifestyle answers, privacy, completion.
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const make = require("./_mock.js"); const L = require("../netlify/functions/lib/legit.js"); const api = require("../netlify/functions/legit-api.js");
const PH = "data:image/jpeg;base64," + "A".repeat(200);
const mk = (id, extra) => Object.assign({ id, email: id + "@x.com", password_hash: "x", name: id, age: 30, gender: "woman", interested_in: ["man"], photos: [{ url: PH }], intent: "serious", identity_verified: true, trial_started_at: new Date().toISOString(), about: {}, tonight_intentions: [], prompts: [], pref_age_min: 18, pref_age_max: 99, pref_distance: 50, pref_body: [], banned: false }, extra || {});
(async () => {
  const idA = "aaaaaaaa-0000-4000-8000-000000000001", idB = "aaaaaaaa-0000-4000-8000-000000000002", idN = "aaaaaaaa-0000-4000-8000-000000000003";
  const T = { legit_users: [mk(idA), mk(idB, { gender: "man", interested_in: ["woman"], about: { drinking: "never", kids: "open" } }), mk(idN, { gender: null, photos: [], intent: null, interested_in: [] })], legit_swipes: [], legit_blocks: [], legit_matches: [], legit_notifications: [], legit_admin_log: [] };
  make(T, {});
  const call = (id, body) => api.handler({ httpMethod: "POST", headers: { authorization: "Bearer " + L.sign(id), "x-nf-client-connection-ip": "2.2.2.2" }, body: JSON.stringify(body) }).then(r => [r.statusCode, JSON.parse(r.body)]);

  let [s, r] = await call(idN, { action: "me" }); ok(r.ok && r.complete === false && r.user.onboarded === false && JSON.stringify(r.user.about) === "{}", "new member is incomplete and not onboarded");
  [s, r] = await call(idN, { action: "update_profile", gender: "woman" }); ok(r.ok && !r.complete, "step 1 saves");
  [s, r] = await call(idN, { action: "update_profile", about: { drinking: "socially", smoking: "never", kids: "open", pets: "have", exercise: "daily", religion: "x", politics: "y", ethnicity: "z" } });
  ok(r.ok && Object.keys(r.user.about).sort().join() === "drinking,exercise,kids,pets,smoking", "only the 5 lifestyle keys are ever stored (no religion/politics/ethnicity)");
  [s, r] = await call(idN, { action: "update_profile", about: { drinking: "heavily", kids: "<script>" } }); ok(r.ok && JSON.stringify(r.user.about) === "{}", "unknown values are dropped");
  [s, r] = await call(idN, { action: "update_profile", about: "x" }); ok(r.ok && JSON.stringify(r.user.about) === "{}", "garbage is ignored");
  [s, r] = await call(idN, { action: "update_profile", about: { pets: "none" } }); ok(r.user.about.pets === "none", "an answer can be set");
  [s, r] = await call(idN, { action: "update_profile", about: {} }); ok(JSON.stringify(r.user.about) === "{}", "sharing can be cleared");
  [s, r] = await call(idN, { action: "update_profile", interested_in: ["man"], intent: "casual", photos: [{ url: PH }] }); ok(r.complete === true, "required steps complete the profile");
  ok(r.user.onboarded === false, "not onboarded until the last step");
  [s, r] = await call(idN, { action: "update_profile", pref_age_min: 25, pref_age_max: 40, pref_distance: 30, onboarding_done: true }); ok(r.user.onboarded === true && r.user.pref_age_min === 25, "finish marks onboarded and saves preferences");
  [s, r] = await call(idN, { action: "update_profile", pref_age_min: 3 }); ok(r.user.pref_age_min === 18, "age floor stays 18");
  [s, r] = await call(idN, { action: "update_profile", onboarding_done: "yes" }); ok(r.ok, "non-true onboarding_done is ignored");
  [s, r] = await call(idA, { action: "discover" }); const card = r.cards.find(c => c.id === idB);
  ok(card && card.about.drinking === "never" && card.about.kids === "open", "what a member shared appears on their card");
  ok(!JSON.stringify(r.cards).includes("password_hash") && !("email" in card), "cards expose no private fields");
  [s, r] = await call(idA, { action: "profile_get", id: idB }); ok(r.profile.about.drinking === "never", "full profile shows shared answers");
  const nobody = T.legit_users.find(u => u.id === idN); nobody.identity_verified = false;
  [s, r] = await call(idN, { action: "update_profile", about: { pets: "have" } }); ok(s === 403, "profile edits still require ID verification");
  [s, r] = await call(idN, { action: "delete_account" }); ok(s === 200 || s === 403, "delete path unchanged");
  console.log("legit onboarding: " + n + " assertions PASS"); process.exit(0);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
