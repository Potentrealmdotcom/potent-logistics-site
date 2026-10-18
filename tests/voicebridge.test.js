// Run: node tests/voicebridge.test.js  (audio bridge with fake phone + fake AI sockets)
const assert = require("assert"), EE = require("events"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const { createBridge } = require("../server-kit/voice-bridge/bridge.js"), AI = require("../netlify/functions/lib/voice/adapters/realtime");
const sleep = ms => new Promise(r => setTimeout(r, ms));
class Sock extends EE { constructor() { super(); this.readyState = 1; this.sent = []; } send(x) { this.sent.push(JSON.parse(x)); } close() { if (this.readyState === 3) return; this.readyState = 3; this.emit("close"); } }
const audioType = ["response.output_audio.delta", "response.audio.delta"].find(t => AI.isAudioDelta(t));
function rig(opts) {
  opts = opts || {}; const calls = []; let aiSock = null;
  const fetch = async (url, o) => { const b = JSON.parse(o.body); calls.push(b); if (opts.apiDown) throw new Error("down"); let data = {}, status = 200;
    if (b.action === "context") { if (opts.ctxStatus) { status = opts.ctxStatus; data = { error: "x" }; } else data = { session_id: "S1", instructions: "be nice", tools: [{ name: "t" }], voice: "alloy", greeting: "Hello", max_seconds: opts.maxSeconds || 1800 }; }
    if (b.action === "tool") data = { result: opts.toolResult || { ok: true } }; if (b.action === "transfer") data = opts.transferFail ? { ok: false, error: "no_one_available" } : { ok: true, requested: true };
    return { status, json: async () => data }; };
  class W extends Sock { constructor(url, o) { super(); aiSock = this; this.url = url; this.headers = o.headers; if (!opts.aiNeverOpens) setTimeout(() => this.emit("open"), 5); } }
  const b = createBridge({ env: { SITE_URL: "https://site.test/", VOICE_BRIDGE_SECRET: "sec", OPENAI_API_KEY: "sk-x" }, WebSocket: W, fetch, log() {} });
  const tw = new Sock(); b.handle(tw); const phone = o => tw.emit("message", JSON.stringify(o)); const ai = o => aiSock.emit("message", JSON.stringify(o));
  return { tw, phone, ai, calls, get aiSock() { return aiSock; }, start: () => phone({ event: "start", start: { streamSid: "MZ1", customParameters: { token: "tok" } } }) };
}
(async () => {
  let r = rig(); r.start(); await sleep(40);
  ok(r.calls[0].action === "context" && r.calls[0].token === "tok", "bridge asks the site for the call context using the stream token");
  ok(r.aiSock.headers.Authorization === "Bearer sk-x" && /^wss:\/\//.test(r.aiSock.url), "AI key stays on the bridge and is sent only to the AI provider");
  ok(r.aiSock.sent.some(m => m.type === "session.update" || m.session) && r.aiSock.sent.some(m => m.type === "response.create"), "AI session configured and greeting spoken");
  r.phone({ event: "media", media: { track: "inbound", payload: "AAAA", timestamp: "100" } }); ok(r.aiSock.sent.some(m => m.type === "input_audio_buffer.append" && m.audio === "AAAA"), "caller audio goes to the AI");
  r.phone({ event: "media", media: { track: "outbound", payload: "ZZ", timestamp: "100" } }); ok(!r.aiSock.sent.some(m => m.audio === "ZZ"), "the assistant's own audio is not fed back");
  r.ai({ type: audioType, item_id: "i1", delta: "BBBB" }); ok(r.tw.sent.some(m => m.event === "media" && m.media.payload === "BBBB") && r.tw.sent.some(m => m.event === "mark"), "AI audio goes to the caller with a position mark");
  // barge-in
  r.phone({ event: "media", media: { track: "inbound", payload: "A", timestamp: "700" } }); r.ai({ type: "input_audio_buffer.speech_started" });
  ok(r.tw.sent.some(m => m.event === "clear") && r.aiSock.sent.some(m => m.type === "conversation.item.truncate" && m.item_id === "i1"), "caller interrupts: playback stops and the AI is told what was actually heard");
  const before = r.tw.sent.length; r.ai({ type: "input_audio_buffer.speech_started" }); ok(r.tw.sent.length === before, "interrupt with nothing playing does nothing");
  // transcripts
  r.ai({ type: "conversation.item.input_audio_transcription.completed", item_id: "u1", transcript: "I need a truck" }); await sleep(10); ok(r.calls.some(c => c.action === "transcript" && c.role === "caller" && c.key === "c:u1"), "what the caller said is recorded");
  // tool relay
  r.ai({ type: "response.function_call_arguments.done", name: "lookup_customer", arguments: "{}", call_id: "call_1" }); await sleep(20);
  ok(r.calls.some(c => c.action === "tool" && c.name === "lookup_customer" && c.call_key === "call_1") && r.aiSock.sent.some(m => JSON.stringify(m).includes("call_1")), "tool call forwarded with the provider call id; result returned to the AI");
  r.ai({ type: "response.function_call_arguments.done", name: "x", arguments: "{bad", call_id: "call_2" }); await sleep(20); ok(!r.calls.some(c => c.call_key === "call_2") && JSON.stringify(r.aiSock.sent).includes("bad_arguments"), "malformed tool arguments never reach the site");
  // hangup
  r.phone({ event: "stop" }); await sleep(20); const en = r.calls.filter(c => c.action === "end"); ok(en.length === 1 && en[0].reason === "caller_hangup" && r.aiSock.readyState === 3, "caller hangs up: call ended once, AI closed"); r.tw.close(); await sleep(10); ok(r.calls.filter(c => c.action === "end").length === 1, "a late socket close does not end it twice");
  // transfer ok
  r = rig({ toolResult: { ok: true, transfer_possible: true } }); r.start(); await sleep(40); r.ai({ type: "response.function_call_arguments.done", name: "request_human_handoff", arguments: "{}", call_id: "h1" }); await sleep(20); ok(!r.calls.some(c => c.action === "transfer"), "transfer waits until the AI finishes speaking"); r.ai({ type: "response.done" }); await sleep(30); ok(r.calls.some(c => c.action === "transfer"), "then the transfer is requested"); r.phone({ event: "stop" }); await sleep(20); ok(r.calls.find(c => c.action === "end").reason === "transferred", "stream ending after a transfer is recorded as transferred");
  // transfer fail -> AI told
  r = rig({ toolResult: { ok: true, transfer_possible: true }, transferFail: true }); r.start(); await sleep(40); r.ai({ type: "response.function_call_arguments.done", name: "request_human_handoff", arguments: "{}", call_id: "h2" }); await sleep(20); r.ai({ type: "response.done" }); await sleep(40);
  ok(JSON.stringify(r.aiSock.sent).includes("could not be completed") && JSON.stringify(r.aiSock.sent).includes("offer a callback"), "failed transfer: the AI is told to be honest and offer a callback");
  // context refused (emergency stop / forged token)
  r = rig({ ctxStatus: 423 }); r.start(); await sleep(30); ok(r.tw.readyState === 3 && !r.aiSock, "site refuses the call: phone leg closed, AI never opened");
  r = rig({ apiDown: true }); r.start(); await sleep(30); ok(r.tw.readyState === 3 && !r.aiSock, "site unreachable: the call is closed cleanly (the phone company then plays its fallback)");
  r = rig(); r.phone({ event: "start", start: { streamSid: "M", customParameters: {} } }); await sleep(10); ok(r.tw.readyState === 3, "no token: refused");
  // AI drop mid-call
  r = rig(); r.start(); await sleep(40); r.aiSock.emit("error", new Error("boom")); await sleep(20); ok(r.calls.find(c => c.action === "end").reason === "ai_error" && r.tw.readyState === 3, "AI provider fails mid-call: call ends and is recorded");
  // max duration (scaled)
  r = rig({ maxSeconds: 1 }); r.start(); await sleep(1200); ok(r.calls.find(c => c.action === "end") && r.calls.find(c => c.action === "end").reason === "max_duration" && r.tw.readyState === 3, "call is cut at the plan's maximum length");
  console.log("PASS: " + n + " assertions"); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
