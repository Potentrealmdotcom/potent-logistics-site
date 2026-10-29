// The ONLY things the voice model can do. Every tool re-checks authorization, plan entitlement, call state and business rules on the server;
// the model's words never grant a permission. Results are written to voice_tool_executions, keyed by the provider's call id, so a retry cannot repeat an action.
const B = require("../beats");
const S = require("./store"), I = require("./intake"), R = require("./rules"), P = require("./pricing"), RT = require("./route"), AV = require("./availability"), V = require("./billing"), TW = require("./adapters/twilio");
const rows = S.rows;
const PLAYBOOK = require("./playbook.js");
const CALL_LANGS = { en: "English", es: "Spanish", pt: "Portuguese", kk: "Kazakh", ru: "Russian", fr: "French", zh: "Chinese (Mandarin)", ko: "Korean", vi: "Vietnamese", ar: "Arabic", hi: "Hindi", ht: "Haitian Creole", pl: "Polish", de: "German" };
// The speech engine sometimes turns a stray English syllable into a foreign word ("Ja.", "bien", "anhelo"). Switching the whole call's language on that is how an English call ended in Spanish.
// Switch only on real evidence in what the caller said: an explicit request, two or more words of that language, or that language's own script.
const LANG_WORDS = {
  es: /\b(hola|gracias|buenos|buenas|necesito|quiero|por favor|habla|espa[nñ]ol|c[oó]mo|est[aá]|qu[eé]|cu[aá]nto|d[oó]nde|tengo|puedo|ayuda|camión|entrega|ma[nñ]ana|no hablo|usted|bueno|claro|muy bien)\b/gi,
  pt: /\b(ol[aá]|obrigad[oa]|preciso|quero|por favor|voc[eê]|n[aã]o|bom dia|boa tarde|portugu[eê]s|quanto|onde)\b/gi,
  fr: /\b(bonjour|merci|besoin|je voudrais|s'il vous pla[iî]t|fran[cç]ais|combien|o[uù]|oui|pouvez)\b/gi,
  de: /\b(hallo|danke|bitte|ich brauche|ich m[oö]chte|deutsch|wie viel|guten tag|nicht)\b/gi,
  pl: /\b(dzie[nń] dobry|dzi[eę]kuj[eę]|prosz[eę]|potrzebuj[eę]|polsku|ile|gdzie)\b/gi,
  vi: /\b(xin ch[aà]o|c[aả]m [oơ]n|t[oô]i c[aầ]n|ti[eế]ng vi[eệ]t|bao nhi[eê]u)\b/gi,
  ht: /\b(bonjou|mesi|tanpri|mwen bezwen|kreyòl|kreyol|konbyen)\b/gi
};
const LANG_SCRIPT = { ru: /[\u0400-\u04FF]/, kk: /[\u0400-\u04FF]/, ko: /[\uAC00-\uD7AF]/, zh: /[\u4E00-\u9FFF]/, ar: /[\u0600-\u06FF]/, hi: /[\u0900-\u097F]/ };
const ASKED = /\b(speak|talk|habla|hablas|parle|spreche|falas?|говор\w*)\b[^.?!]{0,30}\b(spanish|espa[nñ]ol|portuguese|french|german|polish|vietnamese|russian|kazakh|korean|chinese|mandarin|arabic|hindi|creole)\b|\bin (spanish|portuguese|french|german|polish|vietnamese|russian|kazakh|korean|chinese|arabic|hindi|creole)\b|\b(no|don'?t) (speak|hablo) english\b|\bno hablo ingl[eé]s\b/i;
const ENGLISH = /\b(the|and|you|need|get|some|boxes?|pick|deliver|from|please|yes|yeah|okay|thanks|thank|what|where|how|can|do|don'?t|i|we|my|is|it|that|this|to|for|with|about)\b/i;
async function languageEvidence(ctx, code) {
  const t = rows(await B.sb("voice_transcripts?session_id=eq." + ctx.session.id + "&role=eq.caller&select=text&order=seq.desc&limit=4")).map(function (x) { return String(x.text || ""); });
  if (!t.length) return { ok: true, why: "no_lines" };            // nothing to judge by: do not block a real switch
  const all = t.join(" . ");
  if (ASKED.test(all)) return { ok: true, why: "asked" };
  if (LANG_SCRIPT[code] && LANG_SCRIPT[code].test(all)) return { ok: true, why: "script" };
  const hits = LANG_WORDS[code] ? (all.match(LANG_WORDS[code]) || []).length : 0;
  if (hits >= 2) return { ok: true, why: "words" };
  return { ok: !t.some(function (x) { return ENGLISH.test(x); }), why: hits ? "one_word" : "english" };
}
const FEATURE = { lookup_customer: "inbound", create_or_update_lead: "inbound", get_approved_service_information: "inbound", collect_shipment_details: "quotes", validate_shipment_eligibility: "quotes", calculate_quote: "quotes", quote_special_service: "quotes", check_live_availability: "booking",
  set_call_language: "inbound", get_playbook: "inbound", lookup_os_feature: "inbound", create_pending_booking: "booking", confirm_eligible_booking: "booking", end_call: "inbound", send_payment_link: "notifications", take_card_payment: "notifications", create_callback_task: "callbacks", book_demo: "callbacks", request_human_handoff: "handoff", send_approved_confirmation: "notifications", look_up_booking_status: "booking", request_reschedule: "booking", request_cancellation: "booking" };
const CRITICAL = ["pickup_address", "delivery_address", "service_date", "time_window", "service_level", "total_weight_lb", "piece_count", "pieces", "total_dims", "pickup_dock", "delivery_dock", "needs_liftgate", "needs_pallet_jack", "forklift_pickup", "forklift_delivery", "site_has_pallet_jack", "inside_delivery", "hazmat", "special_handling", "extra_stops", "labor_helpers", "labor_hours", "holding_nights", "expected_wait_minutes", "freight_description"];
const INTAKE_KEYS = CRITICAL.concat(["customer_name", "company", "callback_phone", "email", "pickup_contact_name", "pickup_contact_phone", "delivery_contact_name", "delivery_contact_phone", "special_instructions", "po_number", "recurring"]);
const clip = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n); };
const last4 = function (p) { return String(p || "").replace(/\D/g, "").slice(-4); };
const AFFIRM = /\b(yes|yeah|yep|yup|correct|confirm|confirmed|go ahead|book it|that'?s right|sounds good|do it|please do|okay|ok|sure|let'?s do it|proceed|ya|yah|yeh|yea|ja|si|sí|claro|dale|vale)\b/i, NEG = /\b(no|not|don'?t|wait|hold on|stop|cancel|never ?mind|actually|change)\b/i;

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
      customer_name: str(""), company: str(""), callback_phone: str("10-digit US number"), use_caller_id: { type: "boolean", description: "true when the caller said yes to using the number they are calling from; then leave callback_phone empty" }, email: str(""), pickup_address: str("full street address with city and state"), delivery_address: str("full street address with city and state"),
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
    D("book_demo", "Book a 30-minute POTENT OS demo with a person. Use only after the prospect agreed to a demo and you have their name and email. Emails them the booking link and alerts the owner.", obj({ name: str(""), company: str(""), trucks: { type: "integer", description: "how many trucks they run" }, phone: str("number to reach them"), email: str("their email, read back and confirmed"), notes: str("their problem and what they pay today, in a sentence") }, ["name", "email"])),
    D("create_callback_task", "Create a callback for a person to follow up.", obj({ name: str(""), phone: str("number to call"), reason: str(""), preferred_time: str("") }, ["reason"])),
    D("request_human_handoff", "Ask to transfer to a person: negotiations, discounts, complaints, safety concerns, anything uncertain, or when the caller asks for one.", obj({ reason: str("why"), summary: str("one or two sentences for the person") }, ["reason"])),
    D("set_call_language", "Lock the language of this call to the caller's language. Call it as soon as the caller speaks a language other than English. Then speak ONLY that language for the whole call.", obj({ language: { type: "string", enum: Object.keys(CALL_LANGS), description: "language code of what the caller is speaking" } }, ["language"])),
    D("lookup_os_feature", "POTENT-only reference: look up whether POTENT OS has a feature, screen or control, and what it does, from the Master Inventory (200 features, 535 screens). Call it when the caller asks if OS can do something or you need the detail behind a feature. It answers only from the book; if nothing matches it says so and you offer to confirm. It has no prices.", obj({ query: { type: "string" } }, ["query"])),
    D("get_playbook", "Get the POTENT playbook script for the situation you are in: objections, junk removal, cleanouts, freight, pop-up events, recurring accounts and the wallet, closing, tracking and accounts. Call it when the caller pushes back, hesitates, or you are starting a service you need the questions for. It has no prices; prices only come from the quote tools.", obj({ topic: { type: "string", enum: PLAYBOOK.NAMES } }, ["topic"])),
    D("send_payment_link", "After a booking is CONFIRMED and the caller wants to pay by card, email them a secure Stripe payment link for the exact quoted total. The caller pays on Stripe's page; you never take or repeat card numbers. Needs the confirmed booking_id and an email read back and confirmed.", obj({ booking_id: str(""), email: str("their email exactly as the caller said it"), email_confirmed: { type: "boolean", description: "true only after you spelled it back and the caller said yes" } }, ["booking_id", "email"])),
    D("end_call", "End the call. kind 'abuse': ONLY because the caller kept being abusive or disrespectful AFTER you gave one firm warning — never use it on someone who is merely upset, confused, sad or hard to understand, and never when someone is in danger. kind 'do_not_contact': ONLY when a tool result told you the caller's number is on the do-not-contact list. Say a short goodbye line first.", obj({ reason: str("what happened, one sentence"), kind: { type: "string", enum: ["abuse", "do_not_contact"], description: "why the call is ending: abuse (default) or do_not_contact" } }, ["reason"])),
    D("take_card_payment", "After a booking is CONFIRMED, take the card payment ON THE CALL by phone keypad. The caller types the card on their keypad; you never hear, see, say or store it. The amount is the quoted total from our system. Needs the confirmed booking_id. After it says ok, say the one short sentence it gives you and then STOP TALKING until you are told the result.", obj({ booking_id: str("") }, ["booking_id"])),
    D("send_approved_confirmation", "Send the approved written confirmation or request-received notice for this call's booking.", obj({ booking_id: str(""), channel: { type: "string", enum: ["email", "sms"] }, email: str("only for email: exactly what the caller said"), email_confirmed: { type: "boolean", description: "true only after you spelled it back and the caller said yes" }, sms_consent: { type: "boolean", description: "caller agreed to a text message" } }, ["booking_id", "channel"])),
    D("look_up_booking_status", "Look up a booking. Needs the booking reference and the last 4 digits of the phone number on the booking.", obj({ reference: str(""), phone_last4: str("") }, ["reference", "phone_last4"])),
    D("request_reschedule", "Record a reschedule request (a person completes it).", obj({ reference: str(""), phone_last4: str(""), requested_date: str(""), note: str("") }, ["reference", "phone_last4"])),
    D("request_cancellation", "Record a cancellation request (a person completes it).", obj({ reference: str(""), phone_last4: str(""), note: str("") }, ["reference", "phone_last4"]))
  ].filter(function (d) { return d.name !== "send_payment_link" || process.env.VOICE_PAYMENT_LINK === "on"; }).filter(function (d) { return d.name !== "get_playbook" || require("./prompt.js").on("playbook"); });   // VOICE_LAYERS can switch the playbook tool off (bisecting a bad call)
}

