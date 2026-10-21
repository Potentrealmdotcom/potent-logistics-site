// Run: node tests/gemini-helper.test.js  (no network). The shared Gemini caller: low-thinking hint, retry without it on a 400, per-call timeout.
process.env.GEMINI_API_KEY = "gk";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const G = require("../netlify/functions/lib/gemini.js");
(async () => {
  let calls = []; const f = async (u, o) => { calls.push(JSON.parse(o.body)); return { ok: true, status: 200 }; };
  await G.chat({ model: "m", messages: [] }, { fetchImpl: f }); ok(calls.length === 1 && calls[0].reasoning_effort === "low" && calls[0].model === "m", "asks for low thinking");
  calls = []; const f2 = async (u, o) => { const b = JSON.parse(o.body); calls.push(b); return b.reasoning_effort ? { ok: false, status: 400 } : { ok: true, status: 200 }; };
  const r = await G.chat({ model: "m" }, { fetchImpl: f2 }); ok(calls.length === 2 && !calls[1].reasoning_effort && r.ok, "if Gemini rejects the hint it retries once without it");
  calls = []; const f3 = async () => { calls.push(1); return { ok: false, status: 500 }; }; const r3 = await G.chat({}, { fetchImpl: f3 }); ok(calls.length === 1 && r3.status === 500, "other errors are not retried");
  let sig = null; const f4 = async (u, o) => { sig = o.signal; return { ok: true, status: 200 }; }; await G.chat({}, { fetchImpl: f4, timeoutMs: 1234 }); ok(sig && typeof sig.aborted === "boolean", "every call carries a timeout signal");
  const slow = (u, o) => new Promise((res, rej) => { o.signal.addEventListener("abort", () => rej(o.signal.reason)); });
  let err = null; try { await G.chat({}, { fetchImpl: slow, timeoutMs: 30 }); } catch (e) { err = e; } ok(err && err.name === "TimeoutError", "a slow answer becomes a clear TimeoutError instead of a platform error");
  console.log("PASS: " + n + " assertions");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
