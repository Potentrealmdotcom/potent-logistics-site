// Run: node tests/elevate-phone.test.js  (no network). Əlevate phone line: caller-ID + keypad PIN, lockout, isolation from logistics.
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.TWILIO_AUTH_TOKEN = "twtok";
process.env.VOICE_BRIDGE_SECRET = "bridge-secret"; process.env.VOICE_BRIDGE_URL = "wss://voice.example.com/twilio";
process.env.ELEVATE_OWNER_PHONES = "+14045550100, +19125550111"; process.env.ELEVATE_PHONE_NUMBERS = "+14045559999"; process.env.ELEVATE_OWNER_EMAILS = "me@gmail.com";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const P = require("../netlify/functions/lib/elevate-phone.js"), E = require("../netlify/functions/lib/elevate.js"), TW = require("../netlify/functions/lib/voice/adapters/twilio.js");
process.env.ELEVATE_PIN_HASH = P.hashPin("482915");
const make = require("./_mock.js"); const T = { elevate_calls: [], elevate_items: [], voice_sessions: [], organizations: [] }; make(T, { defaults: { elevate_calls: { state: "pin_pending", pin_fails: 0, tool_calls: 0 }, elevate_items: { done: false } }, unique: { elevate_calls: (a, b) => a.call_sid === b.call_sid } });
const hook = require("../netlify/functions/elevate-phone.js"), tools = require("../netlify/functions/voice-tools.js");
const BASE = "https://potentoperations.netlify.app/.netlify/functions/elevate-phone";
const form = o => Object.keys(o).map(k => k + "=" + encodeURIComponent(o[k])).join("&");
async function wh(a, params, sign) { const url = BASE + (a ? "?a=" + a : ""); const sig = sign === false ? "bad" : TW.signature("twtok", url, params);
  const r = await hook.handler({ httpMethod: "POST", headers: { "x-twilio-signature": sig }, queryStringParameters: a ? { a: a } : {}, rawQuery: a ? "a=" + a : "", body: form(params) }); return { s: r.statusCode, x: r.body }; }
const bridge = (body, secret) => tools.handler({ httpMethod: "POST", headers: { authorization: "Bearer " + (secret || "bridge-secret") }, body: JSON.stringify(body) }).then(r => [r.statusCode, JSON.parse(r.body)]);
const call = (sid, from, to) => ({ CallSid: sid, From: from || "+14045550100", To: to || "+14045559999" });

