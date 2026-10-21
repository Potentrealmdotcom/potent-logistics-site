// POTENT VOICE audio bridge: connects one phone call (Twilio Media Streams, G.711 mu-law) to one real-time AI session (Google Gemini Live; the adapter converts the audio).
// It holds NO business data and NO rules. Every fact and action goes through the Netlify function "voice-tools", which re-checks everything.
// Dependencies are injected so the whole conversation flow is testable with fake sockets (tests/voicebridge.test.js).
function createBridge(deps) {
  const env = deps.env, W = deps.WebSocket, F = deps.fetch, log = deps.log || function () {};
  const AI = deps.ai || (function () { try { return require("./gemini-live"); } catch (e) { return require("../../netlify/functions/lib/voice/adapters/gemini-live"); } })();
  const SITE = String(env.SITE_URL || "").replace(/\/+$/, "");
  async function api(body, ms) {
    try {
      const r = await F(SITE + "/.netlify/functions/voice-tools", { method: "POST", headers: { Authorization: "Bearer " + env.VOICE_BRIDGE_SECRET, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms || 10000) });
      return { status: r.status, data: await r.json().catch(function () { return {}; }) };
    } catch (e) { return { status: 0, data: {}, error: e && e.message }; }
  }
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  function handle(tw) {
    let streamSid = null, ctx = null, ai = null, prov = null, connectTimerRef = null, spokeSinceTool = false, toolAt = 0, done = false, aiReady = false, buffered = [], lastItem = null, assistStart = null, mediaTs = 0, marks = 0, markQ = [], transferPending = false, transferred = false, startedAt = Date.now(), timers = [], nm = 0;
    const timer = function (fn, ms) { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const twSend = function (o) { if (tw.readyState === 1) tw.send(JSON.stringify(o)); };
    const aiSend = function (o) { if (o && ai && ai.readyState === 1) ai.send(JSON.stringify(o)); };
    const note = function (role, text, key) { if (ctx && text) api({ action: "transcript", session_id: ctx.session_id, role: role, text: text, key: key }, 8000); };
    const sysNote = function (text) { aiSend(prov.note(text)); };

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
      prov = AI.create({ model: env.VOICE_AI_MODEL });
      ai = new W(AI.URL(env.VOICE_AI_MODEL), { headers: AI.headers(env) });
      ai.on("open", function () { aiSend0(prov.setup({ instructions: ctx.instructions, tools: ctx.tools, voice: ctx.voice })); });
      ai.on("message", function (raw) { let m; try { m = JSON.parse(raw.toString()); } catch (e) { return; } prov.parse(m).forEach(onAi); });
      ai.on("error", function (e) { log("ai error", e && e.message); finish("ai_error", true); });
      ai.on("close", function () { if (!done) finish("ai_closed", true); });
      function aiSend0(list) { list.forEach(aiSend); }
      connectTimerRef = connectTimer;
    }

    function onReady() { // the AI accepted its setup: start the conversation
      clearTimeout(connectTimerRef);
      aiReady = true; buffered.forEach(function (b) { aiSend(prov.audioIn(b)); }); buffered = [];
      aiSend(prov.say(ctx.greeting));
      if (ctx.max_seconds) { timer(function () { sysNote("The maximum call time is almost reached. Wrap up politely within twenty seconds and offer a callback if anything is unfinished."); }, Math.max(1000, (ctx.max_seconds - 30) * 1000)); timer(function () { finish("max_duration", true); }, ctx.max_seconds * 1000); }
    }

    function onAi(e) {
      const t = e.kind;
      if (t === "ready") onReady();
      else if (t === "audio") {
        if (!streamSid || !e.payload) return;
        if (toolAt) spokeSinceTool = true;
        twSend({ event: "media", streamSid: streamSid, media: { payload: e.payload } });
        const name = "m" + (++marks); markQ.push(name); twSend({ event: "mark", streamSid: streamSid, mark: { name: name } });
      } else if (t === "interrupted") { // the caller talked over the assistant: stop its audio on the phone
        if (markQ.length) { twSend({ event: "clear", streamSid: streamSid }); markQ = []; }
      } else if (t === "caller_text") note("caller", e.text, e.key);
      else if (t === "agent_text") note("agent", e.text, e.key);
      else if (t === "tool") runTool(e);
      else if (t === "turn_done") { if (transferPending && (spokeSinceTool || e.spoke)) { transferPending = false; doTransfer(); } }
      else if (t === "error") { log("ai reported error", e.message); }
    }

    async function runTool(m) {
      let result;
      const r = await api({ action: "tool", session_id: ctx.session_id, name: m.name, args: m.args, call_key: m.id }, 15000);
      result = (r.data && r.data.result) || { ok: false, error: "tool_unreachable", say: "The system did not answer. Offer a callback; do not guess." };
      if (m.name === "request_human_handoff" && result.transfer_possible) { transferPending = true; spokeSinceTool = false; toolAt = Date.now(); timer(function () { if (transferPending) { transferPending = false; doTransfer(); } }, 20000); }
      prov.toolResult(m.id, m.name, result).forEach(aiSend);
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
      else if (m.event === "media" && m.media && (!m.media.track || m.media.track === "inbound")) { mediaTs = Number(m.media.timestamp) || mediaTs; if (aiReady) aiSend(prov.audioIn(m.media.payload)); else if (buffered.length < 200) buffered.push(m.media.payload); }
      else if (m.event === "mark") markQ.shift();
      else if (m.event === "stop") finish(transferred ? "transferred" : "caller_hangup", false);
    });
    tw.on("close", function () { finish("twilio_closed", false); });
    tw.on("error", function () { finish("twilio_error", false); });
  }
  return { handle: handle, api: api };
}
module.exports = { createBridge };
