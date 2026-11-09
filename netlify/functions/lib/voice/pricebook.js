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
//  2. (REMOVED, Jarvis step 2, Nov 9, 2026) one org's published price list used to be hard-wired
//     in here as a second branch, dedicated-run levels included. It is gone: no business's
//     prices live in shared code anymore.

function fromSettings(cfg, d) {
  const book = cfg && cfg.settings && cfg.settings.price_book;
  if (!book || typeof book !== "object") return null;
  const level = d.service_level || "standard";
  const t = book.totals_cents && Number(book.totals_cents[level]) > 0 ? Number(book.totals_cents[level])
    : Number(book.flat_total_cents) > 0 ? Number(book.flat_total_cents) : 0;
  if (!(t > 0)) return null;
  return { total_cents: Math.round(t), label: "Freight (price book)", source: "price_book_settings" };
}

// resolve(cfg, d, isPotent) -> { total_cents, label, source } | null (no book: the caller falls back
// to the legacy verified-route quote, whose honest failure is a callback — never an invented price).
// JARVIS BUILD STEP 2 (Nov 9, 2026): the isPotent argument is kept for call-site compatibility and
// is deliberately UNUSED — no org gets a price out of shared code because of who it is. A
// business's prices live in ITS book (book.js/books.js for book services; settings.price_book
// above for a flat freight total), never in this resolver.
function resolve(cfg, d, isPotent) {
  return fromSettings(cfg, d);
}
module.exports = { resolve, fromSettings };
