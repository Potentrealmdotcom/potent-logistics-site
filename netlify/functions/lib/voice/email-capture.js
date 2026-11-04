// DETERMINISTIC SPELLED-LETTER EMAIL ASSEMBLY (Nov 4, 2026 — the announcement retest-3 failure).
// Email capture used to depend on the live model hearing spelled letters, forming the address in
// its head and passing it to collect_shipment_details. On retest 3 Tony spelled P-P-R-D-K-T four
// separate times and got ZERO capture: nothing in the system ever assembled the letters he said.
// This module assembles them at the system level instead. Every caller transcript line the bridge
// posts is fed through here (voice-tools, action "transcript"); letter tokens accumulate across
// turns in the session intake (_email_asm) and, once an address completes, it becomes
// _email_candidate — which collect_shipment_details treats as ground truth (a caller-spelled
// letter outranks a model-heard word). The send-side read-back gate (tools.js emailGate) is
// unchanged: assembly decides WHAT the address is, the gate still proves the caller confirmed it.
//
// Deliberately conservative: a turn only counts as spelling when its content words are almost all
// letter-words / NATO words / digits / "at" / "dot" (ordinary sentences are vetoed by pronoun and
// question words), so normal conversation can never leak into an address. Corrections the caller
// speaks are applied as spoken: "scratch that" pops a letter, "the last letter is T" replaces the
// last one, "add a T at the end" appends, "spell it again / start over" resets.
// State is plain JSON (buffers as strings) so it rides in the session intake row.
const NATO = { alpha: "a", alfa: "a", bravo: "b", charlie: "c", delta: "d", echo: "e", foxtrot: "f", golf: "g", hotel: "h", india: "i", juliett: "j", juliet: "j", kilo: "k", lima: "l", mike: "m", november: "n", oscar: "o", papa: "p", quebec: "q", romeo: "r", sierra: "s", tango: "t", uniform: "u", victor: "v", whiskey: "w", whisky: "w", xray: "x", yankee: "y", zulu: "z" };
const WORD = { bee: "b", cee: "c", see: "c", dee: "d", ee: "e", eff: "f", gee: "g", aitch: "h", eye: "i", jay: "j", kay: "k", el: "l", em: "m", en: "n", oh: "o", pee: "p", cue: "q", queue: "q", are: "r", ess: "s", tee: "t", tea: "t", you: "u", vee: "v", ex: "x", why: "y", zee: "z", zed: "z" };
const DIGITS = { zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9" };
const PROVIDERS = { gmail: 1, yahoo: 1, outlook: 1, icloud: 1, hotmail: 1, protonmail: 1, proton: 1, aol: 1, msn: 1, gmx: 1, yandex: 1, mail: 1, live: 1 };
const TLDS = { com: 1, net: 1, org: 1, edu: 1, gov: 1, io: 1, co: 1, us: 1, biz: 1, info: 1, me: 1 };
const FILLER = { um: 1, uh: 1, er: 1, and: 1, then: 1, it: 1, is: 1, the: 1, a: 1, an: 1, my: 1, email: 1, address: 1, that: 1, spelled: 1, spell: 1, goes: 1, like: 1, with: 1, in: 1, as: 1, s: 1 };
// Ordinary-sentence words that veto a spelling reading outright (a spelling turn never contains
// them once "X as in <word>" examples are neutralized). Single letters are never vetoed.
const VETO = { you: 1, we: 1, they: 1, them: 1, your: 1, yours: 1, our: 1, their: 1, this: 1, there: 1, here: 1, what: 1, where: 1, when: 1, how: 1, can: 1, could: 1, would: 1, should: 1, will: 1, please: 1, thank: 1, thanks: 1, yes: 1, yeah: 1, nope: 1, okay: 1, ok: 1, sure: 1, well: 1, now: 1, today: 1, tomorrow: 1, need: 1, want: 1, got: 1, get: 1, have: 1, has: 1, was: 1, were: 1, been: 1, not: 1, don: 1, just: 1, right: 1, about: 1, from: 1, for: 1, but: 1, if: 1, so: 1, do: 1, does: 1, did: 1 };

function fresh() { return { l: "", d: "", t: "", ph: 0, started: false }; }
function norm(st) { const s = st && typeof st === "object" ? st : {}; return { l: String(s.l || ""), d: String(s.d || ""), t: String(s.t || ""), ph: [0, 1, 2].indexOf(s.ph) >= 0 ? s.ph : 0, started: !!s.started }; }
function emailOf(st) {
  st = norm(st);
  if (st.ph !== 2 || st.l.length < 1 || st.d.length < 1 || st.t.length < 2) return null;
  const e = st.l + "@" + st.d + "." + st.t;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}
// Read-back form: local part letter by letter; a known provider/TLD spoken as the word it is.
function spellOut(email) {
  const m = String(email || "").match(/^([^@]+)@([^.]+)\.(.+)$/); if (!m) return String(email || "");
  const dom = PROVIDERS[m[2]] ? m[2] : m[2].split("").join(" "), tld = TLDS[m[3]] ? m[3] : m[3].split("").join(" ");
  return m[1].split("").join(" ") + " at " + dom + " dot " + tld;
}
// Parse one caller turn. Returns null unless the turn reads as spelling (see header); otherwise
// { tokens, restart, pop, addEnd, lastIs } — tokens are { ch } letters/digits, { at }, { dot },
// { provider } or { tld } in spoken order.
function parseTurn(text) {
  let t = String(text || "").toLowerCase(); if (!t.trim()) return null;
  const out = { tokens: [], restart: false, pop: false, addEnd: null, lastIs: null };
  if (/\b(spell|say|start) (it |that )?(again|over)\b/.test(t) || /\bfrom the (top|beginning)\b/.test(t) || /\bstart(ing)? over\b/.test(t)) out.restart = true;
  let m = t.match(/\b(?:add|plus)\s+(?:an?\s+|the\s+)?([a-z0-9])\b[^.!?]{0,24}?\b(?:at|on) the end\b/) || t.match(/\band\s+(?:an?\s+)?([a-z0-9])\s+(?:at|on) the end\b/); if (m) out.addEnd = m[1];
  m = t.match(/\b(?:the\s+)?last letter is\s+([a-z])\b/) || t.match(/\bends?\s+with\s+(?:an?\s+)?([a-z])\b/); if (m) out.lastIs = m[1];
  if (/\bscratch that\b|\bstrike that\b|\bno wait\b/.test(t)) out.pop = true;
  // Correction phrases are commands, not spelling: strip them from the token stream so their
  // ordinary words ("that", "last", "end") cannot veto or pollute the letter sequence.
  t = t.replace(/\b(?:the\s+)?last letter is\s+[a-z]\b/g, " ").replace(/\bends?\s+with\s+(?:an?\s+)?[a-z]\b/g, " ")
    .replace(/\b(?:add|plus)\s+(?:an?\s+|the\s+)?[a-z0-9]\b[^.!?]{0,24}?\b(?:at|on) the end\b/g, " ").replace(/\band\s+(?:an?\s+)?[a-z0-9]\s+(?:at|on) the end\b/g, " ")
    .replace(/\bscratch that\b|\bstrike that\b|\bno wait\b/g, " ");
  t = t.replace(/([a-z])\s+as\s+in\s+[a-z]+/g, "$1");           // "P as in Peter" is the letter P, once
  t = t.replace(/x[\s-]ray/g, "xray").replace(/double[\s-]?u\b/g, "doubleu");
  const words = t.replace(/@/g, " at ").replace(/[^a-z0-9.\s]/g, " ").split(/[\s.]+/).filter(Boolean);
  let letters = 0, mapped = 0, unmapped = 0, structured = 0;
  for (let w of words) {
    if (w === "doubleu") w = "w";
    if (VETO[w]) return null;
    if (FILLER[w]) continue;
    if (NATO[w] || WORD[w]) { out.tokens.push({ ch: NATO[w] || WORD[w] }); letters++; mapped++; continue; }
    if (/^[a-z]$/.test(w)) { out.tokens.push({ ch: w }); letters++; mapped++; continue; }
    if (/^\d$/.test(w) || DIGITS[w]) { out.tokens.push({ ch: DIGITS[w] || w }); letters++; mapped++; continue; }
    if (w === "at") { out.tokens.push({ at: true }); structured++; mapped++; continue; }
    if (w === "dot") { out.tokens.push({ dot: true }); structured++; mapped++; continue; }
    if (PROVIDERS[w]) { out.tokens.push({ provider: w }); structured++; mapped++; continue; }
    if (TLDS[w]) { out.tokens.push({ tld: w }); structured++; mapped++; continue; }
    unmapped++;
  }
  const content = mapped + unmapped;
  if (out.restart || out.pop || out.addEnd || out.lastIs) { out.letters = letters; out.structured = structured; return out; }   // a pure correction turn carries no letters and needs no ratio
  if (!content || mapped / content < 0.6) return null;
  if (!out.tokens.length) return null;
  out.letters = letters; out.structured = structured;
  return out;
}
function pushCh(st, ch) {
  if (st.ph === 0) { if (st.l.length < 64) st.l += ch; st.started = true; }
  else if (st.ph === 1) { if (st.d.length < 40) st.d += ch; }
  else if (st.t.length < 10) st.t += ch;
}
function popCh(st) {
  if (st.ph === 2 && st.t) { st.t = st.t.slice(0, -1); return; }
  if (st.ph >= 1 && st.d) { st.d = st.d.slice(0, -1); return; }
  if (st.l) st.l = st.l.slice(0, -1);
}
function setLast(st, ch) {
  if (st.ph === 0 || !st.d) { if (st.l) st.l = st.l.slice(0, -1) + ch; else pushCh(st, ch); return; }
  if (st.ph === 2 && st.t) { st.t = st.t.slice(0, -1) + ch; return; }
  if (st.d) st.d = st.d.slice(0, -1) + ch;
}
// Feed one caller line into the assembly. An assembly only STARTS on a turn carrying at least two
// spelled letters (a lone "at gmail dot com" can never start one); once started, continuation
// turns (the at-sign, the domain, a correction) apply with a single token.
function feed(state, text) {
  let st = norm(state);
  const p = parseTurn(text);
  if (!p) return { state: st, changed: false, email: emailOf(st) };
  if (!st.started && !p.restart && (p.letters || 0) < 2) return { state: st, changed: false, email: emailOf(st) };
  let changed = false;
  if (p.restart) { st = fresh(); changed = true; }
  if (p.pop) { popCh(st); changed = true; }
  p.tokens.forEach(function (tk) {
    changed = true;
    if (tk.ch) pushCh(st, tk.ch);
    else if (tk.at) { if (st.ph === 0) st.ph = 1; }
    else if (tk.dot) { if (st.ph === 1) st.ph = 2; else if (st.ph === 0) pushCh(st, "."); }
    else if (tk.provider) { if (st.ph >= 1) { st.d = tk.provider; if (st.ph === 0) st.ph = 1; } }
    else if (tk.tld) { if (st.ph === 2) st.t = tk.tld; }
  });
  if (p.addEnd) { // "add a T at the end": the end of the part still being spelled — the name part
    changed = true;                        // while no domain exists yet (Tony's retest-2/3 case), else the current part
    if (!st.d && st.ph === 0) st.l = (st.l + p.addEnd).slice(0, 64); else pushCh(st, p.addEnd);
  }
  if (p.lastIs) { setLast(st, p.lastIs); changed = true; }
  return { state: st, changed: changed, email: emailOf(st) };
}
module.exports = { parseTurn, feed, fresh, norm, emailOf, spellOut };
