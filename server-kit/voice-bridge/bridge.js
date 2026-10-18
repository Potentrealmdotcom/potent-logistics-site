// POTENT VOICE audio bridge: connects one phone call (Twilio Media Streams) to one real-time AI session (OpenAI Realtime), both as G.711 mu-law.
// It holds NO business data and NO rules. Every fact and action goes through the Netlify function "voice-tools", which re-checks everything.
// Dependencies are injected so the whole conversation flow is testable with fake sockets (tests/voicebridge.test.js).
function createBridge(deps) {
  const env = deps.env, W = deps.WebSocket, F = deps.fetch, log = deps.log || function () {};
  const AI = deps.ai || (function () { try { return require("./realtime"); } catch (e) { return require("../../netlify/functions/lib/voice/adapters/realtime"); } })();
  const SITE = String(env.SITE_URL || "").replace(/\/+$/, "");
  async function api(body, ms) {
    try {
      const r = await F(SITE + "/.netlify/functions/voice-tools", { method: "POST", headers: { Authorization: "Bearer " + env.VOICE_BRIDGE_SECRET, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms || 10000) });
      return { status: r.status, data: await r.json().catch(function () { return {}; }) };
    } catch (e) { return { status: 0, data: {}, error: e && e.message }; }
  }
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  function handle(tw) {
    let streamSid = null, ctx = null, ai = null, done = false, aiReady = false, buffered = [], lastItem = null, assistStart = null, mediaTs = 0, marks = 0, markQ = [], transferPending = false, transferred = false, startedAt = Date.now(), timers = [], nm = 0;
    const timer = function (fn, ms) { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const twSend = function (o) { if (tw.readyState === 1) tw.send(JSON.stringify(o)); };
    const aiSend = function (o) { if (ai && ai.readyState === 1) ai.send(JSON.stringify(o)); };
    const note = function (role, text, key) { if (ctx && text) api({ action: "transcript", session_id: ctx.session_id, role: role, text: text, key: key }, 8000); };
    const sysNote = function (text) { aiSend({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: "[system notice, not the caller] " + text }] } }); aiSend({ type: "response.create" }); };

    async function finish(reason, closeTwilio) {
      if (done) return; done = true; timers.forEach(clearTimeout);
      const secs = Math.round((Date.now() - startedAt) / 1000);
      if (ctx) await api({ action: "end", session_id: ctx.session_id, reason: reason, seconds: secs }, 8000);
      else if (reason !== "caller_hangup") await api({ action: "health", provider: "bridge", kind: "call_setup_failed", ok: false, detail: reason }, 5000);
      try { if (ai) ai.close(); } catch (e) { /* ignore */ }
      if (closeTwilio) { try { tw.close(); } catch (e) { /* ignore */ } }
      log("call finished", reason, secs);
    }
    const startTimeout = timer(function () { if (!ctx) finish("no_start_message", true); }, 8000);

    async function begin(token) {
      const c = await api({ action: "context", token: token }, 10000);
      if (c.status !== 200 || !c.data.session_id) { log("context refused", c.status, c.data && c.data.error); return finish("context_" + (c.status || "unreachable"), true); }
      ctx = c.data; clearTimeout(startTimeout);
      const connectTimer = timer(function () { finish("ai_connect_timeout", true); }, 8000);
      ai = new W(AI.URL(env.VOICE_AI_MODEL), { headers: { Authorization: "Bearer " + env.OPENAI_API_KEY } });
      ai.on("open", function () {
        clearTimeout(connectTimer);
        aiSend(AI.sessionUpdate({ instructions: ctx.instructions, tools: ctx.tools, voice: ctx.voice }));
        aiReady = true; buffered.forEach(function (b) { aiSend(AI.audioIn(b)); }); buffered = [];
        aiSend(AI.say(ctx.greeting));
        if (ctx.max_seconds) { timer(function () { sysNote("The maximum call time is almost reached. Wrap up politely within twenty seconds and offer a callback if anything is unfinished."); }, Math.max(1000, (ctx.max_seconds - 30) * 1000)); timer(function () { finish("max_duration", true); }, ctx.max_seconds * 1000); }
      });
      ai.on("message", function (raw) { let m; try { m = JSON.parse(raw.toString()); } catch (e) { return; } onAi(m); });
      ai.on("error", function (e) { log("ai error", e && e.message); finish("ai_error", true); });
      ai.on("close", function () { if (!done) finish("ai_closed", true); });
    }

    function onAi(m) {
      const t = m.type;
      if (AI.isAudioDelta(t)) {
        if (!streamSid || !m.delta) return;
        if (lastItem !== m.item_id) { lastItem = m.item_id; assistStart = mediaTs; }
        twSend({ event: "media", streamSid: streamSid, media: { payload: m.delta } });
        const name = "m" + (++marks); markQ.push(name); twSend({ event: "mark", streamSid: streamSid, mark: { name: name } });
      } else if (t === "input_audio_buffer.speech_started") {
        if (markQ.length && lastItem) { // the caller talked over the assistant: stop its audio on the phone and tell the AI how much was actually heard
          twSend({ event: "clear", streamSid: streamSid }); aiSend(AI.truncate(lastItem, mediaTs - assistStart)); markQ = []; lastItem = null; assistStart = null;
        }
      } else if (t === "conversation.item.input_audio_transcription.completed") note("caller", m.transcript, "c:" + m.item_id);
      else if (AI.isAgentText(t)) note("agent", m.transcript, "a:" + (m.item_id || m.response_id));
      else if (t === "response.function_call_arguments.done") runTool(m);
      else if (t === "response.done") { if (transferPending) { transferPending = false; doTransfer(); } }
      else if (t === "error") { log("ai reported error", m.error && m.error.message); }
    }

    async function runTool(m) {
      let args = {}; try { args = JSON.parse(m.arguments || "{}"); } catch (e) { args = null; }
      let result;
      if (args === null) result = { ok: false, error: "bad_arguments" };
      else { const r = await api({ action: "tool", session_id: ctx.session_id, name: m.name, args: args, call_key: m.call_id }, 15000); result = (r.data && r.data.result) || { ok: false, error: "tool_unreachable", say: "The system did not answer. Offer a callback; do not guess." }; if (m.name === "request_human_handoff" && result.transfer_possible) transferPending = true; }
      AI.toolResult(m.call_id, result).forEach(aiSend);
    }
    async function doTransfer() {
      for (let i = 0; i < 20 && markQ.length; i++) await sleep(200);            // let the "connecting you" sentence finish playing
      const r = await api({ action: "transfer", session_id: ctx.session_id }, 10000);
      if (r.data && r.data.ok) transferred = true; else sysNote("The transfer could not be completed (" + ((r.data && r.data.error) || "no answer from the system") + "). Tell the caller honestly that no one could be reached, and offer a callback with create_callback_task.");
      // on success the phone company moves the call; the stream ends and finish() runs from the stop event
    }

    tw.on("message", function (raw) {
      let m; try { m = JSON.parse(raw.toString()); } catch (e) { return; }
      if (m.event === "start") { streamSid = m.start && m.start.streamSid; const tok = m.start && m.start.customParameters && m.start.customParameters.token; if (!tok) return finish("no_token", true); begin(tok); }
      else if (m.event === "media" && m.media && (!m.media.track || m.media.track === "inbound")) { mediaTs = Number(m.media.timestamp) || mediaTs; if (aiReady) aiSend(AI.audioIn(m.media.payload)); else if (buffered.length < 200) buffered.push(m.media.payload); }
      else if (m.event === "mark") markQ.shift();
      else if (m.event === "stop") finish(transferred ? "transferred" : "caller_hangup", false);
    });
    tw.on("close", function () { finish("twilio_closed", false); });
    tw.on("error", function () { finish("twilio_error", false); });
  }
  return { handle: handle, api: api };
}
module.exports = { createBridge };
