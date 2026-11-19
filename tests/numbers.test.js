// Run: node tests/numbers.test.js   (D23: Griffin's plain-words numbers interpreter, extracted from app.js)
const fs = require("fs"), assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const src = fs.readFileSync(__dirname + "/../app.js", "utf8");
function extract(name) {
    const i = src.indexOf("function " + name + "(");
    assert(i >= 0, name + " exists in app.js");
    let d = 0, j = src.indexOf("{", i);
    for (; j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}") { d--; if (!d) return src.slice(i, j + 1); } }
    throw new Error("unbalanced " + name);
}
const body = ["plMoney", "plNumbersWindow", "plNumbersQuery"].map(nm => "var " + nm + " = " + extract(nm) + ";").join("\n");
const api = new Function(body + "\nreturn { plNumbersQuery };")();
const q = api.plNumbersQuery;
const NOW = new Date(2026, 10, 18); // Wed Nov 18, 2026
const data = {
    jobs: [
        { id: "j1", date: "2026-11-05", finalPrice: 500, status: "Completed", paymentStatus: "paid", assignedDriverName: "Marcus J. Lewis" },
        { id: "j2", date: "2026-11-10", finalPrice: 300, status: "Completed", assignedDriverName: "" },
        { id: "j3", date: "2026-11-12", finalPrice: 200, status: "Cancelled", assignedDriverName: "Marcus J. Lewis" },
        { id: "j4", date: "2026-10-15", finalPrice: 1000, status: "Completed", paymentStatus: "paid", assignedDriverName: "Marcus J. Lewis" },
        { id: "j5", date: "2026-11-18", finalPrice: 150, status: "New", assignedDriverName: "" },
        { id: "j6", date: "2026-11-03", finalPrice: 400, status: "Delivered", assignedDriverName: "Marcus J. Lewis" }
    ],
    expenses: [
        { type: "fuel", amount: 120, date: "2026-11-06" },
        { type: "tolls", amount: 30, date: "2026-11-06" },
        { type: "fuel", amount: 80, date: "2026-10-06" }
    ],
    settlements: [
        { driver_name: "Marcus J. Lewis", period_end: "2026-11-07", net_pay: 415, status: "paid" },
        { driver_name: "Marcus J. Lewis", period_end: "2026-11-14", net_pay: 575, status: "unpaid" }
    ],
    driverNames: ["Marcus J. Lewis", "DeShawn Carter"]
};
ok(q("how much revenue this month?", data, NOW) === "Revenue this month: $1350.00 across 4 jobs.", "monthly revenue excludes cancelled, includes all live jobs");
ok(q("how much revenue did we make last month?", data, NOW) === "Revenue last month: $1000.00 across 1 job.", "last-month window");
ok(q("revenue this week", data, NOW) === "Revenue this week: $150.00 across 1 job.", "this-week window starts Monday");
ok(q("what did we spend on fuel this month?", data, NOW) === "You spent $120.00 on fuel this month.", "expense by type");
ok(q("what were our total expenses this month?", data, NOW) === "Total expenses this month: $150.00 across 2 expenses.", "expense total");
ok(q("how many jobs did marcus complete this month?", data, NOW) === "Marcus J. Lewis completed 2 jobs this month.", "driver-scoped completed count by first name");
ok(q("how much is still outstanding?", data, NOW) === "Customers still owe $700.00 on 2 finished jobs this month.", "outstanding on finished unpaid jobs");
ok(q("how many loads are unassigned?", data, NOW) === "There are 1 unassigned load right now.", "unassigned is a right-now count");
ok(q("what did we pay out to drivers this month?", data, NOW) === "Driver payouts this month: $990.00 net across 2 settlements.", "settlement payouts");
ok(q("how much do we owe marcus in settlements?", data, NOW) === "Marcus J. Lewis is owed $575.00 in unpaid settlements this month.", "driver-scoped unpaid settlements");
ok(q("what is the average job worth this month?", data, NOW) === "The average job this month brought in $337.50 across 4 jobs.", "average job value");
ok(q("how many jobs were cancelled this month?", data, NOW) === "1 job was cancelled this month.", "cancelled count");
ok(q("what is detention?", data, NOW) === null, "non-numbers questions fall through (null)");
ok(q("tell me a joke", data, NOW) === null, "chit-chat falls through (null)");
console.log("PASS: " + n + " assertions");
