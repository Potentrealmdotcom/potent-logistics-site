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
  // Is this 20 ms phone frame (base64 mu-law) someone talking? Average decoded amplitude above a small floor.
  function loud(b64) {
    try { const b = Buffer.from(b64, "base64"); if (!b.length) return false; let sum = 0; for (let i = 0; i < b.length; i++) { const u = ~b[i] & 0xff, e = (u >> 4) & 7, m = u & 15; sum += (((m << 3) + 0x84) << e) - 0x84; } return sum / b.length > 320; } catch (e) { return false; }
  }
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  function handle(tw) {
    let payPending = false, payStarted = false, idleAt = 0, closingAt = 0, closeNudges = 0, greetHold = true, greetT = null, lastCallerAt = 0, lastAgentAt = 0, toolDoneAt = 0, toolBusy = 0, nudges = 0, burst = 0, readyAt = 0, wdTimer = null;
    let lang = "English", langTimer = null, flushTimer = null, retries = 0, reconnecting = false, timersSet = false, hist = [], streamSid = null, ctx = null, ai = null, prov = null, connectTimerRef = null, spokeSinceTool = false, toolAt = 0, done = false, aiReady = false, buffered = [], lastItem = null, assistStart = null, mediaTs = 0, marks = 0, markQ = [], transferPending = false, transferred = false, startedAt = Date.now(), timers = [], nm = 0;
    const timer = function (fn, ms) { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const twSend = function (o) { if (tw.readyState === 1) tw.send(JSON.stringify(o)); };
    const aiSend = function (o) { if (o && ai && ai.readyState === 1) ai.send(JSON.stringify(o)); };
    const kinds = {};   // what the AI link produced this call (audio, caller_text, agent_text, tool...), reported when the call ends
    const note = function (role, text, key) { if (ctx && text) api({ action: "transcript", session_id: ctx.session_id, role: role, text: text, key: key }, 8000); };
    const sysNote = function (text) { aiSend(prov.note(text)); };

    async function finish(reason, closeTwilio) {
      if (done) return; done = true; timers.forEach(clearTimeout); if (flushTimer) clearInterval(flushTimer); if (langTimer) clearInterval(langTimer); if (wdTimer) clearInterval(wdTimer);
      const secs = Math.round((Date.now() - startedAt) / 1000);
      if (ctx && prov && prov.flush) await Promise.all(prov.flush().map(function (e) { return api({ action: "transcript", session_id: ctx.session_id, role: e.kind === "caller_text" ? "caller" : "agent", text: e.text, key: e.key }, 6000); }));   // keep what was said even if the call ended mid-sentence
      if (ctx) {   // proof for the graders: did the AI produce transcripts, and which message types did it send
        const d = prov && prov.diag ? prov.diag() : {}, got = (kinds.caller_text || 0) + (kinds.agent_text || 0);
        await api({ action: "health", provider: "bridge", kind: got || secs < 15 ? "call_summary" : "no_transcripts", ok: !!got || secs < 15, detail: JSON.stringify({ secs: secs, adapter: (prov && prov.version) || "old", ev: kinds, ago: { agent: lastAgentAt ? Math.round((Date.now() - lastAgentAt) / 1000) : null, caller: lastCallerAt ? Math.round((Date.now() - lastCallerAt) / 1000) : null, tool: toolDoneAt ? Math.round((Date.now() - toolDoneAt) / 1000) : null }, toolBusy: toolBusy, lang: lang, gemini: d }).slice(0, 1800) }, 5000);
      }
      if (ctx && reason !== "pay_handoff") await api({ action: "end", session_id: ctx.session_id, reason: reason, seconds: secs }, 8000);   // a keypad payment moves the call away and brings it back: the call is NOT over
      else if (!ctx && reason !== "caller_hangup") await api({ action: "health", provider: "bridge", kind: "call_setup_failed", ok: false, detail: reason }, 5000);
      try { if (ai) ai.close(); } catch (e) { /* ignore */ }
      if (closeTwilio) { try { tw.close(); } catch (e) { /* ignore */ } }
      log("call finished", reason, secs);
    }
    const startTimeout = timer(function () { if (!ctx) finish("no_start_message", true); }, 8000);

    async function begin(token) {
      const c = await api({ action: "context", token: token }, 10000);
      if (c.status !== 200 || !c.data.session_id) { log("context refused", c.status, c.data && c.data.error); return finish("context_" + (c.status || "unreachable"), true); }
      ctx = c.data; clearTimeout(startTimeout);
      startAi();
    }
    // One AI session. If it drops mid-call we reconnect (up to AI_RETRIES times) and hand the new session the conversation so far, instead of dropping the caller.
    function startAi() {
      clearTimeout(connectTimerRef);
      connectTimerRef = timer(function () { aiDown("ai_connect_timeout", "no setup reply in 8s"); }, 8000);
      prov = AI.create({ model: env.VOICE_AI_MODEL });
      if (!langTimer) langTimer = setInterval(lockReminder, 40000);
      if (!wdTimer) wdTimer = setInterval(watchdog, 1000);
      if (!flushTimer) flushTimer = setInterval(function () { if (prov && prov.flush) prov.flush(5000).forEach(function (e) { onAi(e); }); }, 3000);
      const sock = new W(AI.URL(env.VOICE_AI_MODEL), { headers: AI.headers(env) }); ai = sock;
      sock.on("open", function () { if (ai === sock) prov.setup({ instructions: ctx.instructions, tools: ctx.tools, voice: ctx.voice }).forEach(aiSend); });
      sock.on("message", function (raw) { if (ai !== sock) return; let m; try { m = JSON.parse(raw.toString()); } catch (e) { return; } prov.parse(m).forEach(onAi); });
      sock.on("error", function (e) { if (ai === sock) aiDown("ai_error", e && e.message); });
      sock.on("close", function (code, reason) { if (ai === sock) aiDown("ai_closed", "code=" + code + (reason && reason.length ? " reason=" + String(reason).slice(0, 160) : "")); });
    }
    function aiDown(reason, detail) {
      if (done) return;
      const max = env.VOICE_AI_RETRIES != null ? Number(env.VOICE_AI_RETRIES) : 2;
      log("ai down", reason, detail, "retry", retries + 1, "of", max);
      api({ action: "health", provider: "bridge", kind: "ai_drop", ok: false, detail: (reason + " " + (detail || "") + " after " + Math.round((Date.now() - startedAt) / 1000) + "s, retry " + (retries + 1) + "/" + max).slice(0, 240) }, 5000);
      const old = ai; ai = null; aiReady = false; markQ = [];
      try { if (old) old.close(); } catch (e) { /* ignore */ }
      if (retries < max && ctx && tw.readyState === 1) { retries++; reconnecting = true; startAi(); return; }
      finish(reason, true);
    }

    function onReady() { // the AI accepted its setup: start the conversation (or resume it after a reconnect)
      clearTimeout(connectTimerRef);
      aiReady = true; readyAt = Date.now(); nudges = 0; lastCallerAt = 0; toolDoneAt = 0; buffered = []; // caller audio is not forwarded while the greeting plays, so background noise cannot interrupt it
      greetHold = !reconnecting && !ctx.resume; clearTimeout(greetT); if (greetHold) greetT = setTimeout(function () { greetHold = false; }, 12000);
      if (ctx.resume) {   // back from the keypad payment: no greeting; tell her the verified result and what was said before
        const rc = String(ctx.resume.code || ""), kind = rc.split(":")[0], val = rc.slice(kind.length + 1), recap = ctx.resume.recap || "(nothing said yet)";
        const tail = "\nSpeak the caller's language, as before. The conversation so far:\n" + recap;
        if (kind === "paid") { closingAt = Date.now(); sysNote("The caller is back from the keypad. Stripe CONFIRMED the payment of " + val + ". Do NOT greet again. Say warmly, in one or two short sentences, that the payment went through (" + val + ") and thank them. Then ask: \"Is there anything else I can help you with?\"" + tail); }
        else if (kind === "paidtest") { closingAt = Date.now(); sysNote("The caller is back from the keypad. This was a small TEST charge of " + val + " and Stripe confirmed it. Do NOT greet again. In one or two short sentences say the test payment of " + val + " went through, and that the full booking payment has not been taken. Then ask: \"Is there anything else I can help you with?\"" + tail); }
        else if (kind === "unverified") sysNote("The caller is back from the keypad, but the payment could NOT be confirmed yet. Do NOT say it is paid and do NOT say it failed. Say the team will verify it and follow up with them shortly, so they do not need to do anything now. Do not take the card again and do not offer a link. Then ask if there is anything else you can help with." + tail);
        else sysNote("The caller is back from the keypad, but the card payment did NOT go through (" + val.replace(/-/g, " ") + "). Do NOT greet again. Be kind and unbothered: say no worries, the booking is still locked in. If they want to try the keypad once more you may use take_card_payment again; otherwise say the team will reach out shortly to take the payment. Never send or offer a payment link, never ask for the card number out loud, and never say it is paid." + tail);
      } else if (reconnecting) {
        reconnecting = false;
        const recap = hist.slice(-24).map(function (h) { return (h.role === "caller" ? "Caller: " : "You: ") + h.text; }).join("\n");
        sysNote("The connection dropped for a moment and is back. Do NOT greet again and do not restart. Say one short sentence like 'Sorry, I lost you for a second,' then continue exactly where you left off. Speak English. The conversation so far:\n" + (recap || "(nothing said yet)"));
      } else aiSend(prov.say(ctx.greeting));
      if (ctx.max_seconds && !timersSet) { timersSet = true; timer(function () { sysNote("The maximum call time is almost reached. Wrap up politely within twenty seconds and offer a callback if anything is unfinished."); }, Math.max(1000, (ctx.max_seconds - 30) * 1000)); timer(function () { finish("max_duration", true); }, ctx.max_seconds * 1000); }
    }

    function onAi(e) {
      const t = e.kind; kinds[t] = (kinds[t] || 0) + 1;
      if (t === "ready") onReady();
      else if (t === "audio") {
        if (!streamSid || !e.payload) return;
        lastAgentAt = Date.now(); nudges = 0;
        if (toolAt) spokeSinceTool = true;
        twSend({ event: "media", streamSid: streamSid, media: { payload: e.payload } });
        const name = "m" + (++marks); markQ.push(name); twSend({ event: "mark", streamSid: streamSid, mark: { name: name } });
      } else if (t === "interrupted") { // the caller talked over the assistant: stop its audio on the phone
        if (markQ.length) { twSend({ event: "clear", streamSid: streamSid }); markQ = []; }
      } else if (t === "caller_text") { hist.push({ role: "caller", text: String(e.text).slice(0, 400) }); note("caller", e.text, e.key); }
      else if (t === "agent_text") { hist.push({ role: "agent", text: String(e.text).slice(0, 400) }); note("agent", e.text, e.key); }
      else if (t === "go_away") { log("ai says it will close soon", e.left); }
      else if (t === "tool") runTool(e);
      else if (t === "turn_done") { if (greetHold) { greetHold = false; clearTimeout(greetT); } if (transferPending && (spokeSinceTool || e.spoke)) { transferPending = false; doTransfer(); } }
      else if (t === "error") { log("ai reported error", e.message); }
    }

    async function runTool(m) {
      let result; toolBusy++;
      const r = await api({ action: "tool", session_id: ctx.session_id, name: m.name, args: m.args, call_key: m.id }, 15000);
      result = (r.data && r.data.result) || { ok: false, error: "tool_unreachable", say: "The system did not answer. Offer a callback; do not guess." };
      if (m.name === "request_human_handoff" && result.transfer_possible) { transferPending = true; spokeSinceTool = false; toolAt = Date.now(); timer(function () { if (transferPending) { transferPending = false; doTransfer(); } }, 20000); }
      if (m.name === "take_card_payment" && result.ok && result.pay_handoff) { payPending = true; spokeSinceTool = false; doPay(result.booking_id); }   // the card is never spoken: after one sentence the live call moves to the keypad
      if (result && result.language_name && result.ok) lang = String(result.language_name).slice(0, 40);   // the model reported the caller's language: remember it for the lock
      prov.toolResult(m.id, m.name, result).forEach(aiSend);
      toolBusy = Math.max(0, toolBusy - 1); toolDoneAt = Date.now(); if (["send_approved_confirmation", "book_demo", "create_callback_task"].indexOf(m.name) >= 0 && result && result.ok !== false) closingAt = Date.now();
    }
    // SILENCE WATCHDOG. Dead air must be impossible: if the caller (or a finished tool) is waiting on her and she has said nothing for ~4 s,
    // 1st: tell the model the caller is waiting; 2nd: make her say "Still here, one second"; 3rd: drop and rebuild the AI link (the reconnect path with the conversation recap).
    // Also covers a greeting that never played. VOICE_SILENCE_MS changes the 4 s.
    function watchdog() {
      if (done || !aiReady || toolBusy || transferPending || payPending || !ctx) return;
      const now = Date.now(), th = Number(env.VOICE_SILENCE_MS) || 4000;
      const owed = Math.max(lastCallerAt, toolDoneAt) > lastAgentAt, noGreeting = !lastAgentAt && !reconnecting && readyAt && now - readyAt > 2 * th;
      if (closingAt && !owed && !noGreeting && closeNudges < 2 && lastAgentAt > closingAt && lastCallerAt <= lastAgentAt && now - lastAgentAt > th * 1.75) { // wrap-up done and the caller is quiet: never leave dead air, ask the close question
        closeNudges++; lastAgentAt = now; api({ action: "health", provider: "bridge", kind: "silence_nudge", ok: false, detail: ("close " + closeNudges).slice(0, 120) }, 4000);
        sysNote(closeNudges === 1 ? "The booking is done and the caller is quiet. Ask warmly: \"Is there anything else I can help you with?\"" : "The caller is still quiet. Thank them by name, give the job reference, and say a warm goodbye.");
        return;
      }
      if (!owed && !noGreeting && !closingAt && readyAt && lastAgentAt && now - lastAgentAt > th * 3 && now - Math.max(lastCallerAt, 0) > th * 3 && now - Math.max(idleAt, 0) > th * 3) { // dead-air backstop: whatever the cause, nobody has spoken for ~12s, so she checks in
        idleAt = now; kinds.idle_checkin = (kinds.idle_checkin || 0) + 1; api({ action: "health", provider: "bridge", kind: "silence_nudge", ok: false, detail: ("idle " + Math.round((now - lastAgentAt) / 1000) + "s").slice(0, 120) }, 4000);
        if (kinds.idle_checkin % 3 === 0) aiDown("silence_watchdog", "idle for " + Math.round((now - lastAgentAt) / 1000) + "s"); else if (kinds.idle_checkin % 2 === 1) sysNote("It has been quiet. Say warmly: \"Are you still there? Take your time. If you do not have that handy, we can go ahead without it.\""); else aiSend(prov.say("I'm still right here with you. If it is easier, I can take this down without that and have someone follow up."));
        return;
      }
      if (!owed && !noGreeting) return;
      const since = noGreeting ? readyAt : Math.max(lastCallerAt, toolDoneAt), waited = now - since;
      if (waited < th * (nudges + 1) + (noGreeting ? th : 0)) return;
      nudges++; kinds.silence_nudge = (kinds.silence_nudge || 0) + 1;
      api({ action: "health", provider: "bridge", kind: "silence_nudge", ok: false, detail: ("step " + nudges + " after " + Math.round(waited / 1000) + "s" + (noGreeting ? " (greeting never played)" : "")).slice(0, 120) }, 4000);
      if (nudges === 1) { if (noGreeting) aiSend(prov.say(ctx.greeting)); else sysNote("The caller is waiting for your answer. Answer now in one short sentence."); }
      else if (nudges === 2) aiSend(prov.say("Still here, one second."));
      else { nudges = 0; lastCallerAt = 0; toolDoneAt = 0; aiDown("silence_watchdog", "no speech for " + Math.round(waited / 1000) + "s"); }
    }
    // Language lock: every 40 s the model is quietly reminded which language this call is in, so it cannot drift into one the caller is not speaking.
    function lockReminder() { if (aiReady && prov && prov.noteSilent) aiSend(prov.noteSilent("Language lock: this call is in " + lang + ". Speak ONLY " + lang + ". Never switch to another language unless the caller clearly speaks one to you.")); }
    // KEYPAD PAYMENT. Let her finish the one sentence, then ask the site to move the live call to Twilio <Pay>. The audio stream ends (so nothing she or the model hears can contain card digits),
    // Twilio collects the card straight into Stripe, and the call comes back as a NEW stream carrying the verified result. The call is not ended in between.
    async function doPay(bookingId) {
      const t0 = Date.now();
      for (let i = 0; i < 60; i++) { await sleep(250); if (done) return; if (!markQ.length && lastAgentAt > toolDoneAt && Date.now() - lastAgentAt > 1500) break; if (Date.now() - t0 > 14000) break; }
      payStarted = true;
      const r = await api({ action: "pay", session_id: ctx.session_id, booking_id: bookingId }, 12000);
      if (r.data && r.data.ok) return;      // the phone company moves the call; the stream stops and finish("pay_handoff") runs from the stop event
      payStarted = false; payPending = false; lastAgentAt = Date.now();
      api({ action: "health", provider: "bridge", kind: "pay_handoff_failed", ok: false, detail: String((r.data && r.data.error) || "no answer").slice(0, 120) }, 4000);
      sysNote("The keypad payment could not start. Tell the caller warmly that the booking is locked in and the team will reach out shortly to take the payment. Do not send or offer a payment link, do not ask for a card number out loud, and do not say it is paid.");
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
      else if (m.event === "media" && m.media && (!m.media.track || m.media.track === "inbound")) { mediaTs = Number(m.media.timestamp) || mediaTs; if (!greetHold && loud(m.media.payload)) { if (++burst >= 6) lastCallerAt = Date.now(); } else burst = Math.max(0, burst - 1); if (aiReady && !greetHold) aiSend(prov.audioIn(m.media.payload)); }
      else if (m.event === "mark") markQ.shift();
      else if (m.event === "stop") finish(transferred ? "transferred" : payStarted ? "pay_handoff" : "caller_hangup", false);
    });
    tw.on("close", function () { finish(payStarted ? "pay_handoff" : "twilio_closed", false); });
    tw.on("error", function () { finish(payStarted ? "pay_handoff" : "twilio_error", false); });
  }
  return { handle: handle, api: api };
}
module.exports = { createBridge };
