// Real-time AI adapter: Google Gemini Live API over WebSocket. The phone leg is G.711 mu-law 8 kHz; Gemini takes 16 kHz and returns 24 kHz
// 16-bit PCM, so this file converts both ways. It only BUILDS messages and reads events; the socket lives in server-kit/voice-bridge.
// create() returns one stateful object per call. parse() turns Gemini messages into a small provider-neutral event list:
//   ready | audio{payload} | interrupted | caller_text{text,key} | agent_text{text,key} | tool{id,name,args} | turn_done | error{message}
const DEFAULT_MODEL = "gemini-3.8-live", DEFAULT_VOICE = "Kore";
const VOICES = ["Kore", "Puck", "Charon", "Fenrir", "Aoede", "Leda", "Orus", "Zephyr"];
const URL = function (model) { void model; return "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"; }; // model goes in the setup message
const headers = function (env) { return { "x-goog-api-key": env.GEMINI_API_KEY }; };

// ── G.711 mu-law <-> 16-bit PCM ──
const MU_DEC = (function () { const t = new Int16Array(256); for (let i = 0; i < 256; i++) { const u = ~i & 0xff, sign = u & 0x80, exp = (u >> 4) & 7, man = u & 15; let s = (((man << 3) + 0x84) << exp) - 0x84; t[i] = sign ? -s : s; } return t; })();
function mulawEnc(s) { let sign = 0; if (s < 0) { s = -s; sign = 0x80; } if (s > 32635) s = 32635; s += 0x84; let exp = 7; for (let m = 0x4000; (s & m) === 0 && exp > 0; m >>= 1) exp--; return ~(sign | (exp << 4) | ((s >> (exp + 3)) & 15)) & 0xff; }
const SAFE = { type: 1, description: 1, enum: 1, properties: 1, items: 1, required: 1, nullable: 1, format: 1, minimum: 1, maximum: 1 };
function schema(s) { // JSON-schema -> the subset Gemini accepts (upper-case types, no additionalProperties/default/etc.)
  if (!s || typeof s !== "object") return s;
  const o = {};
  Object.keys(s).forEach(function (k) {
    if (!SAFE[k]) return; const v = s[k];
    if (k === "type") o.type = String(v).toUpperCase();
    else if (k === "properties") { o.properties = {}; Object.keys(v).forEach(function (p) { o.properties[p] = schema(v[p]); }); }
    else if (k === "items") o.items = schema(v);
    else o[k] = v;
  });
  return o;
}
function declarations(tools) {
  return (tools || []).map(function (t) {
    const f = t.function || t, d = { name: f.name, description: f.description || f.name, behavior: "BLOCKING" };
    const p = schema(f.parameters); if (p && p.properties && Object.keys(p.properties).length) d.parameters = p;
    return d;
  });
}

