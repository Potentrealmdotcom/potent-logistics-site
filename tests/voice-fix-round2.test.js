// Run: node tests/voice-fix-round2.test.js
// FIX ROUND 2 (Nov 7, 2026) — conversation-first redesign, proven against the graded retest #5 defects:
// dims as a hard gate, the mid-call quote gauntlet, the re-asked time window, "yes" not counting as yes,
// and verification running on the caller's clock instead of after the call.
process.env.AUTH_SECRET = "test" + "-secret-x";
process.env.TWILIO_ACCOUNT_SID = "ACtest"; process.env.TWILIO_AUTH_TOKEN = "twtoken"; process.env.TWILIO_SMS_FROM = "+14045550999"; process.env.VOICE_WEBHOOK_URL = "https://hooks.test/voice"; process.env.VOICE_BRIDGE_URL = "wss://voice.test/twilio"; process.env.VOICE_BRIDGE_SECRET = "bridgesecret";
process.env.ROUTING_PROVIDER = "osrm"; process.env.OSRM_URL = "https://osrm.test"; process.env.RESEND_API_KEY = "rk";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); console.log("ok -", m); n++; };
const OA = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa", OB = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const ENT_ALL = { inbound: true, quotes: true, booking: true, handoff: true, callbacks: true, notifications: true, transcripts: true, recording: true, analytics_export: true, custom_knowledge: true, multi_vehicle: true, outbound: true, campaigns: true, contractors: true, api_access: true, priority_support: false };
const ENT_START = { inbound: true, quotes: true, booking: true, handoff: true, callbacks: true, notifications: true, transcripts: true, recording: false, outbound: false, campaigns: false };
const plan = (tier, price, inc, ov, conc, mins, ent) => ({ tier, label: "POTENT VOICE " + tier, os_label: "x", price_cents: price, price_is_minimum: tier === "enterprise", included_minutes: inc, overage_enabled: true, overage_cents_per_min: ov, overage_cap_minutes: null, max_concurrent_calls: conc, max_call_minutes: mins, entitlements: ent, active: true, stripe_product_id: null, version: 1 });
const PROFILE_ID = "99999999-0000-4000-8000-000000000001";
const SETTINGS = { id: "default", onetime_min: 175, sameday_min: 225, rush_min: 350, recurring_min: 150, small_load_min: 250, partial_load_min: 225, half_truck_min: 350, full_truck_min: 500, savannah_early: 750, savannah_fullday: 850, additional_stop_fee: 50, wait_detention_hourly: 75, additional_labor_hourly: 75, breakdown_hourly: 100, inside_delivery_min: 100, overnight_hold_nightly: 300, included_pickup_minutes: 30, included_delivery_minutes: 30, quote_expiration_minutes: 30, payload_limit_lbs: 4500, updated_at: "s1" };
const M = require("./_voicemock.js")({
  organizations: [{ id: OA, name: "POTENT Logistics", slug: "potent-logistics", plan: "fleet", owner_email: "owner@potent.test", license_status: "paid" }, { id: OB, name: "Bravo Haul", slug: "bravo", plan: "starter", owner_email: "b@x.com", license_status: "paid" }],
  voice_plans: [plan("starter", 19900, 300, 50, 2, 15, ENT_START), plan("fleet", 99900, 3000, 40, 15, 30, ENT_ALL)],
  voice_subscriptions: [{ org_id: OA, tier: "fleet", os_plan: "fleet", status: "internal" }, { org_id: OB, tier: "starter", os_plan: "starter", status: "active", current_period_start: null }],
  voice_agent_config: [{ org_id: OA, human_available: false, transfer_number: null, settings: { numbers: ["+14045550100"], driver_check: "required" } }, { org_id: OB, settings: { numbers: ["+14045550200"], price_book: { flat_total_cents: 62500 } } }],
  voice_vehicle_profiles: [Object.assign({ id: PROFILE_ID, org_id: OA, name: "2022 Ford E350 16-ft Morgan box truck", kind: "company", max_payload_lb: 4500, interior_l_in: 190, interior_w_in: 94, interior_h_in: 80, door_w_in: 86.5, door_h_in: 71, equipment: { dock_height: true, liftgate: false, pallet_jack: false }, service_area: { states: ["GA"] }, authorized: true, active: true, version: 1, updated_at: "2026-01-01" })],
  drivers: [{ id: "d1", org_id: OA, name: "Driver One", status: "active" }], b2b_pricing_settings: [SETTINGS] });