async function setIntake(ctx, intake, extra) { ctx.session.intake = intake; return S.patchSession(ctx.orgId, ctx.session.id, Object.assign({ intake: intake }, extra || {})); }
async function invalidate(ctx, intake) { // a changed fact voids everything validated on the old facts
  const had = intake._quote_id; delete intake._geo; delete intake._elig; delete intake._quote; delete intake._avail; delete intake._route; delete intake._quote_id;
  if (had) await B.sb("voice_quotes?org_id=eq." + ctx.orgId + "&id=eq." + had + "&status=eq.offered", { method: "PATCH", prefer: "return=minimal", body: { status: "expired" } });
  ctx.session.quote = null; await S.patchSession(ctx.orgId, ctx.session.id, { quote: null, confirmed_by_caller: false });
}
const cleanArgs = function (a) {
  const o = {}; INTAKE_KEYS.forEach(function (k) { if (a && a[k] !== undefined && a[k] !== null && a[k] !== "") o[k] = a[k]; });
  // Only whitelisted facts are kept, but a plain "dimensions" statement (text, list, or length/width/height) is the overall size of the load.
  if (a && !o.total_dims && !(Array.isArray(o.pieces) && o.pieces.length)) { const ld = I.looseDims(a); if (ld && ld.l > 0 && ld.w > 0 && ld.h > 0) o.total_dims = { l: Number(ld.l), w: Number(ld.w), h: Number(ld.h) }; }
  return o;
};
const vOf = function (ctx) { return I.validate(ctx.session.intake || {}); };
// Caller consent is read from the stored transcript after the quote was given, not from a flag the model sets.
async function callerConfirmed(ctx) {
  const q = ctx.session.intake && ctx.session.intake._quote; if (!q) return false;
  const t = rows(await B.sb("voice_transcripts?session_id=eq." + ctx.session.id + "&role=eq.caller&select=text,created_at,seq&order=seq.desc&limit=6"));
  return t.some(function (x) { return String(x.created_at) >= String(q.created_at) && AFFIRM.test(x.text) && !NEG.test(x.text); });
}
async function suppressed(orgId, phone) { return rows(await B.sb("voice_suppression_records?org_id=eq." + orgId + "&phone=eq." + encodeURIComponent(phone || "x") + "&select=id&limit=1")).length > 0; }
async function notifyOwner(orgId, subject, text) { try { const o = rows(await B.sb("organizations?id=eq." + orgId + "&select=owner_email&limit=1"))[0]; if (o && o.owner_email) await require("../mail").send(o.owner_email, subject, text, "/voice/"); } catch (e) { /* best effort */ } }

