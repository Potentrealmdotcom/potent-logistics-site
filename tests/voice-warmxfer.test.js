// Run: node tests/voice-warmxfer.test.js  (Nov 2, 2026 warm supervised transfer, site side)
// Proves: (a) the handoff tool hands her Tony's announce line; (b) a no-answer on a real assistant
// transfer hands the caller BACK to her on a fresh stream (xferfail:1) and writes the fresh "requested"
// handoff row the enforced retry dials against, with the missed-transfer callback saved as before;
// (c) the second failure hands back xferfail:2, writes NO third row, and saves its callback too;
// (d) dials that were never hers (reject/fallback: no requested handoff row to transition) keep the legacy
// spoken close, and an answered transfer ends the caller leg cleanly. Bridge-side arming of the retry
// is proven in tests/voicebridge.test.js.
// (e) PRODUCTION REPLAY of the Nov 2 retest failure: the bridge's premature "end" interposed between
// a=xfer and a=dial (session rewritten handoff -> ended/caller_hangup) must NOT kill the hand-back.
process.env.AUTH_SECRET = "test-secret";
process.env.TWILIO_ACCOUNT_SID = "ACtest"; process.env.TWILIO_AUTH_TOKEN = "twtoken"; process.env.TWILIO_SMS_FROM = "+14045550999"; process.env.VOICE_WEBHOOK_URL = "https://hooks.test/voice"; process.env.VOICE_BRIDGE_URL = "wss://voice.test/twilio"; process.env.VOICE_BRIDGE_SECRET = "bridgesecret";
process.env.ROUTING_PROVIDER = "osrm"; process.env.OSRM_URL = "https://osrm.test"; process.env.RESEND_API_KEY = "rk";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const OA = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const ENT_ALL = { inbound: true, quotes: true, booking: true, handoff: true, callbacks: true, notifications: true, transcripts: true, recording: true, analytics_export: true, custom_knowledge: true, multi_vehicle: true, outbound: true, campaigns: true, contractors: true, api_access: true, priority_support: false };
const plan = (tier, price, inc, ov, conc, mins, ent) => ({ tier, label: "POTENT VOICE " + tier, os_label: "x", price_cents: price, price_is_minimum: tier === "enterprise", included_minutes: inc, overage_enabled: true, overage_cents_per_min: ov, overage_cap_minutes: null, max_concurrent_calls: conc, max_call_minutes: mins, entitlements: ent, active: true, stripe_product_id: null, version: 1 });
const M = require("./_voicemock.js")({
  organizations: [{ id: OA, name: "POTENT Logistics", slug: "potent-logistics", plan: "fleet", owner_email: "owner@potent.test", license_status: "paid" }],
  voice_plans: [plan("starter", 19900, 300, 50, 2, 15, ENT_ALL), plan("growth", 49900, 1000, 45, 5, 20, ENT_ALL), plan("fleet", 99900, 3000, 40, 15, 30, ENT_ALL), plan("enterprise", 199900, 10000, 35, 50, 60, ENT_ALL)],
  voice_subscriptions: [{ org_id: OA, tier: "fleet", os_plan: "fleet", status: "internal" }],
  voice_agent_config: [{ org_id: OA, human_available: true, transfer_number: "+14704531616", settings: { numbers: ["+14045550100"] } }] });
