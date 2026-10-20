// lib/elevate-phone.js — Əlevate on the phone. Kept completely apart from the logistics agent:
// its own table (elevate_calls), its own webhook (elevate-phone), and it only shares the audio bridge.
//
// Who may call: (1) the call must arrive on an Əlevate number (ELEVATE_PHONE_NUMBERS),
//               (2) from one of YOUR phones (ELEVATE_OWNER_PHONES), (3) and you must key in a PIN on the phone keypad.
// The PIN is checked by this server from the keypad tones; the AI never hears it, asks for it, or decides who gets in.
// Per-phone and global lockouts apply. The call is capped in length and the tools are the small safe set in lib/elevate.js.
const crypto = require("crypto");
const E = require("./elevate");
const lc = function (s) { return String(s || "").trim(); };
const list = function (name) { return String(process.env[name] || "").split(",").map(lc).filter(Boolean); };
const norm = function (n) { const d = String(n || "").replace(/[^\d+]/g, ""); return d; };
const eq = function (a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function hashPin(pin) { const salt = crypto.randomBytes(16).toString("hex"); return "scrypt$" + salt + "$" + crypto.scryptSync(String(pin), salt, 32).toString("hex"); }
function checkPin(stored, pin) {
  const p = String(stored || "").split("$"); if (p.length !== 3 || p[0] !== "scrypt" || !/^\d{6}$/.test(String(pin || ""))) return false;
  return eq(crypto.scryptSync(String(pin), p[1], 32).toString("hex"), p[2]);
}
const phoneOk = function (from) { const f = norm(from); return !!f && list("ELEVATE_OWNER_PHONES").map(norm).indexOf(f) >= 0; };
const numberOk = function (to) { const t = norm(to); return !!t && list("ELEVATE_PHONE_NUMBERS").map(norm).indexOf(t) >= 0; };
const configured = function () { return list("ELEVATE_OWNER_PHONES").length > 0 && list("ELEVATE_PHONE_NUMBERS").length > 0 && !!process.env.ELEVATE_PIN_HASH && !!process.env.VOICE_BRIDGE_URL && !!process.env.VOICE_BRIDGE_SECRET; };
const maxSeconds = function () { return Math.max(1, Math.min(Number(process.env.ELEVATE_PHONE_MAX_MIN) || 15, 30)) * 60; };
const rows = function (r) { return r && r.ok && Array.isArray(r.data) ? r.data : []; };
const iso = function (ms) { return new Date(ms).toISOString(); };

// Lockout: 3 wrong PINs from one phone, or 10 across everyone, in the last hour.
async function lockedOut(from) {
  const r = rows(await E.sb("elevate_calls?pin_fails=gt.0&created_at=gte." + encodeURIComponent(iso(Date.now() - 3600e3)) + "&select=from_number,pin_fails&limit=200"));
  let mine = 0, all = 0; r.forEach(function (x) { all += x.pin_fails; if (norm(x.from_number) === norm(from)) mine += x.pin_fails; });
  return mine >= 3 || all >= 10;
}
async function callsToday() {
  return rows(await E.sb("elevate_calls?state=in.(ringing,active,ended)&created_at=gte." + encodeURIComponent(iso(Date.now() - 24 * 3600e3)) + "&select=id&limit=100")).length;
}

// ── what the audio bridge asks for (called from voice-tools) ──
const ID = function (callRow) { return "elv-" + callRow.id; };
const rowId = function (sid) { const m = /^elv-([0-9a-f-]{36})$/i.exec(String(sid || "")); return m ? m[1] : null; };
async function byCallSid(sid) { return rows(await E.sb("elevate_calls?call_sid=eq." + encodeURIComponent(sid) + "&select=*&limit=1"))[0] || null; }
async function byId(id) { return rows(await E.sb("elevate_calls?id=eq." + id + "&select=*&limit=1"))[0] || null; }

async function context(tok) {
  const c = await byCallSid(tok.c); if (!c) return { status: 404, body: { error: "No such call" } };
  if (c.state !== "ringing" && c.state !== "active") return { status: 409, body: { error: "Call is not open" } };
  if (c.state === "ringing") await E.sb("elevate_calls?id=eq." + c.id, { method: "PATCH", prefer: "return=minimal", body: { state: "active", answered_at: iso(Date.now()) } });
  const facts = rows(await E.sb("elevate_items?owner_key=eq." + E.q(c.owner_key) + "&kind=eq.memory&order=created_at.desc&limit=30")).map(function (x) { return String(x.title).slice(0, 200); });
  return { status: 200, body: {
    session_id: ID(c), call_sid: c.call_sid,
    instructions: E.systemPrompt({ memory: facts }) + "\nYou are on a PHONE CALL, speaking out loud: one or two short sentences at a time. The caller was already verified by keypad PIN; do not ask for or accept PINs or passwords. You are not able to transfer calls.",
    greeting: "Hi, it's Əlevate. What can I do for you?", voice: process.env.ELEVATE_VOICE || "marin",
    tools: E.asRealtimeTools(), max_seconds: maxSeconds(), recording: false } };
}
async function handle(act, b) { // transcript / tool / end / transfer for an Əlevate call
  const id = rowId(b.session_id); const c = id && await byId(id); if (!c) return { status: 404, body: { error: "No such call" } };
  if (act === "tool") {
    if (c.state !== "active") return { status: 409, body: { ok: false, error: "call_not_active" } };
    const used = Number(c.tool_calls || 0); if (used >= 60) return { status: 429, body: { ok: false, error: "too_many_tool_calls" } };
    await E.sb("elevate_calls?id=eq." + c.id, { method: "PATCH", prefer: "return=minimal", body: { tool_calls: used + 1 } });
    return { status: 200, body: { result: await E.execute(c.owner_key, String(b.name || ""), b.args, "voice") } };
  }
  if (act === "transcript") return { status: 200, body: { ok: true, stored: false } };       // call audio and words are not kept
  if (act === "end") {
    if (c.state === "ended") return { status: 200, body: { ok: true, already: true } };
    const secs = Math.max(0, Math.min(Math.floor(Number(b.seconds) || 0), 3600));
    await E.sb("elevate_calls?id=eq." + c.id, { method: "PATCH", prefer: "return=minimal", body: { state: "ended", ended_at: iso(Date.now()), seconds: secs, end_reason: String(b.reason || "hangup").slice(0, 60) } });
    try { await require("./elevate-billing").recordPhone(c.owner_key, "elv-" + c.id, secs); } catch (e) { }   // logged for the owner's own line (comped); never blocks hanging up
    return { status: 200, body: { ok: true, seconds: secs } };
  }
  if (act === "transfer") return { status: 200, body: { ok: false, error: "no_transfer_on_this_line" } };
  return { status: 400, body: { error: "Unknown action" } };
}
module.exports = { hashPin, checkPin, phoneOk, numberOk, configured, maxSeconds, lockedOut, callsToday, context, handle, rowId, byCallSid, norm, rows, iso };
