// Run: node tests/voice-canonical-jobsfix.test.js  (jobs() cleanup, Nov 12, 2026)
// Claude's vetted jobs() findings, as executable checks:
//  (a) the past-wait path must reach a DURABLE terminal mark (bounded exit), not a bare
//      continue that re-looks-up the session on every poll until the 45-minute stale check;
//      the mark waits one extra wait window (2 x waitMs) so a slow in-flight recording
//      download — the recording gate refuses done-marked sessions — is never cut off;
//  (b) the pending window must be OLDEST first inside the freshness window: newest-first
//      limit-20 starved an older unfinished job forever when 20+ newer claims landed;
//  (c) stale claims must be crossed off even when they fall outside the working window;
//  (d) real pending jobs behave exactly as before: served with live lines, stored, gone.
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
const { T } = M;
const CN = require("../netlify/functions/lib/voice/canonical");
let sn = 0;
const endedSes = (over) => { const s = Object.assign({ id: "6e6e6e6e-0000-4000-8000-" + String(++sn).padStart(12, "0"), org_id: OA, provider: "twilio", provider_call_id: "CAJ" + sn, direction: "inbound", from_number: "+14704531616", to_number: "+14045550100", state: "ended", intake: {}, outcome: "info_only", seconds: 120, started_at: new Date(Date.now() - 600e3).toISOString(), answered_at: new Date(Date.now() - 590e3).toISOString(), ended_at: new Date().toISOString(), test_mode: false }, over || {}); T.voice_sessions.push(s); return s; };
const liveLine = (s, role, text) => { const seq = T.voice_transcripts.filter(t => t.session_id === s.id).length + 1; T.voice_transcripts.push({ org_id: s.org_id, session_id: s.id, seq, role, text }); };
const pendOf = (s) => T.voice_events.find(e => e.session_id === s.id && e.kind === "canonical_pending");
const doneOf = (s) => T.voice_events.some(e => e.session_id === s.id && e.kind === "canonical_job_done");
const minsAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

(async () => {
  // ── A. PAST-WAIT BOUNDED EXIT: no mark inside the grace window, durable mark past it ──
  const sA = endedSes(); liveLine(sA, "caller", "past wait caller");
  ok((await CN.settleReport(OA, sA.id)).deferred === true, "A: fresh recorded call defers and claims pending");
  sA.ended_at = minsAgo(15);   // past the 10-min wait, inside the 2x grace window
  ok(!(await CN.jobs(20)).some(j => j.session_id === sA.id), "A: past-wait job is NOT handed to the transcriber");
  ok(!doneOf(sA), "A: inside the grace window there is NO terminal mark yet (an in-flight recording download is never cut off)");
  sA.ended_at = minsAgo(25);   // past 2 x waitMs: dead work by any measure
  ok(!(await CN.jobs(20)).some(j => j.session_id === sA.id), "A: past-grace job is still not handed out");
  ok(doneOf(sA), "A: past the grace window the job reaches a DURABLE terminal mark (canonical_job_done) — the poll loop ends");
  ok(!(await CN.jobs(20)).some(j => j.session_id === sA.id), "A: the marked job stays out of jobs() on later polls");
  const late = await CN.store(OA, sA.id, [{ role: "caller", text: "late canonical lines still land" }], { engine: "test", source: "test" });
  ok(late.ok === true && T.voice_transcripts.some(t => t.session_id === sA.id && /late canonical/.test(t.text)), "A: a late canonical delivery after the wait_expired mark still stores, exactly as after giveUp");

  // ── C. REAL JOB, UNCHANGED END-TO-END (runs before the burst so the window is uncrowded) ──
  const sC = endedSes(); liveLine(sC, "agent", "Hi, I'm Elevate."); liveLine(sC, "caller", "1200 Peachtree Street");
  ok((await CN.settleReport(OA, sC.id)).deferred === true, "C: recorded call defers");
  const jobC = (await CN.jobs(20)).find(j => j.session_id === sC.id);
  ok(!!jobC && jobC.call_sid === sC.provider_call_id && jobC.live_lines.length === 2, "C: fresh job is served with call sid + live lines, as before");
  const stC = await CN.store(OA, sC.id, [{ role: "caller", text: "1200 Peachtree Street" }], { engine: "test", source: "test" });
  ok(stC.ok === true && !(await CN.jobs(20)).some(j => j.session_id === sC.id), "C: stored job leaves the list at once");

  // ── B + D. STARVATION + STALE SWEEP under a burst of 20 newer claims ──
  const sOld = endedSes(); liveLine(sOld, "caller", "the old unfinished job");
  ok((await CN.settleReport(OA, sOld.id)).deferred === true, "B: old job claims pending");
  pendOf(sOld).created_at = minsAgo(5);   // it has been waiting 5 minutes — inside the freshness window
  const sAncient = endedSes(); liveLine(sAncient, "caller", "the ancient claim");
  ok((await CN.settleReport(OA, sAncient.id)).deferred === true, "D: ancient job claims pending");
  pendOf(sAncient).created_at = minsAgo(50);   // past the 45-minute freshness window
  for (let i = 0; i < 20; i++) { const sN = endedSes(); liveLine(sN, "caller", "burst " + i); await CN.settleReport(OA, sN.id); }
  const burst = await CN.jobs(20);
  const jobOld = burst.find(j => j.session_id === sOld.id);
  ok(!!jobOld, "B: the OLDEST unfinished job is served even with 20 newer claims behind it (newest-first starved it forever)");
  ok(burst.length > 0 && burst[0].session_id === sOld.id, "B: the window is oldest-first — the longest-waiting job comes first");
  ok(!burst.some(j => j.session_id === sAncient.id), "D: the ancient claim is never handed out as work");
  ok(doneOf(sAncient), "D: the ancient claim is crossed off DURABLY even though it sat outside the working window");

  console.log("voice-canonical-jobsfix: " + n + " assertions PASS");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
