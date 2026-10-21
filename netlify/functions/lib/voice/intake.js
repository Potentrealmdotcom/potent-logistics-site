// Structured shipment intake: the only shape the rest of the system accepts. Anything missing, ambiguous or contradictory is reported, never guessed.
const num = function (v) { const n = typeof v === "string" ? Number(v.replace(/[, ]/g, "")) : Number(v); return isFinite(n) ? n : NaN; };
const bool = function (v) { if (v === true || v === false) return v; if (typeof v === "string") { const s = v.trim().toLowerCase(); if (/^(yes|y|true|1)$/.test(s)) return true; if (/^(no|n|false|0)$/.test(s)) return false; } return null; };
const clip = function (v, n) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n); };
const WINDOWS = ["early", "morning", "afternoon", "evening", "all_day"];
const LEVELS = ["standard", "same_day", "rush", "recurring", "savannah_early", "savannah_full"];
const STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" ");

function phone(p) { const d = String(p || "").replace(/\D/g, ""); const t = d.length === 11 && d[0] === "1" ? d.slice(1) : d; return t.length === 10 && !/^[01]/.test(t) ? "+1" + t : null; }
// "123 Main St, Atlanta, GA 30303": a street number, a street, and a state or ZIP. Verification against a geocoder happens separately.
function stateOf(a) { const m = String(a || "").toUpperCase().match(/(?:,|\s)\s*([A-Z]{2})\s*(?:\d{5}(?:-\d{4})?)?\s*(?:,?\s*USA|,?\s*US)?\s*$/); return m && STATES.indexOf(m[1]) >= 0 ? m[1] : null; }
function cityOf(a) { const p = String(a || "").split(",").map(function (s) { return s.trim(); }); return p.length >= 3 ? p[p.length - 2] : (p.length === 2 ? p[0] : ""); }
function addressCheck(a) {
  const s = clip(a, 200); if (!s) return { ok: false, why: "missing" };
  if (!/^\d+[A-Za-z]?\s+\S+/.test(s)) return { ok: false, why: "needs a street number and street name" };
  if (!stateOf(s) && !/\b\d{5}\b/.test(s)) return { ok: false, why: "needs a city and state or ZIP code" };
  if (s.split(",").length < 2 && !/\b\d{5}\b/.test(s)) return { ok: false, why: "needs a city" };
  return { ok: true, state: stateOf(s) };
}
function dims(d) { if (!d || typeof d !== "object") return null; const l = num(d.l), w = num(d.w), h = num(d.h); return l > 0 && w > 0 && h > 0 && l <= 1000 && w <= 1000 && h <= 1000 ? { l: l, w: w, h: h, qty: Math.max(1, Math.floor(num(d.qty) || 1)), weight_lb: num(d.weight_lb) > 0 ? num(d.weight_lb) : null } : null; }

// Callers (and test simulators) often state dimensions as "190 x 94 x 80 in", [190,94,80], or {length,width,height}. Accept those as the
// overall size of the load; anything that does not give exactly three positive numbers is still reported as missing, never guessed.
function looseDims(raw) {
  const v = raw.total_dims || raw.dimensions || raw.freight_dimensions || raw.dims || raw.size || null;
  const fromObj = function (o) { return { l: o.l != null ? o.l : o.length != null ? o.length : o.length_in, w: o.w != null ? o.w : o.width != null ? o.width : o.width_in, h: o.h != null ? o.h : o.height != null ? o.height : o.height_in }; };
  if (Array.isArray(v) && v.length === 3) return { l: num(v[0]), w: num(v[1]), h: num(v[2]) };
  if (typeof v === "string") { const m = v.match(/\d+(?:\.\d+)?/g); return m && m.length === 3 && !/\b(ft|feet|foot|cm|mm|m)\b/i.test(v.replace(/\bin(?:ch(?:es)?)?\b/ig, "")) ? { l: Number(m[0]), w: Number(m[1]), h: Number(m[2]) } : null; }
  if (v && typeof v === "object" && !Array.isArray(v)) return fromObj(v);
  if (raw.length != null || raw.width != null || raw.height != null) return fromObj(raw);
  return null;
}

