// TENANT BOOKS — DATA ONLY (Jarvis build step 1, Nov 9, 2026).
//
// A "book" is one business's own offer: the services it sells, the questions each service
// needs answered before it can be booked, the price, and the checks the worker runs behind
// the talker. This file is the shelf the books live on — pure data, no logic, nothing about
// how a call flows. The engine that reads a book is book.js; the spine (tools.js, worker.js,
// prompt.js) contains NO business's facts: it loads whichever book belongs to the company
// whose line was called and follows it.
//
// A tenant's book can also live in its own voice_agent_config.settings.book (set at signup /
// in the OS) — that copy wins over this shelf. Books here are keyed by organization slug.
//
// Question kinds: text (default) | date (YYYY-MM-DD) | time | address | phone | email | number.
// A question the caller says they don't know is ANSWERED ("don't know" is an answer) — it is
// recorded in the packet's unknown list and never blocks the booking; the worker sees it.
module.exports = {
  // POTENT'S OWN BOOK (Jarvis build step 2, Nov 9, 2026) — what Potent sells NOW: software and
  // services (Tony, Nov 5, 2026: "Potent isn't doing anything but selling services — no physical
  // anything"). No freight, no junk, no hauling: those are not Potent services anymore, so they
  // are not in Potent's book. The bookable services are the demo and the consultation — both
  // free — so a caller on Potent's own line books one of these, at the book price ($0).
  "potent-logistics": {
    services: [
      { id: "os_demo", name: "POTENT OS demo", kind: "demo", price_cents: 0, price_label: "Free", duration_min: 30, needs_email: true,
        questions: [
          { key: "company", label: "your company name", required: true },
          { key: "trucks", label: "how many trucks you run", required: false, kind: "number" },
          { key: "demo_date", label: "the day for the demo", required: true, kind: "date" },
          { key: "demo_time", label: "the time that suits you", required: true }
        ],
        checks: ["date_not_past", "phone_sane", "email_sane"] },
      { id: "elevate_consult", name: "Elevate consultation", kind: "consultation", price_cents: 0, price_label: "Free", duration_min: 30, needs_email: true,
        questions: [
          { key: "business_type", label: "what kind of business you run", required: true },
          { key: "demo_date", label: "the day for the consultation", required: true, kind: "date" },
          { key: "demo_time", label: "the time that suits you", required: true }
        ],
        checks: ["date_not_past", "phone_sane", "email_sane"] }
    ]
  },
  // A worked example of a FREIGHT tenant's book, kept as data so any hauling company can be
  // loaded with its own version of it (its own prices, its own limits). It is bound to NO
  // organization: freight facts live in a freight business's book, never in the shared spine.
  _template_freight: {
    services: [
      { id: "freight", name: "Freight delivery", kind: "freight", price_cents: null, needs_email: true,
        questions: [
          { key: "pickup_address", label: "the pickup address (street, city and state)", required: true, kind: "address" },
          { key: "delivery_address", label: "the delivery address (street, city and state)", required: true, kind: "address" },
          { key: "service_date", label: "the day", required: true, kind: "date" },
          { key: "time_window", label: "the time window", required: true },
          { key: "freight_description", label: "what is being moved", required: true },
          { key: "piece_count", label: "how many pieces", required: true, kind: "number" },
          { key: "total_weight_lb", label: "the total weight in pounds", required: true, kind: "number" }
        ],
        checks: ["date_not_past", "address_sane", "phone_sane"] }
    ]
  }
};
