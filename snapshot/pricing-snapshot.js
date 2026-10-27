// pricing-snapshot.js — POTENT "Pricing Snapshot" engine.
// Prices come ONLY from Tony's junk-removal pricing book (October 2026):
//   ~/workspace/your_files/pricing/potent-junk-removal-pricing-book.html
// Load tiers also match app.js LOAD_SIZES ($179 / $250 / $350–400 / $500–600 / $750–850).
// Weights/volumes are TYPICAL PUBLISHED ESTIMATES per item type (labelled as estimates
// in the UI) — they drive the tier suggestion only; the price is the book price.
// Operator tool: this module builds copy-ready quote text. It sends NOTHING anywhere.
(function (root, factory) {
    var api = factory();
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    root.PricingSnapshot = api;
})(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    var TRUCK_YD = 16; // usable volume of the 16 ft box truck, cubic yards (same figure estimate-load.js uses)

    // ---- Load tiers — pricing book "Pricing by Load Size" (== app.js LOAD_SIZES) ----
    var TIERS = [
        { id: "minimum",      label: "Single Item",       fill: "1 item",         price: 179, priceMax: 179, capLbs: 300 },
        { id: "quarter",      label: "Quarter Load",      fill: "~25% of truck",  price: 250, priceMax: 250, capLbs: 1075 },
        { id: "half",         label: "Half Load",         fill: "~50% of truck",  price: 350, priceMax: 400, capLbs: 2150 },
        { id: "threequarter", label: "Three-Quarter Load", fill: "~75% of truck", price: 500, priceMax: 600, capLbs: 3225 },
        { id: "full",         label: "Full Load",         fill: "100% of truck",  price: 750, priceMax: 850, capLbs: 4300 }
    ];

    // ---- Cleanout packages — pricing book (flat rate, separate from load pricing) ----
    var CLEANOUTS = [
        { id: "studio", label: "Studio / 1BR Cleanout", price: 499 },
        { id: "br3",    label: "3BR Cleanout",          price: 1299 }
    ];

    var EXTRA_WORKER_RATE = 40;    // pricing book: Extra Worker $40/hour flat (== app.js EXTRA_WORKER_RATE_PER_HOUR)
    var EXTRA_TRUCKLOAD_FEE = 600; // app.js EXTRA_TRUCKLOAD_FEE — each additional full truckload beyond the first

    // ---- Disposal add-on table — extracted VERBATIM from the pricing book ----
    var ADDONS = [
        { id: "mattress",     book: "Mattress",                            fee: 30 },
        { id: "boxspring",    book: "Box Spring",                          fee: 30 },
        { id: "tire_small",   book: "Tire — 16\" or smaller (off rim)",    fee: 6 },
        { id: "tire_large",   book: "Tire — larger than 16\" (off rim)",   fee: 30 },
        { id: "tire_rim",     book: "Tire — on rim (any size)",            fee: 48 },
        { id: "fridge",       book: "Refrigerator / Freezer",              fee: 45 },
        { id: "ac",           book: "AC Unit",                             fee: 45 },
        { id: "tv",           book: "TV / Monitor",                        fee: 45 },
        { id: "paint",        book: "Paint Can (per gallon)",              fee: 15 },
        { id: "propane",      book: "Propane Tank",                        fee: 45 },
        { id: "hottub_piano", book: "Hot Tub / Piano (special handling)",  fee: 450 }
    ];
    var ADDON_FEE = {}; ADDONS.forEach(function (a) { ADDON_FEE[a.id] = a.fee; });

    // ---- Item catalog: every book add-on + common furniture/bags/appliances ----
    // lbs = typical weight (published ranges in lbsLo–lbsHi); yd = typical packed volume.
    // fee = book disposal add-on (0 = included in the load price, no separate fee).
    var ITEMS = [
        // Special disposal (book fees auto-apply)
        { id: "mattress",     name: "Mattress",                          one: "mattress",        many: "mattresses",     fee: ADDON_FEE.mattress,     lbs: 55,  lbsLo: 40,  lbsHi: 75,  yd: 1.20, group: "addons" },
        { id: "boxspring",    name: "Box Spring",                        one: "box spring",      many: "box springs",    fee: ADDON_FEE.boxspring,    lbs: 35,  lbsLo: 25,  lbsHi: 50,  yd: 0.90, group: "addons" },
        { id: "tire_small",   name: "Tire — 16\" or smaller (off rim)",  one: "tire",            many: "tires",          fee: ADDON_FEE.tire_small,   lbs: 25,  lbsLo: 20,  lbsHi: 30,  yd: 0.10, group: "addons" },
        { id: "tire_large",   name: "Tire — larger than 16\" (off rim)", one: "tire",            many: "tires",          fee: ADDON_FEE.tire_large,   lbs: 35,  lbsLo: 30,  lbsHi: 45,  yd: 0.15, group: "addons" },
        { id: "tire_rim",     name: "Tire — on rim (any size)",          one: "tire on rim",     many: "tires on rims",  fee: ADDON_FEE.tire_rim,     lbs: 55,  lbsLo: 45,  lbsHi: 70,  yd: 0.20, group: "addons" },
        { id: "fridge",       name: "Refrigerator / Freezer",            one: "refrigerator",    many: "refrigerators",  fee: ADDON_FEE.fridge,       lbs: 220, lbsLo: 175, lbsHi: 300, yd: 1.60, group: "addons" },
        { id: "ac",           name: "AC Unit",                           one: "AC unit",         many: "AC units",       fee: ADDON_FEE.ac,           lbs: 120, lbsLo: 60,  lbsHi: 220, yd: 0.70, group: "addons" },
        { id: "tv",           name: "TV / Monitor",                      one: "TV",              many: "TVs",            fee: ADDON_FEE.tv,           lbs: 30,  lbsLo: 15,  lbsHi: 60,  yd: 0.30, group: "addons" },
        { id: "paint",        name: "Paint Can (per gallon)",            one: "paint can",       many: "paint cans",     fee: ADDON_FEE.paint,        lbs: 10,  lbsLo: 8,   lbsHi: 12,  yd: 0.05, group: "addons" },
        { id: "propane",      name: "Propane Tank",                      one: "propane tank",    many: "propane tanks",  fee: ADDON_FEE.propane,      lbs: 30,  lbsLo: 25,  lbsHi: 40,  yd: 0.15, group: "addons" },
        { id: "hottub_piano", name: "Hot Tub / Piano (special handling)", one: "hot tub / piano", many: "hot tubs / pianos", fee: ADDON_FEE.hottub_piano, lbs: 600, lbsLo: 400, lbsHi: 900, yd: 3.50, group: "addons" },
        // Furniture (no separate fee — counted in the load)
        { id: "couch",        name: "Couch / Sofa (3-seat)",             one: "couch",           many: "couches",        fee: 0, lbs: 150, lbsLo: 100, lbsHi: 200, yd: 2.70, group: "furniture" },
        { id: "loveseat",     name: "Loveseat",                          one: "loveseat",        many: "loveseats",      fee: 0, lbs: 110, lbsLo: 80,  lbsHi: 140, yd: 1.90, group: "furniture" },
        { id: "recliner",     name: "Recliner / Armchair",               one: "recliner",        many: "recliners",      fee: 0, lbs: 90,  lbsLo: 65,  lbsHi: 120, yd: 1.20, group: "furniture" },
        { id: "dresser",      name: "Dresser",                           one: "dresser",         many: "dressers",       fee: 0, lbs: 120, lbsLo: 75,  lbsHi: 175, yd: 1.10, group: "furniture" },
        { id: "wardrobe",     name: "Wardrobe / Armoire",                one: "wardrobe",        many: "wardrobes",      fee: 0, lbs: 180, lbsLo: 120, lbsHi: 250, yd: 1.60, group: "furniture" },
        { id: "table",        name: "Dining Table",                      one: "table",           many: "tables",         fee: 0, lbs: 80,  lbsLo: 50,  lbsHi: 120, yd: 1.00, group: "furniture" },
        { id: "chair",        name: "Chair (dining / office)",           one: "chair",           many: "chairs",         fee: 0, lbs: 25,  lbsLo: 15,  lbsHi: 40,  yd: 0.40, group: "furniture" },
        { id: "desk",         name: "Desk",                              one: "desk",            many: "desks",          fee: 0, lbs: 90,  lbsLo: 60,  lbsHi: 140, yd: 1.00, group: "furniture" },
        { id: "bedframe",     name: "Bed Frame",                         one: "bed frame",       many: "bed frames",     fee: 0, lbs: 60,  lbsLo: 40,  lbsHi: 90,  yd: 0.60, group: "furniture" },
        { id: "nightstand",   name: "Nightstand / End Table",            one: "nightstand",      many: "nightstands",    fee: 0, lbs: 30,  lbsLo: 20,  lbsHi: 45,  yd: 0.30, group: "furniture" },
        { id: "bookshelf",    name: "Bookshelf",                         one: "bookshelf",       many: "bookshelves",    fee: 0, lbs: 60,  lbsLo: 40,  lbsHi: 90,  yd: 0.80, group: "furniture" },
        { id: "entcenter",    name: "TV Stand / Entertainment Center",   one: "entertainment center", many: "entertainment centers", fee: 0, lbs: 90, lbsLo: 60, lbsHi: 130, yd: 1.00, group: "furniture" },
        // Appliances & bulky (no separate fee unless in the add-on table above)
        { id: "washer",       name: "Washer",                            one: "washer",          many: "washers",        fee: 0, lbs: 180, lbsLo: 150, lbsHi: 220, yd: 1.20, group: "bulky" },
        { id: "dryer",        name: "Dryer",                             one: "dryer",           many: "dryers",         fee: 0, lbs: 130, lbsLo: 100, lbsHi: 160, yd: 1.20, group: "bulky" },
        { id: "stove",        name: "Stove / Oven",                      one: "stove",           many: "stoves",         fee: 0, lbs: 160, lbsLo: 130, lbsHi: 200, yd: 1.20, group: "bulky" },
        { id: "dishwasher",   name: "Dishwasher",                        one: "dishwasher",      many: "dishwashers",    fee: 0, lbs: 100, lbsLo: 80,  lbsHi: 130, yd: 0.90, group: "bulky" },
        { id: "exercise",     name: "Exercise Equipment (treadmill / bike)", one: "exercise machine", many: "exercise machines", fee: 0, lbs: 120, lbsLo: 80, lbsHi: 200, yd: 1.20, group: "bulky" },
        { id: "grill",        name: "Grill",                             one: "grill",           many: "grills",         fee: 0, lbs: 90,  lbsLo: 60,  lbsHi: 130, yd: 0.80, group: "bulky" },
        { id: "patio",        name: "Patio Furniture Set",               one: "patio set",       many: "patio sets",     fee: 0, lbs: 100, lbsLo: 60,  lbsHi: 150, yd: 1.50, group: "bulky" },
        // Bags, bins & misc
        { id: "bag",          name: "Trash Bag (contractor size)",       one: "trash bag",       many: "trash bags",     fee: 0, lbs: 25,  lbsLo: 15,  lbsHi: 40,  yd: 0.15, group: "misc" },
        { id: "bin",          name: "Storage Bin / Tote",                one: "storage bin",     many: "storage bins",   fee: 0, lbs: 30,  lbsLo: 15,  lbsHi: 50,  yd: 0.30, group: "misc" },
        { id: "box",          name: "Box (full, moving size)",           one: "box",             many: "boxes",          fee: 0, lbs: 30,  lbsLo: 20,  lbsHi: 45,  yd: 0.15, group: "misc" },
        { id: "highchair",    name: "High Chair",                        one: "high chair",      many: "high chairs",    fee: 0, lbs: 12,  lbsLo: 9,   lbsHi: 16,  yd: 0.40, group: "misc" },
        { id: "babygear",     name: "Baby Gear (walker / playpen / stroller)", one: "baby items", many: "baby items", bare: true, fee: 0, lbs: 15, lbsLo: 10, lbsHi: 25, yd: 0.35, group: "misc" },
        { id: "yarddebris",   name: "Yard Debris (per ~1 yd³ pile)",     one: "yard debris pile", many: "yard debris piles", fee: 0, lbs: 250, lbsLo: 150, lbsHi: 400, yd: 1.00, group: "misc" },
        { id: "concrete",     name: "Concrete / Dirt (per ~0.5 yd³)",    one: "concrete / dirt pile", many: "concrete / dirt piles", fee: 0, lbs: 500, lbsLo: 400, lbsHi: 700, yd: 0.50, group: "misc" }
    ];
    var ITEM = {}; ITEMS.forEach(function (i) { ITEM[i.id] = i; });

    function tierById(id) { for (var i = 0; i < TIERS.length; i++) if (TIERS[i].id === id) return TIERS[i]; return null; }
    function cleanoutById(id) { for (var i = 0; i < CLEANOUTS.length; i++) if (CLEANOUTS[i].id === id) return CLEANOUTS[i]; return null; }
    function money(n) { return "$" + Number(n).toLocaleString("en-US"); }
    function fmtTravel(min) {
        min = Math.round(min);
        if (min < 60) return min + " minutes";
        if (min === 60) return "an hour";
        var h = Math.floor(min / 60), m = min % 60;
        return m ? (h + " hr " + m + " min") : (h + (h === 1 ? " hour" : " hours"));
    }

    // Totals + tier suggestion from a counts map { itemId: qty }.
    function estimate(counts) {
        var yd = 0, lbs = 0, qty = 0;
        Object.keys(counts || {}).forEach(function (id) {
            var it = ITEM[id], q = Math.max(0, Math.round(counts[id] || 0));
            if (!it || !q) return;
            yd += it.yd * q; lbs += it.lbs * q; qty += q;
        });
        yd = Math.round(yd * 100) / 100;
        var frac = yd / TRUCK_YD, tier = null;
        if (qty > 0) {
            if (qty === 1 && yd <= 1.3) tier = TIERS[0];
            else if (frac <= 0.27) tier = TIERS[1];
            else if (frac <= 0.55) tier = TIERS[2];
            else if (frac <= 0.80) tier = TIERS[3];
            else tier = TIERS[4];
            // Weight can push a load up a tier (tier caps from app.js LOAD_SIZES).
            while (tier && lbs > tier.capLbs && tier.id !== "full") tier = TIERS[TIERS.indexOf(tier) + 1];
        }
        return {
            yd: yd, lbs: lbs, qty: qty, fillPct: Math.round(frac * 100),
            tier: tier,
            extraTruckloadsSuggested: yd > TRUCK_YD ? Math.ceil(yd / TRUCK_YD) - 1 : 0
        };
    }

    function scopeList(counts) {
        var parts = [];
        ITEMS.forEach(function (it) {
            var q = Math.max(0, Math.round((counts || {})[it.id] || 0));
            if (!q) return;
            parts.push(q === 1 ? (it.bare ? it.one : ("1 " + it.one)) : (q + " " + it.many));
        });
        if (!parts.length) return "";
        if (parts.length === 1) return parts[0];
        return parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1];
    }

    // buildQuote(input) — input: { counts, tierId, tierPrice, cleanoutId,
    //   travelMinutes, stairs: "unknown"|"ground"|"stairs", extraWorkerHours, extraTruckloads }
    // Returns { lines: [{label, note, amount, included}], total, est, text }.
    // Lines with `included:true` carry amount 0 — the priced lines sum EXACTLY to total.
    function buildQuote(input) {
        input = input || {};
        var counts = input.counts || {};
        var est = estimate(counts);
        var lines = [];

        var cleanout = input.cleanoutId ? cleanoutById(input.cleanoutId) : null;
        if (cleanout) {
            lines.push({
                label: cleanout.label + " — flat rate",
                note: "One flat price, the whole place cleared — flat-rate package from the pricing book, separate from load-size pricing.",
                amount: cleanout.price
            });
        } else {
            var tier = tierById(input.tierId) || est.tier || TIERS[0];
            var tp = (input.tierPrice == null) ? tier.price : Math.min(tier.priceMax, Math.max(tier.price, Math.round(input.tierPrice)));
            lines.push({
                label: tier.label + " hauling — crew, loading & truck space",
                note: "Priced by truck space, not weight — this load fills about " + est.fillPct + "% of the truck (" + est.yd + " of " + TRUCK_YD + " yd³), an estimated " + est.lbs.toLocaleString("en-US") + " lb.",
                amount: tp
            });
        }

        ITEMS.forEach(function (it) {
            var q = Math.max(0, Math.round(counts[it.id] || 0));
            if (!q || !it.fee) return;
            var note = (it.id === "mattress" || it.id === "boxspring")
                ? "Disposal facilities charge a per-piece fee for mattresses and box springs — they're bulky and can't be compacted like regular trash."
                : "Per-piece disposal fee from the pricing book — this item needs special handling at the disposal facility.";
            lines.push({
                label: it.name + " disposal — " + q + " × " + money(it.fee),
                note: note,
                amount: q * it.fee
            });
        });

        var xt = Math.max(0, Math.round(input.extraTruckloads || 0));
        if (xt > 0) lines.push({
            label: "Additional truckload — " + xt + " × " + money(EXTRA_TRUCKLOAD_FEE),
            note: "More than one full truck — each additional truckload is a flat fee, agreed before we start.",
            amount: xt * EXTRA_TRUCKLOAD_FEE
        });

        var stairs = input.stairs || "unknown";
        var hrs = Math.max(0, Number(input.extraWorkerHours) || 0);
        if (stairs === "stairs" && hrs > 0) lines.push({
            label: "Extra worker — " + hrs + " hr × " + money(EXTRA_WORKER_RATE),
            note: "Stairs carry — a second set of hands so nothing gets dragged, dropped, or dinged on the way down.",
            amount: hrs * EXTRA_WORKER_RATE
        });

        var travel = Math.max(0, Math.round(input.travelMinutes || 0));
        if (travel > 0) lines.push({
            label: "Extended travel — included, no mileage add-on",
            note: "You're about " + fmtTravel(travel) + " away, so that's roughly " + fmtTravel(travel * 2) + " of round-trip driving and fuel. We built that into this quote instead of surprising you with a travel fee on site.",
            amount: 0, included: true
        });

        var total = lines.reduce(function (s, l) { return s + l.amount; }, 0);

        // ---- Customer-facing text, in the format Tony approved (Oct 26, $470 job) ----
        var out = [];
        out.push("POTENT LOGISTICS — Junk Removal Quote");
        out.push("Best Price In The City. Guaranteed. · 24/7 · (912) 914-2166");
        out.push("");
        var scope = scopeList(counts);
        out.push("Scope — everything pictured: " + (scope || "the items in your photos") + ". Loaded and hauled in one trip.");
        out.push("");
        out.push("Price breakdown — " + money(total) + " flat, all-in:");
        out.push("");
        lines.forEach(function (l) {
            out.push("• " + l.label + (l.included ? "." : " — " + money(l.amount) + ".") + " " + l.note);
        });
        out.push("");
        out.push("Total: " + money(total) + ". No hidden fees, nothing per-piece when we arrive. Quote covers exactly what's in the photo — if there's more beyond it, we price it before loading, never after.");
        if (stairs === "unknown") {
            out.push("");
            out.push("Quick question so there are no surprises on either side: are there any stairs we'll be carrying down, or is everything ground level?");
        }
        out.push("");
        out.push("If that price works for you, say the word and I'll send you the invoice to lock in your spot.");

        return { lines: lines, total: total, est: est, text: out.join("\n") };
    }

    return {
        TRUCK_YD: TRUCK_YD, TIERS: TIERS, CLEANOUTS: CLEANOUTS, ADDONS: ADDONS,
        ITEMS: ITEMS, ITEM: ITEM, EXTRA_WORKER_RATE: EXTRA_WORKER_RATE,
        EXTRA_TRUCKLOAD_FEE: EXTRA_TRUCKLOAD_FEE,
        tierById: tierById, cleanoutById: cleanoutById,
        estimate: estimate, buildQuote: buildQuote, money: money
    };
});
