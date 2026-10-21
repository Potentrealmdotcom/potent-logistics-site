// Dev tool: collects every piece of on-screen English text in the app and pages into lang/phrases.json.
// Run: NODE_PATH=/opt/npm-tools/node_modules node scripts/extract-phrases.js
const fs = require("fs"), acorn = require("acorn"), walk = require("acorn-walk");
const FILES = { app: ["app.js"], home: [], pages: ["index.html", "POTENT-OS-Landing-Page.html", "POTENT-Driver-Onboarding.html", "POTENT-Employee-Portal.html", "POTENT-Contractor-Broker-Agreement.html", "POTENT-License-Signup.html", "POTENT-Handbook.html", "guide.html", "os-guide.html", "team.html", "training.html", "404.html"], elevate: ["elevate/index.html"], voice: ["voice/index.html"] };
const out = new Map(); // phrase -> Set(source)
function add(s, src) {
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > 1000) { pieces(s).forEach(x => add2(x, src)); return; }
  add2(s, src);
}
function pieces(s) {
  const sent = s.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [s], out = [];
  sent.forEach(x => { while (x.length > 900) { let k = x.lastIndexOf(" ", 900); if (k < 300) k = 900; out.push(x.slice(0, k)); x = x.slice(k); } out.push(x); });
  const g = []; out.forEach(x => { const l = g[g.length - 1]; if (l !== undefined && (l + x).length <= 900) g[g.length - 1] = l + x; else g.push(x); }); return g;
}
function add2(s, src) {
  s = s.trim();
  if (!wanted(s)) return;
  if (!out.has(s)) out.set(s, new Set()); out.get(s).add(src);
}
function wanted(s) {
  if (s.length < 2 || s.length > 1000) return false;
  if (!/[A-Za-z]{2}/.test(s)) return false;
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(s) || /^(https?:|www\.|\/|#|\.|data:)/i.test(s)) return false;
  if (/^[A-Z]{1,4}[-#]?\d{3,}/.test(s)) return false;
  if (/[{};]|=>|\$\{|function\s*\(|\bvar\b|<\/?[a-z]/.test(s)) return false;           // code / markup
  if (/^[a-z][a-z0-9]*([A-Z][a-z0-9]*)+$/.test(s)) return false;                      // camelCase identifier
  if (/^[a-z0-9_-]+$/.test(s) && !/\s/.test(s)) return false;                         // css class / key / slug
  if (/^[A-Z0-9_]+$/.test(s) && s.length > 5) return false;                           // CONSTANT_NAME
  if (/#[0-9a-fA-F]{3,8}\b|\b\d+(\.\d+)?(px|em|rem|vh|vw|%)\b|\b(solid|flex|absolute|relative|none|auto|inherit)\b[^a-z]*$/.test(s) && !/[a-z]{3,} [a-z]{3,} [a-z]{3,}/i.test(s)) return false;  // css values
  if (/^(px|em|rem|vh|vw|rgba?|hsla?|translate|scale|rotate|linear-gradient|calc|var)\b/.test(s)) return false;
  if (/^\d/.test(s) && !/\s[A-Za-z]{3,}/.test(s)) return false;
  if (!/\s/.test(s) && !/^[A-Z]/.test(s)) return false;                                 // lone lowercase token = code
  if (/^[A-Za-z][\w-]*:[\w-]/.test(s) && !/\s/.test(s)) return false;                 // key:value tokens
  return true;
}
function fromJS(code, src) {
  let ast; try { ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "script", allowReturnOutsideFunction: true }); } catch (e) { console.error("parse fail", src, e.message); return; }
  const skip = [];   // the hand-written TX dictionaries are already translated: leave them out
  walk.simple(ast, { VariableDeclarator(n) { if (n.id && n.id.name === "TX") skip.push([n.start, n.end]); } });
  walk.full(ast, n => {
    if (skip.some(r => n.start >= r[0] && n.end <= r[1])) return;
    if (n.type === "Literal" && typeof n.value === "string") add(n.value, src);
    else if (n.type === "TemplateElement") add(n.value.cooked || "", src);
  });
}
function fromHTML(html, src) {
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (m, js) => { if (!/application\/(ld\+)?json/i.test(m.slice(0, 120)) && js.length < 3e6) fromJS(js, src); return " "; });
  html = html.replace(/<style\b[\s\S]*?<\/style>/gi, " ");
  html.replace(/\b(?:placeholder|title|aria-label|alt|content)="([^"]{2,400})"/g, (m, v) => { add(decode(v), src); return m; });
  html.split(/<[^>]+>/).forEach(t => { t = decode(t); if (t.trim()) { t.split(/\n{2,}/).forEach(p => add(p, src)); } });
}
function decode(s) { return s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&middot;/g, "·").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&rarr;/g, "→").replace(/&larr;/g, "←").replace(/&copy;/g, "©").replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d)); }
for (const [grp, files] of Object.entries(FILES)) for (const f of files) {
  if (!fs.existsSync(f)) continue; const code = fs.readFileSync(f, "utf8");
  if (f.endsWith(".js")) fromJS(code, grp); else fromHTML(code, grp);
}
const arr = [...out.entries()].map(([p, s]) => ({ p, s: [...s].sort() }));
const bySrc = {}; arr.forEach(x => x.s.forEach(s => bySrc[s] = (bySrc[s] || 0) + 1));
console.log("total", arr.length, bySrc, "chars", arr.reduce((a, x) => a + x.p.length, 0), "long>240", arr.filter(x => x.p.length > 240).length);
fs.writeFileSync("lang/phrases.json", JSON.stringify(arr.map(x => x.p).sort()));
fs.writeFileSync("/tmp/ex/phrases-src.json", JSON.stringify(arr));
