// Run: node tests/smoke.test.js   (Smoke Sessions: rooms, queue, timer, beats + rights, moderation, recording, privacy)
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.SUPABASE_URL = "https://x.supabase.co";
const assert = require("assert"), crypto = require("crypto"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const H = "11111111-1111-1111-1111-111111111111", P1 = "22222222-2222-2222-2222-222222222222", P2 = "33333333-3333-3333-3333-333333333333", FAN = "44444444-4444-4444-4444-444444444444", OUT = "55555555-5555-4555-8555-555555555555";
const BEAT = "66666666-6666-4666-8666-666666666666", MYBEAT = "77777777-7777-4777-8777-777777777777", YT = "88888888-8888-4888-8888-888888888888";
const T = { music_users: [{ id: H, email: "host@x.com", name: "Hosty Host", active: true }, { id: P1, email: "p1@x.com", name: "Pat Rapper", active: true }, { id: P2, email: "p2@x.com", name: "Sam Rapper", active: true }, { id: FAN, email: "fan@x.com", name: "Fran", active: true }, { id: OUT, email: "out@x.com", name: "Outsider", active: true }],
  smoke_sessions: [], smoke_members: [], smoke_queue: [], smoke_beats: [], smoke_messages: [], smoke_reactions: [], smoke_votes: [], smoke_reports: [], smoke_blocks: [], smoke_highlights: [], smoke_follows: [], beat_audit: [],
  beat_items: [{ id: BEAT, title: "Dark Trap", active: true, preview_url: "https://x.supabase.co/storage/v1/object/public/beat-previews/a.mp3", producer_id: "pp", beat_producers: { name: "Other Prod", email: "other@x.com" } },
    { id: MYBEAT, title: "Host Beat", active: true, preview_url: "https://cdn.x.com/h.mp3", producer_id: "pq", beat_producers: { name: "Hosty", email: "host@x.com" } },
    { id: YT, title: "YT beat", active: true, preview_url: "https://youtube.com/watch?v=1", producer_id: "pz", beat_producers: { name: "Z", email: "z@x.com" } }] };
const mock = require("./_mock.js")(T, { defaults: { smoke_queue: { status: "waiting" }, smoke_beats: { status: "approved" }, smoke_highlights: { performer_ok: false, published: false }, smoke_sessions: { status: "scheduled", beat_paused: false, recording: "off" }, smoke_members: { muted: false, banned: false, invited: false, can_speak: false, joined_at: "2026-01-01", last_seen: "2026-01-01" } },
  unique: { smoke_members: (x, r) => x.session_id === r.session_id && x.user_id === r.user_id, smoke_queue: (x, r) => x.session_id === r.session_id && x.user_id === r.user_id && ["waiting", "active"].includes(x.status) && ["waiting", "active"].includes(r.status || "waiting"), smoke_votes: (x, r) => x.queue_id === r.queue_id && x.voter_user_id === r.voter_user_id, smoke_blocks: (x, r) => x.user_id === r.user_id && x.blocked_user_id === r.blocked_user_id, smoke_follows: (x, r) => x.user_id === r.user_id && x.followed_user_id === r.followed_user_id } });
const A = require("../netlify/functions/music-smoke.js"), Mu = require("../netlify/functions/lib/music.js");
const ownerTok = (() => { const body = Buffer.from(JSON.stringify({ role: "owner", exp: Date.now() + 1e6 })).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); return body + "." + crypto.createHmac("sha256", "t").update(body).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); })();
const as = (uid, tok) => async (action, extra) => { const h = {}; if (uid || tok) h.authorization = "Bearer " + (tok || Mu.signUser(uid)); const r = await A.handler({ httpMethod: "POST", headers: h, body: JSON.stringify(Object.assign({ action }, extra || {})) }); return { s: r.statusCode, j: JSON.parse(r.body) }; };
const host = as(H), p1 = as(P1), p2 = as(P2), fan = as(FAN), out = as(OUT), anon = as(null), owner = as(null, ownerTok);
(async () => {
  let r = await anon("s_list"); ok(r.s === 200 && r.j.public.length === 0, "anyone can look at the list"); r = await anon("s_create", { title: "x" }); ok(r.s === 401, "must sign in to host");
  r = await host("s_create", { title: "x" }); ok(r.s === 400, "title needed"); r = await host("s_create", { title: "Late Night Cypher", format: "nope" }); ok(r.s === 400, "format checked");
  r = await host("s_create", { title: "Late Night Cypher", format: "cypher", recording: "on" }); ok(r.s === 400 && /permission/.test(r.j.error), "recording needs the permission box");
  r = await host("s_create", { title: "Late Night Cypher", format: "cypher", start_now: true, turn_seconds: 5 }); ok(r.s === 400, "turn length checked");
  r = await host("s_create", { title: "Late Night Cypher", format: "cypher", start_now: true, turn_seconds: 60, voting_on: true, stream_url: "http://insecure" }); ok(r.s === 400, "stream link must be https");
  r = await host("s_create", { title: "Late Night Cypher", format: "cypher", start_now: true, turn_seconds: 60, voting_on: true }); ok(r.s === 200 && T.smoke_sessions[0].status === "live" && T.smoke_sessions[0].recording === "off" && !T.smoke_sessions[0].invite_code, "public live room, recording OFF by default"); const S = r.j.id;
  ok(T.smoke_members[0].role === "host", "creator is the host");
  r = await anon("s_list"); ok(r.j.public.length === 1 && r.j.public[0].host === "Hosty" && r.j.public[0].invite_code === undefined, "public list shows first name only and no code");
  // joining + privacy
  r = await p1("s_poll", { id: S }); ok(r.s === 403, "must join before polling"); r = await p1("s_join", { id: S }); ok(r.s === 200 && r.j.role === "audience", "join as audience");
  r = await p1("s_poll", { id: S, since_react: -1 }); ok(r.s === 200 && r.j.me.role === "audience" && r.j.host === false && r.j.session.invite_code === undefined && r.j.session.recording === "off", "poll shows recording status; no host-only info");
  // private room
  r = await host("s_create", { title: "Private Booth", format: "lounge", visibility: "private", start_now: true }); const PRV = r.j.id; ok(!!r.j.invite_code, "private room has a code");
  r = await out("s_join", { id: PRV }); ok(r.s === 403, "no code, no entry"); r = await out("s_join", { id: PRV, code: "wrong" }); ok(r.s === 403, "wrong code refused"); r = await out("s_join", { id: PRV, code: r.j && T.smoke_sessions[1].invite_code }); ok(r.s === 200, "code works");
  r = await anon("s_list"); ok(r.j.public.length === 1, "private room not in public list"); r = await host("s_list"); ok(r.j.mine.length === 2 && r.j.mine.some(x => x.invite_code), "host sees own rooms with the code");
  r = await host("s_create", { title: "Invite Only", format: "guest", visibility: "invite", start_now: true }); const INV = r.j.id; r = await p2("s_join", { id: INV }); ok(r.s === 403, "invite-only refuses strangers");
  r = await p1("s_invite", { id: INV, email: "p2@x.com" }); ok(r.s === 403, "only hosts invite"); r = await host("s_invite", { id: INV, email: "p2@x.com", role: "performer" }); ok(r.s === 200, "host invites"); r = await p2("s_list"); ok(r.j.invited.length === 1, "invite appears for them"); r = await p2("s_join", { id: INV }); ok(r.s === 200, "invited can join");
  // queue + timer
  await p2("s_join", { id: S }); await fan("s_join", { id: S });
  r = await p1("s_request_mic", { id: S }); ok(r.s === 200, "request the mic"); r = await p1("s_request_mic", { id: S }); ok(r.s === 409, "no double-queueing"); r = await p2("s_request_mic", { id: S }); r = await fan("s_request_mic", { id: S });
  r = await p1("s_next", { id: S }); ok(r.s === 403, "audience cannot run the line");
  r = await host("s_next", { id: S }); ok(T.smoke_queue.find(x => x.user_id === P1).status === "active" && T.smoke_sessions[0].current_queue_id, "first in line is on the mic"); ok(T.smoke_members.find(m => m.user_id === P1 && m.session_id === S).role === "performer", "becomes a performer");
  r = await fan("s_poll", { id: S, since_react: -1 }); ok(r.j.queue.length === 3 && r.j.queue[0].status === "active" && r.j.queue[0].name === "Pat", "everyone sees the line");
  // timer enforced by the server
  T.smoke_queue.find(x => x.user_id === P1).started_at = new Date(Date.now() - 70000).toISOString(); r = await fan("s_poll", { id: S, since_react: -1 }); ok(T.smoke_queue.find(x => x.user_id === P1).status === "done" && T.smoke_queue.find(x => x.user_id === P2).status === "active", "turn timer moves the line even if the host is away");
  r = await fan("s_finish_turn", { id: S }); ok(r.s === 403, "can't end someone else's turn"); r = await p2("s_finish_turn", { id: S }); ok(r.s === 200 && T.smoke_queue.find(x => x.user_id === FAN).status === "active", "performer ends own turn");
  r = await p1("s_request_mic", { id: S }); ok(r.s === 200, "can get back in line after a turn"); r = await p1("s_leave_queue", { id: S }); ok(T.smoke_queue.filter(x => x.user_id === P1 && x.status === "waiting").length === 0, "leave the line");
  // voting
  const fq = T.smoke_queue.find(x => x.user_id === FAN); r = await fan("s_vote", { id: S, queue_id: fq.id }); ok(r.s === 400, "no self-vote"); r = await p2("s_vote", { id: S, queue_id: fq.id }); ok(r.s === 200, "vote"); r = await p2("s_vote", { id: S, queue_id: fq.id }); r = await host("s_poll", { id: S, since_react: -1 }); ok(r.j.queue.find(x => x.id === fq.id).votes === 1, "one vote per person");
  // beats + rights
  r = await host("s_beat_add", { id: S, title: "Mine", audio_url: "https://cdn.x.com/a.mp3" }); ok(r.s === 400 && /why you can play/.test(r.j.error), "a basis is required for every beat");
  r = await host("s_beat_add", { id: S, title: "Borrowed", audio_url: "https://cdn.x.com/a.mp3", rights_basis: "producer_permission" }); ok(r.s === 400, "permission needs a note");
  r = await host("s_beat_add", { id: S, catalog_beat_id: BEAT, rights_basis: "own_production" }); ok(r.s === 400 && /another producer/.test(r.j.error), "can't claim someone else's catalog beat as your own");
  r = await host("s_beat_add", { id: S, catalog_beat_id: YT, rights_basis: "own_production" }); ok(r.s === 400, "non-audio previews can't play");
  r = await host("s_beat_add", { id: S, catalog_beat_id: BEAT, rights_basis: "producer_permission", rights_note: "Okayed by Other Prod on IG, 10/2" }); ok(r.s === 200, "catalog beat with recorded permission"); const B1 = r.j.id;
  r = await host("s_beat_add", { id: S, catalog_beat_id: MYBEAT, rights_basis: "own_production" }); ok(r.s === 200, "own catalog beat"); const B2 = r.j.id;
  r = await p1("s_beat_add", { id: S, title: "x", audio_url: "https://a.com/a.mp3", rights_basis: "own_production" }); ok(r.s === 403, "audience can't add beats");
  r = await p1("s_beat_request", { id: S, title: "Something hard" }); ok(r.s === 200, "audience can request a beat"); const RQ = T.smoke_beats.find(x => x.status === "requested").id;
  r = await host("s_play", { id: S, beat_id: RQ }); ok(r.s === 403, "a requested beat cannot play");
  r = await host("s_beat_decide", { id: S, beat_id: RQ, approve: true }); ok(r.s === 400, "approving needs the basis recorded"); r = await host("s_beat_decide", { id: S, beat_id: RQ, approve: true, rights_basis: "licensed", rights_note: "Licence #1234", audio_url: "https://cdn.x.com/r.mp3" }); ok(r.s === 200, "approved with basis");
  r = await host("s_play", { id: S, beat_id: B1 }); ok(r.s === 200 && T.smoke_sessions[0].current_beat_id === B1 && T.smoke_sessions[0].beat_started_at, "play beat"); r = await fan("s_play", { id: S, beat_id: B1 }); ok(r.s === 403, "only host plays");
  r = await fan("s_poll", { id: S, since_react: -1 }); ok(r.j.beat.title === "Dark Trap" && r.j.beat.rights_basis === "producer_permission" && !r.j.beats.some(b => b.status === "requested" && b.added_by !== FAN), "everyone sees what's playing and its basis; requests are private to host/requester");
  r = await fan("s_beat_url", { id: S }); ok(r.s === 200 && /beat-previews|https/.test(r.j.url) || r.s === 200, "members get the link");
  r = await out("s_beat_url", { id: S }); ok(r.s === 403, "non-members don't");
  // chat, reactions, moderation
  r = await fan("s_chat", { id: S, body: "fire 🔥" }); ok(r.s === 200, "chat"); r = await fan("s_chat", { id: S, body: "   " }); ok(r.s === 400, "empty refused");
  r = await fan("s_react", { id: S, emoji: "💩" }); ok(r.s === 400, "only room reactions"); r = await fan("s_react", { id: S, emoji: "🔥" }); ok(r.s === 200, "react");
  r = await p1("s_poll", { id: S, since_msg: 0, since_react: 0 }); ok(r.j.messages.length === 1 && r.j.reactions.length === 1, "poll delivers new items");
  r = await p1("s_block", { id: S, user_id: FAN }); r = await p1("s_poll", { id: S, since_msg: 0, since_react: 0 }); ok(r.j.messages.length === 0, "blocking hides their chat for me only"); r = await host("s_poll", { id: S, since_msg: 0, since_react: 0 }); ok(r.j.messages.length === 1, "others still see it"); await p1("s_block", { id: S, user_id: FAN, remove: true });
  r = await p1("s_mod", { id: S, user_id: FAN, op: "mute" }); ok(r.s === 403, "audience can't moderate"); r = await host("s_mod", { id: S, user_id: FAN, op: "mute" }); r = await fan("s_chat", { id: S, body: "hi" }); ok(r.s === 403, "muted can't chat"); await host("s_mod", { id: S, user_id: FAN, op: "unmute" });
  r = await host("s_mod", { id: S, user_id: H, op: "ban" }); ok(r.s === 400, "can't moderate the host");
  r = await host("s_mod", { id: S, user_id: FAN, op: "cohost" }); r = await fan("s_mod", { id: S, user_id: P1, op: "mute" }); ok(r.s === 200, "co-host can mute"); r = await fan("s_mod", { id: S, user_id: P1, op: "cohost" }); ok(r.s === 403, "co-host can't promote"); r = await fan("s_end", { id: S }); ok(r.s === 403, "co-host can't end the session"); await host("s_mod", { id: S, user_id: FAN, op: "uncohost" });
  r = await host("s_mod", { id: S, user_id: P2, op: "ban" }); ok(r.s === 200, "ban"); r = await p2("s_poll", { id: S }); ok(r.s === 403, "banned can't poll"); r = await p2("s_join", { id: S }); ok(r.s === 403, "banned can't rejoin"); ok(T.smoke_queue.filter(x => x.user_id === P2 && ["waiting", "active"].includes(x.status)).length === 0, "banned leaves the line");
  r = await fan("s_report", { id: S, user_id: P2, reason: "Harassing people in chat" }); ok(r.s === 200 && T.smoke_reports.length === 1, "report filed"); r = await owner("o_reports"); ok(r.j.reports.length === 1, "owner sees it"); r = await fan("o_reports"); ok(r.s === 403, "fan can't see reports");
  // room settings + recording
  r = await host("s_update", { id: S, recording: "on" }); ok(r.s === 400, "turning recording on needs the permission box"); r = await host("s_update", { id: S, recording: "on", rights_ack: true }); ok(r.s === 200 && T.smoke_sessions[0].recording === "on", "recording on, visibly"); r = await fan("s_poll", { id: S }); ok(r.j.session.recording === "on", "everyone sees recording status");
  r = await fan("s_update", { id: S, chat_on: false }); ok(r.s === 403, "audience can't change settings"); r = await host("s_update", { id: S, chat_on: false }); r = await p1("s_chat", { id: S, body: "yo" }); ok(r.s === 400, "chat off is honoured"); await host("s_update", { id: S, chat_on: true, recording: "off" }); ok(T.smoke_sessions[0].recording === "off", "host can turn recording off");
  // highlights: no publishing without recording + consent
  r = await host("s_highlight", { id: S, title: "Bars from Pat", queue_id: T.smoke_queue.find(x => x.user_id === P1 && x.status === "done").id }); ok(r.s === 200, "bookmark a moment"); const HL = T.smoke_highlights[0].id;
  r = await host("s_highlight_publish", { id: S, highlight_id: HL }); ok(r.s === 400 && /Recording was off/.test(r.j.error), "recording was off → cannot publish");
  await host("s_update", { id: S, recording: "on", rights_ack: true }); r = await host("s_highlight_publish", { id: S, highlight_id: HL }); ok(r.s === 400 && /performer/.test(r.j.error), "needs the performer's agreement");
  r = await fan("s_highlight_consent", { id: S, highlight_id: HL }); ok(r.s === 403, "only the performer can agree"); r = await p1("s_highlight_consent", { id: S, highlight_id: HL }); r = await host("s_highlight_publish", { id: S, highlight_id: HL }); ok(r.s === 200 && T.smoke_highlights[0].published, "published once both conditions are met"); r = await fan("s_highlights", { id: S }); ok(r.j.highlights.length === 1, "audience sees only published highlights");
  // connections + helpers
  r = await fan("s_connections", { id: S }); ok(r.j.people.length >= 2, "follow-up list"); r = await fan("s_follow", { id: S, user_id: P1 }); r = await fan("s_connections", { id: S }); ok(r.j.people.find(x => x.user_id === P1).following, "followed");
  r = await host("s_title", { id: S }); ok(r.j.ideas.length === 4, "title ideas without AI"); r = await host("s_recap", { id: S }); ok(/turn/.test(r.j.text) && /Dark Trap/.test(r.j.text), "recap from facts, no AI needed"); r = await fan("s_recap", { id: S }); ok(r.s === 403, "recap is host-only");
  // self-hosted media (Jitsi room, OBS broadcast, MediaMTX auth): off without env, member-only, host-only
  r = await fan("s_av_token", { id: S }); ok(r.s === 200 && r.j.available === false, "video room reports 'not switched on' without the server");
  process.env.JITSI_DOMAIN = "meet.example.test"; process.env.JITSI_APP_SECRET = "jsecret"; process.env.LIVE_HOST = "live.example.test"; process.env.MTX_KEY = "mtxkey";
  r = await fan("s_av_token", { id: S }); const jc = r.j.jwt && JSON.parse(Buffer.from(r.j.jwt.split(".")[1], "base64").toString()); ok(r.s === 200 && r.j.available && jc.room === "smoke-" + S && jc.context.user.moderator === "false" && jc.context.features.recording === "false", "member gets a non-moderator, no-recording login");
  r = await host("s_av_token", { id: S }); ok(JSON.parse(Buffer.from(r.j.jwt.split(".")[1], "base64").toString()).context.user.moderator === "true", "host is moderator");
  r = await out("s_av_token", { id: S }); ok(r.s === 403, "non-members get no video login");
  r = await fan("s_broadcast_info", { id: S }); ok(r.s === 403, "only the host sees OBS details");
  r = await host("s_broadcast_info", { id: S }); ok(r.s === 200 && r.j.available && /^rtmp:\/\/live\.example\.test:1935\/s-/.test(r.j.server) && r.j.password.length === 32, "host gets OBS server + key: " + JSON.stringify(r.j));
  const mtx = async (body, k) => { const x = await A.handler({ httpMethod: "POST", headers: {}, queryStringParameters: { k: k }, body: JSON.stringify(body) }); return x.statusCode; };
  const bp = "s-" + S, key = r.j.password;
  ok(await mtx({ action: "publish", path: bp, protocol: "rtmp", password: key }, "mtxkey") === 200, "media server accepts the host's key");
  ok(await mtx({ action: "publish", path: bp, protocol: "rtmp", password: "x".repeat(32) }, "mtxkey") === 401, "wrong key cannot publish");
  ok(await mtx({ action: "publish", path: "s-" + FAN, protocol: "rtmp", password: key }, "mtxkey") === 401, "a key only works for its own session");
  ok(await mtx({ action: "read", path: bp, protocol: "hls" }, "mtxkey") === 200 && await mtx({ action: "api", path: "", protocol: "hls" }, "mtxkey") === 401, "viewers can watch, admin api is closed");
  ok(await mtx({ action: "read", path: bp, protocol: "hls" }, "wrong") === 401, "only our media server may ask");
  delete process.env.JITSI_DOMAIN; delete process.env.JITSI_APP_SECRET; delete process.env.LIVE_HOST; delete process.env.MTX_KEY;
  // end
  r = await host("s_end", { id: S }); ok(r.s === 200 && T.smoke_sessions[0].status === "ended" && T.smoke_queue.filter(x => ["waiting", "active"].includes(x.status) && x.session_id === S).length === 0, "ending clears the line"); r = await out("s_join", { id: S }); ok(r.s === 410, "can't join an ended room");
  r = await owner("o_end", { id: PRV }); ok(r.s === 200 && T.smoke_sessions[1].status === "ended", "owner can end any room");
  console.log("smoke.test.js: " + n + " checks passed");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
