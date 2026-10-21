// netlify/functions/elevate-api.js — Əlevate: the private assistant (text + voice).
// Sign-in: Google (only emails listed in ELEVATE_OWNER_EMAILS) or the POTENT OS owner login.
// Env: AUTH_SECRET, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, GOOGLE_CLIENT_ID (optional), ELEVATE_OWNER_EMAILS,
//      GEMINI_API_KEY, ELEVATE_CHAT_MODEL (default gemini-3.8-flash), ELEVATE_VOICE_MODEL (default gemini-3.8-live), ELEVATE_VOICE (default Kore)
const Gem = require("./lib/gemini.js");
const E = require("./lib/elevate");
const G = require("./lib/google");
const Bill = require("./lib/elevate-billing");
const KINDS = ["task", "note", "memory", "place"];
// Voices the speech provider (Gemini Live) offers. Names only: no claim is made about how any of them sounds.
const VOICES = ["Kore", "Puck", "Charon", "Fenrir", "Aoede", "Leda", "Orus", "Zephyr"];
const J = function (s, o) { return { statusCode: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(o) }; };
const fails = {}, hits = {};
const tooMany = function (k, n, ms) { const now = Date.now(); const f = (fails[k] || []).filter(function (t) { return now - t < (ms || 900000); }); fails[k] = f; return f.length >= (n || 8); };
const noteFail = function (k) { (fails[k] = fails[k] || []).push(Date.now()); };
const rate = function (k, n, ms) { const now = Date.now(); const h = (hits[k] || []).filter(function (t) { return now - t < ms; }); hits[k] = h; if (h.length >= n) return true; h.push(now); return false; };
const ipOf = function (e) { return String((e.headers || {})["x-nf-client-connection-ip"] || (e.headers || {})["x-forwarded-for"] || "x").split(",")[0].trim(); };
const bearer = function (e) { const h = (e.headers || {}).authorization || (e.headers || {}).Authorization || ""; return /^Bearer /i.test(h) ? h.slice(7) : ""; };
const MAX_STEPS = 4;

async function memoryFacts(k) {
  const r = await E.sb("elevate_items?owner_key=eq." + E.q(k) + "&kind=eq.memory&order=created_at.desc&limit=30");
  return (Array.isArray(r.data) ? r.data : []).map(function (x) { return String(x.title).slice(0, 200); });
}

// The first message the browser sends Gemini Live (the browser holds only a one-use token; the instructions and tool list come from here).
function liveSetup(model, instructions, voice) {
  return { setup: { model: "models/" + model, generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
    systemInstruction: { parts: [{ text: instructions }] }, tools: [{ functionDeclarations: E.TOOLS.map(function (t) { return { name: t.name, description: t.description, parameters: t.parameters }; }) }],
    inputAudioTranscription: {}, outputAudioTranscription: {} } };
}
exports.liveSetup = liveSetup;

