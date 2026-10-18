// POTENT Coins: card top-up and rewards. 1 coin = $1.00 (balances are kept in cents). Idempotent per Stripe session.
// Reward: every $1,000 of coins bought (lifetime, net of refunds) credits $100 in coins, once per milestone.
// Coins stay closed-loop: no cash-out, no transfers. Refunds and chargebacks take the coins (and any reward they earned) back.
const B = require("./beats");
const rows = function (r) { return r.ok && Array.isArray(r.data) ? r.data : []; };
const STEP = 100000, REWARD = 10000;
const PACKS = [1000, 2500, 5000, 10000, 25000, 50000, 100000];
const MIN = 500, MAX = 100000;
const apply = function (uid, d, ref, note) { return B.rpc("music_coin_apply", { p_user: uid, p_delta: d, p_type: "topup", p_ref: ref, p_note: note, p_actor: "system" }); };
async function balance(uid) { const w = rows(await B.sb("music_coin_wallets?user_id=eq." + uid + "&select=balance_cents"))[0]; return w ? Number(w.balance_cents) : 0; }
async function paidTotal(uid) { return rows(await B.sb("music_coin_topups?user_id=eq." + uid + "&status=eq.paid&select=cents")).reduce(function (a, t) { return a + Number(t.cents); }, 0); }

// Pull back up to `want` coins (never below zero); returns what was taken.
async function claw(uid, want, ref, note) {
  const take = Math.min(want, await balance(uid)); if (take <= 0) return 0;
  const r = await B.rpc("music_coin_apply", { p_user: uid, p_delta: -take, p_type: "adjustment", p_ref: ref, p_note: note, p_actor: "system" });
  return r.ok && r.data && r.data.ok ? take : 0;
}
// Bring awarded rewards in line with lifetime net top-ups: award new milestones, take back ones no longer earned.
async function syncRewards(uid) {
  const total = await paidTotal(uid), earned = Math.floor(total / STEP);
  for (let n = 1; n <= earned; n++) { const r = await apply(uid, REWARD, "reward:" + uid + ":" + n, "Reward: $" + (n * STEP / 100).toLocaleString("en-US") + " in coins bought"); if (!r.ok) return { error: "reward" }; }
  const have = rows(await B.sb("music_coin_ledger?user_id=eq." + uid + "&ref=like." + encodeURIComponent("reward:" + uid + ":") + "*&select=ref"));
  for (const l of have) { const n = Number(String(l.ref).split(":")[2]); if (n > earned) await claw(uid, REWARD, "rewardrev:" + uid + ":" + n, "Reward reversed after a refund"); }
  return { ok: true, earned: earned };
}

async function onCheckout(session) {
  const md = (session && session.metadata) || {};
  if (md.product !== "MUSICCOIN") return { skipped: true };
  if (session.payment_status !== "paid") return { skipped: true, unpaid: true };
  const uid = md.user_id, cents = Number(session.amount_total);
  if (!/^[0-9a-f-]{36}$/i.test(uid || "") || !(cents >= MIN && cents <= MAX)) { await B.audit("system", "coin_topup_bad", session.id, { uid: uid, cents: cents }); return { ok: true, bad: true }; }
  if (!rows(await B.sb("music_users?id=eq." + uid + "&select=id"))[0]) { await B.audit("system", "coin_topup_nouser", session.id, { uid: uid }); return { ok: true, bad: true }; }
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : null;
  const ins = await B.sb("music_coin_topups", { method: "POST", prefer: "resolution=ignore-duplicates,return=representation", body: { session_id: session.id, user_id: uid, cents: cents, payment_intent: pi } });
  if (!ins.ok) return { error: "Could not record the top-up" };
  // The coin credit is idempotent by ref, so a retry after a partial failure finishes the job without doubling.
  const cr = await apply(uid, cents, "topup:" + session.id, "Card top-up");
  if (!cr.ok) return { error: "Could not credit coins" };
  const rw = await syncRewards(uid); if (rw.error) return { error: "Could not credit reward" };
  if (rows(ins).length) { await B.audit("system", "coin_topup", session.id, { user: uid, cents: cents }); try { await require("./notify")({ user_id: uid, kind: "order", title: (cents / 100).toFixed(0) + " POTENT Coins added to your wallet", link: "/music/coins.html" }); } catch (e) {} }
  return { ok: true };
}

async function reverse(pi, status, requireFull) {
  if (!pi) return { skipped: true };
  const t = rows(await B.sb("music_coin_topups?payment_intent=eq." + encodeURIComponent(pi) + "&status=eq.paid&select=*"))[0];
  if (!t) return { skipped: true };
  const up = await B.sb("music_coin_topups?id=eq." + t.id + "&status=eq.paid", { method: "PATCH", prefer: "return=representation", body: { status: status } });
  if (!up.ok) return { error: "Could not record refund" };
  if (!rows(up).length) return { ok: true, duplicate: true };
  const took = await claw(t.user_id, Number(t.cents), "topuprev:" + t.session_id, status === "disputed" ? "Top-up disputed with the card issuer" : "Top-up refunded");
  const rw = await syncRewards(t.user_id);
  await B.audit("system", "coin_topup_" + status, t.session_id, { user: t.user_id, cents: t.cents, clawed: took, short: Number(t.cents) - took });
  return rw.error ? { error: "reward sync" } : { ok: true, clawed: took };
}
async function onRefund(charge) {
  if (!charge || !(Number(charge.amount_refunded) >= Number(charge.amount) && Number(charge.amount) > 0)) return { skipped: true };
  return reverse(charge.payment_intent, "refunded");
}
async function onDispute(d) { return reverse(d && d.payment_intent, "disputed"); }
async function onDisputeClosed(d) {
  if (!d || d.status !== "won" || !d.payment_intent) return { skipped: true };
  const t = rows(await B.sb("music_coin_topups?payment_intent=eq." + encodeURIComponent(d.payment_intent) + "&status=eq.disputed&select=*"))[0]; if (!t) return { skipped: true };
  const up = await B.sb("music_coin_topups?id=eq." + t.id + "&status=eq.disputed", { method: "PATCH", prefer: "return=representation", body: { status: "paid" } });
  if (!rows(up).length) return { ok: true };
  await B.rpc("music_coin_apply", { p_user: t.user_id, p_delta: Number(t.cents), p_type: "topup", p_ref: "topupwon:" + t.session_id, p_note: "Dispute won: top-up restored", p_actor: "system" });
  await syncRewards(t.user_id); return { ok: true };
}
async function progress(uid) { const total = await paidTotal(uid); return { topped_up_cents: total, next_reward_at_cents: (Math.floor(total / STEP) + 1) * STEP, into_cents: total % STEP, step_cents: STEP, reward_cents: REWARD, rewards_earned: Math.floor(total / STEP) }; }
module.exports = { onCheckout, onRefund, onDispute, onDisputeClosed, progress, PACKS, MIN, MAX, STEP, REWARD, syncRewards };