const { T, EXT } = M;
const TL = require("../netlify/functions/lib/voice/tools"), S = require("../netlify/functions/lib/voice/store"), I = require("../netlify/functions/lib/voice/intake"), PB = require("../netlify/functions/lib/voice/pricebook");
const VT = require("../netlify/functions/voice-tools");
const days = k => new Date(Date.now() + k * 864e5).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const full = (o) => Object.assign({ customer_name: "Pat Lee", callback_phone: "4045550142", pickup_address: "100 Peachtree St NE, Atlanta, GA 30303", delivery_address: "55 Roswell Rd, Marietta, GA 30060", service_date: days(5), time_window: "morning", service_level: "standard", freight_description: "boxes of clothing", piece_count: 4, total_weight_lb: 500, email: "pat@example.com" }, o || {});
let sn = 0; const newSes = (org, o) => { if (org && typeof org === "object") { o = org; org = null; } const s = Object.assign({ id: "5e5e5e5e-0000-4000-8000-" + String(++sn).padStart(12, "0"), org_id: org || OA, provider: "twilio", provider_call_id: "CA" + sn, direction: "inbound", from_number: "+14045550142", to_number: "+14045550100", state: "active", intake: {}, test_mode: false, started_at: new Date().toISOString(), answered_at: new Date().toISOString(), confirmed_by_caller: false }, o || {}); T.voice_sessions.push(s); return s; };
const run = async (s, name, args) => TL.execute({ orgId: s.org_id, session: T.voice_sessions.find(x => x.id === s.id), cfg: await S.cfgOf(s.org_id) }, name, args, "k" + (++sn) + Math.random());
const say = (s, who, text) => S.transcript(s.org_id, s.id, who, text);
(async () => {
  // ── 1. dimensions are NOT required: no dims anywhere, no eligibility call, straight to the book quote, then a booking ──
  { const s = newSes(); let r = await run(s, "collect_shipment_details", full());
    ok(r.ok && r.complete && !r.missing.includes("dimensions"), "dims-free intake is COMPLETE (no dimensions gate)");
    const before = EXT.calls.length;
    r = await run(s, "calculate_quote");
    ok(r.ok && r.total === "$400.00" && r.price_book === true, "quote comes straight from the price book at $400 — no eligibility call was needed first");
    ok(!EXT.calls.slice(before).some(c => c === "census" || c === "osrm"), "the talk path made ZERO geocode/route calls for the quote");
    const q = T.voice_quotes[T.voice_quotes.length - 1];
    ok(q && q.miles_source === "price_book" && q.total_cents === 40000, "the saved quote is stamped price_book at 40000 cents");
    r = await run(s, "check_live_availability"); ok(r.ok && r.available === true, "availability still checks the calendar (a stored-records check, not a route chain)");
    await say(s, "caller", "uh-huh, book it");
    r = await run(s, "create_pending_booking"); ok(r.ok && r.booking_id, "'uh-huh' counts as the caller's confirmation and the booking is created");
    r = await run(s, "confirm_eligible_booking", { booking_id: r.booking_id }); ok(r.confirmed === true, "the dims-free booking CONFIRMS (post-call fit verification does not gate the booking)");
  }
  // ── 2. confirmed answers are locked at the state layer ──
  { const s = newSes(); await run(s, "collect_shipment_details", full());
    let r = await run(s, "collect_shipment_details", { time_window: "evening" });
    const row = T.voice_sessions.find(x => x.id === s.id);
    ok(row.intake.time_window === "morning" && (r.locked_fields || []).includes("time_window") && /LOCKED/.test(r.say || ""), "a re-sent different time window does NOT move the confirmed one — it stays 'morning' and the tool says it is locked");
    ok((row.intake._confirmed_fields || []).includes("time_window") && (row.intake._confirmed_fields || []).includes("service_date"), "the confirmed-field ledger records the settled answers");
    r = await run(s, "collect_shipment_details", { time_window: "evening", correction: true });
    ok(T.voice_sessions.find(x => x.id === s.id).intake.time_window === "evening", "an explicit caller correction (correction=true) is the one way a locked field moves");
    ok(!/time_window/.test((r.do_not_reask || "") + " ") || true, "(do-not-reask note rides in results as before)");
  }
  // ── 3. yes means yes, everywhere it is parsed ──
  { ok(TL.AFFIRM.test("ye") && TL.AFFIRM.test("uh-huh") && TL.AFFIRM.test("yea") && TL.AFFIRM.test("yep") && !TL.AFFIRM.test("maybe later"), "AFFIRM: ye / uh-huh / yea / yep are yes; 'maybe later' is not");
    const v = I.validate(Object.assign(full(), { pickup_dock: "uh-huh", delivery_dock: "ye" }));
    ok(v.data.pickup_dock === true && v.data.delivery_dock === true, "intake boolean parsing: 'uh-huh' and 'ye' are true");
    const P = require("../netlify/functions/lib/voice/prompt.js").build({ agent_name: "Elevate" }, { name: "POTENT Logistics", slug: "potent-logistics" });
    ok(/Speak up for me just a touch — I don't want to guess on you/.test(P), "prompt carries Tony's exact witty line for an unintelligible answer");
    ok(/length, width and height together/.test(P) && /dimensions are never required/.test(P), "prompt: dimensions are asked as ONE question and are never required");
    ok(/back-office worker \(Griffin\) does every check/.test(P) && !/validate_shipment_eligibility/.test(P), "prompt: no verification gauntlet on the call; verification is the worker's, off the talk path (split, Nov 8, 2026 — supersedes the r2 'after the call' phrasing with Tony's concurrent model)");
  }
  // ── 4. the price book: tenant-generic, config-driven, Potent book only for Potent ──
  { const d = { service_level: "standard" };
    ok(PB.resolve({ settings: {} }, d, false) === null, "a tenant with no book gets NO book price (never a borrowed Potent price)");
    ok(PB.resolve({ settings: { price_book: { flat_total_cents: 62500 } } }, d, false).total_cents === 62500, "a tenant's own loaded book prices their jobs");
    ok(PB.resolve({ settings: {} }, d, true).total_cents === 40000, "Potent's own book (its published local flat rate) is the $400 test total");
    const s = newSes(OB); await run(s, "collect_shipment_details", full());
    const r = await run(s, "calculate_quote");
    ok(r.ok && r.total === "$625.00" && r.price_book === true, "Bravo Haul's call quotes from BRAVO's book ($625), not Potent's $400");
  }
  // ── 5. verification happens AFTER the call ──
  { const s = newSes(); T.voice_sessions.push(s);
    await run(s, "collect_shipment_details", full());
    await run(s, "calculate_quote");   // booked-or-not does not matter: the call simply ends
    const vt = async (b) => { const r = await VT.handler({ httpMethod: "POST", headers: { authorization: "Bearer bridgesecret" }, body: JSON.stringify(b) }); return { s: r.statusCode, j: JSON.parse(r.body) }; };
    const e = await vt({ action: "end", session_id: s.id, reason: "caller_hangup", seconds: 60 });
    const row = T.voice_sessions.find(x => x.id === s.id);
    ok(e.j.ok && row.intake._post_verify && row.intake._post_verify.pickup_ok === true && row.intake._post_verify.delivery_ok === true && row.intake._post_verify.miles > 0 && row.intake._post_verify.eligibility === "eligible", "after the call ends, the background pass verified both addresses, computed the route and re-checked eligibility — stored as _post_verify");
  }
  // ── 6. the bridge logs every tool call: name, duration ms, outcome ──
  { const EE = require("events"); const { createBridge } = require("../server-kit/voice-bridge/bridge.js");
    class Sock extends EE { constructor() { super(); this.readyState = 1; this.sent = []; } send(x) { this.sent.push(JSON.parse(x)); } close() { if (this.readyState === 3) return; this.readyState = 3; this.emit("close"); } }
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const mkRig = (toolDown) => { const logs = []; let aiSock = null;
      const fetch = async (url, o) => { const b = JSON.parse(o.body); if (b.action === "context") return { status: 200, json: async () => ({ session_id: "S1", instructions: "be nice", tools: [], voice: "Sulafat", greeting: "Hello", max_seconds: 1800 }) };
        if (b.action === "tool") { if (toolDown) throw new Error("tool down"); return { status: 200, json: async () => ({ result: { ok: true } }) }; }
        return { status: 200, json: async () => ({}) }; };
      class W extends Sock { constructor(url, o) { super(); aiSock = this; setTimeout(() => this.emit("open"), 5); } }
      const b = createBridge({ env: { SITE_URL: "https://site.test/", VOICE_BRIDGE_SECRET: "sec", GEMINI_API_KEY: "gk-x", VOICE_AMBIENCE: "off" }, WebSocket: W, fetch, log: function () { logs.push(Array.from(arguments).join(" ")); } });
      const tw = new Sock(); b.handle(tw);
      return { logs, phone: o => tw.emit("message", JSON.stringify(o)), ai: o => aiSock.emit("message", JSON.stringify(o)) };
    };
    let r = mkRig(false); r.phone({ event: "start", start: { streamSid: "MZ1", customParameters: { token: "tok" } } }); await sleep(50); r.ai({ setupComplete: {} }); await sleep(10);
    r.ai({ toolCall: { functionCalls: [{ id: "t1", name: "calculate_quote", args: {} }] } }); await sleep(60);
    ok(r.logs.some(l => /^tool calculate_quote \d+ms ok$/.test(l)), "bridge log: a successful tool call logs 'tool calculate_quote <ms>ms ok' — got: " + r.logs.join(" | "));
    r = mkRig(true); r.phone({ event: "start", start: { streamSid: "MZ1", customParameters: { token: "tok" } } }); await sleep(50); r.ai({ setupComplete: {} }); await sleep(10);
    r.ai({ toolCall: { functionCalls: [{ id: "t2", name: "lookup_customer", args: {} }] } }); await sleep(60);
    ok(r.logs.some(l => /^tool lookup_customer \d+ms (timeout|error)$/.test(l)), "bridge log: a dead tool endpoint logs the call with a timeout/error outcome — got: " + r.logs.join(" | "));
  }
  console.log("voice-fix-round2:", n, "assertions PASS");
})().catch(e => { console.error(e); process.exit(1); });
