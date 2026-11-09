// Run: node tests/voice-book.test.js
// JARVIS BUILD (Nov 9, 2026) — the tenant BOOK drives the call.
// Step 1 proofs: "complete" is the book's own question list for the service being booked.
//  (i)  a salon-style tenant books an appointment with ZERO freight questions demanded;
//  (ii) Nov 9 regression: a caller gives partial details — the packet is refused as
//       incomplete, the result names the book's missing fact so she asks for it out loud,
//       no hold line is ever prescribed, and the same incomplete packet never slips through;
//  plus: a "don't know" is an answer, and the book engine's own validation units.
process.env.TWILIO_ACCOUNT_SID = "ACtest"; process.env.TWILIO_AUTH_TOKEN = "twtoken"; process.env.TWILIO_SMS_FROM = "+14045550999"; process.env.VOICE_WEBHOOK_URL = "https://hooks.test/voice"; process.env.VOICE_BRIDGE_URL = "wss://voice.test/twilio"; process.env.VOICE_BRIDGE_SECRET = "bridgesecret";
process.env.ROUTING_PROVIDER = "osrm"; process.env.OSRM_URL = "https://osrm.test"; process.env.RESEND_API_KEY = "rk";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); console.log("ok -", m); n++; };
const OA = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa", OC = "cccccccc-3333-4333-8333-cccccccccccc";
const ENT_ALL = { inbound: true, quotes: true, booking: true, handoff: true, callbacks: true, notifications: true, transcripts: true, recording: true, analytics_export: true, custom_knowledge: true, multi_vehicle: true, outbound: true, campaigns: true, contractors: true, api_access: true, priority_support: false };
const plan = (tier, price, inc, ov, conc, mins, ent) => ({ tier, label: "POTENT VOICE " + tier, os_label: "x", price_cents: price, price_is_minimum: tier === "enterprise", included_minutes: inc, overage_enabled: true, overage_cents_per_min: ov, overage_cap_minutes: null, max_concurrent_calls: conc, max_call_minutes: mins, entitlements: ent, active: true, stripe_product_id: null, version: 1 });
const SALON_BOOK = { services: [
  { id: "haircut", name: "Haircut", kind: "appointment", price_cents: 4500, duration_min: 45, needs_email: false,
    questions: [
      { key: "service_date", label: "the day for the appointment", required: true, kind: "date" },
      { key: "service_time", label: "the time they want", required: true },
      { key: "stylist", label: "a preferred stylist", required: false },
      { key: "bringing_someone", label: "whether they are bringing someone with them", required: true }
    ],
    checks: ["date_not_past", "phone_sane"] }
] };
const M = require("./_voicemock.js")({
  organizations: [{ id: OA, name: "POTENT Logistics", slug: "potent-logistics", plan: "fleet", owner_email: "owner@potent.test", license_status: "paid" },
    { id: OC, name: "Cutz Salon", slug: "cutz-salon", plan: "fleet", owner_email: "owner@cutz.test", license_status: "paid" }],
  voice_plans: [plan("fleet", 99900, 3000, 40, 15, 30, ENT_ALL)],
  voice_subscriptions: [{ org_id: OA, tier: "fleet", os_plan: "fleet", status: "internal" }, { org_id: OC, tier: "fleet", os_plan: "fleet", status: "active" }],
  voice_agent_config: [{ org_id: OA, settings: { numbers: ["+14045550100"] } }, { org_id: OC, settings: { numbers: ["+14045550300"], book: SALON_BOOK } }] });
