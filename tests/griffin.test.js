// Run: node tests/griffin.test.js   (Griffin in-app assistant: gold-mouth face placement + answer chain always settles)
const fs = require("fs"), path = require("path"), assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const repoRoot = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(repoRoot, "app.js"), "utf8");
function extract(name) {
    const i = src.indexOf("function " + name + "(");
    assert(i >= 0, name + " exists in app.js");
    let d = 0, j = src.indexOf("{", i);
    for (; j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}") { d--; if (!d) return src.slice(i, j + 1); } }
    throw new Error("unbalanced " + name);
}

// ── 1) The face is really embedded in app.js (data URI: the GitHub push route
// is UTF-8-text-only and cannot carry the binary PNG; master PNG lives at
// ~/workspace/assets/mouths/griffin-mouth-gold.png) ──
const faceMatch = src.match(/var GRIFFIN_FACE = "data:image\/webp;base64,([A-Za-z0-9+/=]+)";/);
ok(!!faceMatch, "GRIFFIN_FACE is an embedded WebP data URI");
const faceBytes = Buffer.from(faceMatch[1], "base64");
ok(faceBytes.length > 10000 && faceBytes.toString("ascii", 0, 4) === "RIFF" && faceBytes.toString("ascii", 8, 12) === "WEBP", "embedded face decodes to a real WebP image (" + faceBytes.length + " bytes)");

// ── 2) The face is wired into both assistant surfaces ──
ok(src.indexOf('var GRIFFIN_FACE = "data:image/webp;base64,') > -1, "GRIFFIN_FACE constant carries the embedded face");
const voiceBtn = extract("GriffinVoiceButton");
ok((voiceBtn.split("GRIFFIN_FACE").length - 1) >= 2, "voice panel shows the face (header + talk button)");
const bubble = extract("GriffinBubble");
ok((bubble.split("GRIFFIN_FACE").length - 1) >= 3, "chat bubble shows the face (bubble + header + message rows)");

// ── 3) Offline: the face rides inside app.js, which the service worker precaches; the WebLLM loader has its watchdog ──
const sw = fs.readFileSync(path.join(repoRoot, "sw.js"), "utf8");
ok(sw.indexOf('"/app.js"') > -1, "service worker precaches app.js — the embedded face renders offline with it");
const loader = extract("loadWebLlmEngine");
ok(loader.indexOf("LLM_LOAD_TIMEOUT") > -1 && loader.indexOf("armWatchdog") > -1, "WebLLM loader has the anti-hang watchdog");
ok(loader.indexOf("_webLlmEnginePromise = null") > -1, "a failed model load does not poison retries");

// ── 4) The answer chain always settles with an answer (never a hang, never a rejection) ──
const nowD = new Date();
const ym = nowD.getFullYear() + "-" + String(nowD.getMonth() + 1).padStart(2, "0");
const body = [
    'var SUPABASE_URL = "https://example.invalid", SUPABASE_ANON_KEY = "test-key";',
    'var USERS = [];',
    'var localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };',
    'var loadJobs = function () { return [{ id: "j1", date: "' + ym + '-05", finalPrice: 500, status: "Completed", paymentStatus: "paid", assignedDriverName: "" }]; };',
    'var loadExpenses = function () { return []; };',
    'var plPortalCall = function () { return Promise.resolve({ error: "network" }); };',
    'var navigator = { gpu: undefined };',
    'var fetchBehavior = { impl: function () { return Promise.reject(new Error("offline")); } };',
    'var fetch = function () { return fetchBehavior.impl.apply(null, arguments); };',
    'var loadWebLlmEngine = function () { return Promise.reject(new Error("stub-no-engine")); };',
    ["plMoney", "plNumbersWindow", "plNumbersQuery", "griffinNumbersAnswer", "askGriffinLocalLLM", "griffinAnswer"].map(function (nm) { return "var " + nm + " = " + extract(nm) + ";"; }).join("\n"),
    'return { griffinAnswer: griffinAnswer, setFetch: function (f) { fetchBehavior.impl = f; } };'
].join("\n");
const api = new Function(body)();
function settle(p, label) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error(label + " did not settle within 5s")); }, 5000); })]);
}
(async function () {
    // deterministic pattern answers with no network at all
    const det = await settle(api.griffinAnswer("what is detention?", "a@b.c", "visitor", null), "detention");
    ok(typeof det === "string" && det.indexOf("Detention is") === 0, "static pattern answers offline");
    // numbers path answers from real (fixture) company data for owner/dispatch
    const rev = await settle(api.griffinAnswer("how much revenue this month?", "owner@b.c", "owner", null), "revenue");
    ok(rev === "Revenue this month: $500.00 across 1 job.", "numbers path answers from real data, got: " + rev);
    // unassigned-loads branch: network dead -> honest answer, NOT a rejection/hang (this was a dead end)
    const un = await settle(api.griffinAnswer("are there unassigned loads?", "owner@b.c", "owner", null), "unassigned");
    ok(typeof un === "string" && un.indexOf("couldn't reach the load board") > -1, "unassigned branch fails honestly when the board is unreachable");
    // cloud fallback dead + no WebGPU -> honest on-device message, NOT a hang (the offline dead end)
    const fb = await settle(api.griffinAnswer("tell me something interesting", "a@b.c", "visitor", null), "fallback");
    ok(typeof fb === "string" && fb.indexOf("WebGPU") > -1, "cloud-down + no WebGPU still ends in an honest answer");
    // cloud fallback alive -> its answer is used
    api.setFetch(function () { return Promise.resolve({ json: function () { return Promise.resolve({ ok: true, text: "Cloud answer." }); } }); });
    const cloud = await settle(api.griffinAnswer("tell me something interesting", "a@b.c", "visitor", null), "cloud");
    ok(cloud === "Cloud answer.", "cloud fallback answer passes through");
    // cloud says ok but returns no text -> falls through to the local path instead of resolving undefined
    api.setFetch(function () { return Promise.resolve({ json: function () { return Promise.resolve({ ok: true }); } }); });
    const empty = await settle(api.griffinAnswer("tell me something interesting", "a@b.c", "visitor", null), "empty-cloud");
    ok(typeof empty === "string" && empty.indexOf("WebGPU") > -1, "empty cloud text falls through to local instead of answering undefined");
    // customer wallet with the portal unreachable -> honest answer
    api.setFetch(function () { return Promise.reject(new Error("offline")); });
    const wal = await settle(api.griffinAnswer("what is my wallet balance?", "cust@b.c", "customer", "tok"), "wallet");
    ok(wal === "I could not reach your wallet right now.", "wallet branch fails honestly");
    console.log("PASS: " + n + " assertions");
})().catch(function (e) { console.error("FAIL: " + (e && e.message)); process.exit(1); });
