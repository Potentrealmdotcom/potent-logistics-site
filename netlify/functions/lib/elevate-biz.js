// lib/elevate-biz.js — Əlevate's OWNER-ONLY business tools: a daily briefing from POTENT's own records, and email she sends herself.
// Only the platform owner's Əlevate ever sees these tools, and execute() refuses anyone else even if a model asks.
// Every send is logged in elevate_actions, capped per day, and can be paused with one switch. She never claims a send worked unless it did.
const Mail = require("./mail");
const DAY_CAP = 20;
const OWNER_TOOLS = [
  { name: "business_briefing", description: "Owner only. Get a live snapshot of POTENT: jobs this week and revenue, upcoming jobs, new and due leads, open callback and demo requests, phone calls this week, OS licenses, and your own tasks due. Use it for daily briefings and 'how are we doing'. Report only what comes back.", parameters: { type: "object", properties: {} } },
  { name: "list_open_requests", description: "Owner only. List open callback and demo-booking requests from the phone agent (name, phone, reason, preferred time).", parameters: { type: "object", properties: {} } },
  { name: "list_jobs", description: "Owner only. List POTENT jobs. which is 'upcoming' (not yet delivered) or 'recent' (latest 10).", parameters: { type: "object", properties: { which: { type: "string", enum: ["upcoming", "recent"] } } } },
  { name: "list_leads_due", description: "Owner only. List leads whose follow-up date is today or earlier.", parameters: { type: "object", properties: {} } },
  { name: "send_email", description: "Owner only. Send ONE email right now from POTENT to one person. Use it only when the owner asked you to send something this conversation. It is logged, capped per day, and can be paused. Tell the owner exactly what the result says: sent, or why not.", parameters: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"] } },
  { name: "set_sending", description: "Owner only. Turn her own email sending on or off. enabled=false pauses all sending until turned back on.", parameters: { type: "object", properties: { enabled: { type: "boolean" } }, required: ["enabled"] } },
  { name: "sent_log", description: "Owner only. Show the last emails she sent (to, subject, when, whether it worked).", parameters: { type: "object", properties: {} } }
];
const NAMES = OWNER_TOOLS.map(function (t) { return t.name; });
const day0 = function () { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
const ago = function (n) { return new Date(Date.now() - n * 86400000).toISOString(); };
const rows = function (r) { return Array.isArray(r && r.data) ? r.data : []; };
const money = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };

async function org(E) { const r = await E.sb("organizations?select=id&order=created_at.asc&limit=1"); return rows(r)[0] && rows(r)[0].id; }

async function paused(E, k) {
  const r = await E.sb("elevate_actions?owner_key=eq." + E.q(k) + "&kind=eq.switch&order=created_at.desc&limit=1");
  const last = rows(r)[0]; return !!(last && last.ok === false);
}

async function run(E, k, name, args) {
  if (!E.isOwnerKey(k) || NAMES.indexOf(name) < 0) return { ok: false, error: "Unknown tool." };
  const o = await org(E); const oq = o ? "&org_id=eq." + o : "";
  if (name === "business_briefing") {
    const [jw, up, cb, ld, due, sess, lic, tk] = await Promise.all([
      E.sb("jobs?select=final_price,status,created_at&created_at=gte." + encodeURIComponent(ago(7)) + oq + "&limit=500"),
      E.sb("jobs?select=customer,service_name,date,status,final_price&status=in.(Confirmed,open,Scheduled,%22En%20Route%22,%22In%20Progress%22)" + oq + "&order=date.asc&limit=8"),
      E.sb("voice_callbacks?select=name,phone,reason,preferred_time,created_at&status=eq.open&order=created_at.desc&limit=10"),
      E.sb("leads?select=id&created_at=gte." + encodeURIComponent(ago(7)) + "&limit=1000"),
      E.sb("leads?select=name,company,phone,follow_up_date&follow_up_date=lte." + new Date().toISOString().slice(0, 10) + "&order=follow_up_date.asc&limit=8"),
      E.sb("voice_sessions?select=id&created_at=gte." + encodeURIComponent(ago(7)) + "&limit=1000"),
      E.sb("os_licenses?select=id,tier,status&limit=500"),
      E.sb("elevate_items?owner_key=eq." + E.q(k) + "&kind=eq.task&done=eq.false&due_at=lte." + encodeURIComponent(new Date(Date.now() + 86400000).toISOString()) + "&order=due_at.asc&limit=8")
    ]);
    const done = rows(jw).filter(function (j) { return /^(paid|completed)$/i.test(j.status || ""); });
    return { ok: true, as_of: new Date().toISOString(),
      jobs_last_7_days: rows(jw).length, completed_or_paid_last_7_days: done.length, revenue_last_7_days: money(done.reduce(function (s, j) { return s + (Number(j.final_price) || 0); }, 0)),
      upcoming_jobs: rows(up), open_callbacks: rows(cb), new_leads_last_7_days: rows(ld).length, leads_due_for_follow_up: rows(due),
      phone_calls_last_7_days: rows(sess).length, os_licenses: rows(lic).length, your_tasks_due: rows(tk).map(function (t) { return { title: t.title, due_at: t.due_at }; }),
      note: "Numbers come straight from POTENT's records. Ad spend, web traffic and email-inbox counts are not connected yet; do not report them." };
  }
  if (name === "list_open_requests") return { ok: true, callbacks: rows(await E.sb("voice_callbacks?select=name,phone,reason,preferred_time,created_at&status=eq.open&order=created_at.desc&limit=20")) };
  if (name === "list_jobs") {
    const up = args && args.which !== "recent";
    const r = await E.sb("jobs?select=customer,service_name,origin,destination,date,status,final_price&" + (up ? "status=in.(Confirmed,open,Scheduled,%22En%20Route%22,%22In%20Progress%22)&order=date.asc" : "order=created_at.desc") + oq + "&limit=" + (up ? 15 : 10));
    return { ok: true, jobs: rows(r) };
  }
  if (name === "list_leads_due") return { ok: true, leads: rows(await E.sb("leads?select=name,company,phone,email,follow_up_date,stage&follow_up_date=lte." + new Date().toISOString().slice(0, 10) + "&order=follow_up_date.asc&limit=20")) };
  if (name === "set_sending") {
    const on = args && args.enabled === true;
    const r = await E.sb("elevate_actions", { method: "POST", body: { owner_key: k, kind: "switch", target: on ? "on" : "off", ok: on } });
    return r.ok ? { ok: true, sending: on ? "on" : "paused" } : { ok: false, error: "Could not change the switch." };
  }
  if (name === "sent_log") {
    const r = await E.sb("elevate_actions?owner_key=eq." + E.q(k) + "&kind=eq.email&order=created_at.desc&limit=15");
    return { ok: true, sending: (await paused(E, k)) ? "paused" : "on", sent: rows(r).map(function (x) { return { to: x.target, subject: x.subject, at: x.created_at, worked: x.ok, detail: x.detail || undefined }; }) };
  }
  if (name === "send_email") {
    const to = E.clip(args.to, 200).toLowerCase(), subject = E.clip(args.subject, 150), body = E.clip(args.body, 5000);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(to)) return { ok: false, error: "That is not a valid email address. Nothing was sent." };
    if (!subject || !body) return { ok: false, error: "Needs a subject and a message. Nothing was sent." };
    if (await paused(E, k)) return { ok: false, error: "Sending is paused. Turn it on first. Nothing was sent." };
    const c = await E.sb("elevate_actions?owner_key=eq." + E.q(k) + "&kind=eq.email&ok=eq.true&created_at=gte." + encodeURIComponent(day0()) + "&select=id&limit=" + (DAY_CAP + 1));
    if (rows(c).length >= DAY_CAP) return { ok: false, error: "Today's limit of " + DAY_CAP + " emails is used up. Nothing was sent." };
    const text = body + "\n\n— Əlevate, AI assistant for Tony Mendes, POTENT Logistics\nReply to this email to reach us, or say STOP and we will not email you again.";
    const r = await Mail.send(to, subject, text, null);
    const worked = !!(r && r.ok);
    await E.sb("elevate_actions", { method: "POST", prefer: "return=minimal", body: { owner_key: k, kind: "email", target: to, subject: subject, ok: worked, detail: worked ? null : (r && r.skipped ? "email service not configured" : "email service refused it") } });
    return worked ? { ok: true, sent_to: to, subject: subject } : { ok: false, error: "The email did not go out (" + (r && r.skipped ? "email service is not configured" : "the email service refused it") + ")." };
  }
  return { ok: false, error: "Unknown tool." };
}
module.exports = { OWNER_TOOLS, NAMES, run, DAY_CAP };
