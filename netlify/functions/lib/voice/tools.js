// The ONLY things the voice model can do. Every tool re-checks authorization, plan entitlement, call state and business rules on the server;
// the model's words never grant a permission. Results are written to voice_tool_executions, keyed by the provider's call id, so a retry cannot repeat an action.
const B = require("../beats");
const S = require("./store"), I = require("./intake"), R = require("./rules"), P = require("./pricing"), RT = require("./route"), AV = require("./availability"), V = require("./billing"), TW = require("./adapters/twilio");
const rows = S.rows;
const FEATURE = { lookup_customer: "inbound", create_or_update_lead: "inbound", get_approved_service_information: "inbound", collect_shipment_details: "quotes", validate_shipment_eligibility: "quotes", calculate_quote: "quotes", quote_special_service: "quotes", check_live_availability: "booking",
  create_pending_booking: "booking", confirm_eligible_booking: "booking", create_callback_task: "callbacks", request_human_handoff: "handoff", send_approved_confirmation: "notifications", look_up_booking_status: "booking", request_reschedule: "booking", request_cancellation: "booking" };
const CRITICAL = ["pickup_address", "delivery_address", "service_date", "time_window", "service_level", "total_weight_lb", "piece_count", "pieces", "total_dims", "pickup_dock", "delivery_dock", "needs_liftgate", "needs_pallet_jack", "forklift_pickup", "forklift_delivery", "site_has_pallet_jack", "inside_delivery", "hazmat", "special_handling", "extra_stops", "labor_helpers", "labor_hours", "holding_nights", "expected_wait_minutes", "freight_description"];
const INTAKE_KEYS = CRITICAL.concat(["customer_name", "company", "callback_phone", "email", "pickup_contact_name", "pickup_contact_phone", "delivery_contact_name", "delivery_contact_phone", "special_instructions", "po_number", "recurring"]);
const clip = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n); };
const last4 = function (p) { return String(p || "").replace(/\D/g, "").slice(-4); };
const AFFIRM = /\b(yes|yeah|yep|yup|correct|confirm|confirmed|go ahead|book it|that'?s right|sounds good|do it|please do|okay|ok|sure|let'?s do it|proceed)\b/i, NEG = /\b(no|not|don'?t|wait|hold on|stop|cancel|never ?mind|actually|change)\b/i;

// ── schemas shown to the model (kept deliberately small; the server validates again) ──
const obj = function (props, req) { return { type: "object", properties: props, required: req || [], additionalProperties: false }; };
const str = function (d) { return { type: "string", description: d }; };
function defs() {
  const D = function (name, description, params) { return { type: "function", name: name, description: description, parameters: params || obj({}) }; };
  return [
    D("lookup_customer", "Check whether the caller's phone number matches a known customer. Returns only a name and whether they are known. Caller ID is NOT proof of identity."),
    D("create_or_update_lead", "Save the caller as a sales lead.", obj({ name: str("Caller name"), company: str("Company"), email: str("Email"), notes: str("What they need") }, ["name"])),
    D("get_approved_service_information", "Get approved company facts. Use this instead of guessing about services, service area, truck limits, scheduling, payment or policies.", obj({ topic: { type: "string", enum: ["services", "service_area", "truck_limits", "scheduling", "payment", "policies", "pricing_policy", "faq"] } }, ["topic"])),
    D("collect_shipment_details", "Record shipment facts the caller has stated. Send only what the caller actually said. Returns what is still missing or inconsistent.", obj({
      customer_name: str(""), company: str(""), callback_phone: str("10-digit US number"), email: str(""), pickup_address: str("full street address with city and state"), delivery_address: str("full street address with city and state"),
      pickup_contact_name: str(""), pickup_contact_phone: str(""), delivery_contact_name: str(""), delivery_contact_phone: str(""), service_date: str("YYYY-MM-DD"), time_window: str("early|morning|afternoon|evening|all_day or HH:MM 24h"),
      service_level: { type: "string", enum: ["standard", "same_day", "rush", "recurring", "savannah_early", "savannah_full"] }, freight_description: str(""), piece_count: { type: "integer" }, total_weight_lb: { type: "number" },
      pieces: { type: "array", items: obj({ l: { type: "number" }, w: { type: "number" }, h: { type: "number" }, qty: { type: "integer" }, weight_lb: { type: "number" } }, ["l", "w", "h"]) }, total_dims: obj({ l: { type: "number" }, w: { type: "number" }, h: { type: "number" } }, ["l", "w", "h"]),
      pickup_dock: { type: "boolean", description: "pickup has dock-height loading" }, delivery_dock: { type: "boolean", description: "delivery has dock-height unloading" }, needs_liftgate: { type: "boolean" }, needs_pallet_jack: { type: "boolean" }, site_has_pallet_jack: { type: "boolean" },
      forklift_pickup: { type: "boolean" }, forklift_delivery: { type: "boolean" }, inside_delivery: { type: "boolean" }, hazmat: { type: "boolean" }, special_handling: str(""), special_instructions: str(""), po_number: str(""),
      extra_stops: { type: "integer" }, labor_helpers: { type: "integer" }, labor_hours: { type: "number" }, expected_wait_minutes: { type: "number" }, holding_nights: { type: "integer" }, recurring: { type: "boolean" } })),
    D("validate_shipment_eligibility", "Verify both addresses and check the shipment against the verified truck limits and service area. Call after all required details are collected."),
    D("calculate_quote", "Calculate the official price. The price comes only from this tool. Never state a price from memory."),
    D("quote_special_service", "Official price for junk removal, pop-up events, or recurring service (by load size or dedicated route). The price comes only from this tool. A person schedules these afterwards; offer create_callback_task.", obj({
      service: { type: "string", enum: ["junk_removal", "popup_event", "recurring_load_class", "recurring_route"] },
      pickup_address: str("junk: the address the job is at. Events and routes: the pickup address, full street address with city and state"), delivery_address: str("events and routes: the delivery or event address"),
      load_size: { type: "string", enum: ["minimum", "quarter", "half", "threequarter", "full"], description: "junk removal volume" }, truckloads: { type: "integer", description: "junk: full truckloads needed, default 1" },
      has_heavy_items: { type: "boolean", description: "junk: heavy items such as safes, pianos, hot tubs, or loose concrete, dirt, brick" },
      total_weight_lb: { type: "number", description: "recurring by load size: the weight per run" }, days_per_week: { type: "integer" }, flex_window: { type: "boolean", description: "recurring by load size: customer accepts a flexible time window" },
      direction: { type: "string", enum: ["oneway", "roundtrip"], description: "recurring_route" } }, ["service"])),
    D("check_live_availability", "Check real availability for the requested date and window. Never promise a time without this."),
    D("create_pending_booking", "After you read the quote and details back and the caller clearly says yes, save the booking request."),
    D("confirm_eligible_booking", "Confirm a saved booking request. Succeeds only if every check still passes.", obj({ booking_id: str("id returned by create_pending_booking") }, ["booking_id"])),
    D("create_callback_task", "Create a callback for a person to follow up.", obj({ name: str(""), phone: str("number to call"), reason: str(""), preferred_time: str("") }, ["reason"])),
    D("request_human_handoff", "Ask to transfer to a person: negotiations, discounts, complaints, safety concerns, anything uncertain, or when the caller asks for one.", obj({ reason: str("why"), summary: str("one or two sentences for the person") }, ["reason"])),
    D("send_approved_confirmation", "Send the approved written confirmation or request-received notice for this call's booking.", obj({ booking_id: str(""), channel: { type: "string", enum: ["email", "sms"] }, email: str("only for email"), sms_consent: { type: "boolean", description: "caller agreed to a text message" } }, ["booking_id", "channel"])),
    D("look_up_booking_status", "Look up a booking. Needs the booking reference and the last 4 digits of the phone number on the booking.", obj({ reference: str(""), phone_last4: str("") }, ["reference", "phone_last4"])),
    D("request_reschedule", "Record a reschedule request (a person completes it).", obj({ reference: str(""), phone_last4: str(""), requested_date: str(""), note: str("") }, ["reference", "phone_last4"])),
    D("request_cancellation", "Record a cancellation request (a person completes it).", obj({ reference: str(""), phone_last4: str(""), note: str("") }, ["reference", "phone_last4"]))
  ];
}

async function setIntake(ctx, intake, extra) { ctx.session.intake = intake; return S.patchSession(ctx.orgId, ctx.session.id, Object.assign({ intake: intake }, extra || {})); }
async function invalidate(ctx, intake) { // a changed fact voids everything validated on the old facts
  const had = intake._quote_id; delete intake._geo; delete intake._elig; delete intake._quote; delete intake._avail; delete intake._route; delete intake._quote_id;
  if (had) await B.sb("voice_quotes?org_id=eq." + ctx.orgId + "&id=eq." + had + "&status=eq.offered", { method: "PATCH", prefer: "return=minimal", body: { status: "expired" } });
  ctx.session.quote = null; await S.patchSession(ctx.orgId, ctx.session.id, { quote: null, confirmed_by_caller: false });
}
const cleanArgs = function (a) { const o = {}; INTAKE_KEYS.forEach(function (k) { if (a && a[k] !== undefined && a[k] !== null && a[k] !== "") o[k] = a[k]; }); return o; };
const vOf = function (ctx) { return I.validate(ctx.session.intake || {}); };
// Caller consent is read from the stored transcript after the quote was given, not from a flag the model sets.
async function callerConfirmed(ctx) {
  const q = ctx.session.intake && ctx.session.intake._quote; if (!q) return false;
  const t = rows(await B.sb("voice_transcripts?session_id=eq." + ctx.session.id + "&role=eq.caller&select=text,created_at,seq&order=seq.desc&limit=6"));
  return t.some(function (x) { return String(x.created_at) >= String(q.created_at) && AFFIRM.test(x.text) && !NEG.test(x.text); });
}
async function suppressed(orgId, phone) { return rows(await B.sb("voice_suppression_records?org_id=eq." + orgId + "&phone=eq." + encodeURIComponent(phone || "x") + "&select=id&limit=1")).length > 0; }
async function notifyOwner(orgId, subject, text) { try { const o = rows(await B.sb("organizations?id=eq." + orgId + "&select=owner_email&limit=1"))[0]; if (o && o.owner_email) await require("../mail").send(o.owner_email, subject, text, "/voice/"); } catch (e) { /* best effort */ } }

const TOOLS = {
  async lookup_customer(ctx) {
    const n = last4(ctx.session.from_number); if (!ctx.session.from_number || !n) return { ok: true, known: false };
    const want = String(ctx.session.from_number).replace(/\D/g, "").slice(-10);
    const c = rows(await B.sb("customers?org_id=eq." + ctx.orgId + "&select=id,name,company,phone&limit=500")).find(function (x) { return String(x.phone || "").replace(/\D/g, "").slice(-10) === want; });
    if (c) { await S.patchSession(ctx.orgId, ctx.session.id, { customer_id: c.id }); return { ok: true, known: true, name: c.name || null, company: c.company || null, verified: false, note: "Matched by caller ID only. Do not share account details." }; }
    return { ok: true, known: false };
  },
  async create_or_update_lead(ctx, a) {
    const phone = ctx.session.from_number || I.phone(a.phone) || null; if (!phone) return { ok: false, error: "no_phone" };
    const ex = rows(await B.sb("leads?org_id=eq." + ctx.orgId + "&phone=eq." + encodeURIComponent(phone) + "&select=id&limit=1"))[0];
    const body = { name: clip(a.name, 80), company: clip(a.company, 100) || null, phone: phone, email: clip(a.email, 120) || null, notes: clip(a.notes, 500) || null, source: "POTENT VOICE", service_type: "freight" };
    if (ex) { await B.sb("leads?id=eq." + ex.id + "&org_id=eq." + ctx.orgId, { method: "PATCH", prefer: "return=minimal", body: Object.assign({}, body, { updated_at: new Date().toISOString() }) }); await S.patchSession(ctx.orgId, ctx.session.id, { lead_id: ex.id }); return { ok: true, updated: true }; }
    const r = await B.sb("leads", { method: "POST", prefer: "return=representation", body: Object.assign({ org_id: ctx.orgId, stage: "New" }, body) });
    const id = rows(r)[0] && rows(r)[0].id; if (id) await S.patchSession(ctx.orgId, ctx.session.id, { lead_id: id }); return r.ok ? { ok: true, created: true } : { ok: false, error: "save_failed" };
  },
  async get_approved_service_information(ctx, a) {
    const topic = String(a.topic || ""), prof = await S.profileOf(ctx.orgId), facts = [];
    if (topic === "truck_limits" || topic === "services") {
      if (prof) facts.push("Vehicle: " + prof.name + ". Maximum shipment weight " + prof.max_payload_lb + " lb. Cargo area " + prof.interior_l_in + " x " + prof.interior_w_in + " x " + prof.interior_h_in + " inches; rear door " + prof.door_w_in + " x " + prof.door_h_in + " inches.", "Equipment: " + Object.keys(prof.equipment || {}).filter(function (k) { return prof.equipment[k]; }).join(", ").replace(/_/g, " ") + (prof.equipment && !prof.equipment.liftgate ? ". No liftgate" : "") + (prof.equipment && !prof.equipment.pallet_jack ? ". No pallet jack" : "") + ".");
      else facts.push("Vehicle limits are not set up yet; do not state any limits.");
    }
    if (topic === "service_area") facts.push(prof ? "Authorized service area: " + ((prof.service_area && prof.service_area.states) || []).join(", ") + (prof.interstate_authorized ? " including interstate." : ", local intrastate work only.") : "Service area is not set up yet; do not state one.");
    if (topic === "pricing_policy") facts.push("Prices are calculated by the system after the details and route are verified. The assistant cannot discount or change a price. Waiting time, extra labor and changes can add charges.");
    const today = new Date().toISOString().slice(0, 10);
    const docs = rows(await B.sb("voice_knowledge_documents?org_id=eq." + ctx.orgId + "&status=eq.approved&select=category,title,body,effective_from&limit=50")).filter(function (d) { return (!d.effective_from || d.effective_from <= today) && (d.category === topic || topic === "faq"); });
    docs.forEach(function (d) { facts.push(d.title + ": " + d.body); });
    return { ok: true, topic: topic, facts: facts, note: facts.length ? "Only state these facts." : "No approved information on this topic. Say you will have someone follow up; do not guess." };
  },
  async collect_shipment_details(ctx, a) {
    const intake = Object.assign({}, ctx.session.intake || {}), inc = cleanArgs(a); let changed = false;
    Object.keys(inc).forEach(function (k) { if (JSON.stringify(intake[k]) !== JSON.stringify(inc[k])) { if (CRITICAL.indexOf(k) >= 0 && intake[k] !== undefined) changed = true; intake[k] = inc[k]; } });
    if (!intake.callback_phone && ctx.session.from_number && a && a.use_caller_id === true) intake.callback_phone = ctx.session.from_number;
    if (changed || Object.keys(inc).some(function (k) { return CRITICAL.indexOf(k) >= 0; })) await invalidate(ctx, intake);
    await setIntake(ctx, intake);
    const v = I.validate(intake);
    return { ok: true, complete: v.ok, missing: v.missing, problems: v.problems, reset: changed ? "Details changed, so earlier checks and any quote were cleared. Re-run validation and quote." : undefined };
  },
  async validate_shipment_eligibility(ctx) {
    const intake = Object.assign({}, ctx.session.intake || {}), v = I.validate(intake);
    if (!v.ok) return { ok: false, missing: v.missing, problems: v.problems };
    const d = v.data, geo = intake._geo || {};
    for (const k of ["pickup", "delivery"]) {
      const addr = d[k + "_address"]; if (geo[k] && geo[k].input === addr) continue;
      const g = await RT.verifyAddress(addr);
      if (g.unknown) return { ok: false, error: "address_check_unavailable", say: "I can't verify addresses right now. Offer a callback or a person." };
      if (!g.ok) return { ok: false, problems: [k + "_address_not_found"], say: "I couldn't find the " + k + " address. Ask the caller to repeat it with street, city and state." };
      geo[k] = { input: addr, matched: g.matched, lat: g.lat, lon: g.lon, state: g.state }; d[k + "_state"] = g.state || d[k + "_state"];
    }
    intake._geo = geo;
    const prof = await S.profileOf(ctx.orgId);
    if (!prof) { intake._elig = { status: "review", reviews: [{ code: "no_vehicle_profile", text: "No authorized vehicle profile is configured." }], blocks: [] }; await setIntake(ctx, intake); return { ok: true, status: "review", reasons: ["No authorized vehicle is set up. A person must review this request."] }; }
    d.pickup_state = geo.pickup.state || d.pickup_state; d.delivery_state = geo.delivery.state || d.delivery_state;
    const e = R.evaluate(d, prof); intake._elig = { status: e.status, blocks: e.blocks, reviews: e.reviews, profile_id: prof.id, checked_at: new Date().toISOString() };
    await setIntake(ctx, intake);
    return { ok: true, status: e.status, reasons: e.blocks.concat(e.reviews).map(function (x) { return x.text; }), say: e.status === "blocked" ? "We cannot take this shipment as described. Explain the reason plainly and offer a person or callback." : e.status === "review" ? "A person must review this. Offer a callback or transfer. Do not quote." : "Eligible. You may calculate the quote." };
  },
  async calculate_quote(ctx) {
    const intake = Object.assign({}, ctx.session.intake || {}), el = intake._elig;
    if (!el || el.status !== "eligible") return { ok: false, error: "not_eligible", say: "Run validate_shipment_eligibility first; only eligible shipments can be quoted." };
    const v = I.validate(intake); if (!v.ok) return { ok: false, missing: v.missing, problems: v.problems };
    const d = v.data, S0 = await S.pricingSettings(ctx.orgId, ctx.cfg); let miles = null, mins = null;
    if (!/^savannah/.test(d.service_level)) { const g = intake._geo; const r = await RT.distance(g.pickup, g.delivery); if (r.ok) { miles = r.miles; mins = r.minutes; intake._route = { miles: miles, minutes: mins, source: r.source }; } }
    const q = P.quote(d, miles, S0, ctx.cfg.settings && ctx.cfg.settings.quote);
    if (!q.ok) return { ok: false, review: true, reason: q.reason, say: "You cannot give a price. Offer a callback or a person." };
    const number = S.ref("Q"), ins = await B.sb("voice_quotes", { method: "POST", prefer: "return=representation", body: { org_id: ctx.orgId, session_id: ctx.session.id, number: number, input: d, lines: q.lines, total_cents: q.total_cents, miles: miles, miles_source: intake._route ? intake._route.source : (miles == null ? "flat_rate" : null), settings_version: q.settings_version, expires_at: q.expires_at } });
    const row = rows(ins)[0]; if (!row) return { ok: false, error: "save_failed" };
    intake._quote_id = row.id; intake._quote = { id: row.id, number: number, total_cents: q.total_cents, expires_at: q.expires_at, created_at: row.created_at || new Date().toISOString() };
    await setIntake(ctx, intake, { quote: { id: row.id, number: number, total_cents: q.total_cents } });
    return { ok: true, quote_number: number, lines: q.lines.map(function (l) { return l.label + ": " + P.money(l.cents); }), total: P.money(q.total_cents), tax_note: q.exclusions[q.exclusions.length - 1], valid_minutes: Math.round((new Date(q.expires_at) - Date.now()) / 60000), exclusions: q.exclusions, payment: q.payment_text, deposit: q.deposit_cents ? P.money(q.deposit_cents) : null };
  },
  async check_live_availability(ctx) {
    const intake = Object.assign({}, ctx.session.intake || {}), q = intake._quote, el = intake._elig;
    if (!q || !el || el.status !== "eligible") return { ok: false, error: "quote_first" };
    if (new Date(q.expires_at) < new Date()) return { ok: false, error: "quote_expired", say: "The quote expired. Recalculate it." };
    const d = I.validate(intake).data, win = AV.windowFor(d, intake._route && intake._route.minutes);
    const r = await AV.check(ctx.orgId, el.profile_id, win, ctx.cfg);
    intake._avail = { verified: r.verified, available: r.available, reasons: r.reasons, start: win.start.toISOString(), end: win.end.toISOString(), checked_at: new Date().toISOString() };
    await setIntake(ctx, intake);
    return r.verified && r.available ? { ok: true, available: true, window: d.time_window, say: "The truck is open for that window. You may offer to book it." } : r.verified ? { ok: true, available: false, say: "That window is taken. Offer another time or a callback." } : { ok: true, available: null, say: "Availability could not be verified. You may save a booking REQUEST that a person will confirm. Do not say it is booked." };
  },
  async create_pending_booking(ctx) {
    const intake = Object.assign({}, ctx.session.intake || {}), q = intake._quote, el = intake._elig, av = intake._avail;
    if (!q || !el || el.status !== "eligible") return { ok: false, error: "quote_first" };
    if (new Date(q.expires_at) < new Date()) return { ok: false, error: "quote_expired" };
    if (!av) return { ok: false, error: "check_availability_first" };
    if (!(await callerConfirmed(ctx))) return { ok: false, error: "caller_has_not_confirmed", say: "Read the details and total back, then ask the caller to confirm. Do not proceed until they clearly say yes." };
    const d = I.validate(intake).data, idem = ctx.session.id + ":" + q.number;
    const reason = av.verified && av.available ? null : !av.verified ? "Availability could not be verified: " + (av.reasons || []).join(", ") : "Requested window is not available";
    const body = { org_id: ctx.orgId, session_id: ctx.session.id, quote_id: q.id, idem_key: idem, reference: S.ref("PV"), status: "pending_review", review_reason: reason, vehicle_profile_id: el.profile_id, window_start: av.start, window_end: av.end,
      customer_name: d.customer_name, customer_phone: d.callback_phone, customer_email: d.email || null, snapshot: { intake: d, quote: q, eligibility: el, availability: av } };
    const ins = await B.sb("voice_bookings", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: body });
    let row = rows(ins)[0]; if (!row) row = rows(await B.sb("voice_bookings?org_id=eq." + ctx.orgId + "&idem_key=eq." + encodeURIComponent(idem) + "&select=*&limit=1"))[0];
    if (!row) return { ok: false, error: "save_failed" };
    await S.patchSession(ctx.orgId, ctx.session.id, { confirmed_by_caller: true, outcome: "booking_requested" });
    await notifyOwner(ctx.orgId, "New voice booking request " + row.reference, d.customer_name + " " + d.callback_phone + ": " + d.pickup_address + " to " + d.delivery_address + " on " + d.service_date + ". Total " + P.money(q.total_cents) + ". " + (reason ? "Needs review: " + reason : "Ready to confirm."));
    return { ok: true, booking_id: row.id, reference: row.reference, status: row.status, ready_to_confirm: !reason, say: reason ? "Saved as a REQUEST that a person will review. It is not confirmed." : "Saved. Next call confirm_eligible_booking." };
  },
  async confirm_eligible_booking(ctx, a) {
    if (!S.UUID.test(String(a.booking_id || ""))) return { ok: false, error: "bad_booking" };
    const bk = rows(await B.sb("voice_bookings?org_id=eq." + ctx.orgId + "&id=eq." + a.booking_id + "&session_id=eq." + ctx.session.id + "&select=*&limit=1"))[0];
    if (!bk) return { ok: false, error: "booking_not_found" };
    if (bk.status === "confirmed") return { ok: true, confirmed: true, duplicate: true, reference: bk.reference, job_id: bk.job_id };
    if (bk.status !== "pending_review") return { ok: false, error: "booking_" + bk.status };
    const snap = bk.snapshot, q = rows(await B.sb("voice_quotes?org_id=eq." + ctx.orgId + "&id=eq." + bk.quote_id + "&select=*&limit=1"))[0];
    const fail = async function (why, say) { await B.sb("voice_bookings?id=eq." + bk.id, { method: "PATCH", prefer: "return=minimal", body: { review_reason: why } }); return { ok: true, confirmed: false, reference: bk.reference, pending: true, reason: why, say: say || "Not confirmed. It stays a request for a person to review. Say so honestly." }; };
    if (!q || q.status !== "offered" || new Date(q.expires_at) < new Date()) return fail("Quote expired or changed");
    const prof = await S.profileOf(ctx.orgId, bk.vehicle_profile_id); if (!prof) return fail("Vehicle no longer authorized");
    const e = R.evaluate(snap.intake, prof); if (e.status !== "eligible") return fail("Eligibility changed: " + e.blocks.concat(e.reviews).map(function (x) { return x.code; }).join(","));
    const av = await AV.check(ctx.orgId, prof.id, { start: new Date(bk.window_start), end: new Date(bk.window_end) }, ctx.cfg);
    if (!av.verified) return fail("Availability could not be verified: " + av.reasons.join(","));
    if (!av.available) return fail("Time no longer available", "That time was just taken. Not booked. Offer another time or a callback.");
    const d = snap.intake; let res;
    for (let t = 0; t < 2; t++) {
      const jobId = "PL-" + S.ref("X").split("-").slice(1).join("-");
      const r = await B.rpc("voice_confirm_booking", { p_booking: bk.id, p_job_id: jobId, p_job: { customer: d.customer_name, phone: d.callback_phone, email: d.email || null, service: "freight", service_name: "POTENT VOICE booking " + bk.reference, origin: d.pickup_address, destination: d.delivery_address, speed: d.service_level,
        base_price: q.total_cents / 100, final_price: q.total_cents / 100, date: d.service_date, time_slot: d.time_window, notes: "Booked by POTENT VOICE. Ref " + bk.reference + ". " + d.freight_description + " (" + d.piece_count + " pc, " + d.total_weight_lb + " lb). " + (d.special_instructions || ""), miles: q.miles, est_total_lbs: d.total_weight_lb, is_business: !!d.company, company_name: d.company || null, customer_type: d.company ? "business" : "residential" } });
      res = r.ok ? r.data : null; if (res && res.ok) break; if (res && res.error === "conflict") return fail("Time no longer available", "That time was just taken. Not booked."); if (res && res.error !== undefined && res.error !== "bad_state") break;
    }
    if (!res || !res.ok) return fail("Could not save the booking: " + (res && res.error || "database error"), "Something failed while saving. It is NOT confirmed; a person will follow up.");
    await B.sb("voice_quotes?id=eq." + q.id, { method: "PATCH", prefer: "return=minimal", body: { status: "accepted" } });
    await S.patchSession(ctx.orgId, ctx.session.id, { outcome: "booked" });
    await notifyOwner(ctx.orgId, "Voice booking CONFIRMED " + bk.reference, d.customer_name + " " + d.callback_phone + ": " + d.pickup_address + " to " + d.delivery_address + " on " + d.service_date + " (" + d.time_window + "). Job " + res.job_id + ".");
    return { ok: true, confirmed: true, reference: bk.reference, job_id: res.job_id, duplicate: !!res.duplicate };
  },
  async create_callback_task(ctx, a) {
    const phone = I.phone(a.phone) || ctx.session.from_number; if (!phone) return { ok: false, error: "need_phone_number" };
    const r = await B.sb("voice_callbacks", { method: "POST", prefer: "return=representation", body: { org_id: ctx.orgId, session_id: ctx.session.id, name: clip(a.name, 80) || null, phone: phone, reason: clip(a.reason, 300), preferred_time: clip(a.preferred_time, 80) || null } });
    if (!r.ok) return { ok: false, error: "save_failed" };
    await S.patchSession(ctx.orgId, ctx.session.id, { outcome: "callback" }); return { ok: true, callback_id: rows(r)[0] && rows(r)[0].id, say: "A callback is recorded. Do not promise an exact time." };
  },
  async request_human_handoff(ctx, a) {
    const r = await B.sb("voice_handoffs", { method: "POST", prefer: "return=representation", body: { org_id: ctx.orgId, session_id: ctx.session.id, reason: clip(a.reason, 300), summary: clip(a.summary, 600) || null } });
    if (!r.ok) return { ok: false, error: "save_failed" };
    const can = !!(ctx.cfg.human_available && ctx.cfg.transfer_number && TW.configured());
    await S.patchSession(ctx.orgId, ctx.session.id, { outcome: "handoff_requested" });
    return { ok: true, handoff_id: rows(r)[0] && rows(r)[0].id, transfer_possible: can, transfer: can ? "pending" : "unavailable", say: can ? "Tell the caller you are trying to connect them. Do not say they are connected until told." : "No one is available right now. Tell the caller honestly and offer a callback (create_callback_task)." };
  },
  async send_approved_confirmation(ctx, a) {
    const bk = rows(await B.sb("voice_bookings?org_id=eq." + ctx.orgId + "&id=eq." + clip(a.booking_id, 40) + "&session_id=eq." + ctx.session.id + "&select=*&limit=1"))[0];
    if (!bk || !S.UUID.test(String(a.booking_id))) return { ok: false, error: "booking_not_found" };
    const channel = a.channel === "sms" ? "sms" : "email", snap = bk.snapshot, d = snap.intake, conf = bk.status === "confirmed", total = P.money(snap.quote.total_cents);
    const to = channel === "email" ? clip(a.email, 120).toLowerCase() || bk.customer_email : bk.customer_phone;
    if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(to || ""))) return { ok: false, error: "need_valid_email" };
    if (channel === "sms") { if (a.sms_consent !== true) return { ok: false, error: "need_sms_consent" }; if (await suppressed(ctx.orgId, to)) return { ok: false, error: "number_opted_out" }; }
    const text = (conf ? "Your POTENT booking is CONFIRMED. Reference " + bk.reference + ".\n" : "We received your request. It is NOT yet confirmed. Reference " + bk.reference + ". A dispatcher will confirm with you.\n") + "Pickup: " + d.pickup_address + "\nDelivery: " + d.delivery_address + "\nDate: " + d.service_date + " (" + d.time_window + ")\nQuoted price: " + total + " (" + (snap.quote.payment_text || "payment instructions will follow") + ")\nTo reschedule or cancel, call us back and give this reference.";
    const claim = await B.sb("voice_notifications_sent", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: { org_id: ctx.orgId, booking_id: bk.id, channel: channel, kind: conf ? "confirmation" : "request", to_addr: to, status: "sending" } });
    if (!rows(claim).length) return { ok: true, duplicate: true, say: "Already sent." };
    const res = channel === "email" ? await require("../mail").send(to, (conf ? "Booking confirmed " : "Request received ") + bk.reference, text) : await TW.sms(to, text);
    const sent = !!(res && (res.ok || res.data)), skipped = res && res.skipped;
    await B.sb("voice_notifications_sent?booking_id=eq." + bk.id + "&channel=eq." + channel + "&kind=eq." + (conf ? "confirmation" : "request"), { method: "PATCH", prefer: "return=minimal", body: { status: sent ? "sent" : "failed", error: sent ? null : (skipped ? "email_not_configured" : (res && res.reason) || "send_failed") } });
    if (sent) { if (conf) await B.sb("voice_bookings?id=eq." + bk.id, { method: "PATCH", prefer: "return=minimal", body: { confirmation_sent_at: new Date().toISOString() } }); return { ok: true, sent: true, kind: conf ? "confirmation" : "request_received_not_confirmed" }; }
    await B.sb("voice_callbacks", { method: "POST", prefer: "return=minimal", body: { org_id: ctx.orgId, session_id: ctx.session.id, name: d.customer_name, phone: bk.customer_phone, reason: "Send " + (conf ? "confirmation" : "request notice") + " for " + bk.reference + " manually (" + channel + " failed)" } });
    return { ok: true, sent: false, say: "The message could not be sent. The booking is kept and a person will follow up. Do not say it was sent." };
  }
};
async function verifyRef(ctx, a) {
  const bk = rows(await B.sb("voice_bookings?org_id=eq." + ctx.orgId + "&reference=eq." + encodeURIComponent(clip(a.reference, 30).toUpperCase()) + "&select=*&limit=1"))[0];
  return bk && last4(bk.customer_phone) && last4(bk.customer_phone) === String(a.phone_last4 || "").replace(/\D/g, "").slice(-4) ? bk : null;
}
TOOLS.look_up_booking_status = async function (ctx, a) { const bk = await verifyRef(ctx, a); if (!bk) return { ok: false, error: "not_verified", say: "Could not match that reference and phone number." }; const w = bk.snapshot && bk.snapshot.intake; return { ok: true, status: bk.status === "pending_review" ? "request received, awaiting confirmation" : bk.status, date: w && w.service_date, window: w && w.time_window }; };
// Junk removal, pop-up events and recurring service, priced from POTENT's existing price list (ospricing.js). Never invents a number: anything unclear goes to a person.
TOOLS.quote_special_service = async function (ctx, a) {
  const OS = require("./ospricing"), svc = String(a.service || ""), review = function (why) { return { ok: false, review: true, reason: why, say: "You cannot give a price for this. Offer a callback or a person." }; };
  const S0 = await S.pricingSettings(ctx.orgId, ctx.cfg); if (!S0) return review("No approved pricing settings were found.");
  const cap = Number(S0.payload_limit_lbs) || OS.TRUCK_MAX_LBS, states = (ctx.cfg.service_area && ctx.cfg.service_area.states) || ["GA"];
  const geo = async function (addr) { const g = await RT.verifyAddress(clip(addr, 240)); if (g.unknown) return { err: review("Address service is unavailable.") }; if (!g.ok) return { err: { ok: false, problems: ["address_not_found"], say: "Ask the caller to repeat the address with street, city and state." } }; if (states.indexOf(String(g.state || "").toUpperCase()) < 0) return { err: review("Outside the service area.") }; return { g: g }; };
  const lines = [], money = function (d) { return Math.round(d * 100); }; let input = { service: svc }, miles = null, srcMiles = null, extra = {};
  if (svc === "junk_removal") {
    if (a.has_heavy_items === true) return review("Heavy items and loose heavy material are priced on weight by a person.");
    const j = OS.junk(a.load_size, a.truckloads); if (!j) return { ok: false, problems: ["load_size_missing"], say: "Ask how big the load is: single item, quarter, half, three-quarter or full truck." };
    if (!clip(a.pickup_address, 5)) return { ok: false, problems: ["address_missing"], say: "Ask for the address of the job." };
    const g = await geo(a.pickup_address); if (g.err) return g.err;
    lines.push({ code: "junk", label: j.load.label + (j.truckloads > 1 ? ", first truckload" : ""), cents: money(j.load.price) });
    if (j.truckloads > 1) lines.push({ code: "extra_load", label: (j.truckloads - 1) + " additional truckload(s)", cents: money((j.truckloads - 1) * OS.EXTRA_TRUCKLOAD_FEE) });
    input = { service: svc, load_size: j.load.id, truckloads: j.truckloads, address: g.g.matched }; extra = { range_max: j.totalMax > j.total ? P.money(money(j.totalMax)) : null };
  } else if (svc === "popup_event" || svc === "recurring_route") {
    if (!clip(a.pickup_address, 5) || !clip(a.delivery_address, 5)) return { ok: false, problems: ["address_missing"], say: "Ask for both addresses." };
    const g1 = await geo(a.pickup_address); if (g1.err) return g1.err; const g2 = await geo(a.delivery_address); if (g2.err) return g2.err;
    const r = await RT.distance(g1.g, g2.g); if (!r.ok) return review("Route distance could not be verified."); miles = r.miles; srcMiles = r.source;
    if (svc === "popup_event") { const e = OS.popup(miles); lines.push({ code: "event", label: "Pop-up event, " + Math.round(e.roundTripMiles) + " round-trip miles" + (e.roundTripMiles > OS.EVENT.flatRoundTripMiles ? " (flat price plus $1 per mile past " + OS.EVENT.flatRoundTripMiles + ")" : " (flat price)"), cents: money(e.total) }); input = { service: svc, pickup: g1.g.matched, delivery: g2.g.matched, miles: Math.round(miles * 10) / 10 }; }
    else {
      if (Math.floor(Number(a.days_per_week)) !== 5) return review("Dedicated routes are priced for 5 days a week with no weekends.");
      const rt = OS.dedicatedRoute(miles, a.direction); if (!rt) return review("This route is outside the dedicated route price list.");
      lines.push({ code: "route", label: rt.label + ", 5 days a week", cents: money(rt.dailyPrice) }); input = { service: svc, route: rt.id, pickup: g1.g.matched, delivery: g2.g.matched, miles: Math.round(miles * 10) / 10 }; extra = { per_day: true, weekly: P.money(money(rt.weeklyPrice)) };
    }
  } else if (svc === "recurring_load_class") {
    const w = Number(a.total_weight_lb); if (!(w > 0)) return { ok: false, problems: ["weight_missing"], say: "Ask for the weight per run." };
    if (w > cap) return { ok: false, blocked: true, say: "That is over the " + cap + " lb truck limit. Explain politely and offer a person." };
    const rl = OS.recurringLoad(w, a.days_per_week, a.flex_window === true, cap); if (!rl) return { ok: false, problems: ["days_per_week_missing"], say: "Ask how many days a week (1 to 5)." };
    lines.push({ code: "recurring", label: rl.cls.label + " (" + rl.days + " day(s) a week" + (rl.discount ? ", " + Math.round(rl.discount * 100) + "% recurring discount" : "") + ")", cents: money(rl.perDay) }); input = { service: svc, weight_lb: w, days_per_week: rl.days, flex_window: a.flex_window === true }; extra = { per_day: true, weekly: P.money(money(rl.weekly)) };
  } else return { ok: false, error: "unknown_service" };
  const total = lines.reduce(function (t, l) { return t + l.cents; }, 0), number = S.ref("Q"), exp = new Date(Date.now() + (Number(S0.quote_expiration_minutes) || 30) * 60000).toISOString();
  const ins = await B.sb("voice_quotes", { method: "POST", prefer: "return=representation", body: { org_id: ctx.orgId, session_id: ctx.session.id, number: number, input: input, lines: lines, total_cents: total, miles: miles, miles_source: srcMiles || "flat_rate", settings_version: String(S0.updated_at || ""), expires_at: exp } });
  if (!rows(ins)[0]) return { ok: false, error: "save_failed" };
  return Object.assign({ ok: true, quote_number: number, lines: lines.map(function (l) { return l.label + ": " + P.money(l.cents); }), total: P.money(total), valid_minutes: Number(S0.quote_expiration_minutes) || 30, say: "State the total. " + (extra.range_max ? "Say it can run up to " + extra.range_max + " depending on the actual load, confirmed on site. " : "") + (extra.per_day ? "This price is per day" + (extra.weekly ? " (" + extra.weekly + " a week)" : "") + ". " : "") + "A person schedules this service; offer create_callback_task and do not say it is booked.", exclusions: ["Taxes, if any apply, are not included.", "Changes to the job may change the price."] }, extra);
};
const changeReq = function (kind) { return async function (ctx, a) {
  const bk = await verifyRef(ctx, a); if (!bk) return { ok: false, error: "not_verified", say: "Could not match that reference and phone number." };
  await B.sb("voice_callbacks", { method: "POST", prefer: "return=minimal", body: { org_id: ctx.orgId, session_id: ctx.session.id, name: bk.customer_name, phone: bk.customer_phone, reason: kind + " requested for " + bk.reference + (a.requested_date ? " -> " + clip(a.requested_date, 40) : "") + (a.note ? ": " + clip(a.note, 200) : "") } });
  await B.sb("voice_handoffs", { method: "POST", prefer: "return=minimal", body: { org_id: ctx.orgId, session_id: ctx.session.id, reason: kind + " request " + bk.reference, summary: clip(a.note, 300) || null } });
  return { ok: true, recorded: true, say: "Your " + kind + " request is recorded. A dispatcher completes it; nothing has been changed yet." }; }; };
