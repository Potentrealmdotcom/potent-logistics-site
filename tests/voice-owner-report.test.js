// Run: node tests/voice-owner-report.test.js
// The owner's copy of EVERY call (Oct 24, 2026): one summary+transcript email per finished session,
// one push to the owner's devices only, exactly once across both session-end paths (bridge end in
// voice-tools finish + Twilio status callback in voice-webhook). Plus the push chain fixes:
// matching VAPID pair, authenticated push-subscribe endpoint, authenticated send-push endpoint.
process.env.AUTH_SECRET = "testsecret";
process.env.TWILIO_ACCOUNT_SID = "ACtest"; process.env.TWILIO_AUTH_TOKEN = "twtoken"; process.env.TWILIO_SMS_FROM = "+14045550999";
process.env.VOICE_WEBHOOK_URL = "https://hooks.test/voice"; process.env.VOICE_BRIDGE_URL = "wss://voice.test/twilio"; process.env.VOICE_BRIDGE_SECRET = "bridgesecret";
process.env.RESEND_API_KEY = "rk"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
const assert = require("assert"), crypto = require("crypto"), fs = require("fs");
let n = 0; const ok = (c, m) => { assert(c, m); n++; };

const OA = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa", OB = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const M = require("./_voicemock.js")({
  organizations: [{ id: OA, name: "POTENT Logistics", slug: "potent-logistics", plan: "fleet", owner_email: "owner@potent.test", license_status: "paid" }, { id: OB, name: "Bravo Haul", slug: "bravo", plan: "starter", owner_email: "b@x.com", license_status: "paid" }],
  voice_subscriptions: [{ org_id: OA, tier: "fleet", os_plan: "fleet", status: "internal" }, { org_id: OB, tier: "starter", os_plan: "starter", status: "active" }],
  voice_agent_config: [{ org_id: OA, settings: { numbers: ["+14045550100"] } }, { org_id: OB, settings: { numbers: ["+14045550200"] } }],
  push_subscriptions: [
    { id: "ps-owner", user_id: "org-a1", user_name: "Tony", endpoint: "https://push.test/owner", subscription: { endpoint: "https://push.test/owner", keys: { p256dh: "a", auth: "b" } }, org_id: OA, role: "owner" },
    { id: "ps-dispatch", user_id: "org-a2", user_name: "Dispatch", endpoint: "https://push.test/dispatch", subscription: { endpoint: "https://push.test/dispatch", keys: { p256dh: "a", auth: "b" } }, org_id: OA, role: "dispatch" },
    { id: "ps-other", user_id: "org-b1", user_name: "Bravo", endpoint: "https://push.test/other", subscription: { endpoint: "https://push.test/other", keys: { p256dh: "a", auth: "b" } }, org_id: OB, role: "owner" },
    { id: "ps-legacy", user_id: "potent", user_name: "Tony (legacy)", endpoint: "https://push.test/legacy", subscription: { endpoint: "https://push.test/legacy", keys: { p256dh: "a", auth: "b" } } },
    { id: "ps-quill", user_id: "quill", user_name: "Quill", endpoint: "https://push.test/quill", subscription: { endpoint: "https://push.test/quill", keys: { p256dh: "a", auth: "b" } } }
  ]
});
const { T, EXT } = M;
const VT = require("../netlify/functions/voice-tools"), WH = require("../netlify/functions/voice-webhook");
const OR = require("../netlify/functions/lib/voice/owner-report"), PUSH = require("../netlify/functions/lib/push");
const TW = require("../netlify/functions/lib/voice/adapters/twilio");
const SUB = require("../netlify/functions/push-subscribe"), SP = require("../netlify/functions/send-push");

const caps = [];
PUSH._setSender(async (sub, payload) => { caps.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) }); });
const b64u = b => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sign = p => { const body = b64u(JSON.stringify(Object.assign({ exp: Date.now() + 36e5 }, p))); return body + "." + b64u(crypto.createHmac("sha256", "testsecret").update(body).digest()); };
const TOK = { ownerA: sign({ uid: "org-a1", role: "owner", orgId: OA }), custA: sign({ uid: "cust:x", role: "customer", orgId: OA }), plat: sign({ uid: "potent", role: "owner", orgId: null }) };

