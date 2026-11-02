// Ambience selection for POTENT VOICE calls (Tony, Nov 2, 2026): whatever trade the company is in,
// she should sound like she is sitting in it — the Bland benchmark call sounded real partly because
// the room was in it. This module is the ONE place that decides which room a call gets. The bridge
// owns the audio itself (procedurally synthesized beds in server-kit/voice-bridge/bridge.js, keyed
// by the bed names below); this file owns the mapping from a company's world to a bed.
//
// HOW A COMPANY GETS ITS ROOM: the org's industry is set once at onboarding into
// voice_agent_config.settings.industry (free text or a key — "logistics", "roofing", "pizza"...).
// resolve() turns it into a bed key via INDUSTRY_TO_BED. A trade nobody listed falls back to
// FALLBACK_BED (a plain working office) — never silence, never the wrong trade's room if we can
// help it, and extending coverage is adding ONE line to the map below. BEDS is the full library of
// rooms the bridge can synthesize; keep the two in step (the bridge ignores a bed it does not know
// and falls back to its own generic office).
//
// OWNER RULE (Tony, standing): ambience rides on CUSTOMER calls only. The owner's own calls
// (the Əlevate owner line — elevate-phone.js context) carry ambience:"off" themselves, and a
// company can switch its room off entirely with settings.ambience = "off".

const BEDS = {
  dispatch_office: "Dispatch office: low room murmur, keyboard ticks, a phone ringing far off now and then",
  restaurant: "Busy restaurant: denser murmur, plate-and-cutlery clatter",
  auto_shop: "Auto shop: low rumble, sparse metal clunks, an air tool in the distance",
  office_phones: "Phones office: light murmur, telephones ringing in the back",
  construction: "Construction office/site: deep rumble, a distant thud now and then",
  salon: "Salon or barbershop: soft murmur, low steady hum",
  retail: "Retail store: light murmur, a till/scanner beep now and then",
  clinic: "Clinic / quiet professional office: near-quiet room tone, the softest murmur",
  warehouse: "Warehouse: low rumble, a reversing beep far off now and then",
  generic_office: "Generic working office: room tone, faint murmur (the fallback for any trade not listed)"
};
const FALLBACK_BED = "generic_office";

// industry key (lowercase, spaces/punctuation stripped) -> bed key. Data-driven on purpose:
// onboarding writes the company's trade in its own words; aliases here absorb the common spellings.
const INDUSTRY_TO_BED = {
  // logistics / trucking / moving — the dispatch office (Potent's own room)
  logistics: "dispatch_office", trucking: "dispatch_office", freight: "dispatch_office",
  dispatch: "dispatch_office", moving: "dispatch_office", movers: "dispatch_office",
  courier: "dispatch_office", delivery: "dispatch_office", towing: "dispatch_office",
  junkremoval: "dispatch_office", hauling: "dispatch_office", transport: "dispatch_office",
  transportation: "dispatch_office",
  // food
  restaurant: "restaurant", food: "restaurant", pizza: "restaurant", cafe: "restaurant",
  coffee: "restaurant", bakery: "restaurant", catering: "restaurant", bar: "restaurant",
  diner: "restaurant", foodtruck: "restaurant", kitchen: "restaurant",
  // cars
  auto: "auto_shop", autorepair: "auto_shop", mechanic: "auto_shop", automotive: "auto_shop",
  tires: "auto_shop", bodyshop: "auto_shop", dealership: "auto_shop", cardealer: "auto_shop",
  oilchange: "auto_shop", transmission: "auto_shop",
  // offices where the phones ARE the business (call centers, finance, crypto, sales floors)
  callcenter: "office_phones", finance: "office_phones", crypto: "office_phones",
  insurance: "office_phones", realestate: "office_phones", mortgage: "office_phones",
  sales: "office_phones", telemarketing: "office_phones", answeringservice: "office_phones",
  // the trades
  construction: "construction", roofing: "construction", hvac: "construction",
  plumbing: "construction", electrical: "construction", contractor: "construction",
  generalcontractor: "construction", remodeling: "construction", concrete: "construction",
  painting: "construction", landscaping: "construction", lawncare: "construction",
  treeremoval: "construction", handyman: "construction", pestcontrol: "construction",
  cleaning: "construction", janitorial: "construction", poolservice: "construction",
  // personal care
  salon: "salon", barber: "salon", barbershop: "salon", nails: "salon", spa: "salon",
  tattoo: "salon", gym: "salon", fitness: "salon",
  // shops
  retail: "retail", store: "retail", shop: "retail", boutique: "retail",
  furniture: "retail", appliance: "retail", electronics: "retail", grocery: "retail",
  // quiet professional / care
  medical: "clinic", clinic: "clinic", dental: "clinic", dentist: "clinic",
  veterinary: "clinic", vet: "clinic", pharmacy: "clinic", therapy: "clinic",
  lawfirm: "clinic", legal: "clinic", accounting: "clinic", tax: "clinic",
  // big sheds
  warehouse: "warehouse", storage: "warehouse", selfstorage: "warehouse",
  distribution: "warehouse", manufacturing: "warehouse", factory: "warehouse"
};

const keyOf = function (s) { return String(s || "").toLowerCase().replace(/[^a-z]/g, ""); };

// Decide the room for one call. Returns { ambience: "off" } or { ambience_bed: <bed key> }.
// cfg is the org's voice_agent_config (settings already merged); ses is the call session.
function resolve(cfg, ses) {
  const st = (cfg && cfg.settings) || {};
  if (String(st.ambience || "").toLowerCase() === "off") return { ambience: "off" };   // the company switched its room off
  const direct = keyOf(st.ambience_bed);   // an explicit room choice beats the trade mapping
  if (direct && BEDS[direct]) return { ambience_bed: direct };
  const bed = INDUSTRY_TO_BED[keyOf(st.industry)] || FALLBACK_BED;
  return { ambience_bed: bed };
}

module.exports = { BEDS, FALLBACK_BED, INDUSTRY_TO_BED, resolve, keyOf };
