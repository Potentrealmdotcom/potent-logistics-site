// Run: node tests/voice-dims.test.js
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const I = require("../netlify/functions/lib/voice/intake.js");
const base = { customer_name: "T", callback_phone: "4704531616", pickup_address: "123 Peachtree St NE, Atlanta, GA 30303", delivery_address: "456 Roswell St NE, Marietta, GA 30060", service_date: "2026-10-28", time_window: "morning", freight_description: "pallets", piece_count: 4, total_weight_lb: 3000, pickup_dock: true, delivery_dock: true };
const now = Date.parse("2026-10-21");
[ "190 x 94 x 80 in", "190x94x80", [190, 94, 80], { length: 190, width: 94, height: 80 }, { l: 190, w: 94, h: 80 }, { width_in: 94, height_in: 80, length_in: 190 } ].forEach(d => {
  const r = I.validate(Object.assign({}, base, { dimensions: d }), now); ok(r.missing.indexOf("dimensions") < 0 && r.data.total_dims && r.data.total_dims.l === 190 && r.data.total_dims.w === 94 && r.data.total_dims.h === 80, "accepts " + JSON.stringify(d)); });
ok(I.validate(Object.assign({}, base, { length: 190, width: 94, height: 80 }), now).missing.indexOf("dimensions") < 0, "flat length/width/height accepted");
["4 boxes", "190 x 94", "190 x 94 x 80 ft", "", null, [1, 2], { l: 5, w: 5 }].forEach(d => ok(I.validate(Object.assign({}, base, { dimensions: d }), now).missing.indexOf("dimensions") >= 0, "still missing for " + JSON.stringify(d)));
ok(I.validate(Object.assign({}, base, { total_dims: { l: 100, w: 40, h: 40 }, dimensions: "1 x 1 x 1" }), now).data.total_dims.l === 100, "explicit total_dims wins");
console.log("voice-dims: " + n + " assertions PASS");
