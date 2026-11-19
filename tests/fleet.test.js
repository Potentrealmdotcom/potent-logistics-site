// Run: node tests/fleet.test.js   (D24: service-interval math extracted from app.js)
const fs = require("fs"), assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const src = fs.readFileSync(__dirname + "/../app.js", "utf8");
function extract(name) {
    const i = src.indexOf("function " + name + "(");
    assert(i >= 0, name + " exists in app.js");
    let d = 0, j = src.indexOf("{", i);
    for (; j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}") { d--; if (!d) return src.slice(i, j + 1); } }
    throw new Error("unbalanced " + name);
}
const body = ["plServiceIntervalMonths", "plAddMonths"].map(nm => "var " + nm + " = " + extract(nm) + ";").join("\n");
const api = new Function(body + "\nreturn { plServiceIntervalMonths, plAddMonths };")();
ok(api.plAddMonths("2026-01-15", 6) === "2026-07-15", "oil logged in January is next due in July at the 6-month default");
ok(api.plAddMonths("2026-11-30", 12) === "2027-11-30", "brake interval crosses the year boundary");
ok(api.plAddMonths("2026-01-31", 1) === "2026-02-28", "month-end clamps the way Date does (no phantom March 3rd service)");
ok(api.plAddMonths("", 6) === "", "no date, no next-due");
ok(api.plServiceIntervalMonths({}, "oil") === 6 && api.plServiceIntervalMonths({}, "brake") === 12, "defaults: oil/tires 6 months, brakes 12");
ok(api.plServiceIntervalMonths({ oilInt: "3" }, "oil") === 3, "owner-set interval wins over the default");
ok(api.plServiceIntervalMonths({ tireInt: 0 }, "tire") === 6, "a zero/garbage interval falls back to the default");
console.log("PASS: " + n + " assertions");