// The text assistant: model proposes tool calls, THIS code runs them (only the tools in the list), up to MAX_STEPS rounds.
async function chat(k, messages, tz, fetchImpl) {
  const f = fetchImpl || fetch;
  const history = (Array.isArray(messages) ? messages : []).slice(-20).filter(function (m) { return m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"; })
    .map(function (m) { return { role: m.role, content: m.content.slice(0, 4000) }; });
  if (!history.length || history[history.length - 1].role !== "user") return { ok: false, error: "Say something first." };
  const msgs = [{ role: "system", content: E.systemPrompt({ memory: await memoryFacts(k), tz: tz }) }].concat(history);
  const did = [];
  for (let step = 0; step < MAX_STEPS; step++) {
    let r;
    try {
      r = await Gem.chat({ model: process.env.ELEVATE_CHAT_MODEL || "gemini-3.8-flash", temperature: 0.4, max_tokens: 2000, messages: msgs, tools: E.asChatTools(), tool_choice: "auto" }, { fetchImpl: f, timeoutMs: 8000 });
    } catch (e) { return { ok: false, error: e && e.name === "TimeoutError" ? "That one took too long. Ask again with a shorter request." : "I could not reach my brain. Try again." }; }
    if (!r.ok) {
      let why = ""; try { why = (await r.text()).slice(0, 300); } catch (e) { }
      console.error("elevate chat: Gemini HTTP " + r.status + " " + why.replace(/\s+/g, " "));   // visible in the Netlify function log
      return { ok: false, error: "I'm busy right now. Try again in a moment. (code " + r.status + ")" };
    }
    const d = await r.json(); const m = d && d.choices && d.choices[0] && d.choices[0].message;
    if (!m) return { ok: false, error: "No answer. Try again." };
    if (!m.tool_calls || !m.tool_calls.length) return { ok: true, reply: String(m.content || "").slice(0, 4000) || "Done.", did: did };
    msgs.push({ role: "assistant", content: m.content || null, tool_calls: m.tool_calls });
    for (const tc of m.tool_calls.slice(0, 4)) {
      let args = {}; try { args = JSON.parse(tc.function.arguments || "{}"); } catch (e) { }
      const known = E.TOOLS.some(function (t) { return t.name === tc.function.name; });
      const out = known ? await E.execute(k, tc.function.name, args, "chat") : { ok: false, error: "Unknown tool." };
      if (known && out.ok && /^(add_|complete_|remember)/.test(tc.function.name)) did.push({ tool: tc.function.name, item: out.saved || out.completed });
      msgs.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out).slice(0, 6000) });
    }
  }
  return { ok: true, reply: "I did what I could. Check your lists to see it.", did: did };
}

