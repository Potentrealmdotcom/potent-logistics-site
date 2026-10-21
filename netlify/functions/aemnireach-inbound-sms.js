// netlify/functions/aemnireach-inbound-sms.js
// Twilio webhook: receives inbound SMS, handles STOP, logs replies.
// Set this URL in Twilio Console → Phone Numbers → Messaging → Webhook:
//   https://potentoperations.netlify.app/.netlify/functions/aemnireach-inbound-sms

const SUPABASE_URL = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AI_KEY = process.env.GEMINI_API_KEY;

async function sb(path, method, body) {
    const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
        method: method || "GET",
        headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", "Prefer": "return=representation" },
        body: body ? JSON.stringify(body) : undefined
    });
    try { return JSON.parse(await r.text()); } catch (e) { return null; }
}

// Find which user owns the Twilio number that received this (via most recent outbound)
async function findOwner(toNumber) {
    const rows = await sb("aemnireach.messages?channel=eq.sms&direction=eq.outbound&order=created_at.desc&limit=200&select=user_id,from_address");
    // Twilio 'To' on inbound = our number. We stored provider sends without from_address; fall back to latest sender.
    if (Array.isArray(rows) && rows.length) return rows[0].user_id;
    return null;
}

async function aiReply(text) {
    if (!AI_KEY) return null;
    try {
        const r = await require("./lib/gemini.js").chat({
                model: "gemini-3.8-flash",
                messages: [
                    { role: "system", content: "You are the SMS auto-reply for POTENT OS, a logistics + business software company. Keep replies under 160 characters, friendly, professional. If they want a human, say someone will call them shortly." },
                    { role: "user", content: text }
                ],
                max_tokens: 600
        }, { timeoutMs: 8000 });
        const j = await r.json();
        return j.choices && j.choices[0] ? j.choices[0].message.content.trim() : null;
    } catch (e) { return null; }
}

function twiml(msg) {
    return {
        statusCode: 200, headers: { "Content-Type": "text/xml" },
        body: msg ? "<Response><Message>" + msg.replace(/[<>&]/g, "") + "</Message></Response>" : "<Response></Response>"
    };
}

exports.handler = async (event) => {
    const params = new URLSearchParams(event.body || "");
    const from = params.get("From") || "";
    const body = (params.get("Body") || "").trim();
    if (!from || !body) return twiml(null);

    const upper = body.toUpperCase();
    const ownerId = await findOwner(from);

    // ── STOP / opt-out ───────────────────────────────────────────────
    if (["STOP", "UNSUBSCRIBE", "CANCEL", "QUIT", "END"].includes(upper)) {
        if (ownerId) {
            await sb("aemnireach.contacts?user_id=eq." + ownerId + "&phone=eq." + encodeURIComponent(from), "PATCH", { sms_opted_out: true });
            await sb("aemnireach.messages", "POST", { user_id: ownerId, channel: "sms", direction: "inbound", from_address: from, body: body, status: "opted_out" });
        }
        return twiml("You've been unsubscribed from POTENT OS texts. Reply START to rejoin.");
    }
    if (upper === "START") {
        if (ownerId) await sb("aemnireach.contacts?user_id=eq." + ownerId + "&phone=eq." + encodeURIComponent(from), "PATCH", { sms_opted_out: false });
        return twiml("You're back on the list. Thanks!");
    }

    // ── Log inbound, AI auto-reply ───────────────────────────────────
    let contactId = null;
    if (ownerId) {
        const c = await sb("aemnireach.contacts?user_id=eq." + ownerId + "&phone=eq." + encodeURIComponent(from) + "&select=id&limit=1");
        if (Array.isArray(c) && c[0]) contactId = c[0].id;
        await sb("aemnireach.messages", "POST", {
            user_id: ownerId, contact_id: contactId, channel: "sms", direction: "inbound",
            from_address: from, body: body, status: "replied"
        });
    }
    const reply = await aiReply(body);
    return twiml(reply);
};
