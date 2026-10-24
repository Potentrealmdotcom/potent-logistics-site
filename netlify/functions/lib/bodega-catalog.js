// Server-side POTENT Bodega catalog. Prices live HERE (server only), never in the browser.
// The catalog data is generated from the real Shopify export into bodega/server-catalog.json:
//   { "<handle>": { "title": "...", "priceCents": 12345, "floorCents": 10000 }, ... }
// This loader is placeholder-safe: if the JSON is not present yet it exports an empty map,
// and callers must fail with 500 "Catalog not loaded" instead of trusting any client price.
const fs = require("fs");
const path = require("path");

function loadCatalog() {
  // Primary location per spec: ../../bodega/server-catalog.json relative to this file's directory
  // (netlify/functions/lib -> netlify/bodega). Also try the repo-root bodega/ folder
  // (../../../bodega/server-catalog.json) so the file is found wherever the generator drops it.
  const candidates = [
    path.join(__dirname, "bodega-server-catalog.json"),
    path.join(__dirname, "..", "..", "bodega", "server-catalog.json"),
    path.join(__dirname, "..", "..", "..", "bodega", "server-catalog.json")
  ];
  for (let i = 0; i < candidates.length; i++) {
    try {
      const mod = require(candidates[i]);
      if (mod && typeof mod === "object" && !Array.isArray(mod)) return mod;
    } catch (e) { /* not there via require; try fs below */ }
    try {
      const raw = fs.readFileSync(candidates[i], "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch (e) { /* not present — keep looking */ }
  }
  return {};
}

const CATALOG = loadCatalog();
const HANDLES = Object.keys(CATALOG).sort();

function isLoaded() { return HANDLES.length > 0; }

// Cart codec for Stripe metadata (<=500 chars): "idx:qty,idx:qty" where idx is the
// handle's position in the sorted HANDLES list. Caps: 20 distinct items, qty 1-99.
function encodeItems(items) {
  const seen = {};
  const list = Array.isArray(items) ? items : [];
  list.forEach(function (it) {
    if (!it || typeof it.handle !== "string") return;
    const idx = HANDLES.indexOf(it.handle);
    if (idx < 0) return;
    let qty = Math.floor(Number(it.qty) || 0);
    if (qty < 1) qty = 1;
    if (qty > 99) qty = 99;
    seen[idx] = Math.min(99, (seen[idx] || 0) + qty);
  });
  return Object.keys(seen).sort(function (a, b) { return Number(a) - Number(b); }).slice(0, 20).map(function (idx) {
    return idx + ":" + seen[idx];
  }).join(",");
}

function decodeItems(str) {
  const out = [];
  String(str || "").split(",").forEach(function (part) {
    const m = String(part || "").trim().match(/^(\d+):(\d+)$/);
    if (!m) return;
    const handle = HANDLES[Number(m[1])];
    if (!handle) return;
    let qty = Math.floor(Number(m[2]) || 0);
    if (qty < 1) qty = 1;
    if (qty > 99) qty = 99;
    out.push({ handle: handle, qty: qty });
  });
  return out.slice(0, 20);
}

module.exports = { CATALOG: CATALOG, HANDLES: HANDLES, isLoaded: isLoaded, encodeItems: encodeItems, decodeItems: decodeItems };
