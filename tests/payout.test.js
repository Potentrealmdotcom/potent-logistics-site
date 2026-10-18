// Run: node tests/payout.test.js  (owner-created payouts need owner token + secret code; store admins can't self-serve)
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; process.env.SUPABASE_URL = "https://x.supabase.co";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const P = "11111111-1111-1111-1111-111111111111", past = new Date(Date.now() - 864e5).toISOString();
const T = { beat_producers: [{ id: P, name: "Breeze", email: "breeze", active: true, kind: "platform", store_admin: true, payout_method: null, payout_handle: null, hold_days: 0 }], beat_wallet_txns: [{ producer_id: P, type: "sale", amount_cents: 20000, available_at: past, ref: "s1" }], beat_payouts: [], beat_audit: [], beat_settings: [] };
require("./_mock.js")(T, { defaults: { beat_wallet_txns: { available_at: past } } });
const A = require("../netlify/functions/beat-api.js"), B = require("../netlify/functions/lib/beats.js");
const tok = (() => { const b = Buffer.from(JSON.stringify({ role: "owner", exp: Date.now() + 1e6 })).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); return b + "." + Buffer.from(require("crypto").createHmac("sha256", "t").update(b).digest()).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); })();
const call = async (b, t) => { const r = await A.handler({ httpMethod: "POST", headers: { authorization: "Bearer " + (t === undefined ? tok : t) }, body: JSON.stringify(b) }); return { s: r.statusCode, j: JSON.parse(r.body) }; };
(async () => {
  let r = await call({ action: "o_payout_create", id: P, code: "x" }, "bad"); ok(r.s === 403, "not without the owner token");
  r = await call({ action: "o_payout_create", id: P, code: "x" }); ok(r.s === 403 && /code/i.test(r.j.error), "locked until a payout code exists");
  T.beat_settings.push({ key: "payout_code", value: { hash: B.hashPw("secret-code") } });
  r = await call({ action: "o_payout_create", id: P, code: "wrong" }); ok(r.s === 401 && !T.beat_payouts.length, "wrong code refused, nothing created");
  r = await call({ action: "o_payout_create", id: P, code: "secret-code", amount_cents: 999999 }); ok(r.s === 400, "cannot exceed the available balance");
  r = await call({ action: "o_payout_create", id: P, code: "secret-code" }); ok(r.s === 200 && r.j.amount_cents === 20000 && T.beat_payouts[0].status !== "paid", "owner creates a pending payout for the full balance");
  ok((await B.balances(P)).available === 0, "wallet debited once");
  r = await call({ action: "o_payout_create", id: P, code: "secret-code" }); ok(r.s === 400, "nothing left to pay out");
  console.log("PASS: " + n + " assertions");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
