// POST { toName, toAddr, fromName, fromAddr, letter }  + Bearer token. Saves a certified-mail request for our team to print and mail.
// Done-For-You members are covered; course members spend one letter credit.
const C = require("./lib/ccml");
const clip = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n); };

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return C.J(405, { error: "POST only" });
  const user = await C.userFromEvent(event);
  if (!user) return C.J(401, { error: "Sign in again" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return C.J(400, { error: "Bad request" }); }
  const row = { to_name: clip(b.toName, 200), to_addr: clip(b.toAddr, 500), from_name: clip(b.fromName, 200), from_addr: clip(b.fromAddr, 500), letter: clip(b.letter, 20000) };
  if (!row.to_addr || !row.from_addr || row.letter.length < 20) return C.J(400, { error: "Fill in both addresses and the letter." });

  const prof = await C.profileById(user.id);
  if (!prof || (C.RANK[prof.plan] || 0) < 1) return C.J(402, { error: "Unlock the course first" });

  const day = new Date(Date.now() - 86400000).toISOString();
  const recent = await C.sb("ccml_mail_requests?user_id=eq." + encodeURIComponent(user.id) + "&created_at=gte." + encodeURIComponent(day) + "&select=id");
  if (recent.ok && Array.isArray(recent.data) && recent.data.length >= 25) return C.J(429, { error: "Daily limit reached. Try again tomorrow." });

  const free = prof.plan === "dfy";
  if (!free) {
    // spend one credit, only if it is still there (compare-and-set)
    const have = Number(prof.mail_credits) || 0;
    if (have < 1) return C.J(402, { error: "No letter credits left. Buy a pack first." });
    const spend = await C.sb("ccml_profiles?id=eq." + encodeURIComponent(user.id) + "&mail_credits=eq." + have, { method: "PATCH", prefer: "return=representation", body: { mail_credits: have - 1, updated_at: new Date().toISOString() } });
    if (!spend.ok || !Array.isArray(spend.data) || !spend.data.length) return C.J(409, { error: "Please try again." });
  }
  const ins = await C.sb("ccml_mail_requests", { method: "POST", prefer: "return=representation", body: Object.assign({ user_id: user.id, status: "queued" }, row) });
  if (!ins.ok || !Array.isArray(ins.data) || !ins.data[0]) {
    if (!free) await C.addCredits(user.id, 1);                       // give the credit back
    return C.J(500, { error: "Could not save the request. You were not charged a credit." });
  }
  const after = await C.profileById(user.id);
  return C.J(200, { ok: true, id: ins.data[0].id, mail_credits: after ? after.mail_credits : 0 });
};
