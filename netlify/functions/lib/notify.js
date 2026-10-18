// In-app notifications (never throws; a failed notice must not break a sale or a review).
module.exports = async function notify(o) {
  try {
    const B = require("./beats");
    if (!o || (!o.user_id && !o.producer_id) || !o.title) return;
    await B.sb("music_notifications", { method: "POST", prefer: "return=minimal", body: { user_id: o.user_id || null, producer_id: o.producer_id || null, kind: String(o.kind || "info").slice(0, 40), title: String(o.title).slice(0, 140), body: o.body ? String(o.body).slice(0, 400) : null, link: o.link ? String(o.link).slice(0, 200) : null } });
    // Important notices (orders, payments, payouts) are also emailed when Mailjet is set up. Everything else stays in-app.
    if (o.user_id && /^(order|payment|payout|security)$/.test(String(o.kind || ""))) {
      const u = await B.sb("music_users?id=eq." + o.user_id + "&select=email"), em = u.ok && Array.isArray(u.data) && u.data[0] && u.data[0].email;
      if (em) await require("./mail").send(em, o.title, o.body || o.title, o.link);
    }
  } catch (e) { /* ignore */ }
};
