// lib/vetting.js — carrier vetting: server-side FMCSA + phone line type + ID check + (future) ELD → risk RECOMMENDATION.
// A person still approves or rejects. Nothing here is "AI says yes"; it is a scored checklist with reasons.
//
// Differences from the two reference zips (deliberate):
//  • FMCSA is looked up HERE, not trusted from the browser.
//  • A failed/absent lookup is MANUAL_REVIEW, never a silent reject (an FMCSA outage must not reject honest carriers).
//  • "APPROVED" requires a confirmed ID match; a clean phone alone is not enough.
//  • Carrier not found at FMCSA (e.g. intrastate-only) goes to a human, not an auto-reject.
//  • ELD has NO effect until a telematics partner is connected (status must be "connected" with real counts).

var STATUS = { APPROVED: "APPROVED", MANUAL: "MANUAL_REVIEW", REJECTED: "REJECTED", HOLD: "HOLD_REQUIRES_LIVENESS" };
var APPROVE_MAX = 0, MANUAL_MAX = 20;

function digits(s) { return String(s == null ? "" : s).replace(/\D/g, ""); }
function normName(s) { return String(s || "").toLowerCase().replace(/\b(llc|inc|corp|co|ltd|l\.l\.c|incorporated|company)\b/g, "").replace(/[^a-z0-9]/g, ""); }
function toE164(p) { var d = digits(p); if (d.length === 10) return "+1" + d; if (d.length === 11 && d[0] === "1") return "+" + d; return null; }

// ── pure scoring ──
function evaluate(x) {
    x = x || {}; var f = x.fmcsa || {}, ph = x.phone || {}, idv = x.idv || {}, eld = x.eld || {};
    var score = 0, factors = [];
    var idOk = idv.live_human === true && idv.doc_matches === true;

    // 1. Operating authority (FMCSA)
    if (f.checked !== true || f.error) {
        factors.push("FMCSA_UNVERIFIED");
    } else if (f.found !== true) {
        score += 25; factors.push("FMCSA_NOT_FOUND");
    } else if (f.allowed_to_operate !== true) {
        return { status: STATUS.REJECTED, score: 100, factors: ["AUTHORITY_INACTIVE_OR_REVOKED"], reason: "FMCSA shows this carrier is not allowed to operate." };
    } else if (f.out_of_service === true) {
        return { status: STATUS.REJECTED, score: 100, factors: ["OUT_OF_SERVICE_ORDER"], reason: "FMCSA lists an out-of-service order." };
    } else {
        factors.push("AUTHORITY_ACTIVE");
        if (x.company_name && f.legal_name) {
            var a = normName(x.company_name), b = normName(f.legal_name), c = normName(f.dba_name);
            if (a && b && a !== b && a !== c && b.indexOf(a) < 0 && a.indexOf(b) < 0) { score += 15; factors.push("NAME_MISMATCH_WITH_FMCSA"); }
        }
    }

    // 2. Phone line type (Twilio Lookup v2)
    var lt = String(ph.line_type || "").toLowerCase(); var voip = lt === "voip";
    if (ph.checked !== true || ph.error) { factors.push("PHONE_UNCHECKED"); }
    else if (voip) { score += 30; factors.push("VOIP_PHONE_LINE"); }
    else if (lt === "mobile") { score -= 5; factors.push("MOBILE_PHONE_LINE"); }
    else if (lt === "landline") { factors.push("LANDLINE_PHONE_LINE"); }
    else { score += 10; factors.push("PHONE_LINE_TYPE_UNKNOWN"); }

    // 3. Person check (live human + ID matches the FMCSA record) — set by staff now, by an ID vendor later
    if (idOk) { score -= 15; factors.push("IDENTITY_CONFIRMED"); }
    else { score += 10; factors.push("IDENTITY_NOT_CONFIRMED"); }

    // 4. ELD — ignored until a real partner feed exists
    if (eld.status === "connected") {
        var trucks = Number(f.fleet_size || 0), units = Number(eld.active_hardware_count || 0);
        if (trucks > 0 && units === 0) { score += 40; factors.push("ELD_ZERO_UNITS_VS_FMCSA_FLEET"); }
        else if (units > 0) { score -= 25; factors.push("ELD_ACTIVE_HARDWARE"); }
    } else { factors.push("ELD_NOT_CONNECTED"); }

    // Decision
    if (voip && !idOk) return { status: STATUS.HOLD, score: Math.max(0, score), factors: factors, reason: "Virtual (VOIP) phone line: needs a confirmed live ID match before this can proceed." };
    var unverifiedAuthority = factors.indexOf("FMCSA_UNVERIFIED") >= 0 || factors.indexOf("FMCSA_NOT_FOUND") >= 0;
    var status = score <= APPROVE_MAX ? STATUS.APPROVED : score <= MANUAL_MAX ? STATUS.MANUAL : STATUS.REJECTED;
    if (status === STATUS.APPROVED && unverifiedAuthority) status = STATUS.MANUAL;   // never recommend approval without verified authority
    return { status: status, score: Math.max(0, score), factors: factors, reason: status === STATUS.APPROVED ? "All checks passed." : status === STATUS.MANUAL ? "A person should review the flagged items." : "Too many risk signals." };
}

