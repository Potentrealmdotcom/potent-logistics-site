// Run: node tests/voicebridge.test.js  (audio bridge with fake phone + fake Gemini Live sockets)
const assert = require("assert"), EE = require("events"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const { createBridge } = require("../server-kit/voice-bridge/bridge.js"), AI = require("../netlify/functions/lib/voice/adapters/gemini-live");
const sleep = ms => new Promise(r => setTimeout(r, ms));
class Sock extends EE { constructor() { super(); this.readyState = 1; this.sent = []; } send(x) { this.sent.push(JSON.parse(x)); } close() { if (this.readyState === 3) return; this.readyState = 3; this.emit("close"); } }

const pcm = n => { const b = Buffer.alloc(n * 2); for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin(i / 5)), i * 2); return b.toString("base64"); };
function rig(opts) {
  opts = opts || {}; const calls = []; let aiSock = null;
  const fetch = async (url, o) => { const b = JSON.parse(o.body); calls.push(b); if (opts.apiDown) throw new Error("down"); let data = {}, status = 200;
    if (b.action === "context") { if (opts.ctxStatus) { status = opts.ctxStatus; data = { error: "x" }; } else data = { session_id: "S1", instructions: "be nice", tools: [{ type: "function", name: "t", description: "d", parameters: { type: "object", properties: { a: { type: "string" } }, additionalProperties: false } }], voice: "alloy", greeting: "Hello", max_seconds: opts.maxSeconds || 1800 }; }
    if (b.action === "tool") data = { result: opts.toolResult || { ok: true } }; if (b.action === "transfer") data = opts.transferFail ? { ok: false, error: "no_one_available" } : { ok: true, requested: true };
    return { status, json: async () => data }; };
  class W extends Sock { constructor(url, o) { super(); aiSock = this; this.url = url; this.headers = o.headers; if (!opts.aiNeverOpens) setTimeout(() => this.emit("open"), 5); } }
  const b = createBridge({ env: Object.assign({ SITE_URL: "https://site.test/", VOICE_BRIDGE_SECRET: "sec", GEMINI_API_KEY: "gk-x" }, opts.env || {}), WebSocket: W, fetch, log() {} });
  const tw = new Sock(); b.handle(tw); const phone = o => tw.emit("message", JSON.stringify(o)); const ai = o => aiSock.emit("message", JSON.stringify(o));
  return { tw, phone, ai, calls, get aiSock() { return aiSock; }, start: () => phone({ event: "start", start: { streamSid: "MZ1", customParameters: { token: "tok" } } }), ready: () => ai({ setupComplete: {} }) };
}
const sc = o => ({ serverContent: o }), audio = n => sc({ modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: pcm(n) } }] } });
(async () => {
  let r = rig(); r.start(); await sleep(40);
  ok(r.calls[0].action === "context" && r.calls[0].token === "tok", "bridge asks the site for the call context using the stream token");
  ok(r.aiSock.headers["x-goog-api-key"] === "gk-x" && /^wss:\/\//.test(r.aiSock.url), "AI key stays on the bridge and is sent only to the AI provider");
  const setup = r.aiSock.sent.find(m => m.setup); ok(setup && setup.setup.model === "models/gemini-3.8-live" && setup.setup.systemInstruction.parts[0].text === "be nice" && setup.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName === "Aoede", "AI session configured (model, instructions, valid voice)");
  const fd = setup.setup.tools[0].functionDeclarations[0]; ok(fd.name === "t" && fd.behavior === "BLOCKING" && fd.parameters.type === "OBJECT" && !("additionalProperties" in fd.parameters), "tools converted to the Gemini schema");
  ok(!r.aiSock.sent.some(m => m.clientContent), "nothing is said before the AI confirms its setup");
  r.phone({ event: "media", media: { track: "inbound", payload: Buffer.alloc(160, 0xff).toString("base64"), timestamp: "10" } }); r.ready(); await sleep(10);
  ok(r.aiSock.sent.some(m => m.clientContent && JSON.stringify(m).includes("Hello")), "greeting spoken once the AI is ready");
  ok(!r.aiSock.sent.some(m => m.realtimeInput), "caller audio is held back while the greeting plays, so background noise cannot interrupt it");
  r.ai(sc({ turnComplete: true })); await sleep(5); // greeting finished: caller audio now flows
  const inAudio = r.aiSock.sent.filter(m => m.realtimeInput).length;
  r.phone({ event: "media", media: { track: "inbound", payload: Buffer.alloc(160, 0xff).toString("base64"), timestamp: "100" } }); ok(r.aiSock.sent.filter(m => m.realtimeInput).length === inAudio + 1, "caller audio goes to the AI");
  const l = JSON.stringify(r.aiSock.sent.filter(m => m.realtimeInput).pop()); const bytes = Buffer.from(JSON.parse(l).realtimeInput.audio.data, "base64").length; ok(bytes === 160 * 4, "8 kHz mu-law becomes 16 kHz 16-bit (4 bytes per input byte)");
  r.phone({ event: "media", media: { track: "outbound", payload: "ZZ", timestamp: "100" } }); ok(r.aiSock.sent.filter(m => m.realtimeInput).length === inAudio + 1, "the assistant's own audio is not fed back");
  r.ai(audio(240)); const med = r.tw.sent.filter(m => m.event === "media"); ok(med.length === 1 && Buffer.from(med[0].media.payload, "base64").length === 80 && r.tw.sent.some(m => m.event === "mark"), "AI audio (24 kHz) goes to the caller as 8 kHz mu-law with a position mark");
  // barge-in
  r.ai(sc({ interrupted: true })); ok(r.tw.sent.some(m => m.event === "clear"), "caller interrupts: playback stops on the phone");
  const before = r.tw.sent.length; r.ai(sc({ interrupted: true })); ok(r.tw.sent.length === before, "interrupt with nothing playing does nothing");
  // transcripts
  r.ai(sc({ inputTranscription: { text: "I need " } })); r.ai(sc({ inputTranscription: { text: "a truck" } })); r.ai(sc({ outputTranscription: { text: "Sure" } })); await sleep(10);
  ok(r.calls.some(c => c.action === "transcript" && c.role === "caller" && c.text === "I need a truck" && /^c:/.test(c.key)), "what the caller said is recorded (joined)");
  r.ai(sc({ outputTranscription: { text: ", where to?" } })); r.ai(sc({ turnComplete: true })); await sleep(10);
  ok(r.calls.some(c => c.action === "transcript" && c.role === "agent" && c.text === "Sure, where to?"), "what the assistant said is recorded at the end of its turn");
  // tool relay
  r.ai({ toolCall: { functionCalls: [{ id: "call_1", name: "lookup_customer", args: { a: 1 } }] } }); await sleep(20);
  ok(r.calls.some(c => c.action === "tool" && c.name === "lookup_customer" && c.call_key === "call_1" && c.args.a === 1) && r.aiSock.sent.some(m => m.toolResponse && m.toolResponse.functionResponses[0].id === "call_1"), "tool call forwarded with the provider call id; result returned to the AI");
  // hangup
  r.phone({ event: "stop" }); await sleep(20); const en = r.calls.filter(c => c.action === "end"); ok(en.length === 1 && en[0].reason === "caller_hangup" && r.aiSock.readyState === 3, "caller hangs up: call ended once, AI closed"); r.tw.close(); await sleep(10); ok(r.calls.filter(c => c.action === "end").length === 1, "a late socket close does not end it twice");
  // transfer ok
  r = rig({ toolResult: { ok: true, transfer_possible: true } }); r.start(); await sleep(40); r.ready(); r.ai({ toolCall: { functionCalls: [{ id: "h1", name: "request_human_handoff", args: {} }] } }); await sleep(20); ok(!r.calls.some(c => c.action === "transfer"), "transfer waits until the AI finishes speaking");
  r.ai(audio(240)); r.ai(sc({ turnComplete: true })); r.phone({ event: "mark" }); await sleep(450); ok(r.calls.some(c => c.action === "transfer"), "then the transfer is requested"); r.phone({ event: "stop" }); await sleep(20); ok(r.calls.find(c => c.action === "end").reason === "transferred", "stream ending after a transfer is recorded as transferred");
  // transfer fail -> AI told
  r = rig({ toolResult: { ok: true, transfer_possible: true }, transferFail: true }); r.start(); await sleep(40); r.ready(); r.ai({ toolCall: { functionCalls: [{ id: "h2", name: "request_human_handoff", args: {} }] } }); await sleep(20); r.ai(audio(240)); r.ai(sc({ turnComplete: true })); r.phone({ event: "mark" }); await sleep(450);
  ok(JSON.stringify(r.aiSock.sent).includes("could not be completed") && JSON.stringify(r.aiSock.sent).includes("offer a callback"), "failed transfer: the AI is told to be honest and offer a callback");
  // context refused (emergency stop / forged token)
  r = rig({ ctxStatus: 423 }); r.start(); await sleep(30); ok(r.tw.readyState === 3 && !r.aiSock, "site refuses the call: phone leg closed, AI never opened");
  r = rig({ apiDown: true }); r.start(); await sleep(30); ok(r.tw.readyState === 3 && !r.aiSock, "site unreachable: the call is closed cleanly (the phone company then plays its fallback)");
  r = rig(); r.phone({ event: "start", start: { streamSid: "M", customParameters: {} } }); await sleep(10); ok(r.tw.readyState === 3, "no token: refused");
  // AI drop mid-call
  r = rig({ env: { VOICE_AI_RETRIES: "0" } }); r.start(); await sleep(40); r.aiSock.emit("error", new Error("boom")); await sleep(20); ok(r.calls.find(c => c.action === "end").reason === "ai_error" && r.tw.readyState === 3, "AI provider fails mid-call (no retries left): call ends and is recorded");
  ok(r.calls.some(c => c.action === "health" && c.kind === "ai_drop" && /boom/.test(c.detail)), "the real reason the AI dropped is recorded");
  // AI drop with a retry: the caller is not dropped, the new session gets the conversation so far, no second greeting
  r = rig(); r.start(); await sleep(40); r.ready(); await sleep(10); r.ai(sc({ inputTranscription: { text: "I need a truck to Marietta" } })); r.ai(sc({ turnComplete: true })); await sleep(10);
  const first = r.aiSock; first.readyState = 3; first.emit("close", 1011, Buffer.from("internal error")); await sleep(20);
  ok(r.aiSock !== first && !r.calls.some(c => c.action === "end") && r.tw.readyState === 1, "AI drops mid-call: a new AI session opens and the phone call stays up");
  ok(r.calls.some(c => c.action === "health" && c.kind === "ai_drop" && /code=1011/.test(c.detail) && /internal error/.test(c.detail)), "close code and reason are recorded");
  r.ready(); await sleep(10); const resumed = JSON.stringify(r.aiSock.sent);
  ok(/I need a truck to Marietta/.test(resumed) && /Do NOT greet again/.test(resumed) && !/Hello/.test(resumed), "new session is told the conversation so far and does not greet again");
  r.phone({ event: "stop" }); await sleep(20); ok(r.calls.filter(c => c.action === "end").length === 1, "call still ends once");
  r = rig({ env: { VOICE_AI_RETRIES: "1" } }); r.start(); await sleep(40); r.ready(); r.aiSock.emit("error", new Error("one")); await sleep(15); r.aiSock.emit("error", new Error("two")); await sleep(20);
  ok(r.calls.find(c => c.action === "end").reason === "ai_error" && r.tw.readyState === 3, "after the allowed retries the call ends honestly");
  // transcripts survive a call that ends (or garbles) before a turn completes
  r = rig(); r.start(); await sleep(40); r.ready(); r.ai(sc({ inputTranscription: { text: "need a truck to Marietta" } })); r.ai(sc({ outputTranscription: { text: "Sure, where from" } }));
  r.phone({ event: "stop" }); await sleep(30);
  ok(r.calls.some(c => c.action === "transcript" && c.role === "caller" && /Marietta/.test(c.text)) && r.calls.some(c => c.action === "transcript" && c.role === "agent" && /where from/.test(c.text)), "hang up mid-sentence: what was said so far is still saved");
  ok(r.calls.findIndex(c => c.action === "transcript") < r.calls.findIndex(c => c.action === "end"), "the transcript is saved before the call is closed out");
  // max duration (scaled)
  r = rig({ maxSeconds: 1 }); r.start(); await sleep(40); r.ready(); await sleep(1200); ok(r.calls.find(c => c.action === "end") && r.calls.find(c => c.action === "end").reason === "max_duration" && r.tw.readyState === 3, "call is cut at the plan's maximum length");
  // SILENCE WATCHDOG: dead air is impossible
  r = rig({ env: { VOICE_SILENCE_MS: "100" } }); r.start(); await sleep(40); r.ready(); await sleep(10); r.ai(audio(240)); r.ai(sc({ turnComplete: true }));
  const loudFrame = () => r.phone({ event: "media", media: { track: "inbound", payload: Buffer.alloc(160, 0x00).toString("base64"), timestamp: "5" } });
  for (let i = 0; i < 12; i++) loudFrame();
  await sleep(1300); ok(JSON.stringify(r.aiSock.sent).includes("The caller is waiting for your answer"), "caller spoke and she is silent: the model is told the caller is waiting");
  ok(r.calls.some(c => c.action === "health" && c.kind === "silence_nudge"), "each nudge is recorded in the health log");
  await sleep(1000); ok(JSON.stringify(r.aiSock.sent).includes("Still here, one second."), "still silent: she is made to say \"Still here, one second\"");
  const stuck = r.aiSock; await sleep(1000); ok(r.aiSock !== stuck && r.tw.readyState === 1, "still silent after that: the AI link is rebuilt and the phone call stays up");
  r.phone({ event: "stop" }); await sleep(20);
  r = rig({ env: { VOICE_SILENCE_MS: "100" } }); r.start(); await sleep(40); r.ready(); await sleep(1500);
  ok(r.aiSock.sent.filter(m => m.clientContent && JSON.stringify(m).includes("Hello")).length >= 2, "greeting never played: it is said again");
  r.phone({ event: "stop" }); await sleep(20);
  r = rig({ env: { VOICE_SILENCE_MS: "100" } }); r.start(); await sleep(40); r.ready(); r.ai(audio(240)); await sleep(1500);
  ok(!JSON.stringify(r.aiSock.sent).includes("The caller is waiting"), "caller is simply listening: no nudge");
  ok(JSON.stringify(r.aiSock.sent).includes("It has been quiet"), "dead-air backstop: nobody has spoken for a while, so she checks in whatever the cause");
  r.phone({ event: "stop" }); await sleep(20);
  r = rig({ env: { VOICE_SILENCE_MS: "100" }, toolResult: { ok: true, emailed: true } }); r.start(); await sleep(40); r.ready(); await sleep(10); r.ai(audio(240)); r.ai(sc({ turnComplete: true }));
  r.ai({ toolCall: { functionCalls: [{ id: "pl1", name: "send_payment_link", args: {} }] } }); await sleep(30); r.ai(audio(240)); r.ai(sc({ turnComplete: true })); await sleep(1500);
  ok(JSON.stringify(r.aiSock.sent).includes("Is there anything else I can help you with?"), "after booking + payment link are done and the caller is quiet, she is made to ask the close question (no dead air)");
  r.phone({ event: "stop" }); await sleep(20);
  console.log("PASS: " + n + " assertions"); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