(async () => {
  ok(P.checkPin(process.env.ELEVATE_PIN_HASH, "482915") && !P.checkPin(process.env.ELEVATE_PIN_HASH, "482916") && !P.checkPin(process.env.ELEVATE_PIN_HASH, "48291") && !P.checkPin("", "482915"), "PIN hash checks");
  ok(!process.env.ELEVATE_PIN_HASH.includes("482915"), "the PIN is not stored in the hash text");
  // signature
  let r = await wh("inbound", call("CA1"), false); ok(r.s === 403 && !T.elevate_calls.length, "unsigned request refused, nothing recorded");
  // wrong number / unknown caller
  r = await wh("inbound", call("CA2", "+14045550100", "+14045550000")); ok(/not in service/.test(r.x) && !/Gather/.test(r.x), "a number that is not the Əlevate line");
  r = await wh("inbound", call("CA3", "+16785550123")); ok(/private/.test(r.x) && !/Gather/.test(r.x) && T.elevate_calls[0].state === "denied", "unknown caller never reaches the PIN prompt");
  r = await wh("inbound", call("CA3b", "+16785550123")); const s3 = await wh("pin", Object.assign(call("CA3b", "+16785550123"), { Digits: "482915" })); ok(!/Stream/.test(s3.x), "unknown caller cannot skip to the PIN step even with the right PIN");
  r = await wh("inbound", Object.assign(call("CA3c"), { StirVerstat: "TN-Validation-Failed-A" })); ok(/private/.test(r.x) && !/Gather/.test(r.x), "caller ID that failed carrier validation is refused");
  // happy path
  r = await wh("inbound", call("CA4")); ok(/<Gather[^>]*numDigits="6"/.test(r.x) && !/Stream/.test(r.x), "your phone is asked for a PIN, not connected yet");
  r = await wh("pin", Object.assign(call("CA4"), { Digits: "111111" })); ok(/Gather/.test(r.x) && /not right/.test(r.x) && !/Stream/.test(r.x), "wrong PIN: try again");
  r = await wh("pin", Object.assign(call("CA4"), { Digits: "482915" })); ok(/<Stream url="wss:\/\/voice.example.com\/twilio"/.test(r.x) && /name="token"/.test(r.x), "right PIN connects to the bridge");
  const tokTxt = /name="token" value="([^"]+)"/.exec(r.x)[1];
  ok(T.elevate_calls.find(c => c.call_sid === "CA4").state === "ringing", "call marked ringing");
  // bridge asks for context
  let [s, j] = await bridge({ action: "context", token: tokTxt }); ok(s === 200 && /^elv-/.test(j.session_id) && j.tools.length === E.TOOLS.length && j.max_seconds === 900 && /PHONE CALL/.test(j.instructions), "bridge gets Əlevate context (tools, 15 min cap)");
  ok(!j.tools.some(t => /send|call|pay|book|transfer/i.test(t.name)), "phone tools are the safe set only");
  const sid = j.session_id;
  [s, j] = await bridge({ action: "context", token: tokTxt }); ok(s === 200, "bridge can reconnect while active");
  [s, j] = await bridge({ action: "context", token: tokTxt }, "wrong"); ok(s === 401, "bridge secret required");
  [s, j] = await bridge({ action: "context", token: tokTxt.slice(0, -2) + "zz" }); ok(s === 403, "tampered token refused");
  [s, j] = await bridge({ action: "tool", session_id: sid, name: "add_task", args: { title: "Phone task" }, call_key: "k1" }); ok(s === 200 && j.result.ok && T.elevate_items.some(x => x.title === "Phone task" && x.source === "voice" && x.owner_key === "me@gmail.com"), "voice tool saves to YOUR list");
  [s, j] = await bridge({ action: "tool", session_id: sid, name: "send_email", args: {} }); ok(j.result && !j.result.ok, "no send_email on the phone");
  [s, j] = await bridge({ action: "transcript", session_id: sid, role: "caller", text: "secret words", key: "x" }); ok(j.stored === false && !JSON.stringify(T).includes("secret words"), "what you say is not stored");
  [s, j] = await bridge({ action: "transfer", session_id: sid }); ok(j.ok === false, "no transfers");
  [s, j] = await bridge({ action: "end", session_id: sid, reason: "caller_hangup", seconds: 42 }); ok(j.ok && T.elevate_calls.find(c => c.call_sid === "CA4").state === "ended" && T.elevate_calls.find(c => c.call_sid === "CA4").seconds === 42, "call ended and timed");
  [s, j] = await bridge({ action: "tool", session_id: sid, name: "add_task", args: { title: "after hangup" } }); ok(s === 409, "no tool calls after the call ended");
  [s, j] = await bridge({ action: "context", token: tokTxt }); ok(s === 409, "an ended call cannot be reopened");
  // not a logistics session
  [s, j] = await bridge({ action: "tool", session_id: "elv-" + "00000000-0000-4000-8000-000000000000", name: "list_items", args: { kind: "task" } }); ok(s === 404, "unknown Əlevate session");
  const lg = TW.streamToken("bridge-secret", "CAX", "11111111-1111-4111-8111-111111111111", Date.now() + 1e5);
  [s, j] = await bridge({ action: "context", token: lg }); ok(s === 404 && !j.tools, "a logistics token cannot open an Əlevate call (and reaches only logistics tables)");
  // lockout
  r = await wh("inbound", call("CA5")); for (let i = 0; i < 3; i++) r = await wh("pin", Object.assign(call("CA5"), { Digits: "000000" }));
  ok(/Goodbye/.test(r.x) && !/Gather/.test(r.x) && T.elevate_calls.find(c => c.call_sid === "CA5").state === "denied", "3 wrong PINs hang up");
  r = await wh("inbound", call("CA6")); ok(/Too many/.test(r.x) && !/Gather/.test(r.x), "that phone is locked out for the hour");
  r = await wh("inbound", call("CA7", "+19125550111")); ok(/Gather/.test(r.x), "your other phone is not locked by the first one");
  r = await wh("pin", Object.assign(call("CA7", "+19125550111"), { Digits: "482915" })); ok(/Stream/.test(r.x), "…and works with the right PIN");
  // global lockout
  T.elevate_calls.push({ id: "aaaaaaaa-0000-4000-8000-000000000001", call_sid: "G1", owner_key: "x", from_number: "+19999999999", pin_fails: 7, state: "denied", created_at: new Date().toISOString() });
  r = await wh("inbound", call("CA8", "+19125550111")); ok(/Too many/.test(r.x), "global lockout after 10 wrong PINs from anyone");
  // misc
  r = await wh("status", { CallSid: "CA4", CallStatus: "completed", CallDuration: "50" }); ok(r.s === 200 && T.elevate_calls.find(c => c.call_sid === "CA4").seconds === 42, "status does not overwrite the real duration");
  r = await wh("fallback", call("CA7", "+19125550111")); ok(/lost the connection/.test(r.x) && T.elevate_calls.find(c => c.call_sid === "CA7").state === "failed", "bridge down: honest message, call marked failed");
  const o = { ...process.env }; delete process.env.ELEVATE_PIN_HASH; r = await wh("inbound", call("CA9")); ok(/not in service/.test(r.x), "no PIN configured = line is closed"); process.env.ELEVATE_PIN_HASH = o.ELEVATE_PIN_HASH;
  ok(T.voice_sessions.length === 0, "the logistics tables were never touched");
  console.log("elevate phone: " + n + " assertions PASS"); process.exit(0);
})().catch(e => { console.error("FAIL", e); process.exit(1); });
