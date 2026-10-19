// Run: node tests/ospricing.test.js — the voice assistant's price list must equal the app's (app.js). If a price changes in the app, this fails until ospricing.js is updated.
const assert = require("assert"), fs = require("fs"), vm = require("vm"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const OS = require("../netlify/functions/lib/voice/ospricing.js"); const src = fs.readFileSync(__dirname + "/../app.js", "utf8");
const grab = (re, what) => { const m = src.match(re); assert(m, "could not find " + what + " in app.js"); return m[1]; };
const val = (code) => vm.runInNewContext("(" + code + ")");
const sameCore = (a, b, keys) => JSON.stringify(a.map(x => keys.map(k => x[k]))) === JSON.stringify(b.map(x => keys.map(k => x[k])));

const PT = val(grab(/var PRICE_TABLE = (\{[\s\S]*?\n\});/, "PRICE_TABLE")); ok(JSON.stringify(PT.freight) === JSON.stringify(OS.ZONE_PRICE), "freight zone prices match the app (Local/Regional/Long distance)");
const zs = val(grab(/var ZONES = (\[[\s\S]*?\n\]);/, "ZONES")); ok(zs.map(z => z.sub).join("|") === "0-50 miles|51-150 miles|150+ miles", "zone boundaries are 0-50 / 51-150 / 150+");
ok(OS.zoneOf(50) === "local" && OS.zoneOf(51) === "regional" && OS.zoneOf(150) === "regional" && OS.zoneOf(151) === "longdist", "zoneOf follows those boundaries");
const sd = grab(/var SPEED_SAMEDAY_ADJ = (-?\d+), SPEED_RUSH_ADJ = \d+/, "SPEED_SAMEDAY_ADJ"), sr = grab(/SPEED_RUSH_ADJ = (-?\d+)/, "SPEED_RUSH_ADJ");
ok(Number(sd) === OS.SPEED_ADJ.same_day && Number(sr) === OS.SPEED_ADJ.rush && OS.SPEED_ADJ.standard === 0, "same-day -$25 and rush +$100 match the app");
const lc = val(grab(/var LOAD_CLASSES = (\[[\s\S]*?\n\]);/, "LOAD_CLASSES")); ok(sameCore(lc, OS.LOAD_CLASSES, ["id", "maxPct", "price"]), "recurring load classes (Small $250 / Partial $225 / Half $350 / Full $500, 25/49/74/100%) match");
const dr = val(grab(/var DEDICATED_ROUTES = (\[[\s\S]*?\n\]);/, "DEDICATED_ROUTES")); ok(sameCore(dr, OS.DEDICATED_ROUTES, ["id", "direction", "maxMiles", "dailyPrice", "weeklyPrice"]), "all 9 dedicated routes match");
const ls = val(grab(/var LOAD_SIZES = (\[[\s\S]*?\n\]);/, "LOAD_SIZES")); ok(sameCore(ls, OS.LOAD_SIZES, ["id", "price", "priceMax"]), "junk removal prices match ($179 / $250 / $350-400 / $500-600 / $750-850)");
ok(Number(grab(/var EXTRA_TRUCKLOAD_FEE = (\d+)/, "EXTRA_TRUCKLOAD_FEE")) === OS.EXTRA_TRUCKLOAD_FEE, "extra truckload fee matches");
ok(Number(grab(/var TRUCK_MAX_LBS = (\d+)/, "TRUCK_MAX_LBS")) === OS.TRUCK_MAX_LBS && Number(grab(/maxPayloadLbs: (\d+)/, "maxPayloadLbs")) === OS.TRUCK_MAX_LBS, "truck limit is 4,500 lb in the app and here");
ok(/roundTripMiles <= 150 \? 1000 : 1000 \+ Math\.round\(\(roundTripMiles - 150\) \* 1\)/.test(src), "pop-up event rule in the app is still $1,000 flat to 150 round-trip miles, +$1/mile after");
ok(/f\.days\.length >= 5 \? 0\.15 : f\.days\.length >= 3 \? 0\.08 : 0/.test(src) && /f\.flexWindow \? 0\.05 : 0/.test(src) && /MAX_STACKED_DISCOUNT = 0\.20/.test(src), "recurring discounts (15% at 5 days, 8% at 3-4, +5% flexible, max 20%) match the app");
ok(OS.RECURRING_DISCOUNT.days5 === 0.15 && OS.RECURRING_DISCOUNT.days3 === 0.08 && OS.RECURRING_DISCOUNT.flex === 0.05 && OS.RECURRING_DISCOUNT.maxStacked === 0.20, "…and the copy here says the same");
ok(OS.EVENT.flat === 1000 && OS.EVENT.flatRoundTripMiles === 150 && OS.EVENT.perMileBeyond === 1, "event constants");
// behavior
ok(OS.freight(20, "standard").total === 400 && OS.freight(120, "rush").total === 850 && OS.freight(300, "same_day").total === 1475 && OS.freight(null, "standard") === null && OS.freight(5, "bogus") === null, "freight totals");
ok(OS.loadClass(1125, 4500).id === "small" && OS.loadClass(1126, 4500).id === "small" && OS.loadClass(1149, 4500).id === "partial" && OS.loadClass(2205, 4500).id === "partial" && OS.loadClass(2250, 4500).id === "half" && OS.loadClass(3330, 4500).id === "half" && OS.loadClass(4500, 4500).id === "full" && OS.loadClass(4501, 4500) === null, "load class boundaries use the app's rounded percent of 4,500 lb");
ok(OS.recurringLoad(3000, 5, true, 4500).perDay === 280 && OS.recurringLoad(3000, 5, true, 4500).discount === 0.20, "5 days + flexible = 20% max: Half $350 -> $280");
ok(OS.recurringLoad(3000, 6, false, 4500) === null && OS.recurringLoad(3000, 0, false, 4500) === null, "days per week must be 1-5");
ok(OS.dedicatedRoute(40, "oneway").id === "oneway_50" && OS.dedicatedRoute(90, "roundtrip").id === "roundtrip_100" && OS.dedicatedRoute(260, "roundtrip").id === "roundtrip_300" && OS.dedicatedRoute(260, "oneway") === null && OS.dedicatedRoute(301, "roundtrip") === null, "route tier selection");
ok(OS.popup(75).total === 1000 && OS.popup(100).total === 1050 && OS.popup(null) === null, "pop-up: 150 round-trip miles flat, then +$1/mile");
ok(OS.junk("full", 1).total === 750 && OS.junk("full", 1).totalMax === 850 && OS.junk("nope") === null, "junk totals");
console.log("ospricing: " + n + " assertions PASS");
