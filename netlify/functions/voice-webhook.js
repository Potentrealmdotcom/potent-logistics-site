// Telephone webhooks (Twilio): incoming call, call status, transfer result, transfer TwiML, and the fallback when the audio bridge cannot be reached.
// Every request must carry a valid Twilio signature. Duplicate deliveries are harmless.
const B = require("./lib/beats");
const TW = require("./lib/voice/adapters/twilio");
const S = require("./lib/voice/store");
const V = require("./lib/voice/billing");
const OR = require("./lib/voice/owner-report");
const CN = require("./lib/voice/canonical");
const rows = S.rows;
const xmlR = function (xml, s) { return { statusCode: s || 200, headers: { "Content-Type": "text/xml", "Cache-Control": "no-store" }, body: xml }; };
const base = function () { return process.env.VOICE_WEBHOOK_URL || ((process.env.URL || B.SITE) + "/.netlify/functions/voice-webhook"); };
const bridgeUrl = function () { return process.env.VOICE_BRIDGE_URL || ""; };       // wss://voice.example.com/twilio
const secret = function () { return process.env.VOICE_BRIDGE_SECRET || ""; };
const LIVE = ["ringing", "active", "handoff"];

async function liveCount(orgId) { const r = await B.sb("voice_sessions?org_id=eq." + orgId + "&state=in.(ringing,active,handoff)&started_at=gt." + encodeURIComponent(new Date(Date.now() - 2 * 3600e3).toISOString()) + "&select=id&limit=200"); return rows(r).length; }
async function health(orgId, kind, ok, detail) { try { await B.sb("voice_provider_health", { method: "POST", prefer: "return=minimal", body: { org_id: orgId || null, provider: "twilio", kind: kind, ok: ok, detail: detail || null } }); } catch (e) { /* ignore */ } }
async function missed(orgId, sessionId, phone, why) { if (phone) await B.sb("voice_callbacks", { method: "POST", prefer: "return=minimal", body: { org_id: orgId, session_id: sessionId, phone: phone, reason: why } }); }

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return xmlR(TW.twimlSay("This number is not set up for web requests."), 405);
  const tokenAuth = process.env.TWILIO_AUTH_TOKEN; if (!tokenAuth) return xmlR(TW.twimlSay("Phone service is not configured."), 503);
  const params = TW.parseForm(event.body, event.isBase64Encoded), q = event.queryStringParameters || {};
  const url = base() + (event.rawQuery ? "?" + event.rawQuery : (Object.keys(q).length ? "?" + Object.keys(q).map(function (k) { return k + "=" + encodeURIComponent(q[k]); }).join("&") : ""));
  const h = event.headers || {}, sig = h["x-twilio-signature"] || h["X-Twilio-Signature"];
  if (!TW.validate(tokenAuth, url, params, sig)) { await health(null, "bad_signature", false, "rejected a request with an invalid signature"); return xmlR("<Response/>", 403); }
  const a = q.a || "inbound", callSid = String(params.CallSid || "").slice(0, 64);
  try {
    if (a === "inbound") {
      const to = String(params.To || ""), from = String(params.From || "");
      const cfgRow = rows(await B.sb("voice_agent_config?settings=cs." + encodeURIComponent(JSON.stringify({ numbers: [to] })) + "&select=*&limit=1"))[0];
      if (!cfgRow) { await health(null, "unknown_number", false, to); return xmlR(TW.twimlSay("Sorry, this number is not in service.")); }
      const orgId = cfgRow.org_id, cfg = Object.assign({}, S.DEFAULT_CFG, cfgRow);
      const org = rows(await B.sb("organizations?id=eq." + orgId + "&select=id,name&limit=1"))[0] || { name: "" };
      // The same CallSid can arrive twice (provider retry). Reuse the session instead of making another.
      let ses = rows(await B.sb("voice_sessions?org_id=eq." + orgId + "&provider=eq.twilio&provider_call_id=eq." + encodeURIComponent(callSid) + "&select=*&limit=1"))[0];
      const human = cfg.human_available && cfg.transfer_number;
      const reject = async function (state, why, say) { if (!ses) { const r = await B.sb("voice_sessions", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: { org_id: orgId, provider: "twilio", provider_call_id: callSid, direction: "inbound", from_number: from, to_number: to, state: state, end_reason: why, ended_at: new Date().toISOString(), seconds: 0 } }); ses = rows(r)[0]; await missed(orgId, ses && ses.id, from, "Missed call (" + why + ")"); } return xmlR(human ? TW.twimlDial(cfg.transfer_number, base() + "?a=dial&s=" + (ses ? ses.id : ""), say, to) : TW.twimlSay(say + " We will call you back.")); };
      if (ses) { if (ses.state !== "ringing" && ses.state !== "active") return xmlR(TW.twimlSay("Goodbye.")); }
      else {
        if (cfg.emergency_stop || cfg.ai_enabled === false) return reject("rejected", "ai_disabled", "Our assistant is unavailable right now.");
        const adm = await V.admit(orgId, { activeCalls: await liveCount(orgId) }); if (!adm.ok) return reject("rejected", adm.code, adm.code === "busy" ? "All our lines are busy." : "Our assistant is unavailable right now.");
        if (!bridgeUrl() || !secret()) { await health(orgId, "bridge_not_configured", false, "VOICE_BRIDGE_URL / VOICE_BRIDGE_SECRET missing"); return reject("rejected", "bridge_not_configured", "Our assistant is unavailable right now."); }
        const ins = await B.sb("voice_sessions", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: { org_id: orgId, provider: "twilio", provider_call_id: callSid, direction: "inbound", from_number: from, to_number: to, state: "ringing", test_mode: !!(cfgRow.settings && cfgRow.settings.test_mode) } });
        ses = rows(ins)[0] || rows(await B.sb("voice_sessions?org_id=eq." + orgId + "&provider_call_id=eq." + encodeURIComponent(callSid) + "&select=*&limit=1"))[0];
        if (!ses) return reject("failed", "session_save_failed", "We are having trouble right now.");
        await S.firstTime(orgId, ses.id, "call:" + callSid + ":start", "call_start", { from: from.replace(/\d(?=\d{4})/g, "*") });
      }
      const tok = TW.streamToken(secret(), callSid, orgId, Date.now() + 120000);
      return xmlR(TW.twimlStream(bridgeUrl(), { token: tok, session: ses.id }, base() + "?a=fallback&s=" + ses.id));
    }
    if (a === "fallback") { // the audio bridge could not be reached or dropped: be honest and offer a person
      const readSes = async function () { return rows(await B.sb("voice_sessions?provider_call_id=eq." + encodeURIComponent(callSid) + "&id=eq." + encodeURIComponent(String(q.s || "")) + "&select=*&limit=1"))[0]; };
      // Twilio calls this the moment the audio stream ends, for ANY reason, including the caller simply hanging up (CallStatus is then "completed"). That is a normal end, not a drop.
      const cs = String(params.CallStatus || "").toLowerCase();
      if (cs && cs !== "in-progress" && cs !== "ringing") return xmlR("<Response/>");
      // The call is still up but the stream ended: give the bridge a moment to report its own end before calling it a drop (it reports a few hundred ms after the stream closes).
      await new Promise(function (ok) { setTimeout(ok, Number(process.env.VOICE_FALLBACK_GRACE_MS != null ? process.env.VOICE_FALLBACK_GRACE_MS : 1500)); });
      const ses = await readSes();
      if (!ses) return xmlR(TW.twimlSay("We are having trouble. Please call back shortly."));
      const cfg = await S.cfgOf(ses.org_id);
      if ((ses.state === "active" || ses.state === "ringing") && !ses.ended_at) { await S.patchSession(ses.org_id, ses.id, { state: "failed", end_reason: "bridge_dropped" }); await health(ses.org_id, "bridge_dropped", false, ses.id); await missed(ses.org_id, ses.id, ses.from_number, "Call dropped (assistant connection lost)"); }
      return xmlR(cfg.human_available && cfg.transfer_number ? TW.twimlDial(cfg.transfer_number, base() + "?a=dial&s=" + ses.id, "One moment, I am connecting you to a person.", ses.to_number) : TW.twimlSay("Sorry, we lost our connection. We will call you back."));
    }
    if (a === "status") {
      const st = String(params.CallStatus || ""); if (["completed", "busy", "failed", "no-answer", "canceled"].indexOf(st) < 0) return xmlR("<Response/>");
      const r = rows(await B.sb("voice_sessions?provider=eq.twilio&provider_call_id=eq." + encodeURIComponent(callSid) + "&select=*&limit=1"))[0]; if (!r) return xmlR("<Response/>");
      if (!(await S.firstTime(r.org_id, r.id, "call:" + callSid + ":status:" + st, "call_status", { status: st }))) return xmlR("<Response/>");
      const secs = Math.max(0, parseInt(params.CallDuration, 10) || 0), wasLive = LIVE.indexOf(r.state) >= 0;
      await S.patchSession(r.org_id, r.id, { state: wasLive ? (st === "completed" ? "ended" : "failed") : r.state, ended_at: r.ended_at || new Date().toISOString(), seconds: secs, end_reason: r.end_reason || st });
      if (secs > 0 && r.state !== "rejected") await V.recordUsage(r.org_id, r.id, secs, r.direction === "outbound" ? "outbound" : "call", r.started_at);
      // Backstop for the owner's per-call report: if the bridge's own end (voice-tools finish) never ran
      // (bridge died, call dropped), this status callback is what finalizes the session. settleReport
      // defers to the canonical transcript when a recording exists (bounded wait, live fallback) and
      // is once-per-session, so when finish() already reported, this is a no-op.
      if (wasLive || r.ended_at) { try { await CN.settleReport(r.org_id, r.id); } catch (e) { /* best effort */ } }
      return xmlR("<Response/>");
    }
    if (a === "xfer") { // TwiML that Twilio fetches after we asked it to move the call; the number comes from saved settings, never from the request
      const ses = rows(await B.sb("voice_sessions?provider_call_id=eq." + encodeURIComponent(callSid) + "&select=*&limit=1"))[0]; if (!ses || ses.id !== q.s) return xmlR(TW.twimlSay("Sorry, we could not transfer you."));
      const cfg = await S.cfgOf(ses.org_id), hand = rows(await B.sb("voice_handoffs?org_id=eq." + ses.org_id + "&session_id=eq." + ses.id + "&status=eq.requested&select=id&limit=1"))[0];
      if (!hand || !cfg.human_available || !cfg.transfer_number || cfg.emergency_stop) return xmlR(TW.twimlSay("Sorry, no one is available right now. We will call you back."));
      await S.patchSession(ses.org_id, ses.id, { state: "handoff" });
      return xmlR(TW.twimlDial(cfg.transfer_number, base() + "?a=dial&s=" + ses.id, "Connecting you now.", ses.to_number));
    }
    if (a === "pay" || a === "payresult") {   // KEYPAD PAYMENT. The caller types the card straight to Stripe through Twilio; the amount is re-read from our database here, never from the request or the AI.
      const JP = require("./lib/voice/jobpay"), TL = require("./lib/voice/tools");
      const ses = rows(await B.sb("voice_sessions?provider_call_id=eq." + encodeURIComponent(callSid) + "&select=*&limit=1"))[0];
      const bk = ses && ses.id === q.s ? rows(await B.sb("voice_bookings?org_id=eq." + ses.org_id + "&id=eq." + encodeURIComponent(String(q.b || "")) + "&session_id=eq." + ses.id + "&select=*&limit=1"))[0] : null;
      const plan = bk && bk.status === "confirmed" && bk.job_id ? JP.chargePlan(bk, ses.from_number) : { cents: 0 }, cents = plan.cents;
      const back = function (r) { return xmlR(TW.twimlStream(bridgeUrl(), { token: TW.streamToken(secret(), callSid, ses.org_id, Date.now() + 120000, { r: r }), session: ses.id }, base() + "?a=fallback&s=" + ses.id)); };
      if (!ses || !cents || !bridgeUrl() || !secret()) return xmlR(TW.twimlSay("Sorry, we could not take the payment on this call. We will call you back."));
      if (a === "pay") {
        const conn = process.env.VOICE_PAY_CONNECTOR; if (process.env.VOICE_PAY !== "on" || !conn) return back("failed:not_live");
        await health(ses.org_id, "keypad_pay_started", true, bk.reference);
        return xmlR(TW.twimlPay({ amount: (cents / 100).toFixed(2), connector: conn, action: base() + "?a=payresult&s=" + ses.id + "&b=" + bk.id, description: "POTENT Logistics delivery " + bk.reference }));
      }
      const res = String(params.Result || "").slice(0, 60), code = String(params.PaymentConfirmationCode || ""), ref = bk.reference, money = "$" + (cents / 100).toFixed(2);
      const flag = async function (subject, text) { try { await TL.notifyOwner(ses.org_id, subject, text); } catch (e) { /* ignore */ } if (ses.from_number) await B.sb("voice_callbacks", { method: "POST", prefer: "return=minimal", body: { org_id: ses.org_id, session_id: ses.id, phone: ses.from_number, reason: (subject + " " + ref).slice(0, 300) } }); };
      if (res === "caller-hung-up") { await flag("PAYMENT NOT COMPLETED (caller hung up during keypad)", "Booking " + ref + ", total " + money + ". Call them back to take payment."); return xmlR("<Response/>"); }
      if (res === "success") {
        const v = await JP.verifyCharge(code, cents);
        if (v.ok && plan.test) {   // owner's small test charge: Stripe confirmed the test amount, but the job was NOT paid in full, so it is not marked paid
          await B.audit("system", "voicejob_keypad_test_payment", bk.id, { cents: cents, quote_cents: plan.quote, stripe: v.id });
          await S.transcript(ses.org_id, ses.id, "system", "[Keypad TEST payment confirmed by Stripe: " + money + " for " + ref + "; job NOT marked paid]"); await health(ses.org_id, "keypad_pay_test_paid", true, ref);
          await flag("KEYPAD TEST PAYMENT OK (" + money + ")", "Stripe confirmed the " + money + " test charge (" + v.id + ") for booking " + ref + ". The job was NOT marked paid (the quote is $" + (plan.quote / 100).toFixed(2) + "). Refund the test charge in Stripe if you want it back, and remove VOICE_PAY_TEST_AMOUNT_CENTS.");
          return back("paidtest:" + money);
        }
        if (v.ok) {
          const m = await JP.markPaid(bk, cents, v.pi, "keypad");
          if (m && m.ok) { await S.transcript(ses.org_id, ses.id, "system", "[Keypad payment confirmed by Stripe: " + money + " for " + ref + "]"); await health(ses.org_id, "keypad_pay_paid", true, ref); return back("paid:" + money); }
          await flag("PAYMENT TAKEN BUT JOB NOT MARKED PAID", "Stripe confirmed " + money + " (" + v.id + ") for booking " + ref + " but the job could not be marked paid. Check the job and mark it paid by hand. Do NOT charge again.");
          return back("unverified:" + money);
        }
        await B.audit("system", "voicejob_keypad_unverified", bk.id, { why: v.error, charged_cents: v.cents == null ? null : v.cents, expected_cents: cents });
        await flag("PAYMENT NEEDS YOUR EYES (" + v.error + ")", "The phone keypad reported a payment for booking " + ref + " (expected " + money + ", Stripe says " + (v.cents == null ? "unknown" : "$" + (v.cents / 100).toFixed(2)) + ", id " + (code || "none") + "). It was NOT marked paid. Check Stripe, then fix or refund.");
        return back("unverified:" + money);
      }
      await health(ses.org_id, "keypad_pay_failed", false, res || "no_result");
      await flag("PAYMENT NOT COMPLETED by keypad (" + (res || "no result") + ")", "Booking " + ref + ", total " + money + ". The caller could not finish paying by keypad (" + (res || "no result") + "). Call them back to take payment. No link was sent.");
      return back("failed:" + (res || "no_result"));
    }
    if (a === "dial") { // the result of the attempt to reach a person
      const ses = rows(await B.sb("voice_sessions?provider_call_id=eq." + encodeURIComponent(callSid) + "&select=*&limit=1"))[0]; if (!ses) return xmlR("<Response/>");
      const ds = String(params.DialCallStatus || ""), good = ds === "completed" || ds === "answered";
      if (await S.firstTime(ses.org_id, ses.id, "dial:" + callSid + ":" + ds, "handoff_result", { status: ds })) {
        await B.sb("voice_handoffs?org_id=eq." + ses.org_id + "&session_id=eq." + ses.id + "&status=eq.requested", { method: "PATCH", prefer: "return=minimal", body: { status: good ? "completed" : "missed", resolved_at: new Date().toISOString(), resolved_by: "system:" + ds } });
        if (!good) await missed(ses.org_id, ses.id, ses.from_number, "Transfer to a person was not answered (" + (ds || "unknown") + ")");
      }
      // A transfer that did not connect must never end in silence: the callback is already saved above,
      // so close the call out loud. (The full hand-back to the assistant rides with the warm-transfer build.)
      if (!good) return xmlR(TW.twimlSay("Sorry, no one could take the call. We will call you back."));
      return xmlR("<Response/>");
    }
    return xmlR("<Response/>", 400);
  } catch (e) { console.error("voice-webhook", a, e && e.message); await health(null, "webhook_error", false, a); return xmlR(TW.twimlSay("We are having trouble. Please call back shortly."), 200); }
};
