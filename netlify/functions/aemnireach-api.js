// netlify/functions/aemnireach-api.js
// POTENT OS: Aemnireach — SMS + Email marketing add-on API
// Actions: stats, contacts (list/add/delete), broadcast (send SMS/email campaign)
// Auth: uses the same staff auth as other functions.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAILJET_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET = process.env.MAILJET_SECRET_KEY;
const FROM_EMAIL = process.env.MAILJET_FROM_EMAIL;

async function sb(path, method, body) {
    const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
        method: method || "GET",
        headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": "Bearer " + SUPABASE_KEY,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const txt = await r.text();
    try { return JSON.parse(txt); } catch (e) { return txt; }
}

function ok(data) {
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(data) };
}
function err(msg, code) {
    return { statusCode: code || 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: msg }) };
}

// SMS disabled — email-only mode (no Twilio configured)
// ── Send one email via Mailjet ───────────────────────────────────────
async function sendEmail(to, subject, html) {
    const r = await fetch("https://api.mailjet.com/v3.1/send", {
        method: "POST",
        headers: {
            "Authorization": "Basic " + Buffer.from(MAILJET_KEY + ":" + MAILJET_SECRET).toString("base64"),
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            Messages: [{
                From: { Email: FROM_EMAIL, Name: "POTENT OS" },
                To: [{ Email: to }],
                Subject: subject,
                HTMLPart: html,
                TextPart: html.replace(/<[^>]*>/g, "")
            }]
        })
    });
    const j = await r.json();
    if (!r.ok) throw new Error("Mailjet send failed");
    return j.Messages[0].To[0].MessageID;
}

