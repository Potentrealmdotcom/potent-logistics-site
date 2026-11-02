// Run: node tests/voice-ambience.test.js  (Nov 2, 2026 voice-quality package, part 2: the room)
// Proves: (1) the site's industry->bed map resolves every trade family to its room, with the generic
// office as the unlisted-trade fallback and "off" honored; (2) the site's bed library and the
// bridge's synthesizer library carry the SAME bed keys; (3) the bridge actually puts the room on the
// line — frames flow in the pauses, her audio rides over the bed with playback marks, the owner's
// ambience:"off" and the VOICE_AMBIENCE=off kill switch both silence it.
const assert = require("assert"), EE = require("events"), fs = require("fs"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const AMB = require("../netlify/functions/lib/voice/ambience");
const { createBridge } = require("../server-kit/voice-bridge/bridge.js"), AI = require("../netlify/functions/lib/voice/adapters/gemini-live");
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── (1) the map ──
const bedOf = (settings) => AMB.resolve({ settings: settings || {} }, { direction: "inbound" });
ok(bedOf({ industry: "logistics" }).ambience_bed === "dispatch_office", "map: logistics -> dispatch office");
ok(bedOf({ industry: "Trucking" }).ambience_bed === "dispatch_office", "map: trucking -> dispatch office (case/spelling tolerant)");
ok(bedOf({ industry: "restaurant" }).ambience_bed === "restaurant", "map: restaurant -> restaurant");
ok(bedOf({ industry: "Auto Repair" }).ambience_bed === "auto_shop", "map: auto repair -> auto shop");
ok(bedOf({ industry: "crypto" }).ambience_bed === "office_phones", "map: crypto -> phones office (telephones ringing in back)");
ok(bedOf({ industry: "roofing" }).ambience_bed === "construction", "map: roofing -> construction");
ok(bedOf({ industry: "hvac" }).ambience_bed === "construction", "map: hvac -> construction");
ok(bedOf({ industry: "salon" }).ambience_bed === "salon", "map: salon -> salon");
ok(bedOf({ industry: "retail" }).ambience_bed === "retail", "map: retail -> retail");
ok(bedOf({ industry: "dental" }).ambience_bed === "clinic", "map: dental -> clinic");
ok(bedOf({ industry: "warehouse" }).ambience_bed === "warehouse", "map: warehouse -> warehouse");
ok(bedOf({ industry: "astrology readings" }).ambience_bed === "generic_office", "map: an unlisted trade -> generic office fallback, never silence");
ok(bedOf({}).ambience_bed === "generic_office", "map: no industry on file yet -> generic office fallback");
ok(bedOf({ ambience: "off", industry: "logistics" }).ambience === "off", "map: a company can switch its room off entirely");
ok(bedOf({ ambience_bed: "restaurant", industry: "logistics" }).ambience_bed === "restaurant", "map: an explicit room choice beats the trade mapping");
ok(Object.keys(AMB.INDUSTRY_TO_BED).length >= 40, "map: the trade table is broad (" + Object.keys(AMB.INDUSTRY_TO_BED).length + " industries) and one line extends it");

// ── (2) both libraries carry the same rooms ──
{ const src = fs.readFileSync(__dirname + "/../server-kit/voice-bridge/bridge.js", "utf8");
  const block = src.slice(src.indexOf("const AMBIENCE_BEDS = {"), src.indexOf("};", src.indexOf("const AMBIENCE_BEDS = {")));
  const bridgeKeys = Array.from(block.matchAll(/^\s{4}([a-z_]+):/gm)).map(m => m[1]).sort();
  ok(JSON.stringify(bridgeKeys) === JSON.stringify(Object.keys(AMB.BEDS).sort()), "libraries match: bridge synthesizer beds == site bed list (" + bridgeKeys.join(", ") + ")"); }

// ── (3) the bridge puts the room on the line ──
class Sock extends EE { constructor() { super(); this.readyState = 1; this.sent = []; } send(x) { this.sent.push(JSON.parse(x)); } close() { if (this.readyState === 3) return; this.readyState = 3; this.emit("close"); } }
const pcm = c => { const b = Buffer.alloc(c * 2); for (let i = 0; i < c; i++) b.writeInt16LE(Math.round(8000 * Math.sin(i / 5)), i * 2); return b.toString("base64"); };
function rig(opts) {
  opts = opts || {}; const calls = [], logs = []; let aiSock = null;
  const fetch = async (url, o) => { const b = JSON.parse(o.body); calls.push(b); let data = {};
    if (b.action === "context") data = Object.assign({ session_id: "S1", instructions: "be nice", tools: [], voice: "marin", greeting: "Hello", max_seconds: 1800 }, opts.ctx || {});
    if (b.action === "tool") data = { result: { ok: true } };
    return { status: 200, json: async () => data }; };
  class W extends Sock { constructor(url, o) { super(); aiSock = this; setTimeout(() => this.emit("open"), 5); } }
  const b = createBridge({ env: Object.assign({ SITE_URL: "https://site.test/", VOICE_BRIDGE_SECRET: "sec", GEMINI_API_KEY: "gk-x" }, opts.env || {}), WebSocket: W, fetch, log: function () { logs.push(Array.prototype.slice.call(arguments).join(" ")); } });
  const tw = new Sock(); b.handle(tw); const phone = o => tw.emit("message", JSON.stringify(o)); const ai = o => aiSock.emit("message", JSON.stringify(o));
  return { tw, phone, ai, calls, logs, get aiSock() { return aiSock; },
    start: () => phone({ event: "start", start: { streamSid: "MZ1", customParameters: { token: "tok" } } }), ready: () => ai({ setupComplete: {} }),
    media: () => tw.sent.filter(m => m.event === "media") };
}
const rms = payload => { const b = Buffer.from(payload, "base64"); let s = 0; for (let i = 0; i < b.length; i++) s += Math.pow(AI.MU_DEC[b[i]], 2); return Math.sqrt(s / Math.max(1, b.length)); };

(async () => {
  // a restaurant call: the room is on the line before she has said a word, and it is not silence
  let r = rig({ ctx: { ambience_bed: "restaurant" } }); r.start(); await sleep(60); r.ready(); await sleep(220);
  ok(r.logs.some(l => l === "ambience restaurant"), "bridge: ctx bed restaurant selected and logged");
  ok(r.media().length >= 5, "bridge: bed frames flow continuously, pauses included (" + r.media().length + " frames in ~220 ms)");
  ok(r.media().every(m => Buffer.from(m.media.payload, "base64").length === 160), "bridge: bed frames are full 20 ms phone frames");
  ok(rms(r.media()[3].media.payload) > 30, "bridge: the bed is audible sound, not digital silence (frame RMS " + Math.round(rms(r.media()[3].media.payload)) + ")");
  // her speech rides over the bed and earns playback marks, like the bare line
  r.ai({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: pcm(2400) } }] } } }); await sleep(200);
  ok(r.tw.sent.some(m => m.event === "mark"), "bridge: her speech over the bed produces playback marks (transcript trimming still grounded)");
  r.phone({ event: "stop" }); await sleep(15);
  // the owner's own call: ambience "off" from the site — no room, no frames, exactly the old bare line
  r = rig({ ctx: { ambience: "off" } }); r.start(); await sleep(60); r.ready(); await sleep(200);
  ok(r.logs.some(l => l === "ambience off") && r.media().length === 0, "bridge: owner call (ambience off) stays natural — zero bed frames");
  r.phone({ event: "stop" }); await sleep(15);
  // the deployment kill switch beats a ctx bed
  r = rig({ env: { VOICE_AMBIENCE: "off" }, ctx: { ambience_bed: "restaurant" } }); r.start(); await sleep(60); r.ready(); await sleep(150);
  ok(r.media().length === 0, "bridge: VOICE_AMBIENCE=off silences every room");
  r.phone({ event: "stop" }); await sleep(15);
  // an unknown room name from the site can never produce the wrong trade's room: generic office
  r = rig({ ctx: { ambience_bed: "moon_base" } }); r.start(); await sleep(60); r.ready(); await sleep(150);
  ok(r.logs.some(l => l === "ambience generic_office") && r.media().length >= 3, "bridge: unknown bed name -> generic office");
  r.phone({ event: "stop" }); await sleep(15);
  // nothing named anywhere: the dispatch office (this product's home trade)
  r = rig({ ctx: {} }); r.start(); await sleep(60); r.ready(); await sleep(120);
  ok(r.logs.some(l => l === "ambience dispatch_office"), "bridge: no bed named anywhere -> dispatch office default");
  r.phone({ event: "stop" }); await sleep(15);
  console.log("PASS: " + n + " assertions"); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
