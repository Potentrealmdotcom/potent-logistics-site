// Run: node tests/pricingsnapshot.test.js — Pricing Snapshot must price ONLY from Tony's
// pricing book (Oct 2026) and reproduce the approved $470 quote from Oct 26 exactly.
const assert = require("assert"), fs = require("fs"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const PS = require("../snapshot/pricing-snapshot.js");

// --- the disposal add-on table must equal the pricing book, verbatim ---
const BOOK = { mattress: 30, boxspring: 30, tire_small: 6, tire_large: 30, tire_rim: 48, fridge: 45, ac: 45, tv: 45, paint: 15, propane: 45, hottub_piano: 450 };
const bookHtml = fs.readFileSync(__dirname + "/../../your_files/pricing/potent-junk-removal-pricing-book.html", "utf8");
ok(PS.ADDONS.length === 11, "book has 11 add-on items");
PS.ADDONS.forEach(a => {
    ok(BOOK[a.id] === a.fee, "fee for " + a.id + " is the book fee $" + BOOK[a.id]);
    ok(bookHtml.includes(a.book.replace(/"/g, "&quot;")) || bookHtml.includes(a.book), "book lists \"" + a.book + "\"");
    const item = PS.ITEM[a.id];
    ok(item && item.fee === a.fee && item.lbs > 0 && item.yd > 0, a.id + " carries a weight + volume estimate");
});

// --- load tiers must equal the app's LOAD_SIZES and the book ---
const src = fs.readFileSync(__dirname + "/../app.js", "utf8");
const m = src.match(/var LOAD_SIZES = (\[[\s\S]*?\n\]);/); assert(m, "LOAD_SIZES in app.js");
const appTiers = eval(m[1]);
const byId = {}; appTiers.forEach(t => { byId[t.id] = t; byId[t.id === "minimum" ? "minimum" : t.id] = t; });
ok(PS.TIERS.length === appTiers.length, "same number of load tiers as the app");
PS.TIERS.forEach(t => {
    const a = byId[t.id]; assert(a, "app has tier " + t.id);
    ok(t.price === a.price && t.priceMax === a.priceMax && t.capLbs === a.capLbs, "tier " + t.id + " prices/cap match app.js ($" + a.price + (a.priceMax !== a.price ? "–" + a.priceMax : "") + ")");
});
ok(PS.EXTRA_WORKER_RATE === 40, "extra worker is the book's $40/hr");

// --- SANITY: this morning's job must reproduce $470 with the same line math ---
// 2 mattresses, 2 box springs, 1 couch, ~4 bags, bin, high chair, baby gear; 1 hour away; stairs unanswered.
const q = PS.buildQuote({ counts: { mattress: 2, boxspring: 2, couch: 1, bag: 4, bin: 1, highchair: 1, babygear: 1 }, travelMinutes: 60, stairs: "unknown" });
ok(q.est.tier.id === "half", "the counted volume/weight suggests a half load (got " + q.est.tier.id + ")");
ok(q.lines.map(l => l.amount).join(",") === "350,60,60,0", "lines are Half $350 + mattress $60 + box spring $60 + travel included (got " + q.lines.map(l => l.amount).join(",") + ")");
ok(q.total === 470, "TOTAL IS $470 (got $" + q.total + ")");
ok(q.lines.reduce((s, l) => s + l.amount, 0) === q.total, "lines sum exactly to the total");
ok(q.text.includes("POTENT LOGISTICS — Junk Removal Quote"), "header present");
ok(q.text.includes("Best Price In The City. Guaranteed. · 24/7 · (912) 914-2166"), "business header line present");
ok(q.text.includes("Price breakdown — $470 flat, all-in:"), "breakdown header carries the total");
ok(q.text.includes("Extended travel — included, no mileage add-on"), "travel is stated as included, never a surprise fee");
ok(q.text.includes("are there any stairs"), "unanswered stairs → the quote asks about stairs");
ok(q.text.includes("If that price works for you, say the word and I'll send you the invoice to lock in your spot."), "invoice closing line, verbatim");

// --- behavior: operator overrides, stairs labor, cleanouts ---
const over = PS.buildQuote({ counts: { couch: 1 }, tierId: "quarter", tierPrice: 250 });
ok(over.total === 250 && over.lines[0].label.startsWith("Quarter Load"), "operator can override the suggested tier");
const stairs = PS.buildQuote({ counts: { couch: 1, dresser: 1 }, stairs: "stairs", extraWorkerHours: 2 });
ok(stairs.total === 250 + 80, "stairs carry adds extra worker 2 hr × $40 (quarter load suggested)");
ok(!stairs.text.includes("are there any stairs"), "answered stairs → no stairs question in the text");
const clean = PS.buildQuote({ counts: { couch: 2 }, cleanoutId: "studio", travelMinutes: 30 });
ok(clean.lines[0].amount === 499 && clean.total === 499, "studio/1BR cleanout is the book's $499 flat rate");
const big = PS.buildQuote({ counts: { couch: 8 } });
ok(big.est.tier.id === "full" && big.est.extraTruckloadsSuggested >= 1, "over one truck → full load + extra truckloads suggested");
const single = PS.buildQuote({ counts: { dresser: 1 } });
ok(single.est.tier.id === "minimum" && single.total === 179, "one item alone → single-item $179");

console.log("pricingsnapshot: " + n + " assertions PASS");