let sn = 0;
const newSes = (o) => { const s = Object.assign({ id: "5e5e5e5e-0000-4000-8000-" + String(++sn).padStart(12, "0"), org_id: OA, provider: "twilio", provider_call_id: "CA" + (9000 + sn), direction: "inbound", from_number: "+14045550142", to_number: "+14045550100", state: "active", intake: {}, test_mode: false, started_at: new Date().toISOString(), answered_at: new Date().toISOString() }, o || {}); T.voice_sessions.push(s); return s; };
const say = (ses, lines) => { lines.forEach((l, ix) => T.voice_transcripts.push({ org_id: ses.org_id, session_id: ses.id, seq: l[2] != null ? l[2] : ix + 1, role: l[0], text: l[1] })); };
const endViaBridge = async (ses, seconds) => VT.handler({ httpMethod: "POST", headers: { authorization: "Bearer bridgesecret" }, body: JSON.stringify({ action: "end", session_id: ses.id, reason: "hangup", seconds: seconds != null ? seconds : 95 }) });
const ownerMail = () => EXT.mail.filter(m => (m.to || []).includes("owner@potent.test"));
const reports = () => ownerMail().filter(m => /^Elevate call:/.test(m.subject || ""));
const hook = async (a, params) => { const url = "https://hooks.test/voice?a=" + a; const sig = TW.signature("twtoken", url, params); const body = Object.keys(params).map(k => k + "=" + encodeURIComponent(params[k])).join("&"); return WH.handler({ httpMethod: "POST", headers: { "x-twilio-signature": sig }, body: body, queryStringParameters: { a: a }, rawQuery: "a=" + a }); };

