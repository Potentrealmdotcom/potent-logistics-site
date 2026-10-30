// Run: node tests/voice-canonical.test.js  (canonical word-for-word transcript pipeline: defer, store, fallback)
// The live transcript is Gemini's in-call guess; when a call is recorded, the owner report must
// wait (bounded) for the recording-based transcript, and the stored rows must be replaced in the
// exact {role, text, seq} shape every reader already uses.
process.env.AUTH_SECRET = "t"; process.env.SUPABASE_URL = "https://sb.test"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
process.env.TWILIO_ACCOUNT_SID = "ACtest"; process.env.TWILIO_AUTH_TOKEN = "twtoken"; process.env.VOICE_BRIDGE_SECRET = "bridgesecret";
process.env.RESEND_API_KEY = "rk";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const OA = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa", OB = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const ENT_ALL = { inbound: true, quotes: true, booking: true, handoff: true, callbacks: true, notifications: true, transcripts: true, recording: true, analytics_export: true, custom_knowledge: true, multi_vehicle: true, outbound: true, campaigns: true, contractors: true, api_access: true, priority_support: false };
const plan = (tier, ent) => ({ tier, label: "POTENT VOICE " + tier, os_label: "x", price_cents: 1, price_is_minimum: false, included_minutes: 3000, overage_enabled: true, overage_cents_per_min: 40, overage_cap_minutes: null, max_concurrent_calls: 15, max_call_minutes: 30, entitlements: ent, active: true, stripe_product_id: null, version: 1 });
const M = require("./_voicemock.js")({
  organizations: [{ id: OA, name: "POTENT Logistics", slug: "potent-logistics", plan: "fleet", owner_email: "owner@potent.test", license_status: "paid" }, { id: OB, name: "Bravo Haul", slug: "bravo", plan: "fleet", owner_email: "b@x.com", license_status: "paid" }],
  voice_plans: [plan("fleet", ENT_ALL)],
  voice_subscriptions: [{ org_id: OA, tier: "fleet", os_plan: "fleet", status: "internal" }, { org_id: OB, tier: "fleet", os_plan: "fleet", status: "active", current_period_start: null }],
  voice_agent_config: [{ org_id: OA, recording_enabled: true, recording_consent_confirmed: true, human_available: false, settings: { numbers: ["+14045550100"] } }, { org_id: OB, recording_enabled: false, recording_consent_confirmed: false, human_available: false, settings: { numbers: ["+14045550200"] } }]
});
const { T, EXT } = M;
const VT = require("../netlify/functions/voice-tools");
const CN = require("../netlify/functions/lib/voice/canonical");
const vt = async (body) => { const r = await VT.handler({ httpMethod: "POST", headers: { authorization: "Bearer bridgesecret" }, body: JSON.stringify(body) }); return { s: r.statusCode, j: JSON.parse(r.body) }; };
let sn = 0;
const endedSes = (org, over) => { const s = Object.assign({ id: "5e5e5e5e-0000-4000-8000-" + String(++sn).padStart(12, "0"), org_id: org || OA, provider: "twilio", provider_call_id: "CA" + sn, direction: "inbound", from_number: "+14704531616", to_number: "+14045550100", state: "ended", intake: {}, outcome: "info_only", seconds: 308, started_at: new Date(Date.now() - 3600e3).toISOString(), answered_at: new Date(Date.now() - 3500e3).toISOString(), ended_at: new Date().toISOString(), test_mode: false }, over || {}); T.voice_sessions.push(s); return s; };
const liveLine = (s, role, text) => { const seq = T.voice_transcripts.filter(t => t.session_id === s.id).length + 1; T.voice_transcripts.push({ org_id: s.org_id, session_id: s.id, seq, role, text }); };
const ownerMail = () => EXT.mail.filter(m => /owner@potent.test/.test(JSON.stringify(m.to)));

