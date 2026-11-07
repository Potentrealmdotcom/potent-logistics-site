// Real-time AI adapter: Google Gemini Live API over WebSocket. The phone leg is G.711 mu-law 8 kHz; Gemini takes 16 kHz and returns 24 kHz
// 16-bit PCM, so this file converts both ways. It only BUILDS messages and reads events; the socket lives in server-kit/voice-bridge.
// create() returns one stateful object per call. parse() turns Gemini messages into a small provider-neutral event list:
//   ready | audio{payload} | interrupted | caller_text{text,key} | agent_text{text,key} | tool{id,name,args} | turn_done | error{message}
const DEFAULT_MODEL = "gemini-3.8-live";
// THE VOICE (Tony, Nov 2, 2026): Sulafat, Google's "Warm" voice — Tony's current pick by ear
// ("this could work… closest we can get to the Bland call"), replacing Leda ("Youthful" — Tony:
// "white and giddy"). The Gacrux ("Mature") A/B sample is with Tony and his verdict is still
// pending; if he flips, it is THIS one line that changes — the voice is named nowhere else.
const DEFAULT_VOICE = "Sulafat";
// ACCENT (Tony, Nov 5, 2026 — bundle 2026-11-05a): BRITISH, smooth and sophisticated (the Jarvis
// register), replacing the Oct 21 Spanish-Southern spec. Gemini prebuilt voices are neutral
// timbres with no accent identity, so the British identity rides on two levers: speechConfig
// languageCode "en-GB" (setup below; env VOICE_LANGUAGE_CODE still overrides) + the prompt's
// PERSONALITY AND SOUND steering. The timbre stays Sulafat (proven on calls). REVERT: restore
// the prompt's Southern persona block and drop the "en-GB" default back to env-only.
// VOICE SOURCE — the product-level setting this constant serves (Tony, Nov 2, 2026). Every company's
// Elevate gets its voice from ONE voice-source choice: kind "builtin" (a stock voice, named by
// `voice` — today's Sulafat) or kind "clone" (a voice cloned from a real person's own recordings,
// with that person's recorded consent — the clone feature Tony green-lit the same day). THIS engine
// (Gemini Live) can only speak built-in voices, so on this adapter the kind is always "builtin";
// the "clone" kind resolves in the ElevenLabs voice layer, where cloning actually exists, and lands
// here as the same one-setting shape. Naming it now means the future swap touches this block only.
const VOICE_SOURCE = { kind: "builtin", voice: DEFAULT_VOICE };
const VOICES = ["Sulafat", "Gacrux", "Kore", "Puck", "Charon", "Fenrir", "Aoede", "Leda", "Orus", "Zephyr"];
// THINKING CONFIG (bundle 2026-11-06b — CORRECTS 2026-11-06b): the live model in use
// REJECTS any thinkingConfig in the setup message (close 1007 "Thinking budget is not
// supported for this model" — production proof Nov 6, 2026, session a032abda: three
// connect attempts died in under a second and the call fell to the transfer fallback).
// The 06a "cap at 0" sent the parameter unconditionally, which broke every call.
// RULE: thinkingConfig is added ONLY when VOICE_THINKING_BUDGET is explicitly set to a
// finite number; unset, the key is OMITTED entirely — the model's own default applies.
const DEFAULT_THINKING_BUDGET = 0;
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
  const seen = { top: {}, sc: {} }; let lastTextAt = 0, upPrev = 0, dnRest = [], callerBuf = "", agentBuf = "", n = 0, agentSpoke = false, turnChunks = 0;
  const flushCaller = function (ev) { if (callerBuf.trim()) ev.push({ kind: "caller_text", text: callerBuf.trim(), key: "c:" + (++n) }); callerBuf = ""; };
  // SENTENCE DEDUPE (bundle 2026-11-06b — the repeats defect, graded Nov 5, 2026: whole
  // sentences arriving twice back-to-back inside ONE model turn, e.g. the delivery-address
  // question x2). parse() used to forward every chunk unchecked, so a generation restart
  // (around a tool call or a bridge injection) replayed the pending sentence into both the
  // transcript and the bridge's record. The guard works on the sentence stream — the only
  // stream that HAS sentences: before her text is handed over, it is split into sentences
  // and any sentence whose normalized form (case, whitespace and punctuation ignored)
  // matches the immediately previous sentence OF THE SAME TURN is dropped. The tracker
  // resets when a turn ends (turnComplete / interrupted flush), so the same sentence in a
  // LATER turn — a legitimate re-ask — is never swallowed. A mid-turn rescue flush keeps
  // the tracker, because that turn is still in progress.
  let prevSentNorm = "";
  const normSent = function (s) { return String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(); };
  const dedupeAgentBuf = function () {
    if (!agentBuf) return;
    const segs = agentBuf.match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*)?\s*|[^.!?…]+$/g) || [agentBuf];
    let out = "";
    segs.forEach(function (seg) { const nz = normSent(seg); if (nz && nz === prevSentNorm) { seen.dedup = (seen.dedup || 0) + 1; return; } out += seg; if (nz) prevSentNorm = nz; });
    agentBuf = out;
  };
  // chunks = how much audio this line actually generated, so the bridge can tell a spoken line from a
  // text-only generation and can trim a cut-off line to what played (transcript fidelity, Oct 29, 2026).
  // The count is spent only when text is actually handed over: her transcription can lag her audio by a
  // message or two, and an interruption landing in that gap must not orphan the count from its line.
  const flushAgent = function (ev, rescue, endTurn) { dedupeAgentBuf(); if (agentBuf.trim()) { ev.push({ kind: "agent_text", text: agentBuf.trim(), key: "a:" + (++n), chunks: turnChunks, rescue: !!rescue }); turnChunks = 0; } agentBuf = ""; if (endTurn) prevSentNorm = ""; };
  return {
    name: "gemini-live", version: "2026-11-06b",
    setup: function (o) {
      const voice = VOICE_SOURCE.voice; // LOCKED: Elevate is always the same female voice (Sulafat — see VOICE_SOURCE above), on every call and every reconnect. No config, env or caller can change it.
      const decl = declarations(o.tools);
      const genCfg = { responseModalities: ["AUDIO"] };
      if (process.env.VOICE_THINKING_BUDGET !== undefined && process.env.VOICE_THINKING_BUDGET !== "" && Number.isFinite(Number(process.env.VOICE_THINKING_BUDGET))) genCfg.thinkingConfig = { thinkingBudget: Number(process.env.VOICE_THINKING_BUDGET) };
      genCfg.speechConfig = Object.assign({ voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }, { languageCode: process.env.VOICE_LANGUAGE_CODE || "en-GB" });
      return [{ setup: { model: "models/" + model, generationConfig: genCfg,
        systemInstruction: { parts: [{ text: o.instructions || "" }] }, tools: decl.length ? [{ functionDeclarations: decl }] : [],
        realtimeInputConfig: { automaticActivityDetection: process.env.VOICE_FAST_TURNS === "on" ? { startOfSpeechSensitivity: "START_SENSITIVITY_HIGH", endOfSpeechSensitivity: "END_SENSITIVITY_HIGH", prefixPaddingMs: 200, silenceDurationMs: o.silence_ms || Number(process.env.VOICE_SILENCE_MS) || 350 } : { startOfSpeechSensitivity: process.env.VOICE_START_SENS === "high" ? "START_SENSITIVITY_HIGH" : "START_SENSITIVITY_LOW", endOfSpeechSensitivity: "END_SENSITIVITY_LOW", prefixPaddingMs: 500, silenceDurationMs: o.silence_ms || 900 } },   // default turn-taking is noise-shy on purpose: LOW start sensitivity means a bang, a TV or a cough neither cuts her off nor makes her answer (Tony: "she hears any noise, she automatically talks"); a person actually speaking still interrupts at once. Nov 2, 2026 (cut-off tuning, Tony's confirmation call): prefix padding 300 -> 500 ms so MORE of the caller's first word survives the barge-in, and the end-of-turn silence 600 -> 900 ms so a caller who pauses mid-thought (an address, a date) is not answered over and then clipped — the two changes trade a touch of response latency for far fewer mid-sentence cut-offs. VOICE_START_SENS=high restores the old touchiness. Faster turn-taking only when VOICE_FAST_TURNS=on (it can cut a caller off mid-address)
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
    flush: function (idleMs) { if (idleMs && Date.now() - lastTextAt < idleMs) return []; const ev = []; flushCaller(ev); flushAgent(ev, true); return ev; },
    // Caller words ONLY, on a short fuse (Nov 4, 2026): a caller turn used to become visible to the
    // bridge — its watchdog, its goodbye detector, the transcript — only when the model next produced
    // an event or the 5 s rescue flush ran, so a caller's clear "that's correct" sat unheard for
    // ~8 s while every timer downstream waited on a turn it could not see (retest 2). The bridge now
    // polls this every second with a ~1.2 s fuse. It never touches the agent buffer: her held lines
    // keep their exact played/unplayed accounting via flush() and the turn events.
    flushCaller: function (idleMs) { if (idleMs && Date.now() - lastTextAt < idleMs) return []; const ev = []; flushCaller(ev); return ev; },
    // context only: added to the conversation WITHOUT asking the model to answer (turnComplete false), used for the language-lock reminder
    noteSilent: function (text) { return { clientContent: { turns: [{ role: "user", parts: [{ text: "[system reminder, do not reply to this] " + text }] }], turnComplete: false } }; },
    diag: function () { return JSON.parse(JSON.stringify(seen)); },   // which message types Gemini actually sent (proves whether transcripts were produced)
    truncate: null, // Gemini needs no "how much was heard" report after an interruption
    // Gemini -> events
    parse: function (m) {
      const ev = [];
      Object.keys(m || {}).forEach(function (k) { seen.top[k] = (seen.top[k] || 0) + 1; });
      if (m && m.serverContent) Object.keys(m.serverContent).forEach(function (k) { seen.sc[k] = (seen.sc[k] || 0) + 1; });
      if (m.setupComplete) ev.push({ kind: "ready" });
      const c = m.serverContent;
      if (c) {
        if (c.interrupted) { flushAgent(ev, false, true); ev.push({ kind: "interrupted" }); }
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
          if (out.length) { ev.push({ kind: "audio", payload: out.toString("base64") }); turnChunks++; }
        });
        if (c.turnComplete) { flushCaller(ev); flushAgent(ev, false, true); ev.push({ kind: "turn_done", spoke: agentSpoke }); agentSpoke = false; }
      }
      if (m.toolCall && m.toolCall.functionCalls) { flushCaller(ev); m.toolCall.functionCalls.forEach(function (f) { ev.push({ kind: "tool", id: f.id, name: f.name, args: f.args || {} }); }); }
      if (m.goAway) ev.push({ kind: "go_away", left: m.goAway.timeLeft });
      if (m.error) ev.push({ kind: "error", message: m.error.message || "error" });
      return ev;
    }
  };
}
module.exports = { name: "gemini-live", DEFAULT_MODEL, DEFAULT_VOICE, VOICE_SOURCE, VOICES, DEFAULT_THINKING_BUDGET, URL, headers, create, declarations, schema, mulawEnc, MU_DEC };