const { T } = M;
const TL = require("../netlify/functions/lib/voice/tools"), S = require("../netlify/functions/lib/voice/store"), BK = require("../netlify/functions/lib/voice/book"), P = require("../netlify/functions/lib/voice/prompt.js");
const days = k => new Date(Date.now() + k * 864e5).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
let sn = 0; const newSes = (org, o) => { const s = Object.assign({ id: "6e6e6e6e-0000-4000-8000-" + String(++sn).padStart(12, "0"), org_id: org || OC, provider: "twilio", provider_call_id: "CB" + sn, direction: "inbound", from_number: "+14045550142", to_number: "+14045550300", state: "active", intake: {}, test_mode: false, started_at: new Date().toISOString(), answered_at: new Date().toISOString(), confirmed_by_caller: false }, o || {}); T.voice_sessions.push(s); return s; };
const sesOf = (s) => T.voice_sessions.find(x => x.id === s.id);
const run = async (s, name, args) => TL.execute({ orgId: s.org_id, session: sesOf(s), cfg: await S.cfgOf(s.org_id) }, name, args, "k" + (++sn) + Math.random());
const HOLD = /let me check|one second|hang on|just a moment|bear with me|still with me/i;
(async () => {
  // ── book engine units ──
  { const book = BK.resolve({ settings: { book: SALON_BOOK } }, null);
    ok(book && book.services[0].id === "haircut", "book resolves from cfg.settings.book (the tenant's own loaded book)");
    ok(BK.resolve({ settings: {} }, "no-such-org") === null, "a company with no book resolves to null — legacy behaviour untouched");
    const svc = book.services[0];
    let v = BK.validateAnswers(svc, { customer_name: "Jo", callback_phone: "4045550142", answers: { service_date: days(3), service_time: "10:00", bringing_someone: "no" } });
    ok(v.ok && v.data.answers.service_date === days(3), "validateAnswers: a full book packet is complete with zero freight fields anywhere in it");
    v = BK.validateAnswers(svc, { customer_name: "Jo", callback_phone: "4045550142", answers: { service_time: "10:00" }, unknown: ["bringing_someone"] });
    ok(!v.ok && v.missing.length === 1 && v.missing[0].key === "service_date", "validateAnswers: only the book's own missing question is missing; a don't-know (unknown list) counts as answered");
    v = BK.validateAnswers(svc, { customer_name: "Jo", callback_phone: "4045550142", answers: { service_date: "whenever", service_time: "10:00", bringing_someone: "don't know" } });
    ok(!v.ok && v.missing[0].key === "service_date" && v.data.unknown.includes("bringing_someone"), "validateAnswers: an unreadable date is re-asked; a spoken don't-know in the answer itself counts as answered");
  }
  // ── (i) salon booking: zero freight questions ──
  { const s = newSes(OC);
    const prompt = P.build(await S.cfgOf(OC), { name: "Cutz Salon", slug: "cutz-salon" });
    ok(/BOOK SERVICES/.test(prompt) && /Haircut/.test(prompt) && /\$45\.00/.test(prompt), "the salon's prompt carries ITS book: the Haircut service, its questions and its $45.00 price");
    ok(!/freight_description|piece_count|total_weight_lb/.test(prompt.split("BOOK SERVICES")[1] || ""), "the book block demands no freight field for a salon service");
    let r = await run(s, "submit_job_packet", { service: "haircut", customer_name: "Jo Rivera", use_caller_id: true, answers: { service_date: days(3), service_time: "10:00", bringing_someone: "no" } });
    ok(r.ok && r.submitted && r.total === "$45.00", "salon packet submits COMPLETE on the book's questions alone and prices instantly from the book: $45.00");
    const it = sesOf(s).intake;
    ok(it._book && it._book.complete === true && it._book.service === "haircut", "the saved packet is the book packet (service + book answers)");
    ok(!("freight_description" in it) && !("piece_count" in it) && !("total_weight_lb" in it), "no freight field was ever demanded or stored for the salon booking");
    r = await run(s, "submit_job_packet", { service: "haircut", customer_name: "Jo Rivera", use_caller_id: true, answers: { service_date: days(3), service_time: "10:00", bringing_someone: "no" } });
    ok(r.ok && r.duplicate === true, "the same salon packet again is a duplicate — never a second save");
  }
  // ── (ii) Nov 9 regression: partial details ──
  { const s = newSes(OC);
    let r = await run(s, "submit_job_packet", { service: "haircut", customer_name: "Sam Blue", use_caller_id: true, answers: { service_time: "11:00" } });
    ok(!r.ok && r.error === "packet_incomplete", "a partial book packet is REFUSED as incomplete — never submitted, never priced");
    ok(Array.isArray(r.missing) && r.missing.includes("service_date") && r.missing.includes("bringing_someone"), "the refusal names the BOOK's missing facts (the day; bringing someone) — not shipment fields");
    ok(/conversationally/i.test(r.say) && !HOLD.test(r.say), "the instruction is to ASK out loud, conversationally — and prescribes no hold line");
    ok(!sesOf(s).intake._worker_submit && !sesOf(s).intake._quote, "nothing was handed to the worker and no quote exists for the incomplete packet");
    r = await run(s, "submit_job_packet", { service: "haircut", customer_name: "Sam Blue", use_caller_id: true, answers: { service_time: "11:00" } });
    ok(!r.ok && r.error === "packet_incomplete", "the SAME incomplete packet submitted again is still refused (the Nov 9 loop — resubmitting 3x — now just re-asks)");
    r = await run(s, "submit_job_packet", { service: "haircut", customer_name: "Sam Blue", use_caller_id: true, answers: { service_date: days(2), service_time: "11:00" }, unknown: ["bringing_someone"] });
    ok(r.ok && r.submitted && r.total === "$45.00", "once she asks and the caller answers (or says don't-know), the packet completes and prices from the book");
  }
  // ── an unknown service is refused, never improvised ──
  { const s = newSes(OC);
    const r = await run(s, "submit_job_packet", { service: "massage", customer_name: "Jo", use_caller_id: true, answers: {} });
    ok(!r.ok && r.error === "unknown_service", "a service that is not in the book is refused — she offers what the book lists");
  }
  console.log("\n" + n + " assertions passed — voice-book (step 1)");
})().catch(e => { console.error("FAIL:", e && e.message); process.exit(1); });
