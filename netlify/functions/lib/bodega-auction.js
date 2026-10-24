// POTENT Bodega — Live Drops auction state machine (pure logic; the DB/Stripe shell is
// netlify/functions/bodega-auction.js). Mirrors the Smoke Sessions shape: an event with a
// queue of pieces, one live at a time, a countdown the server enforces on poll.
// Anti-snipe (owner rule): a bid inside the last 15 seconds extends the countdown by 15s.

const ANTI_SNIPE_WINDOW_MS = 15 * 1000;
const ANTI_SNIPE_EXTEND_MS = 15 * 1000;
const MIN_DURATION_SECONDS = 15;
const MAX_DURATION_SECONDS = 600;
const DEFAULT_DURATION_SECONDS = 120;

function clampDuration(seconds) {
  const d = Math.round(Number(seconds) || DEFAULT_DURATION_SECONDS);
  return Math.min(MAX_DURATION_SECONDS, Math.max(MIN_DURATION_SECONDS, d));
}

function startEndsAt(nowMs, durationSeconds) {
  return nowMs + clampDuration(durationSeconds) * 1000;
}

// Judge one bid against the live item. state: { startingBidCents, endsAtMs } plus the
// current highest bid (0 when none). Returns { ok, reason, newHighCents, endsAtMs, extended }.
function applyBid(state, amountCents, nowMs) {
  const amount = Math.floor(Number(amountCents) || 0);
  const out = { ok: false, reason: "", newHighCents: state ? Number(state.currentHighCents) || 0 : 0, endsAtMs: state ? Number(state.endsAtMs) || 0 : 0, extended: false };
  if (!state || !state.endsAtMs) { out.reason = "No piece is live"; return out; }
  if (nowMs >= state.endsAtMs) { out.reason = "This piece's countdown has ended"; return out; }
  if (amount <= 0) { out.reason = "Bad bid"; return out; }
  const high = Number(state.currentHighCents) || 0;
  if (high > 0 && amount <= high) { out.reason = "Bid must beat the current high bid"; return out; }
  if (high === 0 && amount < (Number(state.startingBidCents) || 0)) { out.reason = "Bid is below the starting bid"; return out; }
  out.ok = true;
  out.newHighCents = amount;
  // Anti-snipe: inside the final window, the countdown grows by the extension.
  if (state.endsAtMs - nowMs <= ANTI_SNIPE_WINDOW_MS) {
    out.endsAtMs = state.endsAtMs + ANTI_SNIPE_EXTEND_MS;
    out.extended = true;
  }
  return out;
}

// Settle a finished item from its bid rows ([{ bidder_email, amount_cents, created_at }]).
// Highest bid wins; ties go to the earliest bid. No bids -> unsold.
function settleItem(bids) {
  const list = (Array.isArray(bids) ? bids : []).filter(function (b) { return b && Number(b.amount_cents) > 0; });
  if (!list.length) return { outcome: "unsold", winnerEmail: null, winningBidCents: 0 };
  const sorted = list.slice().sort(function (a, b) {
    const byAmount = Number(b.amount_cents) - Number(a.amount_cents);
    if (byAmount !== 0) return byAmount;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  const top = sorted[0];
  return { outcome: "won", winnerEmail: String(top.bidder_email || ""), winningBidCents: Number(top.amount_cents) };
}

// Public-safe bidder label: never a full email in a feed or leaderboard.
function maskEmail(email) {
  const e = String(email || "");
  const at = e.indexOf("@");
  if (at < 1) return "collector";
  const name = e.slice(0, at), domain = e.slice(at + 1);
  return name.slice(0, 2) + "***@" + domain;
}

module.exports = {
  ANTI_SNIPE_WINDOW_MS: ANTI_SNIPE_WINDOW_MS,
  ANTI_SNIPE_EXTEND_MS: ANTI_SNIPE_EXTEND_MS,
  MIN_DURATION_SECONDS: MIN_DURATION_SECONDS,
  MAX_DURATION_SECONDS: MAX_DURATION_SECONDS,
  DEFAULT_DURATION_SECONDS: DEFAULT_DURATION_SECONDS,
  clampDuration: clampDuration,
  startEndsAt: startEndsAt,
  applyBid: applyBid,
  settleItem: settleItem,
  maskEmail: maskEmail
};
