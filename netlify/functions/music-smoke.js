// POTENT LIVE 360°: SMOKE SESSIONS. Freestyle cyphers, open mics, producer sessions, beat battles and lounges.
// Ordinary application logic: queue, timer, roles, permissions, status. No AI is needed for any of it.
// Rights: a beat only plays when the host recorded the basis for playing it. An exclusive purchase is NOT assumed to cover public performance.
// Recording: this app does not record audio or video. The recording switch is a visible, honest status that hosts can turn off,
// and replays or highlights are only published with the host's recording on AND the performer's consent.
// Money: nothing here charges anyone. Any future event income would be tracked on its own, apart from beat fees and master or publishing revenue.
const B = require("./lib/beats");
const M = require("./lib/music");
const RR = require("./music-rights");
const L = RR.lib;

const UUID = /^[0-9a-f-]{36}$/i;
const clip = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n); };
const rows = function (r) { return r.ok && Array.isArray(r.data) ? r.data : []; };
const FORMATS = { cypher: "Freestyle Cypher", open_mic: "Open Mic", producer: "Producer Session", studio: "Late-Night Studio Session", listen: "Chill & Listen", beat_battle: "Beat Battle", lounge: "Smoke & Vibe Lounge", guest: "Guest Artist Session" };
const EMOJI = ["🔥", "👏", "💯", "🙌", "🎤", "💛", "😮", "🤯"];
const BASES = ["own_production", "producer_permission", "licensed", "royalty_free"];
const ALIVE = 30 * 1000; // someone is "here" if they polled in the last 30 seconds
const fails = {};
function tooMany(k, max, ms) { const f = fails[k]; return !!(f && f.n >= max && Date.now() - f.t < (ms || 36e5)); }
function note(k, ms) { const f = fails[k]; if (!f || Date.now() - f.t > (ms || 36e5)) fails[k] = { n: 1, t: Date.now() }; else { f.n++; } }
const code = function () { return require("crypto").randomBytes(5).toString("hex"); };
const httpsUrl = function (v, n) { v = clip(v, n || 500); return /^https:\/\//i.test(v) ? v : null; };

async function userFrom(event) {
  const t = B.bearer(event); if (!t) return null; const u = M.verifyUser(t); if (!u) return null;
  const r = rows(await B.sb("music_users?id=eq." + u.uid + "&select=id,email,name,active"))[0]; return r && r.active ? r : null;
}
const first = function (n) { return clip(n, 24).split(" ")[0] || "Guest"; };
function pubSession(s, mine) {
  return { id: s.id, title: s.title, description: s.description, format: s.format, format_label: FORMATS[s.format], visibility: s.visibility, status: s.status, starts_at: s.starts_at, started_at: s.started_at, ended_at: s.ended_at,
    venue: s.venue, atmosphere: s.atmosphere, chat_on: s.chat_on, voting_on: s.voting_on, reactions_on: s.reactions_on, requests_on: s.requests_on, turn_seconds: s.turn_seconds, recording: s.recording, rights_ack: s.rights_ack,
    stream_url: s.stream_url, stream_is_360: s.stream_is_360, host_user_id: s.host_user_id, current_queue_id: s.current_queue_id, current_beat_id: s.current_beat_id, beat_started_at: s.beat_started_at, beat_paused: s.beat_paused,
    invite_code: mine ? s.invite_code : undefined };
}
async function member(sid, uid) { return rows(await B.sb("smoke_members?session_id=eq." + sid + "&user_id=eq." + uid + "&select=*"))[0] || null; }
const isStaff = function (m) { return !!(m && (m.role === "host" || m.role === "cohost") && !m.banned); };

// finish the active turn and start the next waiting one. Returns the new active queue row (or null).
async function advance(s, hostSide) {
  const now = new Date().toISOString();
  if (s.current_queue_id) await B.sb("smoke_queue?id=eq." + s.current_queue_id + "&status=eq.active", { method: "PATCH", prefer: "return=minimal", body: { status: "done", ended_at: now } });
  const nxt = rows(await B.sb("smoke_queue?session_id=eq." + s.id + "&status=eq.waiting&select=*&order=requested_at.asc&limit=1"))[0];
  if (!nxt) { await B.sb("smoke_sessions?id=eq." + s.id, { method: "PATCH", prefer: "return=minimal", body: { current_queue_id: null } }); s.current_queue_id = null; return null; }
  await B.sb("smoke_queue?id=eq." + nxt.id + "&status=eq.waiting", { method: "PATCH", prefer: "return=minimal", body: { status: "active", started_at: now } });
  await B.sb("smoke_sessions?id=eq." + s.id, { method: "PATCH", prefer: "return=minimal", body: { current_queue_id: nxt.id } });
  await B.sb("smoke_members?session_id=eq." + s.id + "&user_id=eq." + nxt.user_id + "&role=eq.audience", { method: "PATCH", prefer: "return=minimal", body: { role: "performer", can_speak: true } });
  s.current_queue_id = nxt.id; nxt.status = "active"; nxt.started_at = now; return nxt;
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return B.J(405, { error: "POST only" });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.AUTH_SECRET) return B.J(500, { error: "Server not configured" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return B.J(400, { error: "Bad request" }); }
  const a = String(b.action || "");

  // ───────── owner ─────────
  if (a.indexOf("o_") === 0) {
    if (!B.verifyOwner(B.bearer(event))) return B.J(403, { error: "POTENT owner only" });
    if (a === "o_sessions") return B.J(200, { ok: true, sessions: rows(await B.sb("smoke_sessions?select=id,title,format,visibility,status,starts_at,recording,host_user_id,created_at,music_users(email,name)&order=created_at.desc&limit=100")) });
    if (a === "o_end") { if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" }); await B.sb("smoke_sessions?id=eq." + b.id, { method: "PATCH", prefer: "return=minimal", body: { status: "ended", ended_at: new Date().toISOString() } }); await B.audit("owner", "smoke_end", b.id, null); return B.J(200, { ok: true }); }
    if (a === "o_reports") return B.J(200, { ok: true, reports: rows(await B.sb("smoke_reports?select=*&order=created_at.desc&limit=100")) });
    if (a === "o_report_resolve") { if (!UUID.test(String(b.id || ""))) return B.J(400, { error: "Bad id" }); await B.sb("smoke_reports?id=eq." + b.id, { method: "PATCH", prefer: "return=minimal", body: { status: "resolved" } }); return B.J(200, { ok: true }); }
    return B.J(400, { error: "Unknown action" });
  }

  // ───────── public list (signing in only adds your own and invited rooms) ─────────
  const u = await userFrom(event);
  if (a === "s_list") {
    const horizon = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
    const pub = rows(await B.sb("smoke_sessions?visibility=eq.public&status=in.(live,scheduled)&or=(starts_at.is.null,starts_at.gte." + horizon + ")&select=*&order=status.asc,starts_at.asc&limit=60"));
    let mine = [], inv = [];
    if (u) {
      mine = rows(await B.sb("smoke_sessions?host_user_id=eq." + u.id + "&status=in.(live,scheduled)&select=*&order=created_at.desc&limit=30"));
      const im = rows(await B.sb("smoke_members?user_id=eq." + u.id + "&invited=eq.true&banned=eq.false&select=session_id")); if (im.length) inv = rows(await B.sb("smoke_sessions?id=in.(" + im.map(function (x) { return x.session_id; }).join(",") + ")&status=in.(live,scheduled)&select=*"));
    }
    const hid = {}; pub.concat(mine, inv).forEach(function (x) { hid[x.host_user_id] = 1; });
    const names = {}; if (Object.keys(hid).length) rows(await B.sb("music_users?id=in.(" + Object.keys(hid).join(",") + ")&select=id,name")).forEach(function (x) { names[x.id] = first(x.name); });
    const map = function (s, own) { const o = pubSession(s, own); o.host = names[s.host_user_id] || "Host"; return o; };
    return B.J(200, { ok: true, formats: FORMATS, public: pub.map(function (s) { return map(s, false); }), mine: mine.map(function (s) { return map(s, true); }), invited: inv.map(function (s) { return map(s, false); }) });
  }
  if (!u) return B.J(401, { error: "Sign in first" });
  if (tooMany("sm:" + u.id, 6000)) return B.J(429, { error: "Slow down a little" }); note("sm:" + u.id);

  if (a === "s_create") {
    const title = clip(b.title, 90); if (title.length < 3) return B.J(400, { error: "Give the session a title" });
    const format = String(b.format || "cypher"); if (!FORMATS[format]) return B.J(400, { error: "Pick a format" });
    const vis = ["public", "private", "invite"].indexOf(b.visibility) >= 0 ? b.visibility : "public";
    if (rows(await B.sb("smoke_sessions?host_user_id=eq." + u.id + "&status=in.(live,scheduled)&select=id&limit=11")).length > 9) return B.J(400, { error: "You already have 10 open sessions. End or cancel one first." });
    if (tooMany("smc:" + u.id, 12)) return B.J(429, { error: "That's a lot of sessions in an hour. Try again later." }); note("smc:" + u.id);
    let starts = null; if (b.starts_at) { const d = new Date(b.starts_at); if (isNaN(d) || d.getTime() < Date.now() - 36e5 || d.getTime() > Date.now() + 365 * 864e5) return B.J(400, { error: "Pick a start time within the next year" }); starts = d.toISOString(); }
    const rec = b.recording === "on" ? "on" : "off";
    if (rec === "on" && b.rights_ack !== true) return B.J(400, { error: "To record, confirm you have permission from everyone performing and for any music played." });
    const turn = Math.round(Number(b.turn_seconds) || 60); if (turn < 15 || turn > 600) return B.J(400, { error: "A turn is 15 to 600 seconds" });
    const stream = b.stream_url ? httpsUrl(b.stream_url) : null; if (b.stream_url && !stream) return B.J(400, { error: "The stream link must start with https://" });
    const now = !starts || b.start_now === true;
    const row = { host_user_id: u.id, title: title, description: clip(b.description, 600) || null, format: format, visibility: vis, status: now ? "live" : "scheduled", starts_at: starts, started_at: now ? new Date().toISOString() : null,
      venue: clip(b.venue, 60) || "Studio lounge", atmosphere: clip(b.atmosphere, 40) || "late night", invite_code: vis === "public" ? null : code(),
      chat_on: b.chat_on !== false, voting_on: b.voting_on === true || format === "beat_battle", reactions_on: b.reactions_on !== false, requests_on: b.requests_on !== false, turn_seconds: turn, recording: rec,
      stream_url: stream, stream_is_360: b.stream_is_360 === true && !!stream, rights_ack: b.rights_ack === true };
    const ins = rows(await B.sb("smoke_sessions", { method: "POST", prefer: "return=representation", body: row }))[0]; if (!ins) return B.J(500, { error: "Could not create the session" });
    await B.sb("smoke_members", { method: "POST", prefer: "return=minimal", body: { session_id: ins.id, user_id: u.id, role: "host", display_name: first(u.name) } });
    return B.J(200, { ok: true, id: ins.id, invite_code: ins.invite_code });
  }

  // everything below is about one session
  const sid = String(b.id || ""); if (!UUID.test(sid)) return B.J(400, { error: "Bad session" });
  const s = rows(await B.sb("smoke_sessions?id=eq." + sid + "&select=*"))[0]; if (!s) return B.J(404, { error: "Session not found" });
  let me = await member(s.id, u.id);
  if (me && me.banned) return B.J(403, { error: "You can't join this session" });
  const host = isStaff(me);

  if (a === "s_join") {
    if (s.status === "ended" || s.status === "cancelled") return B.J(410, { error: "This session has ended" });
    const okCode = s.invite_code && clip(b.code, 20) === s.invite_code;
    if (s.visibility === "private" && !me && !okCode) return B.J(403, { error: "This room is private. Use the link the host shared with you." });
    if (s.visibility === "invite" && !(me && (me.invited || me.role !== "audience")) && !okCode) return B.J(403, { error: "This session is invitation-only" });
    const name = first(clip(b.name, 24) || u.name);
    if (!me) { await B.sb("smoke_members?on_conflict=session_id,user_id", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { session_id: s.id, user_id: u.id, role: "audience", display_name: name } }); me = await member(s.id, u.id); }
    else await B.sb("smoke_members?session_id=eq." + s.id + "&user_id=eq." + u.id, { method: "PATCH", prefer: "return=minimal", body: { last_seen: new Date().toISOString(), display_name: me.display_name || name } });
    return B.J(200, { ok: true, role: me.role });
  }
  // session pages are for members only (a public room is joined with s_join first)
  if (!me) return B.J(403, { error: "Join the session first" });

  if (a === "s_poll") {
    const nowIso = new Date().toISOString();
    await B.sb("smoke_members?session_id=eq." + s.id + "&user_id=eq." + u.id, { method: "PATCH", prefer: "return=minimal", body: { last_seen: nowIso } });
    // the turn timer is enforced here, so a room keeps moving even if the host steps away
    let act = s.current_queue_id ? rows(await B.sb("smoke_queue?id=eq." + s.current_queue_id + "&select=*"))[0] : null;
    if (s.status === "live" && act && act.status === "active" && act.started_at && Date.now() - new Date(act.started_at).getTime() > (s.turn_seconds + 3) * 1000) act = await advance(s);
    const mems = rows(await B.sb("smoke_members?session_id=eq." + s.id + "&banned=eq.false&select=user_id,role,display_name,muted,can_speak,last_seen&order=joined_at.asc&limit=300"));
    const q = rows(await B.sb("smoke_queue?session_id=eq." + s.id + "&status=in.(waiting,active)&select=*&order=requested_at.asc&limit=60"));
    const blocks = rows(await B.sb("smoke_blocks?user_id=eq." + u.id + "&select=blocked_user_id")).map(function (x) { return x.blocked_user_id; });
    const since = Math.max(0, Math.floor(Number(b.since_msg) || 0));
    let msgs = !s.chat_on ? [] : since > 0 ? rows(await B.sb("smoke_messages?session_id=eq." + s.id + "&id=gt." + since + "&select=id,user_id,display_name,body,created_at&order=id.asc&limit=100"))
      : rows(await B.sb("smoke_messages?session_id=eq." + s.id + "&select=id,user_id,display_name,body,created_at&order=id.desc&limit=40")).reverse(); // first load: the recent conversation
    msgs = msgs.filter(function (m) { return blocks.indexOf(m.user_id) < 0; });
    const first_load = !(Number(b.since_react) >= 0); const rsince = Math.max(0, Math.floor(Number(b.since_react) || 0));
    let rx = !s.reactions_on ? [] : first_load ? rows(await B.sb("smoke_reactions?session_id=eq." + s.id + "&select=id&order=id.desc&limit=1")).map(function (x) { return { id: x.id, emoji: null }; }) // first load only learns where the stream is
      : rows(await B.sb("smoke_reactions?session_id=eq." + s.id + "&id=gt." + rsince + "&select=id,emoji&order=id.asc&limit=200"));
    const beats = rows(await B.sb("smoke_beats?session_id=eq." + s.id + "&status=in.(approved,requested,played)&select=id,title,producer_name,source,status,rights_basis,added_by&order=created_at.asc&limit=100"));
    const cur = beats.find(function (x) { return x.id === s.current_beat_id; }) || null;
    let votes = {}; if (s.voting_on && q.length) { rows(await B.sb("smoke_votes?queue_id=in.(" + q.map(function (x) { return x.id; }).join(",") + ")&select=queue_id,voter_user_id")).forEach(function (v) { votes[v.queue_id] = (votes[v.queue_id] || 0) + 1; }); }
    const mine = s.voting_on && act ? rows(await B.sb("smoke_votes?queue_id=eq." + act.id + "&voter_user_id=eq." + u.id + "&select=queue_id")).length > 0 : false;
    const here = mems.filter(function (m) { return Date.now() - new Date(m.last_seen).getTime() < ALIVE; });
    return B.J(200, { ok: true, now: nowIso, session: pubSession(s, host), me: { user_id: u.id, role: me.role, muted: me.muted, can_speak: me.can_speak }, host: host,
      here: here.length, people: here.slice(0, 80).map(function (m) { return { user_id: m.user_id, name: m.display_name, role: m.role, muted: m.muted }; }),
      queue: q.map(function (x) { return { id: x.id, user_id: x.user_id, name: x.display_name, status: x.status, started_at: x.started_at, votes: votes[x.id] || 0 }; }),
      beats: beats.filter(function (x) { return host || x.status !== "requested" || x.added_by === u.id; }), beat: cur, i_voted: mine,
      messages: msgs, reactions: rx.filter(function (x) { return x.emoji; }), max_react: rx.length ? rx[rx.length - 1].id : rsince, blocked: blocks });
  }

  // ───────── host: run the room ─────────
  const HOST_ONLY = ["s_start", "s_end", "s_update", "s_next", "s_skip", "s_beat_add", "s_beat_decide", "s_play", "s_invite", "s_mod", "s_highlight", "s_highlight_publish", "s_title", "s_recap"];
  if (HOST_ONLY.indexOf(a) >= 0 && !host) return B.J(403, { error: "Only the host or a co-host can do that" });
  const isOwnerHost = me.role === "host";

  if (a === "s_start") { if (s.status === "ended") return B.J(400, { error: "That session has ended" }); await B.sb("smoke_sessions?id=eq." + s.id, { method: "PATCH", prefer: "return=minimal", body: { status: "live", started_at: s.started_at || new Date().toISOString() } }); return B.J(200, { ok: true }); }
  if (a === "s_end") {
    if (!isOwnerHost) return B.J(403, { error: "Only the host can end the session" });
    await B.sb("smoke_queue?session_id=eq." + s.id + "&status=in.(active,waiting)", { method: "PATCH", prefer: "return=minimal", body: { status: "done", ended_at: new Date().toISOString() } });
    await B.sb("smoke_sessions?id=eq." + s.id, { method: "PATCH", prefer: "return=minimal", body: { status: b.cancel === true && s.status === "scheduled" ? "cancelled" : "ended", ended_at: new Date().toISOString(), current_queue_id: null, current_beat_id: null } }); return B.J(200, { ok: true });
  }
  if (a === "s_update") { // room settings. Turning recording on needs the permission box ticked.
    if (!isOwnerHost) return B.J(403, { error: "Only the host can change room settings" });
    const row = {}; ["chat_on", "voting_on", "reactions_on", "requests_on"].forEach(function (k) { if (typeof b[k] === "boolean") row[k] = b[k]; });
    if (b.recording !== undefined) { if (b.recording === "on") { if (b.rights_ack !== true && !s.rights_ack) return B.J(400, { error: "To record, confirm you have permission from everyone performing and for any music played." }); row.recording = "on"; if (b.rights_ack === true) row.rights_ack = true; } else row.recording = "off"; }
    if (b.rights_ack === true) row.rights_ack = true;
    if (b.turn_seconds !== undefined) { const t = Math.round(Number(b.turn_seconds)); if (!(t >= 15 && t <= 600)) return B.J(400, { error: "A turn is 15 to 600 seconds" }); row.turn_seconds = t; }
    if (b.stream_url !== undefined) { const st = b.stream_url ? httpsUrl(b.stream_url) : null; if (b.stream_url && !st) return B.J(400, { error: "The stream link must start with https://" }); row.stream_url = st; row.stream_is_360 = b.stream_is_360 === true && !!st; }
    if (b.title !== undefined) { const t = clip(b.title, 90); if (t.length < 3) return B.J(400, { error: "Give the session a title" }); row.title = t; }
    if (!Object.keys(row).length) return B.J(400, { error: "Nothing to change" });
    await B.sb("smoke_sessions?id=eq." + s.id, { method: "PATCH", prefer: "return=minimal", body: row }); return B.J(200, { ok: true });
  }
  if (a === "s_next") { if (s.status !== "live") return B.J(400, { error: "Start the session first" }); const n = await advance(s); return B.J(200, { ok: true, active: n ? n.id : null }); }
  if (a === "s_skip") {
    const q = UUID.test(String(b.queue_id || "")) && rows(await B.sb("smoke_queue?id=eq." + b.queue_id + "&session_id=eq." + s.id + "&select=*"))[0]; if (!q) return B.J(404, { error: "Not found" });
    if (q.status === "active") { await advance(s); return B.J(200, { ok: true }); }
    await B.sb("smoke_queue?id=eq." + q.id, { method: "PATCH", prefer: "return=minimal", body: { status: b.remove === true ? "removed" : "skipped", ended_at: new Date().toISOString() } }); return B.J(200, { ok: true });
  }
  if (a === "s_invite") { // invite an artist or producer to the stage. An in-app invite; nothing is emailed.
    const t = rows(await B.sb("music_users?email=eq." + encodeURIComponent(clip(b.email, 200).toLowerCase()) + "&select=id,name,active"))[0]; if (!t || !t.active) return B.J(404, { error: "No Music account with that email" });
    const role = b.role === "producer" ? "producer" : "performer";
    await B.sb("smoke_members?on_conflict=session_id,user_id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { session_id: s.id, user_id: t.id, role: role, can_speak: true, invited: true, banned: false, display_name: first(t.name) } });
    return B.J(200, { ok: true });
  }
  if (a === "s_mod") {
    const t = UUID.test(String(b.user_id || "")) && await member(s.id, b.user_id); if (!t) return B.J(404, { error: "Person not found" });
    if (t.role === "host") return B.J(400, { error: "You can't moderate the host" }); if (t.user_id === u.id) return B.J(400, { error: "That's you" });
    if (t.role === "cohost" && !isOwnerHost) return B.J(403, { error: "Only the host can moderate a co-host" });
    const op = String(b.op), patch = {};
    if ((op === "cohost" || op === "uncohost" || op === "ban" || op === "unban") && !isOwnerHost) return B.J(403, { error: "Only the host can do that" });
    if (op === "mute") patch.muted = true; else if (op === "unmute") patch.muted = false;
    else if (op === "allow_speak") patch.can_speak = true; else if (op === "stop_speak") { patch.can_speak = false; if (t.role === "performer") patch.role = "audience"; }
    else if (op === "remove" || op === "ban") { patch.banned = true; }
    else if (op === "unban") patch.banned = false;
    else if ((op === "cohost" || op === "uncohost") && isOwnerHost) patch.role = op === "cohost" ? "cohost" : "audience"; else return B.J(400, { error: "Unknown moderation action" });
    if (patch.banned === true) { await B.sb("smoke_queue?session_id=eq." + s.id + "&user_id=eq." + t.user_id + "&status=in.(waiting,active)", { method: "PATCH", prefer: "return=minimal", body: { status: "removed", ended_at: new Date().toISOString() } }); if (s.current_queue_id) { const cq = rows(await B.sb("smoke_queue?id=eq." + s.current_queue_id + "&select=user_id,status"))[0]; if (cq && cq.user_id === t.user_id) await advance(s); } }
    await B.sb("smoke_members?session_id=eq." + s.id + "&user_id=eq." + t.user_id, { method: "PATCH", prefer: "return=minimal", body: patch }); await B.audit("user:" + u.email, "smoke_" + op, s.id, { target: t.user_id }); return B.J(200, { ok: true });
  }

  // ───────── beats: nothing plays without a recorded basis ─────────
  if (a === "s_beat_add") {
    const basis = String(b.rights_basis || ""); if (BASES.indexOf(basis) < 0) return B.J(400, { error: "Say why you can play this beat: you made it, the producer allowed it, you hold a licence, or it's royalty-free." });
    const rnote = clip(b.rights_note, 300);
    if (basis !== "own_production" && rnote.length < 4) return B.J(400, { error: "Add a short note: who allowed it, or what licence you hold" });
    let title = clip(b.title, 100), prod = clip(b.producer_name, 60), audio = null, source = "host_own", cat = null;
    if (UUID.test(String(b.catalog_beat_id || ""))) { // a beat from the POTENT catalog
      const it = rows(await B.sb("beat_items?id=eq." + b.catalog_beat_id + "&active=eq.true&select=id,title,preview_url,producer_id,beat_producers(name,email)"))[0]; if (!it) return B.J(404, { error: "That beat was not found" });
      if (!it.preview_url || !/^https:\/\/.+\.(mp3|wav|m4a|ogg|aac)(\?|$)/i.test(it.preview_url) && !/\/storage\/v1\/object\/public\//.test(it.preview_url)) return B.J(400, { error: "That beat's preview isn't a direct audio file, so it can't play here." });
      const mineBeat = it.beat_producers && String(it.beat_producers.email).toLowerCase() === u.email.toLowerCase();
      if (basis === "own_production" && !mineBeat) return B.J(400, { error: "That beat belongs to another producer. Choose \"producer allowed it\" and say how." });
      title = it.title; prod = it.beat_producers && it.beat_producers.name || prod; audio = it.preview_url; source = "catalog"; cat = it.id;
    } else if (UUID.test(String(b.lab_project_id || ""))) { // a finished mix from the host's own Beat Lab
      const lp = rows(await B.sb("lab_projects?id=eq." + b.lab_project_id + "&owner_user_id=eq." + u.id + "&live_ready=eq.true&select=title,export_ref"))[0]; if (!lp || !lp.export_ref) return B.J(404, { error: "Mark a finished mix as ready for live events in Beat Lab first" });
      title = title || lp.title; audio = lp.export_ref; source = "lab"; prod = prod || first(u.name);
    } else { audio = httpsUrl(b.audio_url); if (!audio) return B.J(400, { error: "Paste a direct https link to the audio" }); }
    if (title.length < 2) return B.J(400, { error: "Name the beat" });
    if (rows(await B.sb("smoke_beats?session_id=eq." + s.id + "&select=id&limit=101")).length > 100) return B.J(400, { error: "That's plenty of beats for one session" });
    const ins = rows(await B.sb("smoke_beats", { method: "POST", prefer: "return=representation", body: { session_id: s.id, added_by: u.id, title: title, producer_name: prod || null, audio_url: audio, source: source, catalog_beat_id: cat, status: "approved", rights_basis: basis, rights_note: rnote || null } }))[0];
    return B.J(200, { ok: true, id: ins && ins.id });
  }
  if (a === "s_beat_decide") {
    const bt = UUID.test(String(b.beat_id || "")) && rows(await B.sb("smoke_beats?id=eq." + b.beat_id + "&session_id=eq." + s.id + "&select=*"))[0]; if (!bt) return B.J(404, { error: "Beat not found" });
    if (b.approve !== true) { await B.sb("smoke_beats?id=eq." + bt.id, { method: "PATCH", prefer: "return=minimal", body: { status: "rejected" } }); return B.J(200, { ok: true }); }
    const basis = String(b.rights_basis || ""), rnote = clip(b.rights_note, 300), audio = httpsUrl(b.audio_url);
    if (BASES.indexOf(basis) < 0 || (basis !== "own_production" && rnote.length < 4)) return B.J(400, { error: "Record why this beat can be played before approving it" });
    if (!audio && !bt.audio_url) return B.J(400, { error: "Add the direct audio link you're allowed to play" });
    await B.sb("smoke_beats?id=eq." + bt.id, { method: "PATCH", prefer: "return=minimal", body: { status: "approved", rights_basis: basis, rights_note: rnote || null, audio_url: audio || bt.audio_url } }); return B.J(200, { ok: true });
  }
  if (a === "s_beat_request") { // anyone in the room can suggest a beat. It can't play until the host records the basis.
    if (tooMany("sbr:" + u.id + s.id, 5, 36e5)) return B.J(429, { error: "You've asked for a few beats already" }); note("sbr:" + u.id + s.id);
    const title = clip(b.title, 100); if (title.length < 2) return B.J(400, { error: "Name the beat you'd like" });
    await B.sb("smoke_beats", { method: "POST", prefer: "return=minimal", body: { session_id: s.id, added_by: u.id, title: title, producer_name: clip(b.producer_name, 60) || null, source: "requested", status: "requested" } }); return B.J(200, { ok: true });
  }
  if (a === "s_play") {
    if (b.stop === true) { await B.sb("smoke_sessions?id=eq." + s.id, { method: "PATCH", prefer: "return=minimal", body: { current_beat_id: null, beat_started_at: null, beat_paused: false } }); return B.J(200, { ok: true }); }
    const bt = UUID.test(String(b.beat_id || "")) && rows(await B.sb("smoke_beats?id=eq." + b.beat_id + "&session_id=eq." + s.id + "&select=*"))[0]; if (!bt) return B.J(404, { error: "Beat not found" });
    if (bt.status === "requested" || bt.status === "rejected" || !bt.rights_basis || !bt.audio_url) return B.J(403, { error: "This beat can't play yet. Record why you're allowed to play it first." });
    if (s.status !== "live") return B.J(400, { error: "Start the session first" });
    await B.sb("smoke_sessions?id=eq." + s.id, { method: "PATCH", prefer: "return=minimal", body: { current_beat_id: bt.id, beat_started_at: new Date().toISOString(), beat_paused: false } });
    await B.sb("smoke_beats?id=eq." + bt.id, { method: "PATCH", prefer: "return=minimal", body: { played_at: new Date().toISOString() } }); return B.J(200, { ok: true });
  }
  if (a === "s_beat_url") { // everyone in the room gets the link for the current beat only
    if (!s.current_beat_id) return B.J(404, { error: "No beat is playing" });
    const bt = rows(await B.sb("smoke_beats?id=eq." + s.current_beat_id + "&session_id=eq." + s.id + "&select=audio_url"))[0]; if (!bt || !bt.audio_url) return B.J(404, { error: "No beat is playing" });
    const url = await M.signedUrl(bt.audio_url, 7200); return url ? B.J(200, { ok: true, url: url }) : B.J(404, { error: "Beat not available" });
  }

  // ───────── everyone in the room ─────────
  if (a === "s_request_mic") {
    if (s.status !== "live") return B.J(400, { error: "The room isn't live yet" }); if (!s.requests_on) return B.J(400, { error: "The host isn't taking requests right now" });
    if (me.muted) return B.J(403, { error: "The host has muted you for now" });
    if (rows(await B.sb("smoke_queue?session_id=eq." + s.id + "&status=eq.waiting&select=id&limit=51")).length >= 50) return B.J(400, { error: "The line is full" });
    const ins = await B.sb("smoke_queue", { method: "POST", prefer: "return=representation", body: { session_id: s.id, user_id: u.id, display_name: me.display_name || first(u.name), beat_title: clip(b.beat_title, 80) || null } });
    if (!ins.ok) return B.J(409, { error: "You're already in line" });
    return B.J(200, { ok: true });
  }
  if (a === "s_leave_queue") { await B.sb("smoke_queue?session_id=eq." + s.id + "&user_id=eq." + u.id + "&status=eq.waiting", { method: "PATCH", prefer: "return=minimal", body: { status: "removed", ended_at: new Date().toISOString() } }); return B.J(200, { ok: true }); }
  if (a === "s_finish_turn") { // a performer can end their own turn early
    const cq = s.current_queue_id && rows(await B.sb("smoke_queue?id=eq." + s.current_queue_id + "&select=user_id"))[0];
    if (!cq || (cq.user_id !== u.id && !host)) return B.J(403, { error: "It's not your turn" }); await advance(s); return B.J(200, { ok: true });
  }
  if (a === "s_chat") {
    if (!s.chat_on) return B.J(400, { error: "Chat is off in this room" }); if (me.muted) return B.J(403, { error: "You're muted in this room" });
    const body = clip(b.body, 280); if (!body) return B.J(400, { error: "Say something" });
    if (tooMany("sc:" + u.id, 8, 10000)) return B.J(429, { error: "Easy. Give it a few seconds." }); note("sc:" + u.id, 10000);
    await B.sb("smoke_messages", { method: "POST", prefer: "return=minimal", body: { session_id: s.id, user_id: u.id, display_name: me.display_name || first(u.name), body: body } }); return B.J(200, { ok: true });
  }
  if (a === "s_react") {
    if (!s.reactions_on) return B.J(400, { error: "Reactions are off" }); if (EMOJI.indexOf(b.emoji) < 0) return B.J(400, { error: "Pick one of the room reactions" });
    if (tooMany("sr:" + u.id, 12, 10000)) return B.J(429, { error: "Easy" }); note("sr:" + u.id, 10000);
    await B.sb("smoke_reactions", { method: "POST", prefer: "return=minimal", body: { session_id: s.id, user_id: u.id, emoji: b.emoji } }); return B.J(200, { ok: true });
  }
  if (a === "s_vote") {
    if (!s.voting_on) return B.J(400, { error: "Voting is off in this room" });
    const q = UUID.test(String(b.queue_id || "")) && rows(await B.sb("smoke_queue?id=eq." + b.queue_id + "&session_id=eq." + s.id + "&select=id,user_id,status"))[0]; if (!q) return B.J(404, { error: "Not found" });
    if (q.user_id === u.id) return B.J(400, { error: "You can't vote for yourself" });
    const ins = await B.sb("smoke_votes", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { queue_id: q.id, voter_user_id: u.id } }); return ins.ok ? B.J(200, { ok: true }) : B.J(400, { error: "Could not vote" });
  }
  if (a === "s_report") {
    if (tooMany("srp:" + u.id, 10)) return B.J(429, { error: "Thanks. We have your reports." }); note("srp:" + u.id);
    const reason = clip(b.reason, 500); if (reason.length < 4) return B.J(400, { error: "Tell us what happened" });
    await B.sb("smoke_reports", { method: "POST", prefer: "return=minimal", body: { session_id: s.id, reporter_user_id: u.id, target_user_id: UUID.test(String(b.user_id || "")) ? b.user_id : null, reason: reason } }); return B.J(200, { ok: true, note: "Thanks. POTENT will review this. The host can also mute or remove people in the room." });
  }
  if (a === "s_block") {
    if (!UUID.test(String(b.user_id || "")) || b.user_id === u.id) return B.J(400, { error: "Bad person" });
    if (b.remove === true) await B.sb("smoke_blocks?user_id=eq." + u.id + "&blocked_user_id=eq." + b.user_id, { method: "DELETE", prefer: "return=minimal" });
    else await B.sb("smoke_blocks", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { user_id: u.id, blocked_user_id: b.user_id } });
    return B.J(200, { ok: true });
  }
  if (a === "s_follow") {
    if (!UUID.test(String(b.user_id || "")) || b.user_id === u.id) return B.J(400, { error: "Bad person" });
    if (b.remove === true) await B.sb("smoke_follows?user_id=eq." + u.id + "&followed_user_id=eq." + b.user_id, { method: "DELETE", prefer: "return=minimal" });
    else await B.sb("smoke_follows", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: { user_id: u.id, followed_user_id: b.user_id, session_id: s.id } });
    return B.J(200, { ok: true });
  }
  if (a === "s_connections") { // people who took the mic or made the beats, to follow up with after the session
    const q = rows(await B.sb("smoke_queue?session_id=eq." + s.id + "&status=eq.done&select=user_id,display_name")), pm = rows(await B.sb("smoke_members?session_id=eq." + s.id + "&role=in.(host,cohost,producer)&select=user_id,display_name,role"));
    const seen = {}; const list = []; q.concat(pm).forEach(function (x) { if (x.user_id !== u.id && !seen[x.user_id]) { seen[x.user_id] = 1; list.push({ user_id: x.user_id, name: x.display_name, role: x.role || "performer" }); } });
    const fo = rows(await B.sb("smoke_follows?user_id=eq." + u.id + "&select=followed_user_id")).map(function (f) { return f.followed_user_id; });
    return B.J(200, { ok: true, people: list.map(function (p) { p.following = fo.indexOf(p.user_id) >= 0; return p; }) });
  }
  if (a === "s_highlight_consent") { // a performer says their moment may be kept
    const h = UUID.test(String(b.highlight_id || "")) && rows(await B.sb("smoke_highlights?id=eq." + b.highlight_id + "&session_id=eq." + s.id + "&select=id,queue_id"))[0]; if (!h) return B.J(404, { error: "Not found" });
    const q = h.queue_id && rows(await B.sb("smoke_queue?id=eq." + h.queue_id + "&select=user_id"))[0]; if (!q || q.user_id !== u.id) return B.J(403, { error: "Only the performer can allow this" });
    await B.sb("smoke_highlights?id=eq." + h.id, { method: "PATCH", prefer: "return=minimal", body: { performer_ok: b.ok !== false } }); return B.J(200, { ok: true });
  }
  if (a === "s_highlights") { return B.J(200, { ok: true, highlights: rows(await B.sb("smoke_highlights?session_id=eq." + s.id + (host ? "" : "&published=eq.true") + "&select=*&order=created_at.desc&limit=50")) }); }
  if (a === "s_highlight") { // host bookmarks a moment. This does not record anything.
    const title = clip(b.title, 100); if (title.length < 2) return B.J(400, { error: "Name the moment" });
    const q = UUID.test(String(b.queue_id || "")) ? b.queue_id : s.current_queue_id;
    await B.sb("smoke_highlights", { method: "POST", prefer: "return=minimal", body: { session_id: s.id, queue_id: q || null, title: title, note: clip(b.note, 300) || null, created_by: u.id } }); return B.J(200, { ok: true });
  }
  if (a === "s_highlight_publish") { // shared only when the host's recording was on, rights were confirmed, and the performer agreed
    const h = UUID.test(String(b.highlight_id || "")) && rows(await B.sb("smoke_highlights?id=eq." + b.highlight_id + "&session_id=eq." + s.id + "&select=*"))[0]; if (!h) return B.J(404, { error: "Not found" });
    if (b.published === false) { await B.sb("smoke_highlights?id=eq." + h.id, { method: "PATCH", prefer: "return=minimal", body: { published: false } }); return B.J(200, { ok: true }); }
    if (s.recording !== "on" || !s.rights_ack) return B.J(400, { error: "Recording was off in this session, so highlights can't be published." });
    if (!h.performer_ok) return B.J(400, { error: "The performer hasn't agreed to share this moment yet" });
    await B.sb("smoke_highlights?id=eq." + h.id, { method: "PATCH", prefer: "return=minimal", body: { published: true } }); return B.J(200, { ok: true });
  }

  // ───────── optional helpers (rules first, AI only polishes, never required) ─────────
  if (a === "s_title") {
    const f = FORMATS[s.format] || "Session", ideas = [f + ": " + (clip(b.theme, 40) || "Open Floor"), "After Hours " + f, "Atlanta Late Night " + f, f + " Vol. 1"].map(function (x) { return clip(x, 90); });
    return B.J(200, { ok: true, ideas: ideas });
  }
  if (a === "s_recap") { // counts only. Chat text is never sent to AI.
    const done = rows(await B.sb("smoke_queue?session_id=eq." + s.id + "&status=eq.done&select=display_name")), beats = rows(await B.sb("smoke_beats?session_id=eq." + s.id + "&played_at=not.is.null&select=title,producer_name"));
    const facts = s.title + ": " + done.length + " turn" + (done.length === 1 ? "" : "s") + " on the mic" + (done.length ? " (" + done.map(function (x) { return x.display_name; }).join(", ") + ")" : "") + (beats.length ? ". Beats played: " + beats.map(function (x) { return x.title + (x.producer_name ? " by " + x.producer_name : ""); }).join(", ") : "") + ".";
    let text = facts; if (b.polish === true) { const r = await L.ai("smoke_recap", u.id, L.GUARD + "\nWrite a warm 2-sentence recap of this music session using ONLY these facts. Add nothing: " + facts, facts); if (r.text) text = r.text; }
    return B.J(200, { ok: true, text: text });
  }
  return B.J(400, { error: "Unknown action" });
};
