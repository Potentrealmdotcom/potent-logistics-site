// POTENT's existing price list, copied EXACTLY from the app (app.js). tests/ospricing.test.js reads app.js and fails if any number here drifts from it.
// All money is whole dollars here; callers convert to cents. Nothing in this file is a guess: if the app changes a price, the test fails until this file matches.
const TRUCK_MAX_LBS = 4500;
const ZONE_PRICE = { local: 400, regional: 750, longdist: 1500 };            // PRICE_TABLE.freight; zones: Local 0-50 mi, Regional 51-150, Long Distance 150+
const SPEED_ADJ = { standard: 0, same_day: -25, rush: 100 };                  // SPEEDS: standard +0, SPEED_SAMEDAY_ADJ -25, SPEED_RUSH_ADJ +100
const LOAD_CLASSES = [ // recurring, by share of the truck's payload (checkRealCapacity: round(weight / max payload * 100) <= maxPct)
  { id: "small", label: "Small Load", maxPct: 25, price: 250 }, { id: "partial", label: "Partial Load", maxPct: 49, price: 225 },
  { id: "half", label: "Half Truck", maxPct: 74, price: 350 }, { id: "full", label: "Full Truck", maxPct: 100, price: 500 }];
const DEDICATED_ROUTES = [ // 5 days a week, no weekends; weekly = daily x 5; no extra discount stacked on these
  { id: "oneway_50", label: "One-Way, up to 50mi", direction: "oneway", maxMiles: 50, dailyPrice: 425, weeklyPrice: 2125 },
  { id: "roundtrip_50", label: "Round Trip, up to 50mi", direction: "roundtrip", maxMiles: 50, dailyPrice: 425, weeklyPrice: 2125 },
  { id: "oneway_100", label: "One-Way, up to 100mi", direction: "oneway", maxMiles: 100, dailyPrice: 468, weeklyPrice: 2340 },
  { id: "roundtrip_100", label: "Round Trip, up to 100mi", direction: "roundtrip", maxMiles: 100, dailyPrice: 510, weeklyPrice: 2550 },
  { id: "oneway_150", label: "One-Way, up to 150mi", direction: "oneway", maxMiles: 150, dailyPrice: 468, weeklyPrice: 2340 },
  { id: "roundtrip_150", label: "Round Trip, up to 150mi", direction: "roundtrip", maxMiles: 150, dailyPrice: 552, weeklyPrice: 2760 },
  { id: "oneway_250", label: "One-Way, up to 250mi", direction: "oneway", maxMiles: 250, dailyPrice: 510, weeklyPrice: 2550 },
  { id: "roundtrip_250", label: "Round Trip, up to 250mi", direction: "roundtrip", maxMiles: 250, dailyPrice: 638, weeklyPrice: 3190 },
  { id: "roundtrip_300", label: "Round Trip, 250-300mi", direction: "roundtrip", maxMiles: 300, dailyPrice: 680, weeklyPrice: 3400 }];
const RECURRING_DISCOUNT = { days5: 0.15, days3: 0.08, flex: 0.05, maxStacked: 0.20 };   // load-class recurring only
const LOAD_SIZES = [ // junk removal: price is the single booking price; priceMax is the honest top of the range
  { id: "minimum", label: "Single Item / Minimum", price: 179, priceMax: 179 }, { id: "quarter", label: "Quarter Load", price: 250, priceMax: 250 },
  { id: "half", label: "Half Load", price: 350, priceMax: 400 }, { id: "threequarter", label: "Three-Quarter Load", price: 500, priceMax: 600 },
  { id: "full", label: "Full Load", price: 750, priceMax: 850 }];
const EXTRA_TRUCKLOAD_FEE = 600;                                              // each additional full truckload on big junk jobs
const EVENT = { flat: 1000, flatRoundTripMiles: 150, perMileBeyond: 1 };      // pop-up event: flat round trip up to 150 mi, +$1 per round-trip mile beyond

const zoneOf = function (miles) { return miles <= 50 ? "local" : miles <= 150 ? "regional" : "longdist"; };
const zoneLabel = { local: "Local (0-50 miles)", regional: "Regional (51-150 miles)", longdist: "Long distance (150+ miles)" };
function freight(miles, level) { // one-time freight / delivery
  if (miles == null || !isFinite(miles)) return null;
  if (!(level in SPEED_ADJ)) return null;
  const z = zoneOf(miles); return { zone: z, zoneLabel: zoneLabel[z], base: ZONE_PRICE[z], speedAdj: SPEED_ADJ[level], total: ZONE_PRICE[z] + SPEED_ADJ[level] };
}
function loadClass(weightLb, maxPayload) {
  const cap = Number(maxPayload) || TRUCK_MAX_LBS, w = Number(weightLb);
  if (!(w > 0) || w > cap) return null;
  const pct = Math.round(w / cap * 100); return LOAD_CLASSES.find(function (c) { return pct <= c.maxPct; }) || LOAD_CLASSES[3];
}
function recurringLoad(weightLb, daysPerWeek, flex, maxPayload) {
  const c = loadClass(weightLb, maxPayload); if (!c) return null;
  const days = Math.floor(Number(daysPerWeek)); if (!(days >= 1 && days <= 5)) return null;
  const disc = Math.min((days >= 5 ? RECURRING_DISCOUNT.days5 : days >= 3 ? RECURRING_DISCOUNT.days3 : 0) + (flex ? RECURRING_DISCOUNT.flex : 0), RECURRING_DISCOUNT.maxStacked);
  const perDay = Math.round(c.price * (1 - disc)); return { cls: c, discount: disc, perDay: perDay, days: days, weekly: perDay * days };
}
function dedicatedRoute(miles, direction) {
  if (miles == null || !isFinite(miles) || ["oneway", "roundtrip"].indexOf(direction) < 0) return null;
  return DEDICATED_ROUTES.filter(function (r) { return r.direction === direction && miles <= r.maxMiles; }).sort(function (a, b) { return a.maxMiles - b.maxMiles; })[0] || null;
}
function popup(oneWayMiles) {
  if (oneWayMiles == null || !isFinite(oneWayMiles)) return null;
  const rt = oneWayMiles * 2; return { roundTripMiles: rt, total: rt <= EVENT.flatRoundTripMiles ? EVENT.flat : EVENT.flat + Math.round((rt - EVENT.flatRoundTripMiles) * EVENT.perMileBeyond) };
}
function junk(loadId, truckloads) {
  const l = LOAD_SIZES.find(function (x) { return x.id === loadId; }); if (!l) return null;
  const n = Math.max(1, Math.floor(Number(truckloads) || 1));
  return { load: l, truckloads: n, total: l.price + (n - 1) * EXTRA_TRUCKLOAD_FEE, totalMax: l.priceMax + (n - 1) * EXTRA_TRUCKLOAD_FEE };
}
module.exports = { TRUCK_MAX_LBS, ZONE_PRICE, SPEED_ADJ, LOAD_CLASSES, DEDICATED_ROUTES, RECURRING_DISCOUNT, LOAD_SIZES, EXTRA_TRUCKLOAD_FEE, EVENT, zoneOf, freight, loadClass, recurringLoad, dedicatedRoute, popup, junk };
