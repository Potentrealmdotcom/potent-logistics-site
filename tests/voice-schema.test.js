// Run: node tests/voice-schema.test.js
// Guard: these voice tables have NO created_at column (checked against production Oct 20). Ordering by it makes the API return an empty list.
const fs = require("fs"), path = require("path"); const assert = require("assert"); let n = 0;
const NO_CREATED_AT = ["voice_agent_config", "voice_campaign_contacts", "voice_capacity_holds", "voice_handoffs", "voice_plans", "voice_vehicle_profiles"];
const files = []; (function walk(d) { fs.readdirSync(d).forEach(f => { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : /\.js$/.test(f) && files.push(p); }); })(path.join(__dirname, "../netlify/functions"));
files.forEach(f => { const src = fs.readFileSync(f, "utf8"); NO_CREATED_AT.forEach(t => { const re = new RegExp(t + "\\?[^\"'`]*order=created_at"); assert(!re.test(src), f + " orders " + t + " by created_at (column does not exist)"); n++; }); });
console.log("voice-schema: " + n + " assertions PASS");
