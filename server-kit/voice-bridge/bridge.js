// POTENT VOICE audio bridge: connects one phone call (Twilio Media Streams, G.711 mu-law) to one real-time AI session (Google Gemini Live; the adapter converts the audio).
// It holds NO business data and NO rules. Every fact and action goes through the Netlify function "voice-tools", which re-checks everything.
// Dependencies are injected so the whole conversation flow is testable with fake sockets (tests/voicebridge.test.js).
function createBridge(deps) {
  const env = deps.env, W = deps.WebSocket, F = deps.fetch, log = deps.log || function () {};
  const fs = require("fs"), path = require("path");
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
  const TOOL_HOLD_MS = Math.max(20, Number(env.VOICE_TOOL_HOLD_MS) || 1200);   // lowered 2500 -> 1200 (bundle 2026-11-06a, dead-air diagnosis Nov 5, 2026): at 2.5 s most real checks finished before any cover line could fire, so the caller heard pure silence; 1.2 s puts the hold line inside the gap it exists to cover. VOICE_TOOL_HOLD_MS still overrides.
  const TOOL_HOLD2_MS = Math.max(TOOL_HOLD_MS + 100, Number(env.VOICE_TOOL_HOLD2_MS) || 5500);   // stall cap 10000 -> 5500 (bundle 2026-11-07a, graded Nov 6, 2026: the rescue line at 10 s arrived after the caller had already sat through the worst of the silence — or never landed at all behind a queued injection; 5.5 s puts the apology inside the wait, and the route chain's new 6 s budget means a healthy check now finishes before the cap instead of racing it)
  const TOOL_HOLD_GAP_MS = Math.max(0, Number(env.VOICE_TOOL_HOLD_GAP_MS) != null && env.VOICE_TOOL_HOLD_GAP_MS !== "" ? Number(env.VOICE_TOOL_HOLD_GAP_MS) : 12000);
  const HOLD_LINES = ["One second — I'm checking that for you.", "Just a moment — still checking on that for you.", "Hang tight one more second — I'm pulling that up for you."];
  const HOLD_RECOVERY = "I'm so sorry — that check is taking longer than it should on my end. Let's keep right on going; I have everything you've told me so far.";
  // CALLER GOODBYE (Nov 4, 2026 — retest 2: Tony said "Goodbye.", she answered "Bye!" and stayed on
  // the line until HE hung up). A caller's goodbye is detected here, from their transcribed words,
  // and the ending is enforced by the bridge (the watchdog's goodbye fuse + doEnd): she closes
  // warmly and the call ENDS — it no longer depends on the model choosing to hang up. The pattern
  // is deliberately tight, a whole short turn that IS a goodbye, so a goodbye mentioned
  // mid-sentence ("my buddy said bye") can never trigger it.
  const GOODBYE_RE = /^(you too[,.]?\s+)?(ok(ay)?|well|alright|great|perfect|thanks|thank you)?[\s,.!]*(good\s?bye|bye(\s?bye)?|bye now|see you( later)?|talk (to you )?(later|soon)|that'?s (it|all)( for (me|now))?|i'?m (done|good|all set)|we'?re (done|good|all set))[.!…]*$/i;
  // STALLS AND THE SILENCE LADDER (Nov 3, 2026 — the recording-announcement call, graded from the audio).
  // A slow check stalled her twice (~15 s and ~25 s). Three rules came out of that call:
  // 1) THE SECOND HOLD POINT IS A STALL CAP, not another filler: past TOOL_HOLD2_MS a check is not
  //    "still checking", it is stuck, so the bridge speaks HOLD_RECOVERY (once) and stops filling —
  //    the old second generic hold-on just stacked words in front of dead air.
  // 2) A STALLED CHECK'S RESULT ARRIVES WITH A RESUME NOTE (in runTool): pick the flow up at the exact
  //    step she was on; a stall is never a reason to exit to a callback.
  // 3) THE IDLE LADDER NEVER COUNTS TOOL TIME AS ABSENCE (in watchdog): the ladder exists for callers
  //    who have gone quiet, so its silence clock starts at the latest sign of life (her voice, the
  //    caller's voice or words, a finished check), it stays shut for TOOL_GRACE_MS after any check
  //    finishes, and ANY caller audio or transcribed turn resets its stage to zero — on that call the
  //    ladder spent a stall scripting "keep going or a call back?" twice and then the follow-up exit
  //    at a man who was on the line answering her, and she never re-entered the booking.
  const TOOL_GRACE_MS = Math.max(0, Number(env.VOICE_TOOL_GRACE_MS) != null && env.VOICE_TOOL_GRACE_MS !== "" ? Number(env.VOICE_TOOL_GRACE_MS) : 15000);

  // AMBIENCE — THE ROOM SHE SITS IN (Tony, Nov 2, 2026). The Bland benchmark call sounded real partly
  // because the room was in it: whatever trade the company is in, she should sound like she is sitting
  // in it. A quiet workplace bed is mixed UNDER her voice on its way to the phone for the whole call —
  // in the pauses too, not only while she talks. History: an office-only version shipped Oct 22, 2026
  // and was switched off the same day; the Nov 2 voice package generalized it to a library of rooms
  // SYNTHESIZED in code — and that night Tony heard the graded call and ruled: "The noise wasn't what
  // you played me earlier." He was right: the rooms he approved by ear were specific RECORDINGS, and a
  // synthesizer's approximation of them is not them. So the beds are now the actual approved takes,
  // shipped as files: beds/<name>.ulaw.b64 — 25 s loops, 8 kHz mu-law (the phone wire format itself),
  // base64 so they travel as text, each RMS-matched to the level the package established for its room,
  // loop seams crossfaded. A trade with no approved take of its own plays the approved generic office
  // take — never an invented room. If a bed file is missing the call simply gets no room; ambience can
  // never break a call.
  // WHICH ROOM: the site resolves the company's trade to a bed key at call setup (the industry->bed
  // map lives in netlify/functions/lib/voice/ambience.js — data-driven, one line per trade) and sends
  // ctx.ambience_bed; ctx.ambience="off" means NO room (the owner's own calls stay natural — Tony's
  // standing rule — and a company can switch its room off). VOICE_AMBIENCE is the deployment default
  // and the kill switch: "off" silences every room; a bed key names the default room; "on"/unset means
  // the dispatch office. VOICE_AMBIENCE_GAIN sets the level (default 0.4, clamped 0.01..0.6). If the
  // adapter's mu-law codec is missing, calls pass through untouched.
  const AMBIENCE_BEDS = {
    //            the approved recording for this room (beds/<file>.ulaw.b64); file: null = no approved take of its own yet -> the generic office take plays
    dispatch_office: { file: "dispatch-office" },
    restaurant: { file: "restaurant" },
    auto_shop: { file: "auto-shop" },
    office_phones: { file: "phones-office" },
    construction: { file: null },
    salon: { file: null },
    retail: { file: null },
    clinic: { file: null },
    warehouse: { file: null },
    generic_office: { file: "generic-office" }
  };
  const bedCache = {};
  function loadBed(key) { // the room itself: the approved recording for the trade, decoded once and cached (mu-law bytes -> linear samples for the mixing station)
    if (bedCache[key]) return bedCache[key];
    const spec = AMBIENCE_BEDS[key]; if (!spec) return null;
    const name = spec.file || "generic-office";   // a trade with no approved take of its own gets the approved generic office take
    let ul = null;
    try { ul = Buffer.from(fs.readFileSync(path.join(__dirname, "beds", name + ".ulaw.b64"), "utf8").replace(/\s+/g, ""), "base64"); }
    catch (e) { try { ul = fs.readFileSync(path.join(__dirname, "beds", name + ".ulaw")); } catch (e2) { ul = null; } }
    if (!ul || !ul.length) return null;   // no file, no room — the call itself is never at risk
    const buf = new Int16Array(ul.length); for (let i = 0; i < ul.length; i++) buf[i] = AI.MU_DEC[ul[i]];
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
  // GREETING INTEGRITY — PRE-ROLL (Nov 3, 2026, from the greeting-audio forensics on the usage-test
  // calls). The greeting is the first turn of a COLD Gemini Live session, fired the instant setup
  // completes; its audio arrives in bursts, and the pump below used to play speech exactly as fast as
  // it arrived — no cushion — so a bursty first turn starved and compressed on the live leg: the caller
  // heard a distorted, half-unintelligible greeting while the recording (which preserves only the
  // sample sequence, not the wall-clock spacing) decoded cleanly. Both degraded greetings that night
  // were the first calls after a bridge restart. The station therefore holds a session's FIRST turn
  // until a real cushion is in hand: PREROLL_MS of queued speech (default 400 ms = 3,200 samples at
  // 8 kHz) before the first speech frame plays. Gemini generates faster than real time, so the cushion
  // normally accumulates in a fraction of that wall-clock time and the greeting is not noticeably
  // later; a short first utterance that never reaches the threshold is released once its burst has
  // clearly ended (PREROLL_IDLE_MS with no new audio). Later turns play immediately — the cushion is
  // a first-turn protection, not a per-turn delay. Env VOICE_PREROLL_MS retunes it (0 = off).
  // THE QUEUE NEVER DELETES SPEECH (same fix round): the old overflow rule capped the queue at
  // 24,000 samples (3.0 s) by DELETING the oldest queued speech — it could cut chunks out of the
  // middle of an utterance that generated faster than real time. That splice is gone: the queue
  // simply extends. It is bounded in practice by a turn's length and is emptied wholesale on a
  // caller barge-in (clear), so nothing accumulates across turns.
  const PREROLL_MS = (function () { const v = env.VOICE_PREROLL_MS; if (v == null || v === "") return 400; const n = Number(v); return isFinite(n) ? Math.max(0, n) : 400; })();
  const PREROLL_SAMPLES = Math.round(PREROLL_MS * 8);   // phone audio is 8 kHz: 8 samples per millisecond
  const PREROLL_IDLE_MS = 240;
  function ambienceStation(buf) { // one per call: her speech is queued, and a 20 ms pump mixes it over the bed — so the room is present for the whole call, in the pauses too, not only while she talks
    const gain = Math.min(0.6, Math.max(0.01, Number(env.VOICE_AMBIENCE_GAIN) || 0.4));
    let pos = Math.floor(Math.random() * buf.length), ramp = 0, q = [];
    let gateOpen = PREROLL_SAMPLES <= 0, firstTurn = true, idleTicks = 0;   // pre-roll gate state (see above): the room plays from the first frame; her first turn is held behind the gate until the cushion is in hand
    return {
      push: function (b64) { try { const b = Buffer.from(b64, "base64"); for (let i = 0; i < b.length; i++) q.push(AI.MU_DEC[b[i]]); idleTicks = 0; } catch (e) { /* ignore */ } },   // no cap, no splice: queued speech is never deleted
      clear: function () { q = []; if (firstTurn) { firstTurn = false; gateOpen = true; } },   // a barge-in ends the protected first turn: what follows is conversation, and it is never held
      tick: function () { // one 20 ms frame out: queued speech (or silence) over the bed; reports whether the frame carried her voice
        const out = Buffer.alloc(160); let spoke = false;
        if (firstTurn && !gateOpen) {   // pre-roll: her first turn waits for its cushion (threshold reached, or the opening burst has clearly ended below it)
          if (q.length >= PREROLL_SAMPLES) gateOpen = true;
          else if (q.length > 0 && ++idleTicks * 20 >= PREROLL_IDLE_MS) gateOpen = true;
        }
        const n = gateOpen ? Math.min(160, q.length) : 0, sp = n ? q.splice(0, n) : null;
        if (firstTurn && gateOpen && !sp && q.length === 0) firstTurn = false;   // the first turn has fully played: every later turn starts at once
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
    let saidBye = false, agentEnd = false, payPending = false, payStarted = false, idleAt = 0, idleStage = 0, closingAt = 0, closeNudges = 0, deafStage = 0, deafAt = 0, greetHold = true, greetT = null, lastCallerAt = 0, lastCallerTextAt = 0, lastAgentAt = 0, toolDoneAt = 0, toolBusy = 0, nudges = 0, burst = 0, readyAt = 0, wdTimer = null, callerByeAt = 0, byeNudged = false;
    let lang = "English", langTimer = null, flushTimer = null, retries = 0, reconnecting = false, timersSet = false, hist = [], streamSid = null, ctx = null, ai = null, prov = null, connectTimerRef = null, spokeSinceTool = false, toolAt = 0, lastHoldAt = 0, done = false, aiReady = false, buffered = [], lastItem = null, assistStart = null, mediaTs = 0, marks = 0, markQ = [], transferPending = false, transferred = false, xferStarted = false, xferFired = false, startedAt = Date.now(), timers = [], nm = 0, amb = null, pump = null;
    const timer = function (fn, ms) { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const twSend = function (o) { if (tw.readyState === 1) tw.send(JSON.stringify(o)); };
    const aiSend = function (o) { if (o && ai && ai.readyState === 1) ai.send(JSON.stringify(o)); };
    const kinds = {};   // what the AI link produced this call (audio, caller_text, agent_text, tool...), reported when the call ends
    // keys restart at 1 on every stream; after a keypad payment the SECOND stream of the same call reused them and the server dropped every line as a duplicate
    const nonce = Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), nk = function (k) { return k ? nonce + ":" + k : k; };
    const note = function (role, text, key) { if (ctx && text) api({ action: "transcript", session_id: ctx.session_id, role: role, text: text, key: nk(key) }, 8000); };
    // INJECTION DISCIPLINE (bundle 2026-11-06a — repeats diagnosis, Nov 5, 2026): every say()/note()
    // the bridge sends is a new clientContent turn, and one landing WHILE the model is mid-turn can
    // restart her half-formed answer — the caller then hears the pending sentence twice (the graded
    // repeats defect). So bridge speech is gated on turn state: turnInFlight is set by her audio /
    // agent_text events and cleared at turn_done, at a tool call (she has yielded to the check), on
    // interruption and on reconnect. sysNote()/bridgeSay() NEVER inject while she is actively
    // streaming (audio/text within the last 750 ms): the injection queues and flushes at the turn
    // boundary (turn_done), when she is idle and it cannot restart anything; a queue left over by
    // an interrupted turn is dropped with that turn. "In flight" means ACTIVELY streaming, not
    // merely "no turn_done seen yet": a turn whose stream has been quiet for 750 ms is finished or
    // wedged, and the silence watchdog — whose whole job is prodding a wedged model — must still
    // be able to speak; a stale send first flushes anything queued, in order. Hold lines are
    // unaffected in practice — they fire during tool calls, when she has already yielded — and the
    // watchdog only ever prods her after seconds of silence anyway. noteSilent (the language lock)
    // is exempt on purpose: it is sent with turnComplete:false and never asks the model to
    // generate, so it cannot restart a turn.
    let turnInFlight = false, lastTurnActivityAt = 0, pendingInjections = [];
    const queueInjection = function (send) { if (pendingInjections.length < 4) pendingInjections.push(send); kinds.inj_deferred = (kinds.inj_deferred || 0) + 1; };
    const flushInjections = function () { const q = pendingInjections; pendingInjections = []; q.forEach(function (send) { send(); }); };
    const turnActive = function () { return turnInFlight && (Date.now() - lastTurnActivityAt < 750); };
    const sysNote = function (text) { if (turnActive()) { queueInjection(function () { aiSend(prov.note(text)); }); return; } flushInjections(); aiSend(prov.note(text)); };
    const bridgeSay = function (text) { if (turnActive()) { queueInjection(function () { aiSend(prov.say(text)); }); return; } flushInjections(); aiSend(prov.say(text)); };
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
      if (ctx && reason !== "pay_handoff" && reason !== "xfer_handoff") await api({ action: "end", session_id: ctx.session_id, reason: reason, seconds: secs }, 8000);   // a keypad payment — and now a transfer — moves the call away and may bring it back: the call is NOT over, so the bridge must not end the session; the site finalizes it when the phone call truly ends
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
      const bedKey = ambienceBedKey(ctx), bedBuf = bedKey ? loadBed(bedKey) : null;
      amb = bedBuf ? ambienceStation(bedBuf) : null;
      if (bedKey && !bedBuf) log("ambience bed file missing:", bedKey);
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
      if (!flushTimer) flushTimer = setInterval(function () { if (!prov) return; if (prov.flushCaller) prov.flushCaller(1200).forEach(function (e) { onAi(e); }); if (prov.flush) prov.flush(5000).forEach(function (e) { onAi(e); }); }, 1000);   // caller words surface within ~1–2 s (the adapter's flushCaller): the watchdog, the goodbye fuse, the spelled-email assembler and the transcript all key on caller turns, and the old 3 s poll / 5 s fuse left a clearly-spoken "yes" invisible for up to ~8 s (retest 2's unanswered confirmation). Her own lines keep the 5 s rescue flush — their played/unplayed accounting must not change.
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
      const old = ai; ai = null; aiReady = false; turnInFlight = false; pendingInjections = []; markQ = []; if (amb) amb.clear();
      try { if (old) old.close(); } catch (e) { /* ignore */ }
      if (retries < max && ctx && tw.readyState === 1) { retries++; reconnecting = true; startAi(); return; }
      finish(reason, true);
    }

    function onReady() { // the AI accepted its setup: start the conversation (or resume it after a reconnect)
      clearTimeout(connectTimerRef);
      aiReady = true; turnInFlight = false; pendingInjections = []; readyAt = Date.now(); nudges = 0; lastCallerAt = 0; lastCallerTextAt = 0; toolDoneAt = 0; buffered = []; // caller audio is not forwarded while the greeting plays, so background noise cannot interrupt it
      greetHold = !reconnecting && !ctx.resume; clearTimeout(greetT); if (greetHold) greetT = setTimeout(function () { greetHold = false; }, 12000);
      if (ctx.resume) {   // back from the keypad payment: no greeting; tell her the verified result and what was said before
        const rc = String(ctx.resume.code || ""), kind = rc.split(":")[0], val = rc.slice(kind.length + 1), recap = ctx.resume.recap || "(nothing said yet)";
        const tail = "\nSpeak the caller's language, as before. The conversation so far:\n" + recap;
        if (kind === "paid") { closingAt = Date.now(); sysNote("The caller is back from the keypad. Stripe CONFIRMED the payment of " + val + ". Do NOT greet again. Say warmly, in one or two short sentences, that the payment went through (" + val + ") and thank them. Then ask: \"Is there anything else I can help you with?\"" + tail); }
        else if (kind === "paidtest") { closingAt = Date.now(); sysNote("The caller is back from the keypad. This was a small TEST charge of " + val + " and Stripe confirmed it. Do NOT greet again. In one or two short sentences say the test payment of " + val + " went through, and that the full booking payment has not been taken. Then ask: \"Is there anything else I can help you with?\"" + tail); }
        else if (kind === "unverified") sysNote("The caller is back from the keypad, but the payment could NOT be confirmed yet. Do NOT say it is paid and do NOT say it failed. Say the team will verify it and follow up with them shortly, so they do not need to do anything now. Do not take the card again and do not offer a link. Then ask if there is anything else you can help with." + tail);
        else if (kind === "xferfail" && val === "1") { transferPending = true; spokeSinceTool = false; toolAt = Date.now(); timer(function () { if (transferPending) { transferPending = false; doTransfer(); } }, 20000);
          sysNote("The person did NOT answer, and the caller is back with you. Do NOT greet again. Say warmly, exactly: \"Sorry about that, let me try one more time.\" Then stop talking — the system redials them on its own as soon as you finish; you do not need to call any tool, and do not say they are connected." + tail); }
        else if (kind === "xferfail") sysNote("Both attempts to reach a person have failed, and the caller is back with you. A callback is ALREADY saved for this caller — do not save another one. Do NOT greet again. Apologize warmly in one or two sentences, then confirm out loud that someone will call them back on the number they are calling from. Offer the other ways the company can help, from your instructions, then ask if there is anything else you can help with, and close warmly when they are done." + tail);
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
      if (t === "audio" || t === "agent_text") { turnInFlight = true; lastTurnActivityAt = Date.now(); }   // she is mid-turn: bridge injections queue until the boundary (see INJECTION DISCIPLINE above)
      else if (t === "tool") turnInFlight = false;   // she yielded to a check: the turn is suspended, not in flight — hold lines may speak for her
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
        turnInFlight = false; pendingInjections = [];   // the interrupted turn is over; injections queued for it die with it instead of landing on her next turn
        flushPendingAgent(true);   // record only the part of her line that actually played (markQ still holds the unplayed chunks)
        if (amb) amb.clear();   // drop her unplayed queued speech; the room itself keeps breathing under the caller
        if (markQ.length) { twSend({ event: "clear", streamSid: streamSid }); markQ = []; }
      } else if (t === "caller_text") { lastCallerTextAt = Date.now(); idleStage = 0; idleAt = 0; hist.push({ role: "caller", text: String(e.text).slice(0, 400) }); note("caller", e.text, e.key);
        if (!callerByeAt && !agentEnd && String(e.text).trim().length <= 80 && GOODBYE_RE.test(String(e.text).trim())) { callerByeAt = Date.now(); byeNudged = false; sysNote("The caller just said goodbye — everything they needed is done. Do NOT ask another question, do not offer anything else, and do not repeat the job reference. Say ONE short, warm goodbye line, then call end_call with kind caller_done right away — the call must actually end after your goodbye."); } }   // a transcribed caller turn is a sign of life: the idle ladder restarts from its first, mildest line (Nov 3, 2026 — her ladder kept escalating across answers and repeated its stage-2 line at a man who had just replied)
      else if (t === "agent_text") { flushPendingAgent(false); pendingAgent = { text: String(e.text), key: e.key, chunks: e.chunks || 0, rescue: !!e.rescue }; if (pendingAgent.rescue) flushPendingAgent(false); }
      else if (t === "go_away") { log("ai says it will close soon", e.left); }
      else if (t === "tool") runTool(e);
      else if (t === "turn_done") { if (greetHold) { greetHold = false; clearTimeout(greetT); } if (transferPending && (spokeSinceTool || e.spoke)) { transferPending = false; doTransfer(); } turnInFlight = false; flushInjections(); }   // turn boundary: she is idle, so anything the bridge queued mid-turn may land now — it cannot restart a finished turn
      else if (t === "error") { log("ai reported error", e.message); }
    }

    async function runTool(m) {
      let result; toolBusy++;
      const toolStart = Date.now(), holdTimers = [];
      let recoverySaid = false;   // the stall-cap apology is owed at most once per check — by the HOLD2 timer if the check runs long, or by the failure path below if it dies first; never by both
      let ownHoldAt = 0;   // when THIS check's hold line was ordered by the bridge (its audio is not "her own voice" for the guard below)
      const holdFire = function (idx) {
        if (done || !aiReady || payPending || transferPending || agentEnd || toolBusy <= 0) return;   // the tool already landed, or the call moved on
        // "She is already talking" must mean HER OWN voice — not the hold line this bridge ordered
        // for this very check. The old guard counted ANY agent audio since the check started, so
        // the moment hold line 1 played, its own audio permanently disarmed the stall cap: on the
        // retest-2 stall (26 s of dead air) the recovery line could never fire, because the hold
        // line that preceded it had already "spoken". Audio inside the hold line's own window
        // (its arrival + playback tail) is the bridge's, not hers.
        const ownVoice = lastAgentAt >= toolStart && !(ownHoldAt && lastAgentAt <= ownHoldAt + 4000);
        if (ownVoice) return;   // she is already talking (she answered while this check runs): never talk over her
        if (idx === 0 && lastHoldAt && Date.now() - lastHoldAt < TOOL_HOLD_GAP_MS) return;   // a filler just played for the step before this one: back-to-back steps share one voice, never a stack
        lastHoldAt = Date.now();
        if (idx === 0) { ownHoldAt = Date.now(); bridgeSay(HOLD_LINES[0]); }
        else { recoverySaid = true; bridgeSay(HOLD_RECOVERY); }   // STALL CAP (Nov 3, 2026): the second threshold is not another "still checking" — the check is stuck, so the bridge apologizes once with the recovery line (which promises the caller the conversation continues from what she already has) and then stays out of the way
      };
      holdTimers.push(setTimeout(function () { holdFire(0); }, TOOL_HOLD_MS));
      holdTimers.push(setTimeout(function () { holdFire(1); }, TOOL_HOLD2_MS));
      const r = await api({ action: "tool", session_id: ctx.session_id, name: m.name, args: m.args, call_key: nk(m.id) }, 12000);   // tool window 15000 -> 12000 (2026-11-07a): the server-side steps now budget themselves to land inside ~9 s (route 6 s + reads/writes), so a 12 s cap only ever catches a genuinely wedged call — and catches it 3 s sooner
      holdTimers.forEach(clearTimeout);
      const stalled = Date.now() - toolStart >= TOOL_HOLD2_MS;   // this check genuinely stalled (the announcement call stalled twice, ~15 s and ~25 s): if it still brought a result back, the result lands with a resume-at-checkpoint note, below
      const unreachable = !r || !r.status || !!r.error || !(r.data && r.data.result);
      result = (r.data && r.data.result) || { ok: false, error: "tool_unreachable", say: "The system did not answer. Do NOT run that step again on this call. Offer a callback; do not guess." };   // the no-retry clause is 2026-11-07a: a timed-out step re-fired by the model is how one slow check became 36 s of dead air on the Nov 6 call
      // A timed-out / unreachable tool used to be able to strand the call in silence: the error result went
      // to the model and if the model produced nothing, nothing was ever said again (Nov 2, session
      // 86ac437e). The bridge now speaks the recovery line ITSELF, then hands the error result to the model
      // like any other result; the watchdog is also armed again the moment toolBusy drops below.
      if (unreachable && !recoverySaid && !done && aiReady && !payPending && !agentEnd) bridgeSay(HOLD_RECOVERY);
      if (m.name === "request_human_handoff" && result.transfer_possible) { transferPending = true; spokeSinceTool = false; toolAt = Date.now(); timer(function () { if (transferPending) { transferPending = false; doTransfer(); } }, 20000); }
      if (m.name === "end_call" && result.ok && result.end_call) { agentEnd = true; doEnd(); }   // abuse after a warning: let her say goodbye, then hang up
      if (m.name === "take_card_payment" && result.ok && result.pay_handoff) { payPending = true; spokeSinceTool = false; doPay(result.booking_id); }   // the card is never spoken: after one sentence the live call moves to the keypad
      if (result && result.language_name && result.ok) lang = String(result.language_name).slice(0, 40);   // the model reported the caller's language: remember it for the lock
      // RESUME AT CHECKPOINT (Nov 3, 2026): a stalled check used to hand its result to a model whose
      // silence machinery had spent the stall treating the caller as gone — she surfaced in follow-up
      // mode, offered a callback to a man still answering her, and never re-entered the booking (no name
      // asked, no email asked, no booking made). A result that lands after a real stall therefore
      // arrives with its marching orders: the caller waited and is still here; resume at the exact
      // unfinished step; a stall is never a reason to exit. A FAILED check is different — its error
      // result already carries the honest fallback, so no resume note rides with it.
      if (stalled && !unreachable && !done && aiReady && !payPending && !transferPending && !agentEnd) sysNote("That check took much longer than it should, and the caller waited through it — they are still on the line with you. Pick the conversation back up at the exact step you were on before the check: speak the result once, then ask the next question you still need. Do NOT offer a callback or a follow-up because of the wait, do not say you will write anything down for someone to follow up on, and do not re-ask anything the caller already answered.");
      prov.toolResult(m.id, m.name, result).forEach(aiSend);
      toolBusy = Math.max(0, toolBusy - 1); toolDoneAt = Date.now(); if (["send_approved_confirmation", "book_demo", "create_callback_task"].indexOf(m.name) >= 0 && result && result.ok !== false) closingAt = Date.now();
    }
    // SILENCE WATCHDOG. Dead air must be impossible: if the caller (or a finished tool) is waiting on her and she has said nothing for ~4 s,
    // (the window WHILE a tool runs belongs to runTool's own hold-on lines above — this watchdog still never fires mid-tool, unchanged)
    // 1st: tell the model the caller is waiting; 2nd: make her say "Still here, one second"; 3rd: drop and rebuild the AI link (the reconnect path with the conversation recap).
    // Also covers a greeting that never played. VOICE_SILENCE_MS changes the 4 s.
    function watchdog() {
      if (done || !aiReady || agentEnd || !ctx) return;
      const now = Date.now(), th = Number(env.VOICE_SILENCE_MS) || 4000;
      // GOODBYE FUSE (Nov 4, 2026): once the caller has said goodbye the call ENDS — by her
      // end_call if she uses it, by this fuse if she doesn't. If she has said her own bye and the
      // line is still open seconds later, the bridge hangs up itself (doEnd — the same path an
      // agent-initiated end takes); if she hasn't answered the goodbye at all, she is told once,
      // and the fuse closes the call after that. Armed ONLY by GOODBYE_RE on the caller's own
      // words: a caller who never said goodbye is never touched by it.
      if (callerByeAt && !payPending && !transferPending) {
        const sinceBye = now - callerByeAt;
        if (saidBye && sinceBye > 4000) { callerByeAt = 0; doEnd(); return; }
        if (!saidBye && sinceBye > 9000 && !byeNudged) { byeNudged = true; lastAgentAt = now; sysNote("The caller said goodbye a moment ago and is waiting on yours. Say ONE short, warm goodbye line now, then end the call with end_call (kind caller_done)."); return; }
        if (sinceBye > 16000) { callerByeAt = 0; doEnd(); return; }
      }
      if (toolBusy || transferPending || payPending) return;
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
        sysNote(closeNudges === 1 ? "The booking is done and the caller is quiet. Ask warmly: \"Is there anything else I can help you with?\"" : "The caller is still quiet. Thank them by name and say a warm goodbye. Do not repeat the job reference — it was already given once on this call; say it again only if they ask.");
        return;
      }
      const quietBase = Math.max(lastAgentAt, lastCallerAt || 0, lastCallerTextAt || 0, toolDoneAt || 0);   // the ladder's silence clock starts at the LATEST sign of life — her voice, the caller's sound or words, or a finished check. Tool time is not absence (Nov 3, 2026): the old clock ran straight through a tool stall, so the moment the check ended the ladder read 12+ s of "silence" that was really the system working, and started scripting an exit
      if (!owed && !noGreeting && !closingAt && (!markQ.length || now - lastAgentAt > th * 8) && readyAt && lastAgentAt && now - quietBase > th * 3 && now - Math.max(idleAt, 0) > th * 3 && (!toolDoneAt || now - toolDoneAt > TOOL_GRACE_MS)) { // dead-air backstop: whatever the cause, nobody has spoken for ~12s, so she checks in — but never inside the grace window after a check finishes, when she is owed the moment to speak its result
        idleAt = now; idleStage++; kinds.idle_checkin = (kinds.idle_checkin || 0) + 1; api({ action: "health", provider: "bridge", kind: "silence_nudge", ok: false, detail: ("idle " + Math.round((now - lastAgentAt) / 1000) + "s").slice(0, 120) }, 4000);
        { const n = idleStage;   // the stage is per-absence-episode: any caller sound or transcribed turn resets it to zero (see the resets in onAi and the media handler), so the lines climb only while the caller is truly gone and the same line never repeats across an answer. No forced restart either (a quiet caller is not a broken connection)
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
      if (nudges === 1) { if (noGreeting) bridgeSay(ctx.greeting); else sysNote("The caller is waiting for your answer. Answer now in one short sentence."); }
      else if (nudges === 2) bridgeSay("Still here, one second.");
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
      if (xferFired) return; xferFired = true;   // one redirect per departure: the turn-end path and the 20 s backstop can both arrive, but the call moves once
      for (let i = 0; i < 30 && markQ.length; i++) await sleep(200);            // let her whole announce line finish playing ("I'm transferring you now — ok, yes, give me one second") before the call moves: the playback marks are the ground truth, and the longer line gets a longer leash than the old fragment did
      if (done) return;
      xferStarted = true;   // BEFORE the api call, exactly as doPay() sets payStarted (Nov 2 race fix): the redirect that stops this stream is executed by the phone company INSIDE this round trip, so the stop event reliably beats the HTTP response — if the flag were set only after the await, finish() would run as a normal caller_hangup and end the session ~20 s before the dial result lands, destroying the state the hand-back keys on
      const r = await api({ action: "transfer", session_id: ctx.session_id }, 10000);
      if (r.data && r.data.ok) { transferred = true; } else { xferStarted = false; sysNote("The transfer could not be completed (" + ((r.data && r.data.error) || "no answer from the system") + "). Tell the caller honestly that no one could be reached, and offer a callback with create_callback_task."); }   // no redirect happened: the stream is still hers, so a later stop is a normal end again
      // on success the phone company moves the call; the stream ends and finish("xfer_handoff") runs from the stop event — the session stays open on the site, because a no-answer brings the caller right back to her
    }

    tw.on("message", function (raw) {
      let m; try { m = JSON.parse(raw.toString()); } catch (e) { return; }
      if (m.event === "start") { streamSid = m.start && m.start.streamSid; const tok = m.start && m.start.customParameters && m.start.customParameters.token; if (!tok) return finish("no_token", true); begin(tok); }
      else if (m.event === "media" && m.media && (!m.media.track || m.media.track === "inbound")) { mediaTs = Number(m.media.timestamp) || mediaTs; if (!greetHold && loud(m.media.payload)) { if (++burst >= 6) { lastCallerAt = Date.now(); idleStage = 0; idleAt = 0; } } else burst = Math.max(0, burst - 1); if (aiReady && !greetHold) aiSend(prov.audioIn(m.media.payload)); }   // lastCallerAt is LOUDNESS only (any sound, incl. a TV): it may hold off idle check-ins, but it never counts as the caller speaking — only transcribed caller turns set lastCallerTextAt. Sustained caller sound ALSO resets the idle ladder's stage (Nov 3, 2026): a garbled, low-volume answer may never transcribe, but the man is plainly still there, and the ladder must not keep climbing — or repeat itself — across his answers
      else if (m.event === "mark") markQ.shift();
      else if (m.event === "stop") finish(xferStarted ? "xfer_handoff" : payStarted ? "pay_handoff" : agentEnd ? "ended_by_agent" : "caller_hangup", false);
    });
    tw.on("close", function () { finish(payStarted ? "pay_handoff" : xferStarted ? "xfer_handoff" : "twilio_closed", false); });
    tw.on("error", function () { finish(payStarted ? "pay_handoff" : xferStarted ? "xfer_handoff" : "twilio_error", false); });
  }
  return { handle: handle, api: api };
}
module.exports = { createBridge };