(async () => {
  // ── 1. recorded call: the report DEFERS (no email yet), the job appears for the transcriber ──
  const s1 = endedSes(); liveLine(s1, "agent", "Hi, I'm Elevate. How can I help?"); liveLine(s1, "caller", "1,500 Peachtree Street, Atlanta"); liveLine(s1, "agent", "Got it. I'll use the number ending in");
  EXT.mail.length = 0;
  const d1 = await CN.settleReport(OA, s1.id);
  ok(d1.deferred === true && ownerMail().length === 0, "recorded call: owner report waits for the canonical transcript");
  const jobs = (await vt({ action: "canonical_jobs" })).j.jobs;
  const job = jobs.find(j => j.session_id === s1.id);
  ok(!!job && job.call_sid === s1.provider_call_id && job.live_lines.length === 3 && !!job.deadline, "transcriber job carries the call sid, deadline and the live lines to anchor against");

  // ── 2. canonical lines land: rows replaced in the same shape, THEN the report goes out ──
  const canon = [{ role: "agent", text: "Hi, I'm Elevate. How can I help?" }, { role: "caller", text: "1,200 Peachtree Street, Atlanta" }, { role: "agent", text: "Got it. I'll use the number ending in 1-6-1-6." }];
  const st = await vt({ action: "canonical_transcript", session_id: s1.id, lines: canon, engine: "faster-whisper-small", source: "twilio-dual:caller_ch0" });
  ok(st.j.ok && st.j.lines === 3, "canonical transcript stored");
  const rowsNow = T.voice_transcripts.filter(t => t.session_id === s1.id).sort((a, b) => a.seq - b.seq);
  ok(rowsNow.length === 3 && rowsNow[1].text === "1,200 Peachtree Street, Atlanta" && rowsNow[2].text.endsWith("1-6-1-6."), "stored rows ARE the canonical lines (1200 not 1500, number complete)");
  ok(ownerMail().length === 1 && /1,200 Peachtree/.test(JSON.stringify(ownerMail()[0])), "owner email went out after, carrying the recording's words");
  const dup = await vt({ action: "canonical_transcript", session_id: s1.id, lines: [{ role: "caller", text: "CHANGED" }] });
  ok(dup.j.duplicate === true && T.voice_transcripts.filter(t => t.session_id === s1.id).length === 3 && ownerMail().length === 1, "a second delivery changes nothing and never re-sends");

  // ── 3. giveup: the report falls back to the live transcript ──
  const s2 = endedSes(); liveLine(s2, "caller", "hello, need a truck");
  EXT.mail.length = 0;
  ok((await CN.settleReport(OA, s2.id)).deferred === true && ownerMail().length === 0, "second recorded call also defers");
  const gu = await vt({ action: "canonical_giveup", session_id: s2.id, why: "no_recording_found" });
  ok(gu.j.ok && ownerMail().length === 1 && /hello, need a truck/.test(JSON.stringify(ownerMail()[0])), "giveup releases the report with the live transcript");

  // ── 4. deadline already passed when settle runs: no defer, live transcript report ──
  const s3 = endedSes(OA, { ended_at: new Date(Date.now() - 11 * 60000).toISOString() });
  liveLine(s3, "caller", "an old call");
  EXT.mail.length = 0;
  const d3 = await CN.settleReport(OA, s3.id);
  ok(!d3.deferred && ownerMail().length === 1, "past the bounded wait, the report goes out with the live transcript");

  // ── 5. org without recording: exactly the old behaviour, immediate report ──
  const s4 = endedSes(OB, { to_number: "+14045550200" }); liveLine(s4, "caller", "bravo caller");
  EXT.mail.length = 0; const mailsBefore = EXT.mail.length;
  const d4 = await CN.settleReport(OB, s4.id);
  ok(!d4.deferred && EXT.mail.length > mailsBefore, "no recording on the org: report is immediate, unchanged");

  // ── 6. never-answered session: no defer even on a recording org ──
  const s5 = endedSes(OA, { answered_at: null, outcome: null, seconds: 0 });
  const d5 = await CN.settleReport(OA, s5.id);
  ok(!d5.deferred, "a call that never reached the bridge is never parked on transcription");

  console.log("voice-canonical: " + n + " assertions PASS");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