TOOLS.request_reschedule = changeReq("Reschedule"); TOOLS.request_cancellation = changeReq("Cancellation");

// Run one tool call for a session. Never throws.
async function execute(ctx, name, args, callKey) {
  const t0 = Date.now(); let out;
  try {
    if (!TOOLS[name]) return { ok: false, error: "unknown_tool" };
    if (!callKey) return { ok: false, error: "missing_call_key" };
    const prior = rows(await B.sb("voice_tool_executions?org_id=eq." + ctx.orgId + "&call_key=eq." + encodeURIComponent(String(callKey).slice(0, 120)) + "&select=result&limit=1"))[0];
    if (prior) return Object.assign({}, prior.result, { duplicate: true });
    if (!ctx.session || ["ended", "failed", "rejected"].indexOf(ctx.session.state) >= 0) out = { ok: false, error: "call_not_active" };
    else if (ctx.cfg.emergency_stop || ctx.cfg.ai_enabled === false) out = { ok: false, error: "ai_disabled", say: "The assistant is switched off. Offer a callback." };
    else { const al = await V.allow(ctx.orgId, FEATURE[name]); out = !al.allowed ? { ok: false, error: "not_in_plan", say: al.reason } : await TOOLS[name](ctx, args && typeof args === "object" ? args : {}); }
  } catch (e) { console.error("voice tool", name, e && e.message); out = { ok: false, error: "tool_failed", say: "Something went wrong. Offer a callback or a person; do not guess." }; }
  try { await B.sb("voice_tool_executions", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { org_id: ctx.orgId, session_id: ctx.session && ctx.session.id, tool: name, call_key: String(callKey).slice(0, 120), args: JSON.parse(S.redact(JSON.stringify(args || {}))), result: out, ok: !!out.ok, error: out.error || null, ms: Date.now() - t0 } }); } catch (e) { /* logging must not fail the call */ }
  return out;
}
module.exports = { defs, execute, TOOLS, FEATURE, AFFIRM, NEG };
