// Builds netlify/functions/lib/voice/osinventory.json from the Master Inventory text (pdftotext -layout).
// Usage: node scripts/build-os-inventory.js inv.txt
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8").split("\n");
const STALE = /(family|loyalty).{0,12}15|lowest floor|-20%|–20%|–15%|cash discount|10%\s*cash|cash.{0,10}10%/i;   // discounts the owner removed
const clean = s => s.replace(/\s+/g, " ").trim();
const split = src.findIndex(l => /INTERFACE REFERENCE/.test(l));
const features = []; let area = "General", n = 0, last = null, dropped = 0;
for (let i = 0; i < split; i++) {
  const l = src[i], h = l.match(/^\s*(\d{1,2})\.\s+(.{4,})$/);
  if (h) { area = clean(h[2]); last = null; continue; }
  const b = l.match(/^\s*◆\s*(.+)$/);
  if (b) { last = clean(b[1]); if (STALE.test(last)) { dropped++; last = null; continue; } features.push({ area, text: last }); n++; continue; }
  if (last && /^\s{2,}\S/.test(l) && !/^\s*[A-Z ]{12,}$/.test(l) && features.length) features[features.length - 1].text += " " + clean(l);
  else last = null;
}
const screens = []; let group = "Other";
for (let i = split + 1; i < src.length; i++) {
  const l = src[i], g = l.match(/^\s*(.+?)\s*\((\d+)\)\s*$/);
  if (g) { group = clean(g[1]); continue; }
  if (!/◆/.test(l)) { if (screens.length && /^\s{4,}\S/.test(l) && !/INTERNAL|Page \d/i.test(l)) screens[screens.length - 1].text += " " + clean(l); continue; }
  l.split("◆").slice(1).forEach(x => { x = clean(x); if (x) screens.push({ group, text: x }); });
}
screens.forEach(s => { s.text = s.text.replace(/ SUMMARY .*$/, ""); });
fs.writeFileSync("netlify/functions/lib/voice/osinventory.json", JSON.stringify({ source: "POTENT OS Master Inventory v16 (internal)", features, screens }));
console.log("features", features.length, "dropped stale", dropped, "screens", screens.length);
