// Transactional email through the Mailjet account POTENT already has (same keys as send-email.js).
// Free Mailjet plan covers 200 emails/day, so only important notices are emailed. Never throws.
// The sender must be a verified sender in Mailjet. Default sender: potentrealm@proton.me (override with MUSIC_FROM_EMAIL).
const esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
async function send(to, subject, text, link, fromOverride) {
  try {
    const k = process.env.MAILJET_API_KEY, sec = process.env.MAILJET_SECRET_KEY;
    if (!k || !sec || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(to || ""))) return { skipped: true };
    const from = fromOverride || process.env.MUSIC_FROM_EMAIL || "potentrealm@proton.me", site = process.env.URL || "https://potentoperations.netlify.app";
    const url = link ? (/^https?:/.test(link) ? link : site + link) : null;
    const r = await fetch("https://api.mailjet.com/v3.1/send", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Basic " + Buffer.from(k + ":" + sec).toString("base64") },
      body: JSON.stringify({ Messages: [{ From: { Email: from, Name: "POTENT" }, To: [{ Email: to }], Subject: String(subject).slice(0, 150), TextPart: String(text || subject) + (url ? "\n\n" + url : ""), HTMLPart: "<p>" + esc(text || subject) + "</p>" + (url ? '<p><a href="' + esc(url) + '">Open in POTENT</a></p>' : "") }] }) });
    return { ok: r.ok };
  } catch (e) { return { error: true }; }
}
module.exports = { send };
