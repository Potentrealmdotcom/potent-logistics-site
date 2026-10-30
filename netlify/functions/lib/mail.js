// Transactional email through POTENT's Resend account (switched from Mailjet Oct 20, 2026 —
// Mailjet account sending was suspended; Resend sends from the verified potentworld.online domain).
// Free Resend plan covers 100 emails/day, so only important notices are emailed. Never throws.
// The sender must be on the verified potentworld.online domain. Default sender: info@potentworld.online (override with MAIL_FROM_EMAIL).
const esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
async function send(to, subject, text, link, fromOverride, htmlOverride) {
  try {
    const k = process.env.RESEND_API_KEY;
    if (!k || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(to || ""))) return { skipped: true };
    const fallback = process.env.MAIL_FROM_EMAIL || "info@potentworld.online";
    const from = (fromOverride && /@potentworld\.online$/i.test(String(fromOverride))) ? String(fromOverride) : fallback;
    const site = process.env.URL || "https://potentoperations.netlify.app";
    const url = link ? (/^https?:/.test(link) ? link : site + link) : null;
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + k },
      body: JSON.stringify({ from: "POTENT <" + from + ">", to: [String(to)], subject: String(subject).slice(0, 150), text: String(text || subject) + (url ? "\n\n" + url : ""), html: (typeof htmlOverride === "string" && htmlOverride) ? htmlOverride : "<p>" + esc(text || subject) + "</p>" + (url ? '<p><a href="' + esc(url) + '">Open in POTENT</a></p>' : "") }) });
    return { ok: r.ok };
  } catch (e) { return { error: true }; }
}
module.exports = { send };
