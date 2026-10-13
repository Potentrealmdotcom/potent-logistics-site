// netlify/functions/aemnireach-inbound-email.js
// Mailjet webhook: receives bounce/spam/unsub events, auto-opts contacts out.
// Set this URL in Mailjet → Account → Event notifications (API):
//   https://potentoperations.netlify.app/.netlify/functions/aemnireach-inbound-email

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sb(path, method, body) {
    await fetch(SUPABASE_URL + "/rest/v1/" + path, {
        method: method || "GET",
        headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", "Prefer": "return=representation" },
        body: body ? JSON.stringify(body) : undefined
    });
}

exports.handler = async (event) => {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "POST only" };
    let events;
    try { events = JSON.parse(event.body || "[]"); } catch (e) { return { statusCode: 400, body: "bad json" }; }
    if (!Array.isArray(events)) events = [events];

    for (const ev of events) {
        const email = ev.email;
        const type = ev.event; // sent, open, click, bounce, spam, unsub, blocked
        if (!email) continue;
        if (["bounce", "spam", "unsub", "blocked"].includes(type)) {
            // Opt them out of future emails across all users who have this contact
            await sb("aemnireach.contacts?email=eq." + encodeURIComponent(email), "PATCH", { email_opted_out: true });
        }
    }
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ received: events.length }) };
};
