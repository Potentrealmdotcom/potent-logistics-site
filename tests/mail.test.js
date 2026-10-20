// Run: node tests/mail.test.js
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.SUPABASE_URL = "https://x.supabase.co"; process.env.AUTH_SECRET = "t";
const sent = [], notes = [];
global.fetch = async (u, o) => { u = String(u); o = o || {}; const R = d => ({ ok: true, status: 200, text: async () => JSON.stringify(d), json: async () => d });
  if (u.includes("api.resend.com")) { sent.push(JSON.parse(o.body)); return R({ id: "re_1" }); }
  if (u.includes("music_notifications")) { notes.push(JSON.parse(o.body)); return R([]); }
  if (u.includes("music_users")) return R([{ email: "fan@x.com" }]); return R([]); };
const notify = require("../netlify/functions/lib/notify.js");
(async () => {
  await notify({ user_id: "u1", kind: "order", title: "Paid", link: "/music/coins.html" }); ok(!sent.length && notes.length === 1, "no Resend key: in-app only, no error");
  process.env.RESEND_API_KEY = "rk";
  await notify({ user_id: "u1", kind: "order", title: "Paid <b>", link: "/music/coins.html" }); ok(sent.length === 1 && sent[0].from.includes("info@potentworld.online") && sent[0].to[0] === "fan@x.com", "order notice emailed from info@potentworld.online");
  ok(!/<b>/.test(sent[0].html) && /coins\.html/.test(sent[0].text), "html escaped, link included");
  await notify({ user_id: "u1", kind: "chat", title: "hi" }); ok(sent.length === 1, "low-importance notice stays in-app");
  const m = require("../netlify/functions/lib/mail.js"); ok((await m.send("not-an-email", "x")).skipped, "bad address skipped");
  console.log("PASS: " + n + " assertions");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
