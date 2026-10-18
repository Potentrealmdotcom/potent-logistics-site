// In-app notifications (never throws; a failed notice must not break a sale or a review).
module.exports = async function notify(o) {
  try {
    const B = require("./beats");
    if (!o || (!o.user_id && !o.producer_id) || !o.title) return;
    await B.sb("music_notifications", { method: "POST", prefer: "return=minimal", body: { user_id: o.user_id || null, producer_id: o.producer_id || null, kind: String(o.kind || "info").slice(0, 40), title: String(o.title).slice(0, 140), body: o.body ? String(o.body).slice(0, 400) : null, link: o.link ? String(o.link).slice(0, 200) : null } });
  } catch (e) { /* ignore */ }
};