const { T } = M;
const TL = require("../netlify/functions/lib/voice/tools"), S = require("../netlify/functions/lib/voice/store"), TW = require("../netlify/functions/lib/voice/adapters/twilio");
const WH = require("../netlify/functions/voice-webhook");
const VT = require("../netlify/functions/voice-tools");
const base = "https://hooks.test/voice";
const hook = async (a, params, o) => { o = o || {}; const url = base + "?a=" + a + (o.s ? "&s=" + o.s : ""); const sig = TW.signature(process.env.TWILIO_AUTH_TOKEN, url, params); const body = Object.keys(params).map(k => k + "=" + encodeURIComponent(params[k])).join("&"); const q = { a: a }; if (o.s) q.s = o.s; const r = await WH.handler({ httpMethod: "POST", headers: { "x-twilio-signature": sig }, body: body, queryStringParameters: q, rawQuery: "a=" + a + (o.s ? "&s=" + o.s : "") }); return { s: r.statusCode, x: r.body }; };
let sn = 0; const newSes = (o) => { const s = Object.assign({ id: "5e5e5e5e-0000-4000-8000-" + String(++sn).padStart(12, "0"), org_id: OA, provider: "twilio", provider_call_id: "CA900" + sn, direction: "inbound", from_number: "+14045550142", to_number: "+14045550100", state: "handoff", intake: {}, test_mode: false, started_at: new Date().toISOString(), answered_at: new Date().toISOString(), confirmed_by_caller: false }, o || {}); T.voice_sessions.push(s); return s; };
const tokOf = (x) => { const m = x.match(/name="token" value="([^"]+)"/); return m ? JSON.parse(Buffer.from(m[1].split(".")[0], "base64url").toString()) : {}; };
(async () => {
  // (a) the announce line
  const sesA = newSes({ state: "active" });
  const r = await TL.execute({ orgId: OA, session: sesA, cfg: await S.cfgOf(OA) }, "request_human_handoff", { reason: "caller asked for a person", summary: "wants a person" }, "wx1");
  ok(r.ok && r.transfer_possible === true, "handoff tool: a transfer is possible (a person is available in settings)");
  ok(/I'm transferring you now — ok, yes, give me one second/.test(r.say), "handoff tool: she is handed Tony's announce line verbatim");
  ok(/stop talking/.test(r.say) && /do not promise you will stay on the line/.test(r.say) && !/I'll remain on the line|I'm staying on the line/.test(r.say), "handoff tool: she announces and stops — and is forbidden from promising to stay on the line (she does not; a no-answer brings the caller back to her instead)");
  ok(T.voice_handoffs.some(h => h.session_id === sesA.id && h.status === "requested"), "handoff tool: the requested handoff row exists for the dial to check");

  // (b) first no-answer: hand-back + retry row + callback
  const ses = newSes();
  T.voice_handoffs.push({ id: "hx-1", org_id: OA, session_id: ses.id, reason: "caller asked", status: "requested" });
  let w = await hook("dial", { CallSid: ses.provider_call_id, DialCallStatus: "no-answer", DialCallSid: "CAleg1" }, { s: ses.id });
  ok(w.s === 200 && /<Stream/.test(w.x) && !/no one could take the call/.test(w.x), "dial 1 no-answer: the caller is handed BACK to her on a fresh stream — no terminal apology, no hangup");
  ok(tokOf(w.x).r === "xferfail:1", "dial 1 no-answer: the hand-back carries xferfail:1 (first failure)");
  ok(T.voice_sessions.find(x => x.id === ses.id).state === "active", "dial 1: the session is hers again (state active, so the returning stream's context will serve her)");
  ok(T.voice_handoffs.find(h => h.id === "hx-1").status === "missed", "dial 1: the first handoff is recorded missed");
  ok(T.voice_handoffs.filter(h => h.session_id === ses.id && h.status === "requested").length === 1, "dial 1: exactly one fresh requested handoff row exists — the retry the system dials (enforced in the flow, not suggested in a prompt)");
  ok(T.voice_callbacks.filter(c => c.session_id === ses.id).length === 1 && /not answered/.test(T.voice_callbacks.filter(c => c.session_id === ses.id)[0].reason), "dial 1: the missed-transfer callback is saved, exactly as before");

  // (c) second no-answer: recovery hand-back, no third attempt, callback saved
  await S.patchSession(OA, ses.id, { state: "handoff" });   // the retry's a=xfer does exactly this before it dials
  w = await hook("dial", { CallSid: ses.provider_call_id, DialCallStatus: "no-answer", DialCallSid: "CAleg2" }, { s: ses.id });
  ok(/<Stream/.test(w.x) && tokOf(w.x).r === "xferfail:2", "dial 2 no-answer: handed back again with xferfail:2 (spoken recovery), not a third dial");
  ok(T.voice_handoffs.filter(h => h.session_id === ses.id && h.status === "requested").length === 0, "dial 2: NO new handoff row — there is no third attempt");
  ok(T.voice_callbacks.filter(c => c.session_id === ses.id).length === 2, "dial 2: the second failure saves its callback too");
  ok(T.voice_sessions.find(x => x.id === ses.id).state === "active", "dial 2: the session is hers for the spoken recovery");

  // (d) the other dials are untouched
  const sesL = newSes({ state: "active" });   // a reject/fallback dial: never the assistant's transfer — in production it carries NO requested handoff row (that row is the hand-back discriminator); an already-resolved row from some earlier matter must not count either
  T.voice_handoffs.push({ id: "hx-2", org_id: OA, session_id: sesL.id, reason: "x", status: "missed" });
  w = await hook("dial", { CallSid: sesL.provider_call_id, DialCallStatus: "no-answer", DialCallSid: "CAleg9" }, { s: sesL.id });
  ok(!/<Stream/.test(w.x) && /Sorry, no one could take the call/.test(w.x), "legacy dials (not hers) keep the spoken close — unchanged");
  const sesC = newSes();
  T.voice_handoffs.push({ id: "hx-3", org_id: OA, session_id: sesC.id, reason: "x", status: "requested" });
  w = await hook("dial", { CallSid: sesC.provider_call_id, DialCallStatus: "completed", DialCallSid: "CAleg3" }, { s: sesC.id });
  ok(T.voice_handoffs.find(h => h.id === "hx-3").status === "completed" && /<Hangup\/>/.test(w.x) && !/no one could take the call/.test(w.x), "answered transfer: recorded completed, and the caller leg ends cleanly — no false apology after a real conversation");

  // (e) PRODUCTION REPLAY (Nov 2 retest failure, session 66968cd4): handoff tool -> a=xfer -> the
  // bridge's premature voice-tools "end" (reason caller_hangup) interposed, rewriting the session from
  // "handoff" to "ended" ~20 s BEFORE the dial result -> a=dial no-answer must STILL hand the caller
  // back (the requested->missed transition in this same dial invocation is the durable proof), clear
  // ended_at as it reactivates the session, and write the retry handoff row.
  const sesR = newSes({ state: "active" });
  const rr = await TL.execute({ orgId: OA, session: sesR, cfg: await S.cfgOf(OA) }, "request_human_handoff", { reason: "caller asked for a person", summary: "wants a person" }, "wx-replay");
  ok(rr.ok && rr.transfer_possible === true, "replay: the handoff tool arms the transfer");
  w = await hook("xfer", { CallSid: sesR.provider_call_id }, { s: sesR.id });
  ok(/<Dial/.test(w.x) && T.voice_sessions.find(x => x.id === sesR.id).state === "handoff", "replay: a=xfer sets state handoff and dials the person (silent dial, her announce already played)");
  const vtEnd = await VT.handler({ httpMethod: "POST", headers: { authorization: "Bearer bridgesecret" }, body: JSON.stringify({ action: "end", session_id: sesR.id, reason: "caller_hangup", seconds: 41 }) });
  const endedSes = T.voice_sessions.find(x => x.id === sesR.id);
  ok(vtEnd.statusCode === 200 && endedSes.state === "ended" && endedSes.end_reason === "caller_hangup" && !!endedSes.ended_at, "replay: the interposed bridge end rewrites the session handoff -> ended/caller_hangup (the production defect, reproduced)");
  w = await hook("dial", { CallSid: sesR.provider_call_id, DialCallStatus: "no-answer", DialCallSid: "CAlegR1" }, { s: sesR.id });
  ok(w.s === 200 && /<Stream/.test(w.x) && !/no one could take the call/.test(w.x), "replay: a=dial STILL hands the caller back to her on a fresh stream, despite the session having been ended mid-transfer");
  ok(tokOf(w.x).r === "xferfail:1", "replay: the hand-back stream TwiML carries r=xferfail:1");
  const backSes = T.voice_sessions.find(x => x.id === sesR.id);
  ok(backSes.state === "active" && backSes.ended_at === null, "replay: the session is hers again — state active AND ended_at cleared");
  ok(T.voice_handoffs.filter(h => h.session_id === sesR.id && h.status === "requested").length === 1 && /Transfer retry \(automatic\)/.test(T.voice_handoffs.find(h => h.session_id === sesR.id && h.status === "requested").reason), "replay: the retry handoff row exists (the enforced second dial has something to dial against)");
  ok(T.voice_handoffs.filter(h => h.session_id === sesR.id && h.status === "missed").length === 1, "replay: the original handoff row was recorded missed by this dial invocation");
  ok(T.voice_callbacks.filter(c => c.session_id === sesR.id && /not answered/.test(c.reason)).length === 1, "replay: the missed-transfer callback is saved");

  console.log("PASS: " + n + " assertions"); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