// validate(raw, now) -> { ok, missing[], problems[], data }.  `data` is the normalized record even when not ok, so the agent can ask for exactly what is missing.
function validate(raw, now) {
  raw = raw || {}; const miss = [], prob = [], d = {};
  d.customer_name = clip(raw.customer_name, 80); if (!d.customer_name) miss.push("customer_name");
  d.company = clip(raw.company, 100);
  d.callback_phone = phone(raw.callback_phone); if (!d.callback_phone) miss.push("callback_phone");
  d.email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(raw.email || "")) ? String(raw.email).toLowerCase().slice(0, 120) : ""; if (raw.email && !d.email) prob.push("email_invalid");
  [["pickup", "pickup_address"], ["delivery", "delivery_address"]].forEach(function (p) {
    d[p[1]] = clip(raw[p[1]], 200); const c = addressCheck(d[p[1]]);
    if (!d[p[1]]) miss.push(p[1]); else if (!c.ok) prob.push(p[1] + "_ambiguous: " + c.why);
    d[p[0] + "_state"] = c.ok ? c.state : null; d[p[0] + "_contact_name"] = clip(raw[p[0] + "_contact_name"], 80); d[p[0] + "_contact_phone"] = phone(raw[p[0] + "_contact_phone"]) || "";
  });
  if (d.pickup_address && d.delivery_address && d.pickup_address.toLowerCase() === d.delivery_address.toLowerCase()) prob.push("pickup_and_delivery_are_the_same");
  const date = String(raw.service_date || ""); d.service_date = /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date + "T12:00:00Z")) ? date : "";
  if (!d.service_date) miss.push("service_date"); else {
    const today = new Date(now || Date.now()).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    if (d.service_date < today) prob.push("service_date_in_the_past"); else if (Date.parse(d.service_date) - Date.parse(today) > 366 * 864e5) prob.push("service_date_too_far");
  }
  const w = String(raw.time_window || "").trim().toLowerCase(); d.time_window = WINDOWS.indexOf(w) >= 0 || /^([01]\d|2[0-3]):[0-5]\d$/.test(w) ? w : ""; if (!d.time_window) miss.push("time_window");
  d.service_level = LEVELS.indexOf(raw.service_level) >= 0 ? raw.service_level : "standard";
  d.freight_description = clip(raw.freight_description, 300); if (!d.freight_description) miss.push("freight_description");
  const pc = num(raw.piece_count); d.piece_count = Number.isInteger(pc) && pc > 0 && pc <= 500 ? pc : 0; if (!d.piece_count) miss.push("piece_count");
  const tw = num(raw.total_weight_lb); d.total_weight_lb = tw > 0 && tw <= 100000 ? tw : 0; if (!d.total_weight_lb) miss.push("total_weight_lb");
  d.pieces = (Array.isArray(raw.pieces) ? raw.pieces : []).map(dims).filter(Boolean).slice(0, 100);
  d.total_dims = dims(raw.total_dims) || dims(looseDims(raw));
  if (!d.pieces.length && !d.total_dims) miss.push("dimensions");
  if (Array.isArray(raw.pieces) && raw.pieces.length && raw.pieces.map(dims).some(function (x) { return !x; })) prob.push("a_piece_has_bad_dimensions");
  const listed = d.pieces.reduce(function (a, p) { return a + p.qty; }, 0); if (d.pieces.length && d.piece_count && listed !== d.piece_count && d.pieces.every(function (p) { return p.qty >= 1; }) && listed > d.piece_count) prob.push("piece_dimensions_exceed_piece_count");
  const wl = d.pieces.filter(function (p) { return p.weight_lb; }); if (wl.length === d.pieces.length && d.pieces.length && d.total_weight_lb) { const s = d.pieces.reduce(function (a, p) { return a + p.weight_lb * p.qty; }, 0); if (Math.abs(s - d.total_weight_lb) > Math.max(25, d.total_weight_lb * 0.1)) prob.push("piece_weights_do_not_match_total"); }
  ["pickup_dock", "delivery_dock"].forEach(function (k) { d[k] = bool(raw[k]); if (d[k] === null) miss.push(k); });
  ["needs_liftgate", "needs_pallet_jack", "forklift_pickup", "forklift_delivery", "site_has_pallet_jack", "inside_delivery", "hazmat", "recurring"].forEach(function (k) { d[k] = bool(raw[k]) === true; });
  ["extra_stops", "labor_helpers", "expected_wait_minutes", "labor_hours", "holding_nights"].forEach(function (k) { const n = num(raw[k]); d[k] = n > 0 && n < 1000 ? n : 0; });
  d.special_handling = clip(raw.special_handling, 300); d.special_instructions = clip(raw.special_instructions, 400); d.po_number = clip(raw.po_number, 60);
  return { ok: !miss.length && !prob.length, missing: miss, problems: prob, data: d };
}
module.exports = { validate, phone, stateOf, cityOf, addressCheck, WINDOWS, LEVELS };
