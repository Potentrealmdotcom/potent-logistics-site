// POTENT Bodega — MULTICITY × POTENT Mystery Box Collection (owner spec, Oct 24 2026).
// Boxes are ordinary Bodega products at checkout time: their handles live in the server
// catalog with server-side prices, so bodega-checkout prices them like any other piece.
// The difference is fulfillment: a box's contents are unnamed at purchase, so a box
// purchase creates NO resale ownership record. Instead bodega-ownership (claim) writes
// one bodega_box_orders row per box, carrying the tier's required-contents checklist
// for the owner to fulfill by hand from catalog stock. When the owner fulfills a box,
// the contents are ordinary catalog pieces — nothing about them is pre-registered here.
// Every box guarantees at least 2x its price in POTENT retail/MSRP value; exact
// designs/colors vary by box; Vault Hits are possible bonus finds, never guaranteed.

// handle -> box. Handles are also the catalog handles in bodega/catalog.json and the
// server catalog (added by bodega/generate-catalog.py so regeneration keeps them).
const BOXES = {
  "mystery-box-platinum": {
    key: "platinum",
    name: "Platinum Box",
    title: "MULTICITY × POTENT Mystery Box — Platinum",
    priceCents: 29900,
    valueCents: 59800,
    blurb: "The entry-level MULTICITY collectible clothing box.",
    contents: [
      "1 clothing top",
      "1 clothing bottom",
      "1 accessory"
    ]
  },
  "mystery-box-diamond": {
    key: "diamond",
    name: "Diamond Box",
    title: "MULTICITY × POTENT Mystery Box — Diamond",
    priceCents: 49900,
    valueCents: 99800,
    blurb: "A larger selection with a specialty jersey.",
    contents: [
      "1 clothing top",
      "1 clothing bottom",
      "1 specialty jersey",
      "2 accessories"
    ]
  },
  "mystery-box-vault": {
    key: "vault",
    name: "POTENT'S PICK — The Vault",
    title: "MULTICITY × POTENT Mystery Box — POTENT'S PICK (The Vault)",
    priceCents: 89900,
    valueCents: 179800,
    blurb: "Two complete outfits, a collectible, and a chance at a Vault Hit.",
    contents: [
      "2 complete outfits (2 tops and 2 bottoms)",
      "3 accessories",
      "1 collectible",
      "Chance of a special Vault Hit (1-of-1 accessory, archived design, numbered piece, special jersey, exclusive colorway, early release, or signed/numbered collectible) — a possible bonus, never guaranteed"
    ]
  },
  "mystery-box-black-label": {
    key: "blacklabel",
    name: "Black Label Box",
    title: "MULTICITY × POTENT Mystery Box — Black Label",
    priceCents: 149900,
    valueCents: 299800,
    blurb: "The highest-tier curated MULTICITY experience.",
    contents: [
      "2 premium outfits",
      "1 specialty or limited-edition jersey",
      "4 accessories",
      "1 premium collectible",
      "Numbered certificate",
      "Premium packaging",
      "Personal styling selection"
    ]
  }
};

const HANDLES = Object.keys(BOXES);

function isBox(handle) { return Object.prototype.hasOwnProperty.call(BOXES, String(handle || "")); }
function boxFor(handle) { return BOXES[String(handle || "")] || null; }

module.exports = { BOXES: BOXES, HANDLES: HANDLES, isBox: isBox, boxFor: boxFor };
