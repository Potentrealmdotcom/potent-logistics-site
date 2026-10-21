// Run: node tests/onboarding-submit.test.js
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.SUPABASE_URL = "https://x.supabase.co"; process.env.RESEND_API_KEY = "rk";
const SB = "https://x.supabase.co"; const sent = [], rows = [], patches = []; let failInsert = false, conflicts = 0;
global.fetch = async (u, o) => { u = String(u); o = o || {}; const R = (d, s) => ({ ok: !s || s < 300, status: s || 200, text: async () => JSON.stringify(d), json: async () => d });
  if (u.includes("api.resend.com")) { sent.push(JSON.parse(o.body)); return R({ id: "re_1" }); }
  if (u.includes("/rest/v1/driver_onboarding") && o.method === "POST") { if (failInsert) return R({ message: "boom" }, 500); if (conflicts > 0) { conflicts--; return R({}, 409); } const r = Object.assign({ id: "id" + rows.length }, JSON.parse(o.body)); rows.push(r); return R([r]); }
  if (u.includes("/rest/v1/driver_onboarding") && o.method === "PATCH") { patches.push(JSON.parse(o.body)); return R([]); }
  return R([]); };
const { handler } = require("../netlify/functions/onboarding-submit.js");
const P = SB + "/storage/v1/object/public/driver-documents/";
const good = () => ({ driver_name: "Ana Diaz", phone: "4045550100", email: "ana@x.com", ein: "12-3456789", vehicle_class: "box", payment_method: "ach", payment_details: "acct",
  truck_registration_url: P + "a.jpg", truck_photo_url: P + "b.jpg", license_front_url: P + "c.jpg", license_back_url: P + "d.jpg", medical_card_url: P + "e.jpg", coi_url: P + "f.pdf" });
const call = b => handler({ httpMethod: "POST", body: JSON.stringify(b) }).then(r => ({ s: r.statusCode, b: JSON.parse(r.body) }));
(async () => {
  let r = await call(good());
  ok(r.s === 200 && r.b.ok && /^POT-[A-Z0-9]{6}$/.test(r.b.reference), "saves and returns a reference number");
  ok(rows.length === 1 && rows[0].reference === r.b.reference && rows[0].coi_url && rows[0].vehicle_class === "box" && rows[0].status === "pending", "row has reference, COI, vehicle class, pending");
  ok(r.b.owner_notified && r.b.confirmation_emailed && sent.length === 2, "both sides emailed");
  ok(sent.some(m => m.to[0] === "ana@x.com" && /POT-/.test(m.subject)), "applicant got confirmation with reference");
  const owner = sent.find(m => m.to[0] !== "ana@x.com"); ok(owner && /coi/.test(owner.text) && /f\.pdf/.test(owner.text) && /license front/.test(owner.text), "owner alert lists documents");
  ok(patches.length === 1 && patches[0].owner_notified_at && patches[0].applicant_notified_at, "notification timestamps recorded");
  let b = good(); delete b.coi_url; r = await call(b); ok(r.s === 400 && /coi/i.test(r.b.error), "missing COI is rejected");
  b = good(); b.truck_photo_url = "https://evil.example/x.jpg"; r = await call(b); ok(r.s === 400, "document links outside our bucket are rejected");
  b = good(); b.email = "nope"; r = await call(b); ok(r.s === 400, "bad email rejected");
  b = good(); b.website = "spam"; const before = rows.length; r = await call(b); ok(r.b.ok && rows.length === before, "honeypot: bots silently dropped, nothing saved");
  b = good(); delete b.email; sent.length = 0; r = await call(b); ok(r.b.ok && r.b.owner_notified && !r.b.confirmation_emailed && sent.length === 1, "no email given: owner still notified");
  b = good(); b.extra_docs = { truck_photo_url: [P + "t2.jpg", P + "t3.jpg"] }; sent.length = 0; r = await call(b);
  ok(r.b.ok && rows[rows.length - 1].extra_docs && rows[rows.length - 1].extra_docs.truck_photo_url.length === 2, "several truck pictures are kept");
  ok(sent.some(m => /t3\.jpg/.test(m.text || "")), "owner alert lists the extra pictures");
  b = good(); b.extra_docs = { truck_photo_url: ["https://evil.example/x.jpg"] }; r = await call(b); ok(r.s === 400, "extra pictures outside our bucket are rejected");
  conflicts = 2; r = await call(good()); ok(r.b.ok, "reference collision is retried");
  failInsert = true; r = await call(good()); ok(r.s === 502 && r.b.ok === false, "save failure is reported, never shown as success");
  console.log("onboarding-submit: " + n + " assertions PASS");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