// ── Check subscription ───────────────────────────────────────────────
async function getSub(userId) {
    const rows = await sb("aemnireach.subscriptions?user_id=eq." + userId + "&select=*");
    return Array.isArray(rows) && rows.length ? rows[0] : null;
}

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") return ok({});
    if (event.httpMethod !== "POST") return err("POST only", 405);

    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { return err("Bad JSON"); }
    const { action, user_id, ...p } = body;
    if (!user_id) return err("user_id required", 401);

    try {
        // ── STATS ────────────────────────────────────────────────────
        if (action === "stats") {
            const msgs = await sb("aemnireach.messages?user_id=eq." + user_id + "&select=channel,direction,status&limit=10000");
            const s = { emailSent: 0, emailDelivered: 0, emailBounced: 0, optOuts: 0 };
            (Array.isArray(msgs) ? msgs : []).forEach(function (m) {
                if (m.channel === "email" && m.direction === "outbound") {
                    s.emailSent++;
                    if (m.status === "delivered") s.emailDelivered++;
                    if (m.status === "bounced") s.emailBounced++;
                }
                if (m.status === "opted_out") s.optOuts++;
            });
            const contacts = await sb("aemnireach.contacts?user_id=eq." + user_id + "&select=id&limit=1");
            const sub = await getSub(user_id);
            s.totalContacts = Array.isArray(contacts) ? contacts.length : 0;
            s.smsCredits = sub ? sub.sms_credits : 0;
            s.emailCredits = sub ? sub.email_credits : 0;
            s.subscribed = !!(sub && sub.status === "active");
            s.tier = sub ? sub.tier : null;
            return ok(s);
        }

        // ── CONTACTS ─────────────────────────────────────────────────
        if (action === "contacts") {
            const rows = await sb("aemnireach.contacts?user_id=eq." + user_id + "&select=*&order=created_at.desc&limit=5000");
            return ok({ contacts: Array.isArray(rows) ? rows : [] });
        }
        if (action === "add_contact") {
            const row = await sb("aemnireach.contacts", "POST", {
                user_id: user_id, first_name: p.first_name || "", last_name: p.last_name || "",
                phone: p.phone || null, email: p.email || null, company: p.company || "",
                tags: p.tags || []
            });
            return ok({ contact: row });
        }
        if (action === "delete_contact") {
            await sb("aemnireach.contacts?id=eq." + p.id + "&user_id=eq." + user_id, "DELETE");
            return ok({ deleted: true });
        }

        // ── BROADCAST ────────────────────────────────────────────────
        if (action === "broadcast") {
            const sub = await getSub(user_id);
            if (!sub || sub.status !== "active") return err("Aemnireach subscription required", 403);
            const channel = "email";
            const creditField = "email_credits";
            if ((sub[creditField] || 0) <= 0) return err("Out of " + channel + " credits", 402);

            // Get recipients (not opted out)
            const optField = "email_opted_out";
            const addrField = "email";
            let q = "aemnireach.contacts?user_id=eq." + user_id + "&" + optField + "=eq.false&" + addrField + "=not.is.null&select=id," + addrField + ",first_name&limit=10000";
            if (p.tag) q += "&tags=cs.{\"" + p.tag + "\"}";
            const recipients = await sb(q);
            const list = Array.isArray(recipients) ? recipients : [];
            if (!list.length) return err("No recipients found");

            // Create campaign record
            const camp = await sb("aemnireach.campaigns", "POST", {
                user_id: user_id, name: p.name || (channel.toUpperCase() + " " + new Date().toISOString().slice(0, 10)),
                channel: channel, subject: p.subject || "", body: p.body, audience_tag: p.tag || null,
                status: "sending", total_recipients: list.length
            });
            const campId = Array.isArray(camp) && camp[0] ? camp[0].id : null;

            let sent = 0, failed = 0;
            const maxSend = Math.min(list.length, sub[creditField]);
            for (let i = 0; i < maxSend; i++) {
                const r = list[i];
                const to = r[addrField];
                try {
                    let pid;
                    {
                        const html = "<p>" + (p.body || "").replace("{first}", r.first_name || "there").replace(/\n/g, "<br>") + "</p>";
                        pid = await sendEmail(to, p.subject || "Message from POTENT OS", html);
                    }
                    await sb("aemnireach.messages", "POST", {
                        user_id: user_id, contact_id: r.id, channel: channel, direction: "outbound",
                        to_address: to, subject: p.subject || "", body: p.body, status: "sent", provider_id: String(pid)
                    });
                    sent++;
                } catch (e) {
                    await sb("aemnireach.messages", "POST", {
                        user_id: user_id, contact_id: r.id, channel: channel, direction: "outbound",
                        to_address: to, subject: p.subject || "", body: p.body, status: "failed"
                    });
                    failed++;
                }
            }

            // Deduct credits, update campaign
            await sb("aemnireach.subscriptions?user_id=eq." + user_id, "PATCH", { [creditField]: sub[creditField] - sent });
            if (campId) await sb("aemnireach.campaigns?id=eq." + campId, "PATCH", { status: "sent", sent_count: sent, failed_count: failed });

            return ok({ sent: sent, failed: failed, total: list.length, campaign_id: campId });
        }

        // ── SUBSCRIBE (after Stripe payment) ─────────────────────────
        if (action === "activate") {
            const tier = p.tier === "pro" ? "pro" : "base";
            const credits = tier === "pro" ? { sms_credits: 5000, email_credits: 25000 } : { sms_credits: 1000, email_credits: 5000 };
            const existing = await getSub(user_id);
            if (existing) {
                await sb("aemnireach.subscriptions?user_id=eq." + user_id, "PATCH",
                    Object.assign({ tier: tier, status: "active", stripe_subscription_id: p.stripe_id || null }, credits));
            } else {
                await sb("aemnireach.subscriptions", "POST",
                    Object.assign({ user_id: user_id, tier: tier, status: "active", stripe_subscription_id: p.stripe_id || null }, credits));
            }
            return ok({ activated: true, tier: tier });
        }

        return err("Unknown action: " + action);
    } catch (e) {
        return err(e.message, 500);
    }
};
