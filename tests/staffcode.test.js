// Run: node tests/staffcode.test.js  (no network). Staff email sign-in codes.
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.RESEND_API_KEY = "rk"; process.env.OWNER_ALERT_EMAIL = "boss@potent.test";
process.env.STAFF_PASSWORDS_JSON = JSON.stringify({ potent: { p: "x", r: "owner" }, dispatch1: { p: "y", r: "dispatch" } });
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
let rows = {}, mails = [], revoked = [], tableMissing = false;
global.fetch = async (u, o) => { u = String(u); o = o || {}; const body = o.body ? JSON.parse(o.body) : null, M = o.method || "GET";
  if (u.includes("api.resend.com")) { mails.push(body); return { ok: true, status: 200, text: async () => "{}", json: async () => ({}) }; }
  const R = (st, d) => ({ ok: st < 300, status: st, text: async () => JSON.stringify(d), json: async () => d });
  if (u.includes("/rest/v1/revoked_users")) return R(200, revoked.map(x => ({ user_id: x })).filter(x => u.includes("eq." + x.user_id)));
  if (u.includes("/rest/v1/staff_logins")) { if (tableMissing) return R(404, {}); const m = u.match(/user_id=eq\.([^&]+)/);
    if (M === "GET") return R(200, m && rows[decodeURIComponent(m[1])] ? [rows[decodeURIComponent(m[1])]] : []);
    if (M === "POST") { rows[body.user_id] = Object.assign({ tries: 0 }, rows[body.user_id], body); return R(201, []); }
    if (M === "PATCH") { Object.assign(rows[decodeURIComponent(m[1])], body); return R(204, []); } }
  return R(200, []); };
const auth = require("../netlify/functions/auth.js");
const call = async (b, ip) => { const r = await auth.handler({ httpMethod: "POST", headers: { "x-nf-client-connection-ip": ip || "1.1.1.1" }, body: JSON.stringify(b) }); return [r.statusCode, JSON.parse(r.body)]; };
(async () => {
  let [s, r] = await call({ action: "staffcode_send", userId: "potent" });
  ok(s === 200 && r.ok && mails.length === 1 && mails[0].to[0] === "boss@potent.test" && /^bo\*\*\*@/.test(r.sent_to), "owner gets a code at the owner alert email; the reply masks the address");
  const code = (mails[0].text.match(/code is (\d{6})/) || [])[1]; ok(!!code && !JSON.stringify(rows).includes(code), "a 6-digit code is emailed and only its hash is stored");
  [s, r] = await call({ action: "staffcode_verify", userId: "potent", code: "000000" }, "2.2.2.2"); ok(s === 401 && !r.token, "wrong code refused");
  [s, r] = await call({ action: "staffcode_verify", userId: "dispatch1", code }, "3.3.3.3"); ok(s === 401, "the code does not work for a different person");
  [s, r] = await call({ action: "staffcode_verify", userId: "potent", code }, "4.4.4.4"); ok(s === 200 && r.ok && r.role === "owner" && r.token, "right code signs in with the real role");
  [s, r] = await call({ action: "staffcode_verify", userId: "potent", code }, "5.5.5.5"); ok(s === 401, "a code works only once");
  [s, r] = await call({ action: "staffcode_send", userId: "dispatch1" }, "6.6.6.6"); ok(s === 404 && /No email/.test(r.error), "non-owner with no email on file is told to ask the owner");
  rows.dispatch1 = { user_id: "dispatch1", email: "d@x.com", tries: 0 }; [s, r] = await call({ action: "staffcode_send", userId: "dispatch1" }, "6.6.6.6"); ok(s === 200 && mails[mails.length - 1].to[0] === "d@x.com", "owner-registered email receives the code");
  const c2 = mails[mails.length - 1].text.match(/code is (\d{6})/)[1]; for (let i = 0; i < 5; i++) await call({ action: "staffcode_verify", userId: "dispatch1", code: "111111" }, "7.7.7." + i);
  [s, r] = await call({ action: "staffcode_verify", userId: "dispatch1", code: c2 }, "8.8.8.8"); ok(s === 401, "after 5 wrong tries the code is dead even if correct");
  rows.potent.code_exp = new Date(Date.now() - 1000).toISOString(); [s, r] = await call({ action: "staffcode_verify", userId: "potent", code }, "9.9.9.9"); ok(s === 401, "expired code refused");
  [s, r] = await call({ action: "staffcode_send", userId: "nobody" }, "10.0.0.1"); ok(s === 401 && mails.length === 2, "unknown user: no email sent");
  revoked = ["potent"]; [s, r] = await call({ action: "staffcode_send", userId: "potent" }, "10.0.0.2"); ok(s === 403, "revoked staff cannot get a code");
  revoked = []; tableMissing = true; [s, r] = await call({ action: "staffcode_send", userId: "potent" }, "10.0.0.3"); ok(s === 503 && /password/.test(r.error), "table not created yet: says so and points to the password");
  tableMissing = false; let last; for (let i = 0; i < 9; i++) [last] = await call({ action: "staffcode_send", userId: "potent" }, "11.0.0.1"); ok(last === 429, "code requests are rate limited");
  console.log("PASS: " + n + " assertions"); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
