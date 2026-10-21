// Route distance: the real failure reason is reported, the key is trimmed, one retry on 429/5xx, and nothing is guessed.
const assert = require("assert");
process.env.ROUTING_PROVIDER = "ors"; process.env.ORS_API_KEY = "  abc123\n";
const RT = require("../netlify/functions/lib/voice/route.js");
const A = { lat: 33.75, lon: -84.39 }, B = { lat: 33.95, lon: -84.55 };
const resp = (st, body) => ({ ok: st < 300, status: st, text: async () => typeof body === "string" ? body : JSON.stringify(body) });
const first = (async () => {
  let calls = [], seq = [];
  global.fetch = async (u, o) => { calls.push({ u, o }); return seq.shift() || resp(500, "x"); };
  seq = [resp(200, { routes: [{ summary: { distance: 32187, duration: 1800 } }] })];
  let r = await RT.distance(A, B);
  assert.ok(r.ok && Math.abs(r.miles - 20) < 0.01 && r.minutes === 30, "good route returns miles and minutes");
  assert.ok(/^https:\/\/api\.heigit\.org\/openrouteservice\/v2\/directions\/driving-car$/.test(calls[0].u), "uses the new HeiGIT host");
  assert.strictEqual(calls[0].o.headers.Authorization, "abc123", "key is trimmed of spaces and newlines");
  assert.deepStrictEqual(JSON.parse(calls[0].o.body).radiuses, [-1, -1], "snaps to the nearest road");
  calls = []; seq = [resp(403, { error: { message: "Access to this API has been disallowed" } })];
  r = await RT.distance(A, B); assert.ok(!r.ok && r.reason === "ors_key_rejected" && /403/.test(r.detail) && calls.length === 1, "bad key: reason is reported, no retry");
  calls = []; seq = [resp(404, { error: { code: 2010, message: "Could not find routable point" } })];
  r = await RT.distance(A, B); assert.ok(!r.ok && r.reason === "ors_no_road_near_address" && calls.length === 1, "no road near address: reported, no retry");
  calls = []; seq = [resp(429, { error: "rate" }), resp(200, { routes: [{ summary: { distance: 16093.44, duration: 600 } }] })];
  r = await RT.distance(A, B); assert.ok(r.ok && Math.round(r.miles) === 10 && calls.length === 2, "429 is retried once and can succeed");
  calls = []; seq = [resp(500, "boom"), resp(500, "boom")];
  r = await RT.distance(A, B); assert.ok(!r.ok && r.reason === "ors_http_500" && calls.length === 2, "two failures: reported, never guessed");
  global.fetch = async () => { const e = new Error("t"); e.name = "TimeoutError"; throw e; };
  r = await RT.distance(A, B); assert.ok(!r.ok && r.reason === "routing_timeout", "timeout reported");
  delete process.env.ORS_API_KEY; r = await RT.distance(A, B); assert.ok(!r.ok && r.reason === "routing_not_configured", "no key: not configured");
  console.log("route ok");
})().catch(e => { console.error(e); process.exit(1); });
// host fallback (runs after the first block so the two do not share fetch at the same time)
first.then(async () => {
  process.env.ORS_API_KEY = "k"; const urls = [];
  global.fetch = async (u) => { urls.push(String(u)); return /heigit/.test(u) ? { ok: false, status: 404, text: async () => "{}" } : { ok: true, status: 200, text: async () => JSON.stringify({ routes: [{ summary: { distance: 1609.344, duration: 60 } }] }) }; };
  const r = await require("../netlify/functions/lib/voice/route.js").distance({ lat: 1, lon: 1 }, { lat: 2, lon: 2 });
  assert.ok(r.ok && urls.length === 2 && /heigit/.test(urls[0]) && /openrouteservice\.org/.test(urls[1]), "falls back to the old host only if the new one 404s");
  console.log("route host ok");
}).catch(e => { console.error(e); process.exit(1); });

// backup
(async () => {
  await new Promise(r => setTimeout(r, 300));
  const RT = require("../netlify/functions/lib/voice/route.js"); process.env.ORS_API_KEY = "k"; delete process.env.ROUTE_BACKUP;
  const urls = [];
  global.fetch = async (u) => { urls.push(String(u)); return /osrm/.test(u) ? { ok: true, status: 200, json: async () => ({ code: "Ok", routes: [{ distance: 16093.44, duration: 900 }] }) } : { ok: false, status: 403, text: async () => JSON.stringify({ error: "Access to this API has been disallowed" }) }; };
  let r = await RT.distance({ lat: 1, lon: 1 }, { lat: 2, lon: 2 });
  assert.ok(r.ok && r.source === "osrm_public_backup" && Math.round(r.miles) === 10 && /ors_key_rejected/.test(r.primary_failure), "main service refuses: backup measures it and is labelled");
  assert.ok(urls.some(u => /router\.project-osrm\.org\/route\/v1\/driving\/1,1;2,2/.test(u)), "backup uses lon,lat order");
  process.env.ROUTE_BACKUP = "off"; r = await RT.distance({ lat: 1, lon: 1 }, { lat: 2, lon: 2 });
  assert.ok(!r.ok && r.reason === "ors_key_rejected", "backup can be switched off; real reason still shown");
  delete process.env.ROUTE_BACKUP;
  global.fetch = async (u) => /osrm/.test(u) ? { ok: false, status: 500, json: async () => ({}) } : { ok: false, status: 403, text: async () => "{}" };
  r = await RT.distance({ lat: 1, lon: 1 }, { lat: 2, lon: 2 }); assert.ok(!r.ok, "both fail: no price is guessed");
  console.log("route backup ok");
})().catch(e => { console.error(e); process.exit(1); });
