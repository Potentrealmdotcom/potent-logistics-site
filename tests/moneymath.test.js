// Run: node tests/moneymath.test.js   (D34 one-money-math helpers + D29 block-out helper, extracted from app.js and exercised directly)
const fs = require("fs"), assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const src = fs.readFileSync(__dirname + "/../app.js", "utf8");
function extract(name) {
    const i = src.indexOf("function " + name + "(");
    assert(i >= 0, name + " exists in app.js");
    let d = 0, j = src.indexOf("{", i);
    for (; j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}") { d--; if (!d) return src.slice(i, j + 1); } }
    throw new Error("unbalanced " + name);
}
const store = { pl_emp_settings: "{}", pl_drivers: "[]" };
const sandbox = {
    USERS: [{ id: "dispatch1", name: "Dispatch 1", commLogistics: 0.10 }, { id: "driver", name: "Driver 1", commLogistics: 0 }],
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } }
};
// evaluate the real declarations together in one scope so cross-calls resolve
const body = ["plMoneyRound", "plRepLogisticsRate", "plDriverRecordFor", "plDriverPayForJob", "plDriverBlockedOn"].map(nm => "var " + nm + " = " + extract(nm) + ";").join("\n");
const api = new Function("USERS", "localStorage", body + "\nreturn { plMoneyRound, plRepLogisticsRate, plDriverRecordFor, plDriverPayForJob, plDriverBlockedOn };")(sandbox.USERS, sandbox.localStorage);
const { plMoneyRound, plRepLogisticsRate, plDriverPayForJob, plDriverBlockedOn } = api;

ok(plMoneyRound(100.456) === 100.46, "rounds half-up to cents");
ok(plMoneyRound(100.454) === 100.45, "rounds down under half a cent");
ok(plMoneyRound("12.3") === 12.3 && plMoneyRound(null) === 0 && plMoneyRound(undefined) === 0, "coerces strings and empties");

const job500 = { finalPrice: 500, miles: 100 };
ok(plDriverPayForJob({ pay_type: "per_load", pay_rate: 120 }, job500) === 120, "per-load driver gets the flat rate, not a % of the job");
ok(plDriverPayForJob({ pay_type: "per_mile", pay_rate: 0.45 }, job500) === 45, "per-mile driver gets rate x miles");
ok(plDriverPayForJob({ pay_type: "percentage", pay_rate: 30 }, job500) === 150, "percentage driver gets their % of the price");
ok(plDriverPayForJob(null, job500) === 125, "unknown structure keeps the historical 25% fallback");
ok(plDriverPayForJob({ pay_type: "percentage", pay_rate: 33.333 }, { finalPrice: 100 }) === 33.33, "driver pay is cent-rounded through the one path");

ok(plRepLogisticsRate("Dispatch 1") === 0.10, "roster rate used when no saved setting");
store.pl_emp_settings = JSON.stringify({ dispatch1: { logisticsRate: 15 } });
ok(plRepLogisticsRate("Dispatch 1") === 0.15, "saved employee-settings rate wins, like payroll");
store.pl_emp_settings = "{}";
ok(plRepLogisticsRate("Nobody") === 0.10, "unknown rep falls back to the 10% default");

const bos = [{ driverName: "Marcus", start: "2026-11-20", end: "2026-11-22", reason: "vacation" }];
ok(plDriverBlockedOn("Marcus", "2026-11-20", bos) && plDriverBlockedOn("Marcus", "2026-11-22", bos), "block-out covers both boundary days");
ok(!plDriverBlockedOn("Marcus", "2026-11-23", bos) && !plDriverBlockedOn("Other", "2026-11-21", bos), "no block outside the range or for other drivers");
ok(plDriverBlockedOn("Marcus", "2026-11-21T09:00:00", bos), "datetime job dates still match by day");

console.log("PASS: " + n + " assertions");
