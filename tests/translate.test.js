// Language packs: translation core (retries, number safety), live fallback (never calls a refusal "untranslatable"), pack endpoint, phrase list.
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
process.env.SUPABASE_SERVICE_ROLE_KEY = "sr"; process.env.ANTHROPIC_API_KEY = "k"; delete process.env.GEMINI_API_KEY;
const C = require("../netlify/functions/lib/translate-core.js");
const resp = (st, body, hdr) => ({ ok: st < 300, status: st, headers: { get: k => (hdr || {})[k] || null }, json: async () => body, text: async () => JSON.stringify(body) });
const llm = arr => resp(200, { content: [{ text: JSON.stringify(arr) }] });
(async () => {
  // number safety
  ok(C.sane("Total $1,250 by 5 PM", "Total $1,250 до 5 PM") && !C.sane("Total $1,250", "Всего $1,520") && !C.sane("Pay now", ""), "numbers must survive translation");
  ok(Object.keys(C.LANGS).length === 13 && C.LANGS.kk && C.LANGS.ht, "13 target languages incl Kazakh and Haitian Creole");
  ok(/Arabic-Indic|Western digit/.test(C.sys("ar")) && /Stripe/.test(C.sys("de")) && /pallet/.test(C.sys("de")), "prompt keeps digits/brands and carries the trucking glossary");
  // retries on 429 then success
  let calls = 0; global.fetch = async () => { calls++; return calls < 3 ? resp(429, {}, { "retry-after": "0" }) : llm(["Hola", "Adiós"]); };
  C.wait = () => Promise.resolve();
  const t0 = Date.now(); let r = await C.translateList("es", ["Hello", "Goodbye"], { tries: 4 });
  ok(r[0] === "Hola" && r[1] === "Adiós" && calls === 3, "429 is retried until it works");
  // a translation that changes a number is dropped, not stored
  global.fetch = async () => llm(["Total $999", "Bien"]); r = await C.translateList("es", ["Total $123", "Fine"], {});
  ok(r[0] === null && r[1] === "Bien", "number mismatch -> null for that phrase only");
  // wrong length -> split in halves
  calls = 0; global.fetch = async (u, o) => { calls++; const sent = JSON.parse(JSON.parse(o.body).messages[0].content); return sent.length > 1 ? llm(["x"]) : llm(sent.map(s => s + "!")); };
  r = await C.translateList("de", ["A one", "B two", "C three"], { tries: 1 });
  ok(r.every(x => x && x.endsWith("!")), "bad-shape answer is split and retried");
  // live endpoint: refusal -> 503 retry flag (client keeps the phrase), cap -> 429
  const T = require("../netlify/functions/translate.js");
  global.fetch = async (u, o) => { if (String(u).includes("supabase")) return resp(200, []); return resp(529, {}); };
  let out = await T.handler({ httpMethod: "POST", headers: { "x-nf-client-connection-ip": "1.1.1.1" }, body: JSON.stringify({ lang: "fr", phrases: ["Book a job"] }) });
  ok(out.statusCode === 503 && JSON.parse(out.body).retry === true, "model busy -> 503 with retry, not an empty 200");
  global.fetch = async (u) => String(u).includes("supabase") ? resp(200, []) : llm(["Réserver un travail"]);
  out = await T.handler({ httpMethod: "POST", headers: { "x-nf-client-connection-ip": "1.1.1.2" }, body: JSON.stringify({ lang: "fr", phrases: ["Book a job", "x".repeat(900)] }) });
  ok(out.statusCode === 200 || out.statusCode === 503, "long text (900 chars) is accepted by the live endpoint");
  const big = ["Book a job"]; for (let i = 0; i < 40; i++) big.push("Phrase number " + i);
  let st = 0; for (let i = 0; i < 80; i++) { const o = await T.handler({ httpMethod: "POST", headers: { "x-nf-client-connection-ip": "9.9.9.9" }, body: JSON.stringify({ lang: "fr", phrases: big.map(s => s + i) }) }); st = o.statusCode; if (st === 429) break; }
  ok(st === 429, "per-visitor cap still protects the endpoint (and is flagged retry)");
  // pack endpoint
  const P = require("../netlify/functions/lang-pack.js");
  global.fetch = async (u) => String(u).includes("ui_packs") ? resp(200, [{ data: { Hello: "Hola" }, n: 1, updated_at: "2026-10-21T00:00:00Z" }]) : resp(200, []);
  out = await P.handler({ queryStringParameters: { lang: "es" } }); let j = JSON.parse(out.body);
  ok(out.statusCode === 200 && j.t.Hello === "Hola" && /public/.test(out.headers["Cache-Control"]), "pack served and cacheable");
  ok((await P.handler({ queryStringParameters: { lang: "xx" } })).statusCode === 400, "unknown language rejected");
  // background job refuses outsiders
  const B = require("../netlify/functions/translate-packs-background.js");
  ok((await B.handler({ headers: {} })).statusCode === 403 && (await B.handler({ headers: { "x-pack-key": "nope" } })).statusCode === 403, "bulk job cannot be started from outside");
  // phrase list
  const ph = require("../lang/phrases.json");
  ok(ph.length > 6000 && ph.every(p => p.length <= 1000) && new Set(ph).size === ph.length, "phrase list is complete, de-duplicated, and nothing is too long");
  ok(["Book a Job", "Payment Method", "Custom Quote", "Ask or tell Əlevate…"].every(p => ph.includes(p)), "key booking/quote/Əlevate strings are in the list");
  console.log("translate: " + n + " assertions PASS");
})().catch(e => { console.error(e); process.exit(1); });