// ── FMCSA (server-side) ──
async function fmcsaLookup(opts, fetchImpl) {
    var f = fetchImpl || fetch, key = process.env.FMCSA_WEBKEY, dot = digits(opts.dot), mc = digits(opts.mc);
    if (!key) return { checked: false, error: "FMCSA_WEBKEY not set" };
    if (!dot && !mc) return { checked: false, error: "no DOT/MC supplied" };
    var url = dot ? "https://mobile.fmcsa.dot.gov/qc/services/carriers/" + dot + "?webKey=" + encodeURIComponent(key)
                  : "https://mobile.fmcsa.dot.gov/qc/services/carriers/docket-number/" + mc + "?webKey=" + encodeURIComponent(key);
    try {
        var r = await f(url); if (!r.ok) return { checked: false, error: "FMCSA http " + r.status };
        var d = await r.json(), c = d && d.content;
        if (Array.isArray(c)) c = c[0] && (c[0].carrier || c[0]); else if (c && c.carrier) c = c.carrier;
        var now = new Date().toISOString();
        if (!c || typeof c !== "object") return { checked: true, found: false, checked_at: now };
        return { checked: true, found: true, checked_at: now, dot: String(c.dotNumber || dot || ""), legal_name: c.legalName || "", dba_name: c.dbaName || "",
            allowed_to_operate: c.allowedToOperate === "Y", out_of_service: c.oosDate != null && String(c.oosDate) !== "" && String(c.oosDate) !== "null",
            fleet_size: Number(c.totalPowerUnits || 0), status_code: c.statusCode || null };
    } catch (e) { return { checked: false, error: "FMCSA unreachable" }; }
}

// ── Twilio Lookup v2 line type ──
async function phoneLookup(phone, fetchImpl) {
    var f = fetchImpl || fetch, sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN, e164 = toE164(phone);
    if (!sid || !tok) return { checked: false, error: "Twilio not configured" };
    if (!e164) return { checked: false, error: "not a US phone number" };
    try {
        var r = await f("https://lookups.twilio.com/v2/PhoneNumbers/" + encodeURIComponent(e164) + "?Fields=line_type_intelligence", { headers: { Authorization: "Basic " + Buffer.from(sid + ":" + tok).toString("base64") } });
        if (!r.ok) return { checked: false, error: "Twilio http " + r.status };
        var d = await r.json(), li = d.line_type_intelligence || {}, t = String(li.type || "").toLowerCase();
        var line = /voip/.test(t) ? "voip" : t === "mobile" ? "mobile" : t === "landline" ? "landline" : t ? "other" : "unknown";
        return { checked: true, line_type: line, raw_type: t || null, carrier: li.carrier_name || null, checked_at: new Date().toISOString() };
    } catch (e) { return { checked: false, error: "Twilio unreachable" }; }
}

module.exports = { evaluate: evaluate, fmcsaLookup: fmcsaLookup, phoneLookup: phoneLookup, toE164: toE164, STATUS: STATUS };
