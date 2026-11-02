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
  // HOLD-ON LINES WHILE A TOOL RUNS — THE BRIDGE IS THE ONLY OWNER (Tony, Nov 2, 2026, two rulings the
  // same day: the morning call first went totally dead when a tool hung after her own hold-on fragment,
  // so the bridge took over the caller's ear during tools; the confirmation call then proved the cost of
  // TWO owners — the prompt still REQUIRED her to speak a hold-on before every slow step while the bridge
  // spoke its own, and at lock-in (three slow steps back to back) the caller heard two near-identical
  // "One second — I'm checking that for you" lines ~4 s apart, the second cut off mid-word by the payment
  // result). The split is now total: her prompt forbids her to say ANY hold-on around a tool (she runs it
  // in silence and speaks the result the moment it lands); the bridge alone speaks fillers, and only here:
  // past TOOL_HOLD_MS of tool time with no agent audio, ONE short line; past TOOL_HOLD2_MS, at most one
  // more, for that same tool only. And because a booking runs several slow steps in a row, a filler also
  // starts a quiet period (TOOL_HOLD_GAP_MS): no new step may speak another filler inside it — a chain of
  // steps shares one voice, never a stack of hold-ons. If the tool call FAILS (timeout / unreachable /
  // no result), the bridge speaks a recovery line itself and still hands the error result to the model
  // like any other result — recovery never depends on the model choosing to resume. Tenant-generic
  // wording only: the bridge holds no business content.
  const TOOL_HOLD_MS = Math.max(20, Number(env.VOICE_TOOL_HOLD_MS) || 2500);
  const TOOL_HOLD2_MS = Math.max(TOOL_HOLD_MS + 100, Number(env.VOICE_TOOL_HOLD2_MS) || 10000);
  const TOOL_HOLD_GAP_MS = Math.max(0, Number(env.VOICE_TOOL_HOLD_GAP_MS) != null && env.VOICE_TOOL_HOLD_GAP_MS !== "" ? Number(env.VOICE_TOOL_HOLD_GAP_MS) : 12000);
  const HOLD_LINES = ["One second — I'm checking that for you.", "Just a moment — still checking on that for you.", "Hang tight one more second — I'm pulling that up for you."];
  const HOLD_RECOVERY = "I'm so sorry — that check is taking longer than it should on my end. Let's keep right on going; I have everything you've told me so far.";

  // AMBIENCE — THE ROOM SHE SITS IN (Tony, Nov 2, 2026; restored and generalized). The Bland benchmark
  // call sounded real partly because the room was in it: whatever trade the company is in, she should
  // sound like she is sitting in it. A quiet workplace bed is mixed UNDER her voice on its way to the
  // phone for the whole call — in the pauses too, not only while she talks. History: an office-only
  // version of this shipped Oct 22, 2026 and was switched off the same day (VOICE_AMBIENCE=off in the
  // deployment env); the mixing station below is that proven design, generalized from one office to a
  // library of rooms. Every bed is SYNTHESIZED right here from noise, murmur and room events — no audio
  // files, nothing bought, nothing licensed: free by construction.
  // WHICH ROOM: the site resolves the company's trade to a bed key at call setup (the industry->bed
  // map lives in netlify/functions/lib/voice/ambience.js — data-driven, one line per trade) and sends
  // ctx.ambience_bed; ctx.ambience="off" means NO room (the owner's own calls stay natural — Tony's
  // standing rule — and a company can switch its room off). VOICE_AMBIENCE is the deployment default
  // and the kill switch: "off" silences every room; a bed key names the default room; "on"/unset means
  // the dispatch office. VOICE_AMBIENCE_GAIN sets the level (default 0.4, clamped 0.01..0.6). If the
  // adapter's mu-law codec is missing, calls pass through untouched.
  const AMBIENCE_BEDS = {
    //            voices murmur rumble lp     tickEvery(samples)      tickAmp tickLen  event: {type,freq,every(samples),len,amp}   hum
    dispatch_office: { voices: 3, murmur: 5200, rumble: 2400, lp: 0.08, tick: [6000, 26000], tickAmp: 420, tickLen: 90, event: { type: "ring", every: [160000, 360000], len: 6000, amp: 1500 } },
    restaurant: { voices: 5, murmur: 6500, rumble: 1800, lp: 0.08, tick: [2000, 9000], tickAmp: 500, tickLen: 60 },
    auto_shop: { voices: 1, murmur: 2200, rumble: 3400, lp: 0.05, tick: [24000, 70000], tickAmp: 2600, tickLen: 500 },
    office_phones: { voices: 3, murmur: 4200, rumble: 1600, lp: 0.08, tick: [8000, 20000], tickAmp: 300, tickLen: 70, event: { type: "ring", every: [96000, 240000], len: 6000, amp: 1700 } },
    construction: { voices: 1, murmur: 1500, rumble: 3800, lp: 0.04, tick: [30000, 80000], tickAmp: 3200, tickLen: 1500 },
    salon: { voices: 2, murmur: 3200, rumble: 1200, lp: 0.08, tick: null, hum: 220 },
    retail: { voices: 3, murmur: 3800, rumble: 1500, lp: 0.08, tick: [12000, 30000], tickAmp: 300, tickLen: 70, event: { type: "beep", freq: 2000, every: [120000, 320000], len: 700, amp: 1300 } },
    clinic: { voices: 1, murmur: 1200, rumble: 700, lp: 0.08, tick: null, event: { type: "beep", freq: 880, every: [240000, 560000], len: 500, amp: 800 } },
    warehouse: { voices: 1, murmur: 1800, rumble: 3000, lp: 0.05, tick: [20000, 60000], tickAmp: 1500, tickLen: 300, event: { type: "beep", freq: 1200, every: [144000, 360000], len: 1000, amp: 1400 } },
    generic_office: { voices: 2, murmur: 3000, rumble: 1400, lp: 0.08, tick: [10000, 30000], tickAmp: 300, tickLen: 80 }
  };
  const bedCache = {};
  function synthBed(key) { // one seamless 24 s loop per room, generated once and cached: brown-noise rumble, filtered murmur "voices", ticks/clatter, and the room's signature event (a distant phone ring, a till beep)
    if (bedCache[key]) return bedCache[key];
    const p = AMBIENCE_BEDS[key]; if (!p) return null;
    const SR = 8000, LEN = SR * 24, buf = new Int16Array(LEN);
    let seed = 987654321 + key.length * 131; const rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    let brown = 0, lp = 0, tick = 4000, evt = p.event ? Math.floor(p.event.every[0] + rnd() * (p.event.every[1] - p.event.every[0])) : -1;
    const voices = []; for (let vi = 0; vi < p.voices; vi++) voices.push({ lp1: 0, lp2: 0, env: 0, target: 0, left: 0, f: 0.04 + rnd() * 0.11 });
    for (let i = 0; i < LEN; i++) {
      const w = rnd() * 2 - 1;
      brown = (brown + 0.02 * w) / 1.02; lp += p.lp * (brown * 3.5 - lp);
      let s = lp * p.rumble + (p.hum ? p.hum * Math.sin(i / (SR / 180) * 6.2832) : 0);
      for (let vi = 0; vi < voices.length; vi++) { const v = voices[vi], n = rnd() * 2 - 1;
        if (--v.left <= 0) { v.target = rnd() < 0.45 ? 0 : 0.35 + rnd() * 0.65; v.left = 500 + Math.floor(rnd() * 1100); }
        v.env += (v.target - v.env) * 0.004;
        v.lp1 += v.f * (n - v.lp1); v.lp2 += v.f * (v.lp1 - v.lp2);
        s += v.lp2 * v.env * p.murmur;
      }
      if (p.tick && --tick <= 0) { tick = Math.floor(p.tick[0] + rnd() * (p.tick[1] - p.tick[0])); for (let j = 0; j < p.tickLen && i + j < LEN; j++) buf[i + j] += Math.round((rnd() * 2 - 1) * p.tickAmp * (1 - j / p.tickLen)); }
      if (p.event && --evt <= 0) { evt = Math.floor(p.event.every[0] + rnd() * (p.event.every[1] - p.event.every[0])); const ev = p.event;
        for (let j = 0; j < ev.len && i + j < LEN; j++) { const ph = j / SR; const tone = ev.type === "ring" ? (Math.sin(ph * 440 * 6.2832) + Math.sin(ph * 480 * 6.2832)) / 2 : Math.sin(ph * (ev.freq || 1000) * 6.2832); buf[i + j] += Math.round(tone * ev.amp * Math.min(1, j / 300) * Math.min(1, (ev.len - j) / 600)); } }
      buf[i] += Math.max(-11000, Math.min(11000, Math.round(s)));
    }
    for (let i = 0; i < 800; i++) { const a = i / 800; buf[i] = Math.round(buf[i] * a + buf[LEN - 800 + i] * (1 - a)); }   // seamless loop seam
    let peak = 1; for (let i = 0; i < LEN; i++) { const a = Math.abs(buf[i]); if (a > peak) peak = a; }   // normalize to a known level; the gain decides how much rides under her voice
    const norm = 10000 / peak; for (let i = 0; i < LEN; i++) buf[i] = Math.round(buf[i] * norm);
    bedCache[key] = buf; return buf;
  }
  function ambienceBedKey(ctx) { // -> a bed key, or null when this call gets no room
    if (String(env.VOICE_AMBIENCE || "on") === "off") return null;   // deployment kill switch (the state the live server sits in today)
    if (!AI.MU_DEC || !AI.mulawEnc) return null;
    if (ctx && ctx.ambience === "off") return null;   // owner / personal calls stay natural
    const want = String((ctx && ctx.ambience_bed) || env.VOICE_AMBIENCE_BED || env.VOICE_AMBIENCE || "").toLowerCase().replace(/[^a-z_]/g, "");
    if (!want || want === "on") return "dispatch_office";   // nothing named anywhere: the dispatch office — this product's home trade (a deployment names its own default in VOICE_AMBIENCE)
    return AMBIENCE_BEDS[want] ? want : "generic_office";   // an unknown name: a plain working office, never the wrong trade's room
  }
  function ambienceStation(buf) { // one per call: her speech is queued, and a 20 ms pump mixes it over the bed — so the room is present for the whole call, in the pauses too, not only while she talks
    const gain = Math.min(0.6, Math.max(0.01, Number(env.VOICE_AMBIENCE_GAIN) || 0.4));
    let pos = Math.floor(Math.random() * buf.length), ramp = 0, q = [];
    return {
      push: function (b64) { try { const b = Buffer.from(b64, "base64"); for (let i = 0; i < b.length; i++) q.push(AI.MU_DEC[b[i]]); if (q.length > 24000) q.splice(0, q.length - 24000); } catch (e) { /* ignore */ } },
      clear: function () { q = []; },
      tick: function () { // one 20 ms frame out: queued speech (or silence) over the bed; reports whether the frame carried her voice
        const out = Buffer.alloc(160); let spoke = false;
        const n = Math.min(160, q.length), sp = n ? q.splice(0, n) : null;
        for (let i = 0; i < 160; i++) {
          if (ramp < 4000) ramp++;
          const amb = buf[pos]; pos = (pos + 1) % buf.length;
          const s = sp && i < n ? sp[i] : 0; if (s) spoke = true;
          const v = s + Math.round(amb * gain * (ramp / 4000));
          out[i] = AI.mulawEnc(v > 32767 ? 32767 : v < -32768 ? -32768 : v);
        }
        return { payload: out.toString("base64"), spoke: spoke };
      }
    };
  }

  function handle(tw) {
    let saidBye = false, agentEnd = false, payPending = false, payStarted = false, idleAt = 0, closingAt = 0, closeNudges = 0, deafStage = 0, deafAt = 0, greetHold = true, greetT = null, lastCallerAt = 0, lastCallerTextAt = 0, lastAgentAt = 0, toolDoneAt = 0, toolBusy = 0, nudges = 0, burst = 0, readyAt = 0, wdTimer = null;
    let lang = "English", langTimer = null, flushTimer = null, retries = 0, reconnecting = false, timersSet = false, hist = [], streamSid = null, ctx = null, ai = null, prov = null, connectTimerRef = null, spokeSinceTool = false, toolAt = 0, lastHoldAt = 0, done = false, aiReady = false, buffered = [], lastItem = null, assistStart = null, mediaTs = 0, marks = 0, markQ = [], transferPending = false, transferred = false, startedAt = Date.now(), timers = [], nm = 0, amb = null, pump = null;
    const timer = function (fn, ms) { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const twSend = function (o) { if (tw.readyState === 1) tw.send(JSON.stringify(o)); };
    const aiSend = function (o) { if (o && ai && ai.readyState === 1) ai.send(JSON.stringify(o)); };
    const kinds = {};   // what the AI link produced this call (audio, caller_text, agent_text, tool...), reported when the call ends
    // keys restart at 1 on every stream; after a keypad payment the SECOND stream of the same call reused them and the server dropped every line as a duplicate
    const nonce = Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), nk = function (k) { return k ? nonce + ":" + k : k; };
    const note = function (role, text, key) { if (ctx && text) api({ action: "transcript", session_id: ctx.session_id, role: role, text: text, key: nk(key) }, 8000); };
    const sysNote = function (text) { aiSend(prov.note(text)); };
    // TRANSCRIPT FIDELITY (Tony, Oct 29, 2026: "the transcripts need to match the recording word for word —
    // if it doesn't it isn't right"). Her lines are HELD until the turn's fate is known, because the AI's
    // transcription also covers words that were generated but never heard: a line with no audio behind it
    // (a text-only generation) is not recorded at all, and a line the caller talked over is recorded only
    // up to the part that actually played — Twilio's playback marks (markQ = sent but not yet played)
    // are the ground truth. The end-of-call rescue flush keeps its old keep-everything behaviour.
    let pendingAgent = null;
    const noteAgent = function (text, key) { if (/\b(goodbye|bye|have a (great|good|nice) (day|night|one)|take care)\b/i.test(String(text))) saidBye = true; hist.push({ role: "agent", text: String(text).slice(0, 400) }); note("agent", text, key); };
    const flushPendingAgent = function (cut) {
      if (!pendingAgent) return; const p = pendingAgent; pendingAgent = null;
      if (p.rescue) { noteAgent(p.text, p.key); return; }
      if (!p.chunks) return;   // no audio was generated for this line: it was never spoken, so it is not recorded
      if (!cut) { noteAgent(p.text, p.key); return; }
      const played = p.chunks - Math.min(markQ.length, p.chunks);
      if (played <= 0) return;   // cut off before any of it played: the caller heard none of it
      const keep = Math.floor(p.text.length * played / p.chunks); if (keep < 2) return;
      const cutText = p.text.slice(0, keep).replace(/\s+\S*$/, "").trim();
      if (cutText) noteAgent(cutText, p.key);
    };

    async function finish(reason, closeTwilio) {
      if (done) return; done = true; timers.forEach(clearTimeout); if (pump) clearInterval(pump); if (flushTimer) clearInterval(flushTimer); if (langTimer) clearInterval(langTimer); if (wdTimer) clearInterval(wdTimer);
      const secs = Math.round((Date.now() - startedAt) / 1000);
      flushPendingAgent(false);   // a held line from a finished turn is recorded before the rescue flush below
      if (ctx && prov && prov.flush) await Promise.all(prov.flush().map(function (e) { return api({ action: "transcript", session_id: ctx.session_id, role: e.kind === "caller_text" ? "caller" : "agent", text: e.text, key: nk(e.key) }, 6000); }));   // keep what was said even if the call ended mid-sentence
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
      if (done) return;   // the caller hung up while the context was fetched: never spin up the room or the AI on a dead call
      const bedKey = ambienceBedKey(ctx), bedBuf = bedKey ? synthBed(bedKey) : null;
      amb = bedBuf ? ambienceStation(bedBuf) : null;
      log("ambience", amb ? bedKey : "off");
      if (amb) pump = setInterval(function () {   // the room runs the whole call; her queued speech rides over it; a frame that carried her voice earns the playback mark her transcript trimming counts on
        if (done || !streamSid) return;
        const f = amb.tick();
        twSend({ event: "media", streamSid: streamSid, media: { payload: f.payload } });
        if (f.spoke) { const name = "m" + (++marks); markQ.push(name); twSend({ event: "mark", streamSid: streamSid, mark: { name: name } }); }
      }, 20);
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
      const old = ai; ai = null; aiReady = false; markQ = []; if (amb) amb.clear();
      try { if (old) old.close(); } catch (e) { /* ignore */ }
      if (retries < max && ctx && tw.readyState === 1) { retries++; reconnecting = true; startAi(); return; }
      finish(reason, true);
    }

    function onReady() { // the AI accepted its setup: start the conversation (or resume it after a reconnect)
      clearTimeout(connectTimerRef);
      aiReady = true; readyAt = Date.now(); nudges = 0; lastCallerAt = 0; lastCallerTextAt = 0; toolDoneAt = 0; buffered = []; // caller audio is not forwarded while the greeting plays, so background noise cannot interrupt it
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
      if (t !== "agent_text" && t !== "interrupted") flushPendingAgent(false);   // any other event settles the held line as fully spoken
      if (t === "ready") onReady();
      else if (t === "audio") {
        if (!streamSid || !e.payload) return;
        lastAgentAt = Date.now(); nudges = 0;
        if (toolAt) spokeSinceTool = true;
        if (amb) { amb.push(e.payload); return; }   // with a room live, her audio is queued and the pump mixes it over the bed (marks ride the pump's spoken frames)
        twSend({ event: "media", streamSid: streamSid, media: { payload: e.payload } });
        const name = "m" + (++marks); markQ.push(name); twSend({ event: "mark", streamSid: streamSid, mark: { name: name } });
      } else if (t === "interrupted") { // the caller talked over the assistant: stop its audio on the phone
        flushPendingAgent(true);   // record only the part of her line that actually played (markQ still holds the unplayed chunks)
        if (amb) amb.clear();   // drop her unplayed queued speech; the room itself keeps breathing under the caller
        if (markQ.length) { twSend({ event: "clear", streamSid: streamSid }); markQ = []; }
      } else if (t === "caller_text") { lastCallerTextAt = Date.now(); hist.push({ role: "caller", text: String(e.text).slice(0, 400) }); note("caller", e.text, e.key); }
      else if (t === "agent_text") { flushPendingAgent(false); pendingAgent = { text: String(e.text), key: e.key, chunks: e.chunks || 0, rescue: !!e.rescue }; if (pendingAgent.rescue) flushPendingAgent(false); }
      else if (t === "go_away") { log("ai says it will close soon", e.left); }
      else if (t === "tool") runTool(e);
      else if (t === "turn_done") { if (greetHold) { greetHold = false; clearTimeout(greetT); } if (transferPending && (spokeSinceTool || e.spoke)) { transferPending = false; doTransfer(); } }
      else if (t === "error") { log("ai reported error", e.message); }
    }

    async function runTool(m) {
      let result; toolBusy++;
      const toolStart = Date.now(), holdTimers = [];
      const holdFire = function (idx) {
        if (done || !aiReady || payPending || transferPending || agentEnd || toolBusy <= 0) return;   // the tool already landed, or the call moved on
        if (lastAgentAt >= toolStart) return;   // she is already talking (she answered while this check runs): never talk over her
        if (idx === 0 && lastHoldAt && Date.now() - lastHoldAt < TOOL_HOLD_GAP_MS) return;   // a filler just played for the step before this one: back-to-back steps share one voice, never a stack
        lastHoldAt = Date.now(); aiSend(prov.say(HOLD_LINES[idx % HOLD_LINES.length]));
      };
      holdTimers.push(setTimeout(function () { holdFire(0); }, TOOL_HOLD_MS));
      holdTimers.push(setTimeout(function () { holdFire(1); }, TOOL_HOLD2_MS));
      const r = await api({ action: "tool", session_id: ctx.session_id, name: m.name, args: m.args, call_key: nk(m.id) }, 15000);
      holdTimers.forEach(clearTimeout);
      const unreachable = !r || !r.status || !!r.error || !(r.data && r.data.result);
      result = (r.data && r.data.result) || { ok: false, error: "tool_unreachable", say: "The system did not answer. Offer a callback; do not guess." };
      // A timed-out / unreachable tool used to be able to strand the call in silence: the error result went
      // to the model and if the model produced nothing, nothing was ever said again (Nov 2, session
      // 86ac437e). The bridge now speaks the recovery line ITSELF, then hands the error result to the model
      // like any other result; the watchdog is also armed again the moment toolBusy drops below.
      if (unreachable && !done && aiReady && !payPending && !agentEnd) aiSend(prov.say(HOLD_RECOVERY));
      if (m.name === "request_human_handoff" && result.transfer_possible) { transferPending = true; spokeSinceTool = false; toolAt = Date.now(); timer(function () { if (transferPending) { transferPending = false; doTransfer(); } }, 20000); }
      if (m.name === "end_call" && result.ok && result.end_call) { agentEnd = true; doEnd(); }   // abuse after a warning: let her say goodbye, then hang up
      if (m.name === "take_card_payment" && result.ok && result.pay_handoff) { payPending = true; spokeSinceTool = false; doPay(result.booking_id); }   // the card is never spoken: after one sentence the live call moves to the keypad
      if (result && result.language_name && result.ok) lang = String(result.language_name).slice(0, 40);   // the model reported the caller's language: remember it for the lock
      prov.toolResult(m.id, m.name, result).forEach(aiSend);
      toolBusy = Math.max(0, toolBusy - 1); toolDoneAt = Date.now(); if (["send_approved_confirmation", "book_demo", "create_callback_task"].indexOf(m.name) >= 0 && result && result.ok !== false) closingAt = Date.now();
    }
    // SILENCE WATCHDOG. Dead air must be impossible: if the caller (or a finished tool) is waiting on her and she has said nothing for ~4 s,
    // (the window WHILE a tool runs belongs to runTool's own hold-on lines above — this watchdog still never fires mid-tool, unchanged)
    // 1st: tell the model the caller is waiting; 2nd: make her say "Still here, one second"; 3rd: drop and rebuild the AI link (the reconnect path with the conversation recap).
    // Also covers a greeting that never played. VOICE_SILENCE_MS changes the 4 s.
    function watchdog() {
      if (done || !aiReady || toolBusy || transferPending || payPending || agentEnd || !ctx) return;
      const now = Date.now(), th = Number(env.VOICE_SILENCE_MS) || 4000;
      const owed = Math.max(lastCallerTextAt, toolDoneAt) > lastAgentAt, noGreeting = !lastAgentAt && !reconnecting && readyAt && now - readyAt > 2 * th;   // "owed" counts only REAL caller turns (transcribed speech) and finished tools — never raw loudness: a TV, running water or banging is loud too, and loudness alone used to make the watchdog prod her into answering the room
      if (!lastCallerTextAt && !owed && !closingAt && lastAgentAt && lastCallerAt > lastAgentAt && now - lastCallerAt > th && now - lastAgentAt > th && now - deafAt > 2 * th) { // DEAF LANE: sound from the caller landed after her last line, yet not one word has ever been transcribed this call — her ears are the problem, not the caller. The silent-caller backstop below needs ~12 s between check-ins, so a talking-but-unheard caller gets dead air for a minute and hangs up first (Call 13, Oct 29 2026: 42 s, one check-in, nothing saved). Escalate fast: hearing line, then a fresh AI session, then a saved callback.
        deafAt = now; deafStage++; kinds.deaf_check = (kinds.deaf_check || 0) + 1; api({ action: "health", provider: "bridge", kind: "silence_nudge", ok: false, detail: ("deaf " + deafStage).slice(0, 120) }, 4000);
        if (deafStage === 1) { lastAgentAt = now; sysNote("You have not been able to hear anything the caller said on this call — the line may be bad. In one short warm sentence, tell the caller you can't seem to hear them and ask them to try again. Then wait."); }
        else if (deafStage === 2) { aiDown("caller_not_transcribed", "caller audible but never transcribed"); }   // a fresh AI session is the proven cure for a wedged input pipeline; the reconnect recap carries the conversation over
        else if (deafStage === 3) { lastAgentAt = now; sysNote("You still cannot hear the caller at all. Save a callback now: call create_callback_task for the number they are calling from, with the reason that you could not hear the caller (line problem). Then in one short warm sentence say someone will call them right back on this number, say goodbye, and stop."); }
        return;
      }
      if (closingAt && !saidBye && !owed && !noGreeting && closeNudges < 2 && lastAgentAt > closingAt && lastCallerAt <= lastAgentAt && now - lastAgentAt > th * 1.75) { // wrap-up done and the caller is quiet: never leave dead air, ask the close question
        closeNudges++; lastAgentAt = now; api({ action: "health", provider: "bridge", kind: "silence_nudge", ok: false, detail: ("close " + closeNudges).slice(0, 120) }, 4000);
        sysNote(closeNudges === 1 ? "The booking is done and the caller is quiet. Ask warmly: \"Is there anything else I can help you with?\"" : "The caller is still quiet. Thank them by name, give the job reference, and say a warm goodbye.");
        return;
      }
      if (!owed && !noGreeting && !closingAt && (!markQ.length || now - lastAgentAt > th * 8) && readyAt && lastAgentAt && now - lastAgentAt > th * 3 && now - Math.max(lastCallerAt, 0) > th * 3 && now - Math.max(idleAt, 0) > th * 3) { // dead-air backstop: whatever the cause, nobody has spoken for ~12s, so she checks in
        idleAt = now; kinds.idle_checkin = (kinds.idle_checkin || 0) + 1; api({ action: "health", provider: "bridge", kind: "silence_nudge", ok: false, detail: ("idle " + Math.round((now - lastAgentAt) / 1000) + "s").slice(0, 120) }, 4000);
        { const n = kinds.idle_checkin;   // normal check-ins that never repeat; no forced restart (a quiet caller is not a broken connection)
          if (n === 1) sysNote("It has been quiet. In one short sentence, check in warmly: ask if they are still with you. Then stay quiet and wait.");   // matches her prompt's one allowed check-in; the old wording ordered the exact "I'm right here, take your time" narration her prompt bans
          else if (n === 2) sysNote("Still quiet. Say one short, different sentence: ask whether they would like to keep going or have someone call them back. Do not repeat your earlier words.");
          else if (n === 3) sysNote("Still quiet. In one short sentence, say you can write down what you have so far and have a person follow up on this number. Do not repeat your earlier words.");
          else if (n === 4) sysNote("Still quiet. Save what you have now (collect_shipment_details for anything said, then create_callback_task using the number they are calling from), and tell them in one short sentence that you saved it and someone will call them back. Do not repeat your earlier words.");
          else if (n === 5) sysNote("Still quiet. Say one warm goodbye sentence: you saved their details, someone will call, and they can call back any time. Then stop.");
          /* after that she stays quiet rather than looping; the site saves a callback if the call ends without one */ }
        return;
      }
      if (!owed && !noGreeting) return;
      const since = noGreeting ? readyAt : Math.max(lastCallerTextAt, toolDoneAt), waited = now - since;
      if (waited < th * (nudges + 1) + (noGreeting ? th : 0)) return;
      nudges++; kinds.silence_nudge = (kinds.silence_nudge || 0) + 1;
      api({ action: "health", provider: "bridge", kind: "silence_nudge", ok: false, detail: ("step " + nudges + " after " + Math.round(waited / 1000) + "s" + (noGreeting ? " (greeting never played)" : "")).slice(0, 120) }, 4000);
      if (nudges === 1) { if (noGreeting) aiSend(prov.say(ctx.greeting)); else sysNote("The caller is waiting for your answer. Answer now in one short sentence."); }
      else if (nudges === 2) aiSend(prov.say("Still here, one second."));
      else { nudges = 0; lastCallerAt = 0; lastCallerTextAt = 0; toolDoneAt = 0; aiDown("silence_watchdog", "no speech for " + Math.round(waited / 1000) + "s"); }
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
    async function doEnd() {
      const t0 = Date.now();
      for (let i = 0; i < 40; i++) { await sleep(250); if (done) return; if (!markQ.length && lastAgentAt > toolDoneAt && Date.now() - lastAgentAt > 1200) break; if (Date.now() - t0 > 10000) break; }
      const r = await api({ action: "hangup", session_id: ctx.session_id }, 8000);
      if (!(r.data && r.data.ok)) finish("ended_by_agent", true);   // the phone company could not be told: close our side
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
      else if (m.event === "media" && m.media && (!m.media.track || m.media.track === "inbound")) { mediaTs = Number(m.media.timestamp) || mediaTs; if (!greetHold && loud(m.media.payload)) { if (++burst >= 6) lastCallerAt = Date.now(); } else burst = Math.max(0, burst - 1); if (aiReady && !greetHold) aiSend(prov.audioIn(m.media.payload)); }   // lastCallerAt is LOUDNESS only (any sound, incl. a TV): it may hold off idle check-ins, but it never counts as the caller speaking — only transcribed caller turns set lastCallerTextAt
      else if (m.event === "mark") markQ.shift();
      else if (m.event === "stop") finish(transferred ? "transferred" : payStarted ? "pay_handoff" : agentEnd ? "ended_by_agent" : "caller_hangup", false);
    });
    tw.on("close", function () { finish(payStarted ? "pay_handoff" : "twilio_closed", false); });
    tw.on("error", function () { finish(payStarted ? "pay_handoff" : "twilio_error", false); });
  }
  return { handle: handle, api: api };
}
module.exports = { createBridge };
