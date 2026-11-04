"use strict";
// Run: node tests/voicebridge-fixups.test.js
// THE NOV 4, 2026 BRIDGE FIXES, proven against the fake phone + fake Gemini Live rig:
//  (4) STALL CAP: retest 2 had 26 s of dead air because the hold line's OWN audio disarmed the
//      stall cap (the guard counted any agent audio since the check started). Here the fake model
//      actually PLAYS the hold line back — the exact condition the older suite never simulated —
//      and the recovery line must still fire, exactly once.
//  (5) GOODBYE FUSE: Tony said "Goodbye.", she said "Bye!" and stayed on the line until HE hung
//      up. Now the caller's goodbye arms a bridge fuse: she is told to close with end_call
//      (caller_done), and if she says her bye but the line stays open, the bridge hangs up itself.
//  (3) CALLER-TURN VISIBILITY: a caller turn used to surface only on the model's next event or
//      the 5 s rescue flush (~8 s worst case — retest 2's unanswered "yes"). A lone transcription
//      fragment must now reach the site as a transcript line within ~2–3 s.
const assert = require("assert"), EE = require("events"); let n = 0; const ok = (c, m) => { assert(c, m); console.log("ok -", m); n++; };
const { createBridge } = require("../server-kit/voice-bridge/bridge.js");
const sleep = ms => new Promise(r => setTimeout(r, ms));
class Sock extends EE { constructor() { super(); this.readyState = 1; this.sent = []; } send(x) { this.sent.push(JSON.parse(x)); } close() { if (this.readyState === 3) return; this.readyState = 3; this.emit("close"); } }
const pcm = k => { const b = Buffer.alloc(k * 2); for (let i = 0; i < k; i++) b.writeInt16LE(Math.round(8000 * Math.sin(i / 5)), i * 2); return b.toString("base64"); };
function rig(opts) {
  opts = opts || {}; const calls = []; let aiSock = null;
  const fetch = async (url, o) => { const b = JSON.parse(o.body); calls.push(b); let data = {}, status = 200;
    if (b.action === "context") { data = { session_id: "S1", instructions: "be nice", tools: [{ type: "function", name: "t", description: "d", parameters: { type: "object", properties: { a: { type: "string" } }, additionalProperties: false } }], voice: "alloy", greeting: "Hello", max_seconds: 1800, resume: null }; }
    if (b.action === "tool") { if (opts.toolDelay) await sleep(opts.toolDelay); data = { result: { ok: true } }; }
    if (b.action === "hangup") data = { ok: true };
    return { status, json: async () => data }; };
  class W extends Sock { constructor(url, o) { super(); aiSock = this; this.url = url; this.headers = o.headers; setTimeout(() => this.emit("open"), 5); } }
  const b = createBridge({ env: Object.assign({ SITE_URL: "https://site.test/", VOICE_BRIDGE_SECRET: "sec", GEMINI_API_KEY: "gk-x", VOICE_AMBIENCE: "off" }, opts.env || {}), WebSocket: W, fetch, log() {} });
  const tw = new Sock(); b.handle(tw); const phone = o => tw.emit("message", JSON.stringify(o)); const ai = o => aiSock.emit("message", JSON.stringify(o));
  return { tw, phone, ai, calls, get aiSock() { return aiSock; }, start: () => phone({ event: "start", start: { streamSid: "MZ1", customParameters: { token: "tok" } } }), ready: () => ai({ setupComplete: {} }) };
}
const sc = o => ({ serverContent: o }), audio = k => sc({ modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: pcm(k) } }] } });
const says = (r, frag) => r.aiSock.sent.filter(m => m.clientContent && JSON.stringify(m).includes(frag));

(async () => {
  // ── (4) stall cap survives the hold line's own playback ──
  { const r = rig({ env: { VOICE_TOOL_HOLD_MS: "60", VOICE_TOOL_HOLD2_MS: "700", VOICE_SILENCE_MS: "100000" }, toolDelay: 1600 });
    r.start(); await sleep(40); r.ready();
    r.ai({ toolCall: { functionCalls: [{ id: "x1", name: "validate_shipment_eligibility", args: {} }] } });
    await sleep(150);   // hold line 1 has been ordered by now (60 ms threshold)
    ok(says(r, "checking that for you").length === 1, "stall: the hold line is ordered during the long check");
    // the model PLAYS the hold line — its audio + transcription come back while the check runs.
    // Under the old guard this audio alone permanently disarmed the stall cap.
    r.ai(sc({ outputTranscription: { text: "One second — I'm checking that for you." } })); r.ai(audio(240)); r.ai(sc({ turnComplete: true }));
    await sleep(900);
    ok(says(r, "taking longer than it should").length === 1, "stall: the recovery line still fires exactly once, even though the hold line itself was spoken during the check");
    await sleep(900);   // the tool lands (~1.6 s); nothing more may be said by the bridge
    ok(says(r, "taking longer than it should").length === 1 && r.aiSock.sent.some(m => m.toolResponse), "stall: after the tool lands, the result is delivered and the recovery is not repeated");
    r.phone({ event: "stop" }); await sleep(10);
  }
  // ── (3) a lone caller fragment reaches the site transcript fast ──
  { const r = rig(); r.start(); await sleep(40); r.ready(); await sleep(10);
    r.ai(audio(240)); r.ai(sc({ turnComplete: true }));   // greeting finished
    const t0 = Date.now();
    r.ai(sc({ inputTranscription: { text: "1200 Peachtree Street" } }));   // a fragment, no turn end, no further events
    let seen = 0; for (let i = 0; i < 40 && !seen; i++) { await sleep(100); if (r.calls.some(c => c.action === "transcript" && c.role === "caller" && /Peachtree/.test(c.text))) seen = Date.now() - t0; }
    ok(seen > 0 && seen < 3500, "visibility: a caller's words reach the transcript in " + (seen || "never") + " ms (was up to ~8 s)");
    r.phone({ event: "stop" }); await sleep(10);
  }
  // ── (5) goodbye fuse: she answers the goodbye, the bridge ends the call ──
  { const r = rig(); r.start(); await sleep(40); r.ready(); await sleep(10);
    r.ai(audio(240)); r.ai(sc({ turnComplete: true }));   // greeting finished
    r.ai(sc({ inputTranscription: { text: "Goodbye." } })); r.ai(sc({ turnComplete: true })); await sleep(30);
    ok(says(r, "caller_done").length >= 1, "goodbye: the bridge tells her to close warmly and end the call with end_call (caller_done)");
    ok(!r.calls.some(c => c.action === "hangup"), "goodbye: no hangup yet — she gets her chance to say her line first");
    r.ai(sc({ outputTranscription: { text: "Bye! Take care now." } })); r.ai(audio(240)); r.ai(sc({ turnComplete: true }));
    r.phone({ event: "mark" }); r.phone({ event: "mark" });
    let hung = 0; for (let i = 0; i < 60 && !hung; i++) { await sleep(200); if (r.calls.some(c => c.action === "hangup")) hung = 1; }
    ok(hung === 1, "goodbye: she said her bye and did NOT hang up — the bridge ends the call itself within seconds");
    r.phone({ event: "stop" }); await sleep(10);
  }
  console.log("voicebridge-fixups:", n, "assertions passed");
})().catch(e => { console.error(e); process.exit(1); });
