// Run: node tests/onboarding-submit.test.js
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.SUPABASE_URL = "https://x.supabase.co"; process.env.MAILJET_API_KEY = "a"; process.env.MAILJET_SECRET_KEY = "b";
const SB = "https://x.supabase.co"; const sent = [], rows = [], patches = []; let failInsert = false, conflicts = 0;
global.fetch = async (u, o) => { u = String(u); o = o || {}; const R = (d, s) => ({ ok: !s || s < 300, status: s || 200, text: async () => JSON.stringify(d), json: async () => d });
  if (u.includes("api.mailjet.com")) { sent.push(JSON.parse(o.body).Messages[0]); return R({}); }
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
  ok(sent.some(m => m.To[0].Email === "ana@x.com" && /POT-/.test(m.Subject)), "applicant got confirmation with reference");
  const owner = sent.find(m => m.To[0].Email !== "ana@x.com"); ok(owner && /coi/.test(owner.TextPart) && /f\.pdf/.test(owner.TextPart) && /license front/.test(owner.TextPart), "owner alert lists documents");
  ok(patches.length === 1 && patches[0].owner_notified_at && patches[0].applicant_notified_at, "notification timestamps recorded");
  let b = good(); delete b.coi_url; r = await call(b); ok(r.s === 400 && /coi/i.test(r.b.error), "missing COI is rejected");
  b = good(); b.truck_photo_url = "https://evil.example/x.jpg"; r = await call(b); ok(r.s === 400, "document links outside our bucket are rejected");
  b = good(); b.email = "nope"; r = await call(b); ok(r.s === 400, "bad email rejected");
  b = good(); b.website = "spam"; const before = rows.length; r = await call(b); ok(r.b.ok && rows.length === before, "honeypot: bots silently dropped, nothing saved");
  b = good(); delete b.email; sent.length = 0; r = await call(b); ok(r.b.ok && r.b.owner_notified && !r.b.confirmation_emailed && sent.length === 1, "no email given: owner still notified");
  conflicts = 2; r = await call(good()); ok(r.b.ok, "reference collision is retried");
  failInsert = true; r = await call(good()); ok(r.s === 502 && r.b.ok === false, "save failure is reported, never shown as success");
  console.log("onboarding-submit: " + n + " assertions PASS");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