(async () => {
  // ── 0. The original bug, pinned: app and server must hold ONE VAPID pair ──
  const appKey = (fs.readFileSync(__dirname + "/../app.js", "utf8").match(/var VAPID_PUBLIC_KEY = "([^"]+)"/) || [])[1];
  ok(appKey && appKey === PUSH.publicKey(), "app.js subscribes with the same VAPID public key the server publishes");
  const ecdh = crypto.createECDH("prime256v1"); ecdh.setPrivateKey(Buffer.from("RBXmilmfr0S7Yqx5tQ1m9k8G-T1WBwuv_m61JfmtPRI".replace(/-/g, "+").replace(/_/g, "/"), "base64"));
  ok(ecdh.getPublicKey().toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") === PUSH.publicKey(), "the server's VAPID private key derives the public key (pair is self-consistent)");

  // ── 1. Booked call, ended by the bridge: ONE report email (transcript in seq order) + owner-only push ──
  let m0 = ownerMail().length, c0 = caps.length;
  const s1 = newSes({ outcome: "booked", intake: { customer_name: "Pat Lee", pickup_address: "100 Peachtree St NE, Atlanta, GA", delivery_address: "55 Roswell Rd, Marietta, GA", service_date: "2026-10-25", time_window: "morning", _quote: { total_cents: 40000, number: "Q-1" } } });
  T.voice_bookings.push({ id: "bk1", org_id: OA, session_id: s1.id, reference: "PV-TEST1", status: "confirmed", job_id: "PL-1" });
  say(s1, [["agent", "Thanks for calling Potent Logistics.", 2], ["caller", "I need tile moved to Marietta.", 1], ["caller", "Yes, book it.", 3]]); // inserted out of order on purpose
  let r = await endViaBridge(s1, 125);
  ok(JSON.parse(r.body).ok, "bridge end accepted");
  ok(reports().length === 1, "exactly one every-call report email for the booked call");
  const rep1 = reports()[0];
  ok(rep1.subject === "Elevate call: Booked — Pat Lee", "report subject: outcome + caller, distinct from outcome notices");
  ok(rep1.text.includes("FULL TRANSCRIPT") && rep1.text.includes("PV-TEST1") && rep1.text.includes("$400.00"), "report carries the booking reference and the quote");
  ok(rep1.text.indexOf("I need tile moved") < rep1.text.indexOf("Thanks for calling") && rep1.text.indexOf("Thanks for calling") < rep1.text.indexOf("Yes, book it."), "transcript lines are in seq order, not insertion order");
  const hit1 = caps.slice(c0);
  ok(hit1.length === 2 && hit1.every(h => h.payload.title === "Elevate just took a call" && h.payload.url === "/voice/"), "push went to exactly the owner's two devices");
  ok(hit1.every(h => ["https://push.test/owner", "https://push.test/legacy"].includes(h.endpoint)), "push targets: org owner row + platform-owner legacy row — not dispatch, not the other org, not other staff");
  ok(/Booked: Atlanta → Marietta/.test(hit1[0].payload.body) && hit1[0].payload.body.includes("$400.00"), "push body is the one-line outcome");
  r = await endViaBridge(s1, 125);
  ok(JSON.parse(r.body).already === true && reports().length === 1 && caps.length === c0 + 2, "a second bridge end changes nothing: still one email, one push round");
  const dup = await OR.reportCall(OA, s1.id);
  ok(dup.duplicate === true && reports().length === 1, "reportCall itself is idempotent per session");

  // ── 2. Pure question call: still reported (that's the point), outcome Information only ──
  m0 = ownerMail().length; c0 = caps.length;
  const s2 = newSes({ intake: {} });
  say(s2, [["agent", "We run Conyers, Covington and Lithonia, seven days a week."]]);
  await endViaBridge(s2, 40);
  ok(reports().length === 2 && /Information only/.test(reports()[1].subject), "info-only call produces its report email");
  ok(/Question call — no booking/.test(caps[c0].payload.body), "info-only push one-liner says what happened");
  ok(ownerMail().length === m0 + 1, "no outcome email exists for a question call — the report is the only one");

  // ── 3. Unfinished call: safety-net email AND report email, one each, different subjects ──
  m0 = ownerMail().length;
  const s3 = newSes({ intake: { pickup_address: "12 Pine St, Conyers, GA" } });
  say(s3, [["caller", "I need some boxes moved"], ["caller", "from my house in Conyers"]]);
  await endViaBridge(s3, 30);
  const newMail = ownerMail().slice(m0);
  ok(newMail.filter(m => /^Unfinished call saved/.test(m.subject)).length === 1, "safety net still sends its own email, once");
  ok(newMail.filter(m => /^Elevate call:/.test(m.subject)).length === 1, "report email also sent, once — and it is not a copy of the net's email");
  ok(T.voice_callbacks.some(c => c.session_id === s3.id), "safety net saved the callback");
  ok(/Callback saved/.test(newMail.find(m => /^Elevate call:/.test(m.subject)).subject), "the report sees the final outcome the net set (callback)");

  // ── 4. Blocked + declined: 'could not take' email + report, and NO callback was forced ──
  m0 = ownerMail().length;
  const s4 = newSes({ intake: { customer_name: "Heavy Harry", _elig: { status: "blocked", blocks: [{ text: "over the 4,999 lb limit" }] } } });
  say(s4, [["caller", "I have 6000 pounds of tile"], ["caller", "no thanks"]]);
  await endViaBridge(s4, 60);
  const nm4 = ownerMail().slice(m0);
  ok(nm4.filter(m => /^Job we could not take/.test(m.subject)).length === 1, "blocked+declined outcome email fired once");
  ok(nm4.filter(m => /^Elevate call: Could not take it/.test(m.subject)).length === 1, "report email fired once with the declined outcome");
  ok(!T.voice_callbacks.some(c => c.session_id === s4.id), "no callback saved for a caller who declined");

  // ── 5. Bridge died: the Twilio status callback is the backstop and reports exactly once ──
  m0 = ownerMail().length; c0 = caps.length;
  const s5 = newSes({ provider_call_id: "CA9551", intake: { customer_name: "Sam Poe" } });
  say(s5, [["caller", "Need a pickup tomorrow"], ["agent", "I can help with that."]]);
  await hook("status", { CallSid: "CA9551", CallStatus: "completed", CallDuration: "80" });
  ok(ownerMail().slice(m0).filter(m => /^Elevate call:/.test(m.subject)).length === 1, "status callback reported the orphaned session");
  ok(ownerMail().slice(m0)[0].text.includes("Need a pickup tomorrow"), "backstop report still carries the full transcript");
  await hook("status", { CallSid: "CA9551", CallStatus: "completed", CallDuration: "80" });
  ok(ownerMail().slice(m0).filter(m => /^Elevate call:/.test(m.subject)).length === 1 && caps.length === c0 + 2, "duplicate status delivery: no second email, no second push");

  // ── 6. Never connected (rang out): NO report — an email per robocall ring would bury the real ones ──
  m0 = ownerMail().length; c0 = caps.length;
  const s6 = newSes({ provider_call_id: "CA9552", state: "ringing", answered_at: null });
  await hook("status", { CallSid: "CA9552", CallStatus: "no-answer", CallDuration: "0" });
  ok(ownerMail().length === m0 && caps.length === c0, "no-answer session produces no report email and no push");

  // ── 7. push-subscribe: token-stamped rows, owner-only by construction ──
  let res = await SUB.handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ subscription: { endpoint: "https://push.test/x", keys: { p256dh: "a", auth: "b" } } }) });
  ok(res.statusCode === 401, "push-subscribe refuses anonymous requests");
  res = await SUB.handler({ httpMethod: "POST", headers: { authorization: "Bearer " + TOK.custA }, body: JSON.stringify({ subscription: { endpoint: "https://push.test/x", keys: { p256dh: "a", auth: "b" } } }) });
  ok(res.statusCode === 401, "push-subscribe refuses customer tokens");
  res = await SUB.handler({ httpMethod: "POST", headers: { authorization: "Bearer " + TOK.ownerA }, body: JSON.stringify({ subscription: { endpoint: "https://push.test/newowner", keys: { p256dh: "p", auth: "q" } }, user_name: "Tony" }) });
  ok(res.statusCode === 200, "owner token registers a device");
  let row = T.push_subscriptions.find(x => x.endpoint === "https://push.test/newowner");
  ok(row && row.org_id === OA && row.role === "owner" && row.user_id === "org-a1", "the row is stamped with the token's org + role + uid (server-side, not client-claimed)");
  res = await SUB.handler({ httpMethod: "POST", headers: { authorization: "Bearer " + TOK.ownerA }, body: JSON.stringify({ subscription: { endpoint: "https://push.test/newowner", keys: { p256dh: "p2", auth: "q2" } }, user_name: "Tony" }) });
  ok(T.push_subscriptions.filter(x => x.endpoint === "https://push.test/newowner").length === 1, "re-subscribing the same device updates its one row");
  res = await SUB.handler({ httpMethod: "POST", headers: { authorization: "Bearer " + TOK.ownerA }, body: JSON.stringify({ action: "unsubscribe", endpoint: "https://push.test/newowner" }) });
  ok(res.statusCode === 200 && !T.push_subscriptions.some(x => x.endpoint === "https://push.test/newowner"), "unsubscribe removes the caller's own row");

  // ── 8. send-push: authenticated now; userId targeting still works ──
  res = await SP.handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ title: "Hi", body: "x" }) });
  ok(res.statusCode === 401, "send-push refuses anonymous broadcasts (it used to accept them)");
  c0 = caps.length;
  res = await SP.handler({ httpMethod: "POST", headers: { authorization: "Bearer " + TOK.ownerA }, body: JSON.stringify({ title: "POTENT ALERT", body: "test", userId: "org-a1" }) });
  const sentTo = caps.slice(c0).map(h => h.endpoint);
  ok(res.statusCode === 200 && sentTo.length === 1 && sentTo[0] === "https://push.test/owner", "targeted send reaches only that user's devices");
  process.env.PUSH_INTERNAL_SECRET = "s3cret";
  res = await SP.handler({ httpMethod: "POST", headers: { "x-push-secret": "s3cret" }, body: JSON.stringify({ title: "srv", body: "x", userId: "org-a1" }) });
  ok(res.statusCode === 200, "server-to-server callers can use the internal secret header");
  delete process.env.PUSH_INTERNAL_SECRET;

  // ── 9. Callback call: the name lives on the callback record, not the session intake — the report
  // must resolve it from there (it used to print "name not given"), and the email must be multipart:
  // the plain-text part unchanged, plus the approved ƏLEVATE HTML design with hosted image URLs ──
  const s9 = newSes({ outcome: "callback", intake: {}, seconds: 69, started_at: "2026-10-29T17:17:00.000Z", from_number: "+14704531616" });
  T.voice_callbacks.push({ id: "cb9", org_id: OA, session_id: s9.id, name: "Anthony Mendes", phone: "+14704531616", reason: "Caller requested to speak to a real person.", status: "open" });
  T.voice_handoffs.push({ id: "ho9", org_id: OA, session_id: s9.id, status: "callback", reason: "transfer not answered" });
  say(s9, [["caller", "Can I talk to a person?"], ["agent", "I can definitely help with that. What were you hoping to discuss?"], ["caller", "Yes, it's Anthony Mendes."]]);
  const rep9 = await OR.buildReport(OA, s9);
  ok(rep9.subject === "Elevate call: Callback saved — Anthony Mendes", "callback report names the caller from the callback record, not 'name not given'");
  ok(!/name not given/.test(rep9.text) && rep9.text.includes("Anthony Mendes"), "text part carries the resolved name too");
  ok(rep9.html.includes("ƏLEVATE") && rep9.html.includes("She answers. She books. She follows up."), "html part carries the Elevate header with the upside-down e");
  ok(rep9.html.includes("https://potentoperations.netlify.app/voice/img/elevate-mail/coin-banner.png"), "html hero is the hosted coin-editions banner URL");
  ok(rep9.html.includes("https://potentoperations.netlify.app/voice/img/elevate-mail/mouth.png") && rep9.html.includes("Here&rsquo;s what she said"), "html transcript section carries the hosted pink-diamond mouth");
  ok(rep9.html.includes("https://potentoperations.netlify.app/voice/img/elevate-mail/globe.png") && rep9.html.includes("no marketing, just the call"), "html footer carries the hosted gold globe and the no-marketing line");
  ok(rep9.html.includes("Callback saved") && rep9.html.includes("(470) 453-1616") && rep9.html.includes("1 min 9 sec"), "summary card: outcome badge, formatted number, length");
  ok(rep9.html.includes("Thu, Oct 29, 2026") && rep9.html.includes("1:17 PM"), "summary card: the call's date and time");
  ok(rep9.html.includes("Callback saved — someone will call back on the number they confirmed."), "summary card: next step derived from the saved callback");
  ok(rep9.html.includes("Can I talk to a person?") && rep9.html.includes("VIEW IN YOUR ELEVATE DASHBOARD") && rep9.html.includes('href="https://potentoperations.netlify.app/voice/"'), "html carries the transcript lines and the dashboard button");
  ok(rep9.html.includes("Session " + s9.id.slice(0, 8)) && rep9.html.includes("POTENT Logistics"), "footer session line uses the real session id and the org's own name");
  const s10 = newSes({ outcome: "callback", intake: {} });
  T.voice_callbacks.push({ id: "cb10", org_id: OA, session_id: s10.id, name: "Anthony Mendes", phone: "+14704531616", reason: "Asked for a person.", status: "open" });
  say(s10, [["caller", "I want to talk to a real person."]]);
  const rr10 = await OR.reportCall(OA, s10.id);
  const mail10 = reports()[reports().length - 1];
  ok(rr10.ok && rr10.emailed && mail10 && mail10.text.includes("FULL TRANSCRIPT") && typeof mail10.html === "string" && mail10.html.includes("coin-banner.png"), "sent report email is multipart: text part intact, html part is the approved design");

  console.log("voice owner report: " + n + " assertions PASS");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