exports.chat = chat;
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return J(405, { ok: false, error: "POST only" });
  if (!process.env.AUTH_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) return J(500, { ok: false, error: "Not configured" });
  if ((event.body || "").length > 60000) return J(413, { ok: false, error: "Too large" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return J(400, { ok: false, error: "Bad request" }); }
  const a = String(b.action || ""), ip = ipOf(event);
  try {
    // ── sign in ──
    if (a === "googleconfig") return J(200, { ok: true, enabled: G.configured(), clientId: G.configured() ? G.clientId() : null });
    if (a === "google") {
      if (tooMany("eg:" + ip)) return J(429, { ok: false, error: "Too many attempts. Try again in 15 minutes." });
      const gv = await G.verifyIdToken(b.credential); if (!gv.ok) { noteFail("eg:" + ip); return J(401, { ok: false, error: gv.error }); }
      const intent = String(b.intent || "");
      if (intent === "sub" || /^pack:\d+$/.test(intent)) { // buying (the email is proven by Google, so the purchase can only land on the buyer's own account)
        const c = await Bill.checkout(gv.email, intent); return J(c.status, c);
      }
      if (E.owners().indexOf(gv.email) < 0 && !(await Bill.canSignIn(gv.email))) { noteFail("eg:" + ip); return J(403, { ok: false, error: gv.email + " does not have an Əlevate assistant yet. Choose Subscribe to get one." }); }
      return J(200, { ok: true, token: E.mint(gv.email), name: gv.name || gv.email });
    }
    if (a === "from_os") { // you are already signed in to POTENT OS as the owner
      if (tooMany("eo:" + ip)) return J(429, { ok: false, error: "Too many attempts. Try again in 15 minutes." });
      if (!E.verifyOsOwner(b.os_token)) { noteFail("eo:" + ip); return J(401, { ok: false, error: "Sign in to POTENT OS as the owner first." }); }
      return J(200, { ok: true, token: E.mint(E.osKey()), name: "Owner" });
    }

    // ── everything else needs an Əlevate login ──
    const t = E.verify(bearer(event)) || (a === "voice_end" ? E.verify(b.token) : null);; // (the page's last-gasp beacon cannot set headers, so voice_end also accepts the token in its body)
    if (!t) return J(401, { ok: false, error: "Sign in again", login: true });
    const k = t.k;
    if (a === "me") return J(200, { ok: true, owner: k, voice: !!process.env.GEMINI_API_KEY, voices: VOICES, voice_default: process.env.ELEVATE_VOICE || "Kore" });
    if (a === "billing") {
      const st = await Bill.standing(k);
      return J(200, { ok: true, plan: { price_cents: Bill.PRICE_CENTS, included_minutes: Bill.INCLUDED_S / 60 }, packs: Object.keys(Bill.PACKS).map(function (c) { return { cents: Number(c), minutes: Bill.PACKS[c] / 60 }; }),
        owner: Bill.isOwner(k), comped: st.comped, subscribed: st.subscribed, sub_status: st.sub_status, period_end: st.period_end, included_left_minutes: Math.floor(st.included_left_s / 60), credit_left_minutes: Math.floor(st.credits_left_s / 60), unlimited: st.comped });
    }
    if (a === "portal") { const c = await Bill.portal(k); return J(c.status, c); }
    if (a === "buy") { const c = await Bill.checkout(k, String(b.what || "")); return J(c.status, c); }
    if (a === "voice_ping") return J(200, await Bill.ping(k, b.ref));
    if (a === "voice_end") { const r = await Bill.end(k, b.ref); return J(r.ok ? 200 : (r.status || 400), r); }
    if (/^o_/.test(a)) { // the owner only: add people, give free minutes
      if (!Bill.isOwner(k)) return J(403, { ok: false, error: "Owner only." });
      const em = E.clip(b.email, 200).toLowerCase();
      if (a === "o_overview") { // everyone with an account row OR free minutes, so a grant always shows up
        const r = await E.sb("elevate_accounts?order=created_at.desc&limit=200");
        if (!r.ok) return J(502, { ok: false, error: "Could not load people." });
        const c = await E.sb("elevate_credits?select=owner_key,seconds,expires_at&expires_at=gt." + encodeURIComponent(new Date().toISOString()) + "&limit=1000");
        const mins = {}; (Array.isArray(c.data) ? c.data : []).forEach(function (x) { mins[x.owner_key] = (mins[x.owner_key] || 0) + Math.floor((Number(x.seconds) || 0) / 60); });
        const acc = Array.isArray(r.data) ? r.data : [], seen = {};
        const out = acc.map(function (x) { seen[x.owner_key] = 1; return Object.assign({}, x, { free_minutes: mins[x.owner_key] || 0 }); });
        Object.keys(mins).forEach(function (k2) { if (!seen[k2]) out.push({ owner_key: k2, mode: "free", sub_status: null, free_minutes: mins[k2] }); });
        return J(200, { ok: true, accounts: out });
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return J(400, { ok: false, error: "Enter an email." });
      if (a === "o_account_set") { if (["free", "comped"].indexOf(b.mode) < 0) return J(400, { ok: false, error: "Mode is free or comped." }); const sa = await Bill.setAccount(em, { mode: b.mode }); return sa.ok ? J(200, { ok: true }) : J(500, { ok: false, error: "Could not save that. Nothing changed." }); }
      if (a === "o_credit_grant") { const min = Math.floor(Number(b.minutes)); if (!(min >= 1 && min <= 600)) return J(400, { ok: false, error: "1 to 600 minutes." }); const r = await Bill.addCredit(em, min * 60, "grant:" + Date.now() + ":" + Math.random().toString(36).slice(2, 8), "grant"); if (r.ok) await E.sb("elevate_accounts?on_conflict=owner_key", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { owner_key: em } }); return r.ok ? J(200, { ok: true }) : J(500, { ok: false, error: "Could not save that. Nothing changed." }); }
    }

    if (a === "items") {
      const kind = KINDS.indexOf(b.kind) >= 0 ? b.kind : "task";
      const r = await E.sb("elevate_items?owner_key=eq." + E.q(k) + "&kind=eq." + kind + "&order=created_at.desc&limit=200");
      return J(200, { ok: true, items: Array.isArray(r.data) ? r.data : [] });
    }
    if (a === "item_save") {
      const kind = KINDS.indexOf(b.kind) >= 0 ? b.kind : null; const title = E.clip(b.title, 200); if (!kind || !title) return J(400, { ok: false, error: "Add some text." });
      if (kind === "place") { // a saved place: rounded to 2 decimals (about 1 km) on purpose, so the map never holds an exact address
        const lat = Number(b.lat), lon = Number(b.lon); if (b.lat == null || b.lon == null || !isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return J(400, { ok: false, error: "Pick a spot on the map." });
        const r = await E.sb("elevate_items", { method: "POST", body: { owner_key: k, kind: "place", title: title, lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100, source: "manual" } });
        return r.ok ? J(200, { ok: true, item: r.data[0] }) : J(500, { ok: false, error: "Could not save." });
      }
      const due = b.due_at ? Date.parse(b.due_at) : null;
      const r = await E.sb("elevate_items", { method: "POST", body: { owner_key: k, kind: kind, title: title, body: kind === "note" ? E.clip(b.body, 4000) || null : null, due_at: kind === "task" && due && isFinite(due) ? new Date(due).toISOString() : null, source: "manual" } });
      return r.ok ? J(200, { ok: true, item: r.data[0] }) : J(500, { ok: false, error: "Could not save." });
    }
    if (a === "item_toggle" || a === "item_delete") {
      if (!E.UUID.test(String(b.id || ""))) return J(400, { ok: false, error: "Bad id" });
      const sel = "elevate_items?id=eq." + b.id + "&owner_key=eq." + E.q(k);                    // always scoped to YOUR rows
      if (a === "item_delete") { await E.sb(sel, { method: "DELETE", prefer: "return=minimal" }); return J(200, { ok: true }); }
      await E.sb(sel, { method: "PATCH", prefer: "return=minimal", body: { done: b.done === true, updated_at: new Date().toISOString() } });
      return J(200, { ok: true });
    }

    // ── text assistant ──
    if (a === "chat") {
      if (!Bill.isOwner(k) && !(await Bill.canSignIn(k))) return J(402, { ok: false, error: "Subscribe or add credits in Settings to use the assistant." });
      if (!process.env.GEMINI_API_KEY) return J(503, { ok: false, error: "The assistant's brain is not connected yet (GEMINI_API_KEY)." });
      if (rate("ec:" + k, 40, 3600000)) return J(429, { ok: false, error: "That's a lot of messages this hour. Take a breather." });
      const out = await chat(k, b.messages, E.clip(b.tz, 60) || "America/New_York");
      return J(out.ok ? 200 : 502, out);
    }

    // ── voice (browser connects straight to Gemini Live with a one-use, short-lived token made here) ──
    if (a === "voice_session") {
      if (!process.env.GEMINI_API_KEY) return J(503, { ok: false, error: "Voice is not connected yet (GEMINI_API_KEY)." });
      if (rate("ev:" + k, 6, 3600000)) return J(429, { ok: false, error: "Voice was started a lot this hour. Try again later." });
      const bs = await Bill.start(k, "voice"); if (!bs.ok) return J(bs.status, { ok: false, error: bs.error });
      const model = process.env.ELEVATE_VOICE_MODEL || "gemini-3.8-live";
      const setup = liveSetup(model, E.systemPrompt({ memory: await memoryFacts(k), tz: E.clip(b.tz, 60) }) + "\nYou are speaking out loud: keep answers to one or two short sentences.", VOICES.indexOf(b.voice) >= 0 ? b.voice : (process.env.ELEVATE_VOICE || "Kore"));
      let r, d;
      try {
        const now = Date.now();
        r = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", { method: "POST", headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ uses: 1, expireTime: new Date(now + (bs.max_seconds + 120) * 1000).toISOString(), newSessionExpireTime: new Date(now + 90000).toISOString() }) });
        d = await r.json();
      } catch (e) { await Bill.end(k, bs.ref, Date.now()); return J(502, { ok: false, error: "Could not start voice. Try again." }); }
      const token = d && d.name;
      if (!(r.ok && token)) { await Bill.end(k, bs.ref, Date.now()); return J(502, { ok: false, error: "Could not start voice. Try again." }); }
      return J(200, { ok: true, client_secret: token, setup: setup, model: model, max_minutes: bs.max_seconds / 60, ref: bs.ref });
    }
    if (a === "voice_tool") { // the browser relays a tool call the voice model asked for; only the listed tools can run
      if (rate("et:" + k, 120, 3600000)) return J(429, { ok: false, error: "Slow down" });
      if (!E.TOOLS.some(function (x) { return x.name === b.name; })) return J(400, { ok: false, error: "Unknown tool." });
      return J(200, await E.execute(k, b.name, b.args, "voice"));
    }
    return J(404, { ok: false, error: "Unknown action" });
  } catch (e) { console.error("elevate-api:", e && e.message); return J(500, { ok: false, error: "Something went wrong." }); }
};