function create(opts) {
  opts = opts || {}; const model = opts.model || process.env.VOICE_AI_MODEL || DEFAULT_MODEL;
  let lastTextAt = 0, upPrev = 0, dnRest = [], callerBuf = "", agentBuf = "", n = 0, agentSpoke = false;
  const flushCaller = function (ev) { if (callerBuf.trim()) ev.push({ kind: "caller_text", text: callerBuf.trim(), key: "c:" + (++n) }); callerBuf = ""; };
  const flushAgent = function (ev) { if (agentBuf.trim()) ev.push({ kind: "agent_text", text: agentBuf.trim(), key: "a:" + (++n) }); agentBuf = ""; };
  return {
    name: "gemini-live",
    setup: function (o) {
      const voice = VOICES.indexOf(o.voice) >= 0 ? o.voice : (process.env.VOICE_NAME && VOICES.indexOf(process.env.VOICE_NAME) >= 0 ? process.env.VOICE_NAME : DEFAULT_VOICE);
      const decl = declarations(o.tools);
      return [{ setup: { model: "models/" + model, generationConfig: { responseModalities: ["AUDIO"], speechConfig: Object.assign({ voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }, process.env.VOICE_LANGUAGE_CODE ? { languageCode: process.env.VOICE_LANGUAGE_CODE } : {}) },
        systemInstruction: { parts: [{ text: o.instructions || "" }] }, tools: decl.length ? [{ functionDeclarations: decl }] : [],
        realtimeInputConfig: { automaticActivityDetection: { prefixPaddingMs: 300, silenceDurationMs: o.silence_ms || 600 } },
        inputAudioTranscription: {}, outputAudioTranscription: {} } }];
    },
    // phone -> Gemini: mu-law 8 kHz base64 -> PCM16 16 kHz base64
    audioIn: function (b64) {
      const b = Buffer.from(b64, "base64"), out = Buffer.alloc(b.length * 4);
      for (let i = 0; i < b.length; i++) { const x = MU_DEC[b[i]]; out.writeInt16LE(Math.round((upPrev + x) / 2), i * 4); out.writeInt16LE(x, i * 4 + 2); upPrev = x; }
      return { realtimeInput: { audio: { mimeType: "audio/pcm;rate=16000", data: out.toString("base64") } } };
    },
    toolResult: function (callId, name, out) { return [{ toolResponse: { functionResponses: [{ id: callId, name: name, response: { output: out } }] } }]; },
    say: function (text) { return { clientContent: { turns: [{ role: "user", parts: [{ text: "Say exactly this to the caller, then wait: " + text }] }], turnComplete: true } }; },
    note: function (text) { return { clientContent: { turns: [{ role: "user", parts: [{ text: "[system notice, not the caller] " + text }] }], turnComplete: true } }; },
    // text heard so far that no event has flushed yet (call ended or garbled before a turn completed): hand it over instead of losing it
    flush: function (idleMs) { if (idleMs && Date.now() - lastTextAt < idleMs) return []; const ev = []; flushCaller(ev); flushAgent(ev); return ev; },
    // context only: added to the conversation WITHOUT asking the model to answer (turnComplete false), used for the language-lock reminder
    noteSilent: function (text) { return { clientContent: { turns: [{ role: "user", parts: [{ text: "[system reminder, do not reply to this] " + text }] }], turnComplete: false } }; },
    truncate: null, // Gemini needs no "how much was heard" report after an interruption
    // Gemini -> events
    parse: function (m) {
      const ev = [];
      if (m.setupComplete) ev.push({ kind: "ready" });
      const c = m.serverContent;
      if (c) {
        if (c.interrupted) { flushAgent(ev); ev.push({ kind: "interrupted" }); }
        if (c.inputTranscription && c.inputTranscription.text) { callerBuf += c.inputTranscription.text; lastTextAt = Date.now(); }
        if (c.outputTranscription && c.outputTranscription.text) { flushCaller(ev); agentBuf += c.outputTranscription.text; lastTextAt = Date.now(); }
        if (c.modelTurn && c.modelTurn.parts) c.modelTurn.parts.forEach(function (p) {
          if (!(p.inlineData && p.inlineData.data)) return;
          flushCaller(ev); agentSpoke = true;
          const pcm = Buffer.from(p.inlineData.data, "base64"); let s = dnRest.slice(); dnRest = [];
          for (let i = 0; i + 1 < pcm.length; i += 2) s.push(pcm.readInt16LE(i));
          const full = Math.floor(s.length / 3) * 3, out = Buffer.alloc(full / 3);
          for (let i = 0, j = 0; i < full; i += 3, j++) out[j] = mulawEnc(Math.round((s[i] + s[i + 1] + s[i + 2]) / 3));
          dnRest = s.slice(full);
          if (out.length) ev.push({ kind: "audio", payload: out.toString("base64") });
        });
        if (c.turnComplete) { flushCaller(ev); flushAgent(ev); ev.push({ kind: "turn_done", spoke: agentSpoke }); agentSpoke = false; }
      }
      if (m.toolCall && m.toolCall.functionCalls) { flushCaller(ev); m.toolCall.functionCalls.forEach(function (f) { ev.push({ kind: "tool", id: f.id, name: f.name, args: f.args || {} }); }); }
      if (m.goAway) ev.push({ kind: "go_away", left: m.goAway.timeLeft });
      if (m.error) ev.push({ kind: "error", message: m.error.message || "error" });
      return ev;
    }
  };
}
module.exports = { name: "gemini-live", DEFAULT_MODEL, DEFAULT_VOICE, VOICES, URL, headers, create, declarations, schema, mulawEnc, MU_DEC };
