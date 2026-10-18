// Real-time AI adapter: OpenAI Realtime API over WebSocket, G.711 mu-law (what phone audio already is, so no transcoding).
// This file only BUILDS messages and reads events; the socket itself lives in server-kit/voice-bridge so a different provider can replace it.
const URL = function (model) { return "wss://api.openai.com/v1/realtime?model=" + encodeURIComponent(model || process.env.VOICE_AI_MODEL || "gpt-realtime-2.1"); };
function sessionUpdate(o) {
  return { type: "session.update", session: { type: "realtime", output_modalities: ["audio"], instructions: o.instructions, tools: o.tools, tool_choice: "auto",
    audio: { input: { format: { type: "audio/pcmu" }, turn_detection: { type: "server_vad", threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: o.silence_ms || 600, create_response: true, interrupt_response: true }, transcription: { model: "gpt-4o-mini-transcribe" } },
      output: { format: { type: "audio/pcmu" }, voice: o.voice || "marin" } } } };
}
const audioIn = function (b64) { return { type: "input_audio_buffer.append", audio: b64 }; };
const toolResult = function (callId, out) { return [{ type: "conversation.item.create", item: { type: "function_call_output", call_id: callId, output: JSON.stringify(out) } }, { type: "response.create" }]; };
const truncate = function (itemId, ms) { return { type: "conversation.item.truncate", item_id: itemId, content_index: 0, audio_end_ms: Math.max(0, Math.floor(ms)) }; };
const say = function (text) { return { type: "response.create", response: { instructions: "Say exactly this to the caller, then wait: " + text } }; };
// Event names differ between API versions; accept both.
const isAudioDelta = function (t) { return t === "response.output_audio.delta" || t === "response.audio.delta"; };
const isAgentText = function (t) { return t === "response.output_audio_transcript.done" || t === "response.audio_transcript.done"; };
module.exports = { name: "openai-realtime", URL, sessionUpdate, audioIn, toolResult, truncate, say, isAudioDelta, isAgentText };
