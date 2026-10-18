// Rights & revenue-split logic for POTENT Music projects. Pure functions + signed contributor links.
// Each revenue category (beat_sale, master, publishing, promo, other) has its own schedule; nothing is shared between them.
const crypto = require("crypto");
const CATEGORIES = ["beat_sale", "master", "publishing", "promo", "other"];
const ROLES = ["lead_artist", "featured_artist", "producer", "co_producer", "songwriter", "composer", "engineer", "dj", "promoter", "manager", "other"];
const b64u = function (b) { return Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const key = function () { return String(process.env.AUTH_SECRET || "") + "|rights"; };
function signContributor(cid) { const body = b64u(JSON.stringify({ cid: cid })); return body + "." + b64u(crypto.createHmac("sha256", key()).update(body).digest()); }
function verifyContributor(t) {
  if (!process.env.AUTH_SECRET || typeof t !== "string" || t.indexOf(".") < 0) return null;
  const p = t.split("."), e = b64u(crypto.createHmac("sha256", key()).update(p[0]).digest()), x = Buffer.from(p[1] || ""), y = Buffer.from(e);
  if (x.length !== y.length || !crypto.timingSafeEqual(x, y)) return null;
  try { return JSON.parse(Buffer.from(p[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")).cid || null; } catch (e2) { return null; }
}
// lines: [{contributor_id, pct}]. Returns {ok, error, lines}. Never invents or rounds a missing percentage.
function validateLines(lines, contributorIds) {
  if (!Array.isArray(lines) || !lines.length) return { ok: false, error: "Add at least one person with a share" };
  if (lines.length > 50) return { ok: false, error: "Too many lines (50 max)" };
  const seen = {}, out = []; let sum = 0;
  for (const l of lines) {
    const id = String(l && l.contributor_id || ""), pct = Math.round(Number(l && l.pct) * 10000) / 10000;
    if (contributorIds.indexOf(id) < 0) return { ok: false, error: "A person on this split is not part of the project" };
    if (seen[id]) return { ok: false, error: "The same person is listed twice. Combine their roles into one share." };
    if (!(pct > 0 && pct <= 100)) return { ok: false, error: "Each share must be above 0 and at most 100" };
    seen[id] = 1; sum += pct; out.push({ contributor_id: id, pct: pct });
  }
  sum = Math.round(sum * 10000) / 10000;
  if (sum !== 100) return { ok: false, error: "Shares add up to " + sum + "%. They must add up to exactly 100%." };
  return { ok: true, lines: out };
}
// Largest-remainder split so allocations always add up to the exact amount.
function allocate(cents, lines) {
  const raw = lines.map(function (l, i) { const x = cents * l.pct / 100; return { i: i, base: Math.floor(x + 1e-9), frac: x - Math.floor(x + 1e-9) }; });
  let left = cents - raw.reduce(function (a, r) { return a + r.base; }, 0);
  raw.slice().sort(function (a, b) { return b.frac - a.frac || a.i - b.i; }).forEach(function (r) { if (left > 0) { r.base++; left--; } });
  return lines.map(function (l, i) { return { contributor_id: l.contributor_id, cents: raw[i].base }; });
}
function eligibleFor(base, gross, deductions) { return base === "gross" ? gross : Math.max(0, gross - deductions); }
module.exports = { CATEGORIES, ROLES, signContributor, verifyContributor, validateLines, allocate, eligibleFor };
