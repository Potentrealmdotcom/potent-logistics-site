// Twilio webhook for the Əlevate phone line. Every request must carry a valid Twilio signature.
//   ?a=inbound  call arrives: must be on an Əlevate number AND from one of your phones -> ask for the keypad PIN
//   ?a=pin      keypad digits arrive: right -> connect to the audio bridge; wrong -> try again, then lock out
//   ?a=status   call ended
//   ?a=fallback the audio bridge could not be reached
const TW = require("./lib/voice/adapters/twilio");
const E = require("./lib/elevate");
const P = require("./lib/elevate-phone");
const xmlR = function (xml, s) { return { statusCode: s || 200, headers: { "Content-Type": "text/xml", "Cache-Control": "no-store" }, body: xml }; };
const base = function () { return process.env.ELEVATE_WEBHOOK_URL || ((process.env.URL || "https://potentoperations.netlify.app") + "/.netlify/functions/elevate-phone"); };
const gather = function (say, attempt) {
  return '<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="dtmf" numDigits="6" timeout="10" action="' + TW.esc(base() + "?a=pin") + '" method="POST"><Say>' + TW.esc(say) + "</Say></Gather><Say>I did not get a PIN. Goodbye.</Say><Hangup/></Response>";
};

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return xmlR(TW.twimlSay("This number is not set up for web requests."), 405);
  const tokenAuth = process.env.TWILIO_AUTH_TOKEN; if (!tokenAuth || !process.env.AUTH_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) return xmlR(TW.twimlSay("This line is not in service."), 503);
  const params = TW.parseForm(event.body, event.isBase64Encoded), q = event.queryStringParameters || {};
  const url = base() + (event.rawQuery ? "?" + event.rawQuery : (Object.keys(q).length ? "?" + Object.keys(q).map(function (k) { return k + "=" + encodeURIComponent(q[k]); }).join("&") : ""));
  const h = event.headers || {}; if (!TW.validate(tokenAuth, url, params, h["x-twilio-signature"] || h["X-Twilio-Signature"])) return xmlR("<Response/>", 403);
  const a = q.a || "inbound", sid = String(params.CallSid || "").slice(0, 64), from = String(params.From || ""), to = String(params.To || "");
  try {
    if (a === "inbound") {
      if (!P.configured() || !P.numberOk(to)) return xmlR(TW.twimlSay("Sorry, this number is not in service."));
      const failedStir = /^TN-Validation-Failed/i.test(String(params.StirVerstat || ""));
      let row = await P.byCallSid(sid);
      if (!row) {
        const known = P.phoneOk(from) && !failedStir;
        const ins = await E.sb("elevate_calls", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: { call_sid: sid, owner_key: E.osKey(), from_number: from, state: known ? "pin_pending" : "denied", end_reason: known ? null : (failedStir ? "caller_id_failed_validation" : "unknown_caller") } });
        row = P.rows(ins)[0] || await P.byCallSid(sid);
      }
      if (!row || row.state !== "pin_pending") return xmlR(TW.twimlSay("This line is private. Goodbye."));
      if (await P.lockedOut(from)) { await E.sb("elevate_calls?id=eq." + row.id, { method: "PATCH", prefer: "return=minimal", body: { state: "denied", end_reason: "locked_out" } }); return xmlR(TW.twimlSay("Too many tries. Goodbye.")); }
      if ((await P.callsToday()) >= 40) { await E.sb("elevate_calls?id=eq." + row.id, { method: "PATCH", prefer: "return=minimal", body: { state: "denied", end_reason: "daily_cap" } }); return xmlR(TW.twimlSay("Daily limit reached. Goodbye.")); }
      return xmlR(gather("Əlevate. Enter your six digit PIN."));
    }
    if (a === "pin") {
      const row = await P.byCallSid(sid); if (!row || row.state !== "pin_pending" || !P.phoneOk(row.from_number)) return xmlR(TW.twimlSay("This line is private. Goodbye."));
      if (await P.lockedOut(row.from_number)) { await E.sb("elevate_calls?id=eq." + row.id, { method: "PATCH", prefer: "return=minimal", body: { state: "denied", end_reason: "locked_out" } }); return xmlR(TW.twimlSay("Too many tries. Goodbye.")); }
      if (!P.checkPin(process.env.ELEVATE_PIN_HASH, params.Digits)) {
        const fails = Number(row.pin_fails || 0) + 1;
        await E.sb("elevate_calls?id=eq." + row.id, { method: "PATCH", prefer: "return=minimal", body: fails >= 3 ? { pin_fails: fails, state: "denied", end_reason: "wrong_pin" } : { pin_fails: fails } });
        return xmlR(fails >= 3 ? TW.twimlSay("That PIN was not right. Goodbye.") : gather("That PIN was not right. Try again."));
      }
      await E.sb("elevate_calls?id=eq." + row.id + "&state=eq.pin_pending", { method: "PATCH", prefer: "return=minimal", body: { state: "ringing" } });
      const tok = TW.streamToken(process.env.VOICE_BRIDGE_SECRET, sid, "elevate", Date.now() + 120000);
      return xmlR(TW.twimlStream(process.env.VOICE_BRIDGE_URL, { token: tok }, base() + "?a=fallback"));
    }
    if (a === "fallback") {
      const row = await P.byCallSid(sid);
      if (row && (row.state === "ringing" || row.state === "active")) await E.sb("elevate_calls?id=eq." + row.id, { method: "PATCH", prefer: "return=minimal", body: { state: "failed", ended_at: P.iso(Date.now()), end_reason: "bridge_dropped" } });
      return xmlR(TW.twimlSay("Sorry, I lost the connection. Please call again."));
    }
    if (a === "status") {
      const st = String(params.CallStatus || ""); if (["completed", "busy", "failed", "no-answer", "canceled"].indexOf(st) < 0) return xmlR("<Response/>");
      const row = await P.byCallSid(sid); if (!row) return xmlR("<Response/>");
      const live = ["ringing", "active", "pin_pending"].indexOf(row.state) >= 0;
      await E.sb("elevate_calls?id=eq." + row.id, { method: "PATCH", prefer: "return=minimal", body: { state: live ? (row.state === "pin_pending" ? "denied" : (st === "completed" ? "ended" : "failed")) : row.state, ended_at: row.ended_at || P.iso(Date.now()), seconds: row.seconds != null ? row.seconds : Math.max(0, parseInt(params.CallDuration, 10) || 0), end_reason: row.end_reason || (row.state === "pin_pending" ? "hung_up_at_pin" : st) } });
      return xmlR("<Response/>");
    }
    return xmlR("<Response/>", 400);
  } catch (e) { console.error("elevate-phone", a, e && e.message); return xmlR(TW.twimlSay("We are having trouble. Please call back shortly.")); }
};
