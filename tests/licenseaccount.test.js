// Run: node tests/licenseaccount.test.js  (a buyer's login choice: only for a PAID license, password stored hashed)
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const T = { os_licenses: [{ email: "buyer@co.com", status: "active", company: "Co" }, { email: "pending@co.com", status: "pending" }] };
require("./_mock.js")(T, {});
const auth = require("../netlify/functions/auth.js");
const call = async (b, ip) => { const r = await auth.handler({ httpMethod: "POST", headers: { "x-nf-client-connection-ip": ip || "1.1.1.1" }, body: JSON.stringify(Object.assign({ action: "licenseaccount" }, b)) }); return [r.statusCode, JSON.parse(r.body)]; };
(async () => {
  let [s, r] = await call({ email: "stranger@x.com", username: "u", password: "secret1" }); ok(s === 404 && !T.os_licenses.some(x => x.account_password), "no paid license for that email: nothing saved");
  [s, r] = await call({ email: "pending@co.com", username: "u", password: "secret1" }, "2.2.2.2"); ok(s === 404, "an unpaid (pending) license cannot set a login");
  [s, r] = await call({ email: "buyer@co.com", username: "buyer", password: "123" }, "3.3.3.3"); ok(s === 400, "short password refused");
  [s, r] = await call({ email: "buyer@co.com", username: "buyer", password: "secret1" }, "4.4.4.4");
  const row = T.os_licenses[0]; ok(s === 200 && row.account_username === "buyer" && /^scrypt\$/.test(row.account_password) && !JSON.stringify(row).includes("secret1"), "paid buyer: login saved with the password hashed, never plain");
  let last; for (let i = 0; i < 10; i++) [last] = await call({ email: "stranger@x.com", username: "u", password: "secret1" }, "9.9.9.9"); ok(last === 429, "guessing emails is rate limited");
  console.log("PASS: " + n + " assertions");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
