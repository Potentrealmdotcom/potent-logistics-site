// Run: node tests/voicekit.test.js  Every file the voice-bridge Dockerfile COPYs must really be staged by both install scripts (this caught a stale realtime.js line).
const fs = require("fs"), path = require("path"), assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const kit = path.join(__dirname, "..", "server-kit"), df = fs.readFileSync(path.join(kit, "voice-bridge", "Dockerfile"), "utf8");
const copies = []; df.split("\n").filter(l => /^COPY /.test(l)).forEach(l => l.replace(/^COPY /, "").replace(/\s\.\/?$/, "").split(/\s+/).forEach(f => copies.push(f)));
ok(copies.length >= 4, "Dockerfile copies files");
const sh = ["install-voice.sh", "install-voice-only.sh"].map(f => fs.readFileSync(path.join(kit, f), "utf8"));
copies.forEach(f => {
  const inDir = fs.existsSync(path.join(kit, "voice-bridge", f));
  const staged = sh.every(s => s.includes(f));
  ok(inDir || staged, "Dockerfile COPY " + f + " is neither in voice-bridge/ nor staged by both installers");
  if (!inDir) ok(fs.existsSync(path.join(kit, "..", "netlify", "functions", "lib", "voice", "adapters", f)), f + " must exist in adapters/");
});
ok(!/realtime\.js/.test(df), "no stale realtime.js reference");
console.log("PASS: " + n + " assertions");
