// Run:  GEMINI_API_KEY=... VOICE_BRIDGE_SECRET=... SITE_URL=https://potentoperations.netlify.app node server.js
// Caddy puts HTTPS (wss://voice.<domain>/twilio) in front of this. It listens only on 127.0.0.1.
const http = require("http"), WebSocket = require("ws");
const { createBridge } = require("./bridge");
for (const k of ["GEMINI_API_KEY", "VOICE_BRIDGE_SECRET", "SITE_URL"]) if (!process.env[k]) { console.error("Missing " + k); process.exit(1); }
const bridge = createBridge({ env: process.env, WebSocket: WebSocket, fetch: fetch, log: function () { console.log.apply(console, [new Date().toISOString()].concat([].slice.call(arguments))); } });
const MAX = Number(process.env.MAX_CALLS) || 50; let live = 0;
const server = http.createServer(function (req, res) { if (req.url === "/health") { res.writeHead(200); return res.end("ok " + live); } res.writeHead(404); res.end(); });
const wss = new WebSocket.Server({ server: server, path: "/twilio", maxPayload: 1 << 20 });
wss.on("connection", function (s) { if (live >= MAX) { s.close(1013, "busy"); return; } live++; s.on("close", function () { live--; }); bridge.handle(s); });
server.listen(8090, "127.0.0.1", function () { console.log("voice bridge listening on 127.0.0.1:8090"); });
const ping = function () { bridge.api({ action: "health", provider: "bridge", kind: "ping", ok: true, detail: live + " live" }, 8000); };
setInterval(ping, 5 * 60 * 1000); ping();