// Email read-back gate: the first call with an address only stores it and tells the model to spell it back; sending needs a second call with email_confirmed:true for the SAME address, so an address the caller never confirmed can never be used.
async function emailGate(ctx, a, email) {
  const it = ctx.session.intake || {}, pend = it._email_pending;
  if (a.email_confirmed === true && pend === email) { it._email_ok = email; return null; }
  it._email_pending = email; ctx.session.intake = it;
  await S.patchSession(ctx.orgId, ctx.session.id, { intake: it });
  const spelled = email.replace(/@/, " at ").replace(/\./g, " dot ").split("").join(" ");
  return { ok: false, error: "read_back_required", gate: (a.email_confirmed === true ? (pend ? "pending_mismatch:" + pend : "no_pending") : "not_confirmed_flag"), email: email, say: "NOT SENT YET. Say: \"Let me read that back: " + spelled + ". Is that right?\" Spell it letter by letter, wait for a clear yes from the caller, and do not call the tool again until you have heard it. If they correct it, use the corrected address. Then call this tool again with the same email and email_confirmed true. If the caller did not clearly say an address, ask for it; never guess or reuse one from memory." };
}
// Payment wording the model sees. POTENT takes the card on the call by keypad when it is switched on, so no tool result may tell her "dispatch will send instructions" (call 2: that line made her tell the owner he did not have to pay).
const payOn = function () { return process.env.VOICE_PAY === "on" && !!process.env.VOICE_PAY_CONNECTOR; };
const PAY_HINT = "We take the card right on this call, over the phone keypad, once the booking is confirmed (take_card_payment).";
const PAY_SAY = "Booking confirmed. NEXT, offer to take the card right now over the keypad (take_card_payment). If they say they do not need to pay now or hesitate, do NOT say dispatch will send instructions: work it with the 3 A's (Acknowledge, Associate, Ask), mention it takes about a minute and locks the slot; if they still decline, ask 'When would be a good time for us to reconnect?', then use create_callback_task with that time and create_or_update_lead with the note, and say you will follow up.";
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
    if (!intake.callback_phone && ctx.session.from_number && a && a.use_caller_id === true) intake.callback_phone = I.phone(ctx.session.from_number) || ctx.session.from_number;
    if (intake.callback_phone && (inc.callback_phone !== undefined || (a && a.use_caller_id === true)) && await suppressed(ctx.orgId, I.phone(intake.callback_phone) || intake.callback_phone)) return { ok: false, error: "do_not_contact", do_not_contact: true, say: "That number is on our do-not-contact list. Do not save it, and do not collect anything else. Politely say you cannot take details or arrange a callback for that number, thank them for calling, and end the call now with end_call using kind do_not_contact." };
    if (changed || Object.keys(inc).some(function (k) { return CRITICAL.indexOf(k) >= 0; })) await invalidate(ctx, intake);
    await setIntake(ctx, intake);
    const v = I.validate(intake);
    let heavy;
    if (inc.total_weight_lb !== undefined && Number(intake.total_weight_lb) > 0) {   // flag an overweight load the moment the weight is said, so she does not keep collecting details for a job we cannot take
      const pr = rows(await B.sb("voice_vehicle_profiles?org_id=eq." + ctx.orgId + "&active=eq.true&authorized=eq.true&select=max_payload_lb&limit=20")).map(function (x) { return Number(x.max_payload_lb) || 0; }), cap = pr.length ? Math.max.apply(null, pr) : 0;
      if (cap && Number(intake.total_weight_lb) > cap) heavy = "That weight is over our limit of " + cap + " pounds. Do not keep collecting dimensions. Follow the REFUSAL PATH now: kindly say so and name the limit, offer the other ways POTENT can help, and ask to add them to the follow-up list.";
    }
    const l4 = a && a.use_caller_id === true && intake.callback_phone ? String(intake.callback_phone).replace(/\D/g, "").slice(-4) : undefined;
    const res = { ok: true, complete: v.ok, missing: v.missing, problems: v.problems, number_ends_in: l4, say: heavy || (l4 ? "Read it back now in one short phrase, digit by digit: the number ending in " + l4.split("").join(" ") + ". Then move on." : undefined), reset: changed ? "Details changed, so earlier checks and any quote were cleared. Re-run validation and quote." : undefined };
    if (!res.say && v.problems.indexOf("piece_weights_do_not_match_total") >= 0) res.say = "The piece weights and the total weight do not agree. Do NOT change either number yourself. Ask the caller once: \"Is that weight the total for everything, or for each piece?\" Then record only what they answer.";
    return res;
  },
  async validate_shipment_eligibility(ctx) {
    const intake = Object.assign({}, ctx.session.intake || {}), v = I.validate(intake);
    if (!v.ok) return { ok: false, missing: v.missing, problems: v.problems };
    const d = v.data, geo = intake._geo || {};
    const notFound = [];
    for (const k of ["pickup", "delivery"]) {   // BOTH addresses are checked even when the first one fails (call 4: the unverifiable drop-off hid behind the unverifiable pickup)
      const addr = d[k + "_address"]; if (geo[k] && geo[k].input === addr) continue;
      const g = await RT.verifyAddress(addr);
      if (g.unknown) return { ok: false, error: "address_check_unavailable", say: "I can't verify addresses right now. Offer a callback or a person." };
      if (!g.ok) { notFound.push(k); continue; }
      geo[k] = { input: addr, matched: g.matched, lat: g.lat, lon: g.lon, state: g.state }; d[k + "_state"] = g.state || d[k + "_state"];
    }
    if (notFound.length) {
      const miss = intake._addr_miss || {}; let finalMiss = false;
      notFound.forEach(function (k) { const a = d[k + "_address"]; miss[a] = (miss[a] || 0) + 1; if (miss[a] >= 2) finalMiss = true; });
      intake._addr_miss = miss; intake._geo = geo; await setIntake(ctx, intake);
      const probs = notFound.map(function (k) { return k + "_address_not_found"; });
      const named = notFound.map(function (k) { return "the " + k + " address \"" + d[k + "_address"] + "\""; }).join(" and ");
      if (finalMiss) return { ok: false, problems: probs.concat(["address_unverified"]), address_unverified: true, say: "You still cannot verify " + named + " after two tries. Do NOT ask for it again, and never change any part of an address to a guess. Read it back exactly as the caller stated it, say the team will confirm that address and call back shortly with the quote, then call create_callback_task with the full shipment details and the address exactly as stated, with the reason: address not verified. Close warmly, using their name." };
      return { ok: false, problems: probs, say: "You couldn't find " + named + ". Do NOT ask the caller to repeat the whole address. Read " + (notFound.length === 2 ? "the addresses" : "the " + notFound[0] + " address") + " back exactly as recorded and ask which part is wrong: the street, the city, or the state. Fix only the part they correct, then run the checks again." };
    }
    intake._geo = geo;
    const prof = await S.profileOf(ctx.orgId);
    if (!prof) { intake._elig = { status: "review", reviews: [{ code: "no_vehicle_profile", text: "No authorized vehicle profile is configured." }], blocks: [] }; await setIntake(ctx, intake); return { ok: true, status: "review", reasons: ["No authorized vehicle is set up. A person must review this request."] }; }
    d.pickup_state = geo.pickup.state || d.pickup_state; d.delivery_state = geo.delivery.state || d.delivery_state;
    const e = R.evaluate(d, prof); intake._elig = { status: e.status, blocks: e.blocks, reviews: e.reviews, profile_id: prof.id, checked_at: new Date().toISOString() };
    await setIntake(ctx, intake);
    return { ok: true, status: e.status, reasons: e.blocks.concat(e.reviews).map(function (x) { return x.text; }), say: e.status === "blocked" ? "We cannot take this shipment as described. Follow the REFUSAL PATH: thank them for calling, explain the reason kindly and name the limit, offer the other ways POTENT can help, and ask to add them to the follow-up list. Never end on the refusal or a bare goodbye." : e.status === "review" ? "A person must review this. Offer a callback or transfer. Do not quote." : "Eligible. You may calculate the quote." };
  },
  async calculate_quote(ctx) {
    const intake = Object.assign({}, ctx.session.intake || {}), el = intake._elig;
    if (!el || el.status !== "eligible") return { ok: false, error: "not_eligible", say: "Run validate_shipment_eligibility first; only eligible shipments can be quoted." };
    const v = I.validate(intake); if (!v.ok) return { ok: false, missing: v.missing, problems: v.problems };
    const d = v.data, S0 = await S.pricingSettings(ctx.orgId, ctx.cfg); let miles = null, mins = null, routeWhy = null;
    if (!/^savannah/.test(d.service_level)) { const g = intake._geo; const r = await RT.distance(g.pickup, g.delivery); if (r.ok) { miles = r.miles; mins = r.minutes; intake._route = { miles: miles, minutes: mins, source: r.source }; } else routeWhy = r.reason + (r.detail ? " - " + r.detail : ""); }
    const q = P.quote(d, miles, S0, ctx.cfg.settings && ctx.cfg.settings.quote);
    if (!q.ok) return { ok: false, review: true, reason: q.reason + (routeWhy ? " [route: " + routeWhy + "]" : ""), route_failure: routeWhy || undefined, say: "You cannot give a price. Offer a callback or a person." };
    const number = S.ref("Q"), ins = await B.sb("voice_quotes", { method: "POST", prefer: "return=representation", body: { org_id: ctx.orgId, session_id: ctx.session.id, number: number, input: d, lines: q.lines, total_cents: q.total_cents, miles: miles, miles_source: intake._route ? intake._route.source : (miles == null ? "flat_rate" : null), settings_version: q.settings_version, expires_at: q.expires_at } });
    const row = rows(ins)[0]; if (!row) return { ok: false, error: "save_failed" };
    intake._quote_id = row.id; intake._quote = { id: row.id, number: number, total_cents: q.total_cents, expires_at: q.expires_at, created_at: row.created_at || new Date().toISOString() };
    await setIntake(ctx, intake, { quote: { id: row.id, number: number, total_cents: q.total_cents } });
    return { ok: true, quote_number: number, lines: q.lines.map(function (l) { return l.label + ": " + P.money(l.cents); }), total: P.money(q.total_cents), tax_note: q.exclusions[q.exclusions.length - 1], valid_minutes: Math.round((new Date(q.expires_at) - Date.now()) / 60000), exclusions: q.exclusions, payment: (await isPotentOrg(ctx)) && payOn() ? PAY_HINT : q.payment_text, deposit: q.deposit_cents ? P.money(q.deposit_cents) : null };
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
    if (bk.status === "confirmed") return { ok: true, confirmed: true, duplicate: true, reference: bk.reference, job_id: bk.job_id, say: (await isPotentOrg(ctx)) && payOn() ? PAY_SAY : undefined };
    if (bk.status !== "pending_review") return { ok: false, error: "booking_" + bk.status };
    const snap = bk.snapshot, q = rows(await B.sb("voice_quotes?org_id=eq." + ctx.orgId + "&id=eq." + bk.quote_id + "&select=*&limit=1"))[0];
    const fail = async function (why, say) { await B.sb("voice_bookings?id=eq." + bk.id, { method: "PATCH", prefer: "return=minimal", body: { review_reason: why } }); return { ok: true, confirmed: false, reference: bk.reference, pending: true, reason: why, say: say || "Not confirmed. It stays a request for a person to review. Say so honestly." }; };
    if (!q || q.status !== "offered" || new Date(q.expires_at) < new Date()) return fail("Quote expired or changed");
    const prof = await S.profileOf(ctx.orgId, bk.vehicle_profile_id); if (!prof) return fail("Vehicle no longer authorized");
    const gz = (ctx.session.intake && ctx.session.intake._geo) || {}, di = Object.assign({}, snap.intake); di.pickup_state = di.pickup_state || (gz.pickup && gz.pickup.state) || null; di.delivery_state = di.delivery_state || (gz.delivery && gz.delivery.state) || null;
    const e = R.evaluate(di, prof); if (e.status !== "eligible") return fail("Eligibility changed: " + e.blocks.concat(e.reviews).map(function (x) { return x.code; }).join(","));
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
    return { ok: true, confirmed: true, reference: bk.reference, job_id: res.job_id, duplicate: !!res.duplicate, say: (await isPotentOrg(ctx)) && payOn() ? PAY_SAY : undefined };
  },
  async book_demo(ctx, a) {
    const email = clip(a.email, 120).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "need_valid_email", say: "Ask for their email and read it back letter by letter." };
    { const g = await emailGate(ctx, a, email); if (g) return g; }
    const link = process.env.DEMO_BOOKING_URL || "https://calendly.com/potentrealm-pm/30min";
    const phone = I.phone(a.phone) || ctx.session.from_number || null;
    const reason = "OS DEMO REQUESTED: " + clip(a.company, 80) + (a.trucks ? ", " + Math.floor(Number(a.trucks)) + " trucks" : "") + ". " + clip(a.notes, 200) + " Email " + email;
    const r = await B.sb("voice_callbacks", { method: "POST", prefer: "return=representation", body: { org_id: ctx.orgId, session_id: ctx.session.id, name: clip(a.name, 80) || null, phone: phone, reason: reason.slice(0, 300), preferred_time: "demo" } });
    if (!r.ok) return { ok: false, error: "save_failed" };
    const mail = await require("../mail").send(email, "Your POTENT OS demo: pick a time", "Hi " + (clip(a.name, 60) || "there") + ",\n\nThanks for talking with us. Pick any time that works for a 30-minute POTENT OS demo here:\n" + link + "\n\nWe will show it live on your numbers. Questions: (912) 914-2166.\n\nPOTENT Operations", null);
    await notifyOwner(ctx.orgId, "OS demo requested: " + clip(a.name, 60) + (a.company ? " (" + clip(a.company, 60) + ")" : ""), reason + (phone ? " Phone " + phone : "") + ". Booking link sent: " + (mail && mail.ok ? "yes" : "NOT SENT, follow up by hand") + ".");
    await S.patchSession(ctx.orgId, ctx.session.id, { outcome: "callback" });
    return { ok: true, callback_id: rows(r)[0] && rows(r)[0].id, link_emailed: !!(mail && mail.ok), say: mail && mail.ok ? "Tell them you just emailed the booking link and they can pick any time that works for a 30-minute demo. Do not say a time is booked." : "Tell them honestly the email could not be sent right now, that a person will follow up with a time, and do not say a time is booked." };
  },
  async lookup_os_feature(ctx, a) {
    const inv = require("./osinventory.json"), q = String((a && a.query) || "").toLowerCase().slice(0, 120);
    const STOP = { the: 1, and: 1, for: 1, can: 1, does: 1, with: 1, have: 1, you: 1, your: 1, how: 1, what: 1, that: 1, this: 1, any: 1, do: 1, it: 1, os: 1, potent: 1, a: 1, an: 1, to: 1, of: 1, in: 1, is: 1, on: 1 };
    const w = q.split(/[^a-z0-9]+/).filter(function (x) { return x.length > 2 && !STOP[x]; }).map(function (x) { return x.length > 5 ? x.replace(/(ing|ed|es|s)$/, "") : x.replace(/s$/, ""); });
    if (!w.length) return { ok: false, error: "empty_query", say: "Ask what feature they mean." };
    const score = function (t, area) { const h = (t + " " + area).toLowerCase(); let n = 0, hit = 0; w.forEach(function (x) { if (h.indexOf(x) >= 0) { hit++; n += (t.toLowerCase().indexOf(x) >= 0 ? 2 : 1); } }); return hit >= Math.ceil(w.length / 2) ? n : 0; };
    const f = inv.features.map(function (x) { return { s: score(x.text, x.area), area: x.area, text: x.text }; }).filter(function (x) { return x.s > 0; }).sort(function (x, y) { return y.s - x.s; }).slice(0, 6);
    const sc = inv.screens.map(function (x) { return { s: score(x.text, x.group), group: x.group, text: x.text }; }).filter(function (x) { return x.s > 0; }).sort(function (x, y) { return y.s - x.s; }).slice(0, 6);
    if (!f.length && !sc.length) return { ok: true, found: false, say: "Not in the book. Do not guess. Say you will confirm that and offer a callback or a demo; never say it can or cannot." };
    return { ok: true, found: true, features: f.map(function (x) { return x.area + ": " + x.text; }), screens: sc.map(function (x) { return x.group + ": " + x.text; }), say: "Answer only from these lines, in plain words, one or two sentences. If they do not cover the exact question, say you will confirm." };
  },
  async get_playbook(ctx, a) { return PLAYBOOK.get(a && a.topic); },
  async set_call_language(ctx, a) {
    const code = String(a.language || "").toLowerCase().slice(0, 5), name = CALL_LANGS[code]; if (!name) return { ok: false, error: "unsupported_language", say: "Say politely in English that you cannot continue in that language and offer a callback (create_callback_task)." };
    if (code !== "en") { const ev = await languageEvidence(ctx, code); if (!ev.ok) return { ok: false, error: "language_unconfirmed", say: "Do NOT switch. The caller has been speaking English; a stray sound was misheard. Stay in English. If you are truly unsure, ask once in English: 'Would you prefer English or another language?' and switch only if they ask for it." }; }
    const intake = Object.assign({}, ctx.session.intake || {}); intake._lang = code; await setIntake(ctx, intake);
    return { ok: true, language_locked: code, language_name: name, say: "From now on speak ONLY " + name + " for the rest of this call, including questions, read-backs and goodbye. Do not switch to any other language unless the caller clearly switches. Keep prices, dates and addresses exactly as given." };
  },
  // Card payment on the call. The AI only asks for it; the bridge then moves the live call to Twilio <Pay> (see voice-tools "pay" and voice-webhook "pay"/"payresult").
  // Nothing here sees a card. The amount comes from the stored quote. "Paid" is only ever said after Stripe itself confirms the exact amount.
  // Ending a call: log it, tell the owner, and let the bridge hang up once the goodbye has been spoken.
  // A do-not-contact ending is NOT abuse: it gets its own outcome and owner wording, never the abusive-caller label.
  async end_call(ctx, a) {
    if (a && a.kind === "do_not_contact") {
      await S.patchSession(ctx.orgId, ctx.session.id, { outcome: "ended_do_not_contact" });
      await notifyOwner(ctx.orgId, "Call ended by Elevate (number on do-not-contact list)", "Caller " + (ctx.session.from_number || "unknown") + ". Reason: " + clip(a.reason, 200) + ". See the transcript in Calls.");
      return { ok: true, end_call: true, say: "Say ONE short, calm goodbye line now (no lecture, no apology), then stop talking. The call ends right after." };
    }
    await S.patchSession(ctx.orgId, ctx.session.id, { outcome: "ended_abuse" });
    await notifyOwner(ctx.orgId, "Call ended by Elevate (caller abusive)", "Caller " + (ctx.session.from_number || "unknown") + ". Reason: " + clip(a.reason, 200) + ". See the transcript in Calls.");
    return { ok: true, end_call: true, say: "Say ONE short, calm goodbye line now (no lecture, no apology), then stop talking. The call ends right after." };
  },
  async take_card_payment(ctx, a) {
    if (!S.UUID.test(String(a.booking_id || ""))) return { ok: false, error: "bad_booking" };
    const bk = rows(await B.sb("voice_bookings?org_id=eq." + ctx.orgId + "&id=eq." + a.booking_id + "&session_id=eq." + ctx.session.id + "&select=*&limit=1"))[0];
    if (!bk) return { ok: false, error: "booking_not_found" };
    if (bk.status !== "confirmed" || !bk.job_id) return { ok: false, error: "not_confirmed", say: "The booking is not confirmed yet, so there is nothing to pay. Do not take payment. Tell the caller a person will confirm it first." };
    const JP = require("./jobpay"), cents = JP.payableCents(bk), job = rows(await B.sb("jobs?id=eq." + encodeURIComponent(bk.job_id) + "&select=payment_status&limit=1"))[0];
    if (job && job.payment_status === "paid") return { ok: true, already_paid: true, say: "This booking is already paid. Do not charge again. Thank them." };
    const flag = async function (why) {
      await notifyOwner(ctx.orgId, "PAYMENT NEEDED by phone: " + bk.reference, "The caller could not pay by keypad on the call (" + why + "). Booking " + bk.reference + (cents ? ", total " + P.money(cents) : "") + ". Call them back" + (ctx.session.from_number ? " at " + ctx.session.from_number : "") + " to take payment. No payment link was sent.");
      if (ctx.session.from_number) await B.sb("voice_callbacks", { method: "POST", prefer: "return=minimal", body: { org_id: ctx.orgId, session_id: ctx.session.id, phone: ctx.session.from_number, reason: ("Take payment for " + bk.reference + " (" + why + ")").slice(0, 300) } });
    };
    const fail = "Tell the caller warmly that their booking is locked in and that the team will reach out shortly to take the payment, so nothing is lost. Do NOT send or offer a payment link, do not ask for a card number out loud, and never say it is paid.";
    if (!cents) { await flag("amount not available"); return { ok: false, error: "bad_amount", flagged: true, say: fail }; }
    if (process.env.VOICE_PAY !== "on" || !process.env.VOICE_PAY_CONNECTOR || !TW.configured() || !process.env.STRIPE_SECRET_KEY) { await flag("keypad payment is not switched on"); return { ok: false, error: "keypad_not_live", flagged: true, say: fail }; }
    const tries = rows(await B.sb("voice_tool_executions?session_id=eq." + ctx.session.id + "&tool=eq.take_card_payment&select=id&limit=10")).length;
    if (tries > 3) { await flag("too many keypad attempts"); return { ok: false, error: "too_many_attempts", flagged: true, say: fail }; }
    const plan = JP.chargePlan(bk, ctx.session.from_number);
    return { ok: true, pay_handoff: true, booking_id: bk.id, amount: P.money(plan.cents), say: "Say ONE short sentence in your own voice: you are taking the card now for " + P.money(plan.cents) + ", they will hear a short automated prompt, and they should type the card number on their phone keypad. Mention you cannot hear the keys. Then STOP talking completely. Say nothing else until you are told the result. Never say it is paid until told." };
  },
  async send_payment_link(ctx, a) {
    if (process.env.VOICE_PAYMENT_LINK !== "on") return { ok: false, error: "link_retired", say: "We do not send payment links. Use take_card_payment to take the card on the call by keypad." };
    if (!S.UUID.test(String(a.booking_id || ""))) return { ok: false, error: "bad_booking" };
    const email = clip(a.email, 120).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: "need_valid_email", say: "Ask for their email and read it back letter by letter." };
    { const g = await emailGate(ctx, a, email); if (g) return g; }
    const bk = rows(await B.sb("voice_bookings?org_id=eq." + ctx.orgId + "&id=eq." + a.booking_id + "&session_id=eq." + ctx.session.id + "&select=*&limit=1"))[0];
    if (!bk) return { ok: false, error: "booking_not_found" };
    if (bk.status !== "confirmed" || !bk.job_id) return { ok: false, error: "not_confirmed", say: "The booking is not confirmed yet, so there is nothing to pay. Do not send a payment link. Tell the caller a person will confirm it first." };
    const JP = require("./jobpay"), r = await JP.createLink(bk, email);
    if (r.ok) await B.sb("voice_bookings?id=eq." + bk.id, { method: "PATCH", prefer: "return=minimal", body: { customer_email: email } });
    if (!r.ok) return { ok: false, error: r.error, say: "The payment link could not be created. Tell the caller honestly, and that they can pay cash or card before the job, or a person will send a link. Never ask for a card number." };
    const total = P.money(r.cents), text = "Thank you for booking with POTENT Logistics. Reference " + bk.reference + ".\n\nPay " + total + " securely by card on Stripe's own page (you can also pay cash or card before the job starts). This link works for 23 hours:";
    const mail = await require("../mail").send(email, "Pay for your POTENT delivery " + bk.reference + " (" + total + ")", text, r.url);
    await notifyOwner(ctx.orgId, "Payment link sent for " + bk.reference, total + " to " + email + ". Sent: " + (mail && mail.ok ? "yes" : "NOT SENT, follow up"));
    return { ok: true, emailed: !!(mail && mail.ok), amount: total, say: mail && mail.ok ? "Tell the caller you just emailed a secure payment link for " + total + ". They pay on the secure page, never by telling you a card number. Do not say it is paid; payment is confirmed automatically when they finish." : "The email did not go out. Tell the caller honestly and that a person will send the link or they can pay cash or card before the job." };
  },
  async create_callback_task(ctx, a) {
    const phone = I.phone(a.phone) || ctx.session.from_number; if (!phone) return { ok: false, error: "need_phone_number" };
    if (await suppressed(ctx.orgId, phone)) return { ok: false, error: "do_not_contact", say: "That number is on the do-not-contact list. Do NOT save a callback for it. Politely tell the caller you cannot arrange a callback to that number, thank them for calling, and end the call with end_call using kind do_not_contact." };
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
    if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(to || ""))) return { ok: false, error: "need_valid_email", say: "Ask the caller for their email and read it back." };
    if (channel === "email") { const g = await emailGate(ctx, a, to); if (g) return g; }
    if (channel === "sms") { if (a.sms_consent !== true) return { ok: false, error: "need_sms_consent" }; if (await suppressed(ctx.orgId, to)) return { ok: false, error: "number_opted_out" }; }
    const text = (conf ? "Your POTENT booking is CONFIRMED. Reference " + bk.reference + ".\n" : "We received your request. It is NOT yet confirmed. Reference " + bk.reference + ". A dispatcher will confirm with you.\n") + "Pickup: " + d.pickup_address + "\nDelivery: " + d.delivery_address + "\nDate: " + d.service_date + " (" + d.time_window + ")\nQuoted price: " + total + " (" + (snap.quote.payment_text || "payment instructions will follow") + ")\nTo reschedule or cancel, call us back and give this reference.";
    const claim = await B.sb("voice_notifications_sent", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: { org_id: ctx.orgId, booking_id: bk.id, channel: channel, kind: conf ? "confirmation" : "request", to_addr: to, status: "sending" } });
    if (!rows(claim).length) return { ok: true, duplicate: true, say: "Already sent." };
    const res = channel === "email" ? await require("../mail").send(to, (conf ? "Booking confirmed " : "Request received ") + bk.reference, text) : await TW.sms(to, text);
    const sent = !!(res && (res.ok || res.data)), skipped = res && res.skipped;
    await B.sb("voice_notifications_sent?booking_id=eq." + bk.id + "&channel=eq." + channel + "&kind=eq." + (conf ? "confirmation" : "request"), { method: "PATCH", prefer: "return=minimal", body: { status: sent ? "sent" : "failed", error: sent ? null : (skipped ? "email_not_configured" : (res && res.reason) || "send_failed") } });
    if (sent) { await B.sb("voice_bookings?id=eq." + bk.id, { method: "PATCH", prefer: "return=minimal", body: Object.assign(channel === "email" ? { customer_email: to } : {}, conf ? { confirmation_sent_at: new Date().toISOString() } : {}) }); return { ok: true, sent: true, kind: conf ? "confirmation" : "request_received_not_confirmed" }; }
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
    const r = await RT.distance(g1.g, g2.g); if (!r.ok) return review("Route distance could not be verified [route: " + r.reason + (r.detail ? " - " + r.detail : "") + "]."); miles = r.miles; srcMiles = r.source;
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
// POTENT's own selling material, junk/pop-up price list, playbook and Stripe account belong to POTENT's line only; other companies never get them.
const isPotentOrg = async function (ctx) { if (ctx._isP !== undefined) return ctx._isP; const o = rows(await B.sb("organizations?id=eq." + ctx.orgId + "&select=slug&limit=1"))[0]; return (ctx._isP = !!(o && o.slug === (process.env.POTENT_ORG_SLUG || "potent-logistics"))); };
const POTENT_ONLY = { quote_special_service: 1, get_playbook: 1, lookup_os_feature: 1, send_payment_link: 1, take_card_payment: 1 };
async function execute(ctx, name, args, callKey) {
  const t0 = Date.now(); let out;
  try {
    if (!TOOLS[name]) return { ok: false, error: "unknown_tool" };
    if (!callKey) return { ok: false, error: "missing_call_key" };
    const prior = rows(await B.sb("voice_tool_executions?org_id=eq." + ctx.orgId + "&call_key=eq." + encodeURIComponent(String(callKey).slice(0, 120)) + "&select=result&limit=1"))[0];
    if (prior) return Object.assign({}, prior.result, { duplicate: true });
    if (!ctx.session || ["ended", "failed", "rejected"].indexOf(ctx.session.state) >= 0) out = { ok: false, error: "call_not_active" };
    else if (ctx.cfg.emergency_stop || ctx.cfg.ai_enabled === false) out = { ok: false, error: "ai_disabled", say: "The assistant is switched off. Offer a callback." };
    else if (POTENT_ONLY[name] && !(await isPotentOrg(ctx))) out = { ok: false, error: "not_available", say: "That is not set up for this company. Take a callback so the owner can follow up. Do not guess." };
    else { const al = await V.allow(ctx.orgId, FEATURE[name]); out = !al.allowed ? { ok: false, error: "not_in_plan", say: al.reason } : await TOOLS[name](ctx, args && typeof args === "object" ? args : {}); }
  } catch (e) { console.error("voice tool", name, e && e.message); out = { ok: false, error: "tool_failed", say: "Something went wrong. Offer a callback or a person; do not guess." }; }
  try { await B.sb("voice_tool_executions", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { org_id: ctx.orgId, session_id: ctx.session && ctx.session.id, tool: name, call_key: String(callKey).slice(0, 120), args: JSON.parse(S.redact(JSON.stringify(args || {}))), result: out, ok: !!out.ok, error: out.error || null, ms: Date.now() - t0 } }); } catch (e) { /* logging must not fail the call */ }
  return out;
}
module.exports = { defs, execute, TOOLS, FEATURE, AFFIRM, NEG, notifyOwner };
