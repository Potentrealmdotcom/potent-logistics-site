// Owner brief: only the owner's Əlevate carries the BHAG; everyone else's does not.
const assert = require("assert");
process.env.ELEVATE_OWNER_EMAILS = "boss@example.com";
const E = require("../netlify/functions/lib/elevate.js");
assert.ok(E.isOwnerKey("Boss@Example.com"), "owner key recognised");
assert.ok(!E.isOwnerKey("someone@else.com"), "others are not owner");
const o = E.systemPrompt({ owner: true }), n = E.systemPrompt({ owner: false });
assert.ok(/BHAG/.test(o) && /1,000 trucking/.test(o) && /\$34,995/.test(o), "owner prompt has the goal and prices");
assert.ok(!/BHAG|Conyers|1,000 trucking/.test(n), "non-owner prompt has none of it");
assert.ok(!/data hostage.*Motive|POTENT0421/i.test(o), "no passwords or other-company angles");
console.log("elevate-owner ok");

// ── Jarvis slice 1: owner-only business tools ──
(async () => {
  const make = require("./_mock.js");
  const T = { elevate_actions: [], organizations: [{ id: "org1", created_at: "2026-01-01" }], jobs: [
      { id: "j1", org_id: "org1", status: "Paid", final_price: 400, created_at: new Date().toISOString() },
      { id: "j2", org_id: "org1", status: "Completed", final_price: 250.5, created_at: new Date().toISOString() },
      { id: "j3", org_id: "org1", status: "Confirmed", final_price: 100, created_at: new Date().toISOString(), customer: "Acme", date: "2026-10-25" }],
    voice_callbacks: [{ id: "c1", status: "open", name: "Dana", phone: "404", reason: "OS demo", created_at: new Date().toISOString() }],
    leads: [], voice_sessions: [{ id: "s1", created_at: new Date().toISOString() }], os_licenses: [], elevate_items: [] };
  make(T);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const B = "boss@example.com", X = "someone@else.com";
  assert.ok(E.toolsFor(B).some(t => t.name === "send_email") && E.toolsFor(B).some(t => t.name === "business_briefing"), "owner gets business tools");
  assert.ok(!E.toolsFor(X).some(t => /send_email|business_briefing|set_sending/.test(t.name)), "others never see them");
  assert.strictEqual(E.toolsFor(X).length, E.TOOLS.length, "others get exactly the base list");
  assert.ok(E.asChatTools(B).length > E.asChatTools(X).length && E.asRealtimeTools(B).length > E.asRealtimeTools(X).length, "chat and voice both gated");
  let o = await E.execute(X, "send_email", { to: "a@b.com", subject: "hi", body: "x" }, "chat");
  assert.ok(!o.ok && T.elevate_actions.length === 0, "a non-owner cannot send even if the model asks");
  o = await E.execute(X, "business_briefing", {}, "chat"); assert.ok(!o.ok, "a non-owner cannot read the briefing");
  o = await E.execute(B, "business_briefing", {}, "chat");
  assert.ok(o.ok && o.jobs_last_7_days === 3 && o.completed_or_paid_last_7_days === 2 && o.revenue_last_7_days === 650.5 && o.open_callbacks.length === 1 && o.phone_calls_last_7_days === 1, "briefing returns the real numbers");
  assert.ok(/not connected/.test(o.note), "briefing says ad spend is not connected");
  process.env.RESEND_API_KEY = "";
  o = await E.execute(B, "send_email", { to: "a@b.com", subject: "Hi", body: "Hello" }, "chat");
  assert.ok(!o.ok && /not configured/.test(o.error) && T.elevate_actions[0].ok === false, "no email key: says it did NOT send, logs the failure");
  process.env.RESEND_API_KEY = "re_test";
  o = await E.execute(B, "send_email", { to: "not-an-email", subject: "Hi", body: "Hello" }, "chat"); assert.ok(!o.ok && /valid email/.test(o.error), "bad address refused");
  o = await E.execute(B, "send_email", { to: "a@b.com", subject: "", body: "Hello" }, "chat"); assert.ok(!o.ok, "empty subject refused");
  o = await E.execute(B, "send_email", { to: "a@b.com", subject: "Demo link", body: "Here it is" }, "chat");
  assert.ok(o.ok && o.sent_to === "a@b.com" && T.elevate_actions.some(x => x.kind === "email" && x.ok === true && x.subject === "Demo link"), "send works and is logged");
  await sleep(5); o = await E.execute(B, "set_sending", { enabled: false }, "chat"); assert.ok(o.ok && o.sending === "paused");
  const before = T.elevate_actions.length;
  o = await E.execute(B, "send_email", { to: "a@b.com", subject: "x", body: "y" }, "chat"); assert.ok(!o.ok && /paused/.test(o.error) && T.elevate_actions.length === before, "paused: nothing sent, nothing logged as sent");
  await sleep(5); await E.execute(B, "set_sending", { enabled: true }, "chat");
  for (let i = 0; i < 25; i++) T.elevate_actions.push({ id: "z" + i, owner_key: B, kind: "email", ok: true, created_at: new Date().toISOString(), target: "q@q.com", subject: "s" });
  o = await E.execute(B, "send_email", { to: "a@b.com", subject: "x", body: "y" }, "chat"); assert.ok(!o.ok && /limit/.test(o.error), "daily cap stops sending");
  o = await E.execute(B, "sent_log", {}, "chat"); assert.ok(o.ok && o.sent.length > 0, "sent log readable");
  assert.ok(/business_briefing/.test(E.systemPrompt({ owner: true })) && !/business_briefing/.test(E.systemPrompt({ owner: false })), "prompt mentions business tools only for the owner");
  console.log("elevate-owner tools ok");
})().catch(e => { console.error(e); process.exit(1); });
