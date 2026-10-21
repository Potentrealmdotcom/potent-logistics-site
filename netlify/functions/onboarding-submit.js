// netlify/functions/onboarding-submit.js — receives a driver/carrier onboarding application.
// Saves it with the service role (the browser no longer writes to the table), then confirms BOTH sides:
//   • the applicant gets a reference number + a confirmation email (if they gave an email)
//   • POTENT gets an alert email with every document link
// The response says exactly what was saved/sent, so the form never shows "success" for a failed save.
const mail = require("./lib/mail.js");

const SB = process.env.SUPABASE_URL || "https://ymvsatlrkzgxwzxybwmk.supabase.co";
const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Content-Type": "application/json" };
const J = (c, o) => ({ statusCode: c, headers: H, body: JSON.stringify(o) });
const DOC_PREFIX = () => SB + "/storage/v1/object/public/driver-documents/";
const REQUIRED_DOCS = ["truck_registration_url", "truck_photo_url", "license_front_url", "license_back_url", "medical_card_url", "coi_url"];
const OPTIONAL_DOCS = ["eld_photo_url", "applicant_photo_url"];
const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n || 200);
const FROM = () => process.env.MAIL_FROM_EMAIL || "info@potentworld.online";
const ownerEmail = () => process.env.OWNER_ALERT_EMAIL || "potentlogistics@" + "proton.me";

function sb(path, opts) {
  opts = opts || {}; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return fetch(SB + "/rest/v1/" + path, { method: opts.method || "GET",
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: opts.prefer || "return=representation" },
    body: opts.body ? JSON.stringify(opts.body) : undefined })
    .then(r => r.text().then(t => { let d; try { d = JSON.parse(t); } catch (e) { d = t; } return { ok: r.ok, status: r.status, data: d }; }));
}

function makeRef() { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]; return "POT-" + s; }

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return J(200, {});
  if (event.httpMethod !== "POST") return J(405, { ok: false, error: "POST only" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return J(500, { ok: false, error: "Server not configured." });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return J(400, { ok: false, error: "Bad request." }); }
  if (b.website) return J(200, { ok: true, reference: "POT-000000" }); // honeypot: bots fill hidden fields

  const row = {
    driver_name: str(b.driver_name, 120), phone: str(b.phone, 40), email: str(b.email, 160), ein: str(b.ein, 40),
    vehicle_class: str(b.vehicle_class, 60), payment_method: str(b.payment_method, 40), payment_details: str(b.payment_details, 400)
  };
  if (!row.driver_name || !row.phone || !row.ein || !row.payment_details) return J(400, { ok: false, error: "Name, phone, EIN and payment details are required." });
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(row.email)) return J(400, { ok: false, error: "That email address does not look right." });
  for (const f of REQUIRED_DOCS.concat(OPTIONAL_DOCS)) {
    const u = str(b[f], 600);
    if (!u) { if (REQUIRED_DOCS.indexOf(f) >= 0) return J(400, { ok: false, error: "Missing required document: " + f.replace(/_url$/, "").replace(/_/g, " ") + "." }); row[f] = null; continue; }
    if (u.indexOf(DOC_PREFIX()) !== 0) return J(400, { ok: false, error: "Invalid document link." });
    row[f] = u;
  }
  // extra pictures per field (a driver can send several truck photos, both sides of a card, a multi-page COI)
  const extra = {}; let extraCount = 0;
  if (b.extra_docs && typeof b.extra_docs === "object") {
    for (const f of REQUIRED_DOCS.concat(OPTIONAL_DOCS)) {
      const arr = Array.isArray(b.extra_docs[f]) ? b.extra_docs[f].slice(0, 12) : [];
      const ok = arr.map(u => str(u, 600)).filter(u => u);
      if (ok.some(u => u.indexOf(DOC_PREFIX()) !== 0)) return J(400, { ok: false, error: "Invalid document link." });
      if (ok.length) { extra[f] = ok; extraCount += ok.length; }
    }
  }
  row.status = "pending";

  let ref = null, saved = null;
  for (let i = 0; i < 4 && !saved; i++) {
    ref = makeRef(); row.reference = ref;
    let r = await sb("driver_onboarding", { method: "POST", body: extraCount ? Object.assign({}, row, { extra_docs: extra }) : row });
    if (!r.ok && extraCount && r.status !== 409) r = await sb("driver_onboarding", { method: "POST", body: row });   // table has no extra_docs column yet: save without it; the links still go in the owner's email
    if (r.ok && Array.isArray(r.data) && r.data[0]) saved = r.data[0];
    else if (r.status !== 409) return J(502, { ok: false, error: "Could not save your application. Nothing was submitted. Please try again or call (470) 453-1616." });
  }
  if (!saved) return J(502, { ok: false, error: "Could not save your application. Please try again." });

  const now = new Date().toISOString(), links = REQUIRED_DOCS.concat(OPTIONAL_DOCS).filter(f => row[f]).map(f => "  " + f.replace(/_url$/, "").replace(/_/g, " ") + ": " + row[f]).join("\n") + Object.keys(extra).map(f => "\n  more " + f.replace(/_url$/, "").replace(/_/g, " ") + ":\n    " + extra[f].join("\n    ")).join("");
  const o = await mail.send(ownerEmail(), "New driver onboarding " + ref + " — " + row.driver_name,
    "Reference: " + ref + "\nName: " + row.driver_name + "\nPhone: " + row.phone + "\nEmail: " + (row.email || "(none)") + "\nEIN: " + row.ein + "\nVehicle: " + row.vehicle_class +
    "\nPayment: " + row.payment_method + "\n\nDocuments:\n" + links + "\n\nStatus: pending review.", "", FROM());
  let a = { skipped: true };
  if (row.email) a = await mail.send(row.email, "We received your onboarding — " + ref,
    "Hi " + row.driver_name.split(" ")[0] + ",\n\nPOTENT Logistics received your onboarding application and all required documents.\nYour reference number is " + ref + ".\n\nWe review applications and will contact you at " + row.phone + ". Questions: (470) 453-1616.\n\nPlease keep this reference number.", "", FROM());
  const patch = {}; if (o && o.ok) patch.owner_notified_at = now; if (a && a.ok) patch.applicant_notified_at = now;
  if (Object.keys(patch).length) await sb("driver_onboarding?id=eq." + encodeURIComponent(saved.id), { method: "PATCH", prefer: "return=minimal", body: patch });

  return J(200, { ok: true, reference: ref, owner_notified: !!(o && o.ok), confirmation_emailed: !!(a && a.ok) });
};
