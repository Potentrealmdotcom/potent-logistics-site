// THE PRICE BOOK (fix round 2, Nov 7, 2026 — Tony's conversation-first ruling).
// On a live call she just TALKS: the price comes from the business's OWN book, instantly, with no
// geocoding, no eligibility chain and no route calculation while the caller waits. Verification of
// addresses, route and fit happens AFTER the call (see voice-tools.js postCallVerify).
//
// Where a company's book lives, in order:
//  1. cfg.settings.price_book — the tenant's own loaded book, in voice_agent_config.settings:
//       { flat_total_cents: 40000 }                                  — one flat total for a standard job
//       { totals_cents: { standard: 40000, same_day: 37500, rush: 50000 } }   — per service level
//     Any tenant can carry one; nothing Potent-specific is ever read from another company's book.
//  2. POTENT's own book — Potent's published price list (ospricing.js, copied from the app and kept
//     identical to it by tests/ospricing.test.js): the LOCAL flat rate for one-time freight
//     (Atlanta->Marietta test calls are local; the $400 test total is simply this book entry).
//     This branch is Potent-org-only, exactly like the other Potent-only material in tools.js.
// Savannah runs and recurring service are NOT book-priced here: they keep their existing paths.
const OS = require("./ospricing");

function fromSettings(cfg, d) {
  const book = cfg && cfg.settings && cfg.settings.price_book;
  if (!book || typeof book !== "object") return null;
  const level = d.service_level || "standard";
  const t = book.totals_cents && Number(book.totals_cents[level]) > 0 ? Number(book.totals_cents[level])
    : Number(book.flat_total_cents) > 0 ? Number(book.flat_total_cents) : 0;
  if (!(t > 0)) return null;
  return { total_cents: Math.round(t), label: "Freight (price book)", source: "price_book_settings" };
}

function fromPotentBook(d) {
  const level = d.service_level || "standard";
  if (/^savannah/.test(level) || level === "recurring") return null;   // those keep their own pricing paths
  if (!(level in OS.SPEED_ADJ)) return null;
  const total = OS.ZONE_PRICE.local + OS.SPEED_ADJ[level];   // dollars, from Potent's own published list
  return { total_cents: Math.round(total * 100), label: "Freight, Local (0-50 miles) (price book)", source: "potent_price_book" };
}

// resolve(cfg, d, isPotent) -> { total_cents, label, source } | null (no book: the caller falls back
// to the legacy verified-route quote, whose honest failure is a callback — never an invented price).
function resolve(cfg, d, isPotent) {
  return fromSettings(cfg, d) || (isPotent ? fromPotentBook(d) : null);
}
module.exports = { resolve, fromSettings, fromPotentBook };
