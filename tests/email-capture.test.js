"use strict";
// Run: node tests/email-capture.test.js
// SPELLED-LETTER EMAIL ASSEMBLY (Nov 4, 2026 — announcement retest 3): Tony spelled P-P-R-D-K-T
// four separate times and the live model captured none of them; capture depended entirely on the
// model hearing letters, forming the address in its head, and typing it into a tool. The assembler
// is deterministic: it collects letter tokens from caller turns at the system level (fed from the
// transcript action), handles corrections, and produces the address — or stays silent on turns
// that are not spelling at all.
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); console.log("ok -", m); n++; };
const EC = require("../netlify/functions/lib/voice/email-capture");

{ // Tony's exact retest sequence: five letters, a correction adding the last one, then the domain
  let st = EC.fresh();
  let f = EC.feed(st, "P. P. R. D. K."); st = f.state;
  ok(f.changed && !f.email && EC.emailOf(st) === null, "five spelled letters start an assembly, no address yet");
  f = EC.feed(st, "add a T at the end"); st = f.state;
  ok(f.changed && !f.email, "'add a T at the end' appends to the name part being spelled");
  f = EC.feed(st, "at gmail dot com"); st = f.state;
  ok(f.email === "pprdkt@gmail.com", "the domain turn completes it: pprdkt@gmail.com — assembled, not model-formed");
}
{ // NATO words assemble the same address
  let st = EC.fresh(); let f = EC.feed(st, "Papa papa romeo delta kilo tango"); st = f.state;
  f = EC.feed(st, "at yahoo dot com"); st = f.state;
  ok(f.email === "pprdkt@yahoo.com", "NATO spelling assembles too (pprdkt@yahoo.com)");
}
{ // ASR letter-words (the way a transcriber renders spoken letters)
  let st = EC.fresh(); let f = EC.feed(st, "pee pee are dee kay tee"); st = f.state;
  f = EC.feed(st, "at gmail dot com"); st = f.state;
  ok(f.email === "pprdkt@gmail.com", "letter-words (pee, are, dee, kay, tee) assemble the same way");
}
{ // "X as in Peter" forms count once each
  let st = EC.fresh(); let f = EC.feed(st, "P as in Peter, P as in Peter, R as in Romeo"); st = f.state;
  ok(f.changed && !f.email, "'as in' anchors are neutralized — three letters, not eleven");
  f = EC.feed(st, "at gmail dot com"); st = f.state;
  ok(f.email === null || f.email === "ppr@gmail.com", "the assembly holds exactly the three letters given");
}
{ // corrections: scratch-that pops, last-letter replaces
  let st = EC.fresh(); let f = EC.feed(st, "p p r d j"); st = f.state;
  f = EC.feed(st, "scratch that"); st = f.state;
  f = EC.feed(st, "k t"); st = f.state;
  f = EC.feed(st, "the last letter is t"); st = f.state;
  f = EC.feed(st, "at gmail dot com"); st = f.state;
  ok(f.email === "pprdkt@gmail.com", "scratch-that + re-spell + 'last letter is T' still lands on pprdkt@gmail.com");
}
{ // ordinary speech NEVER starts or feeds an assembly
  for (const line of ["see you at five", "I need a truck at Peachtree tomorrow", "yes that is correct", "the pickup is at gmail street", "call me at five"]) {
    const f = EC.feed(EC.fresh(), line);
    ok(!f.changed && !f.email, "not spelling, not captured: \"" + line + "\"");
  }
  const f = EC.feed(EC.fresh(), "it is pprdkt at gmail dot com");
  ok(!f.email, "an address spoken as a WORD does not start an assembly (the model path owns those; a lone domain tail can never start one)");
}
{ // spelling restarts clean
  let st = EC.fresh(); let f = EC.feed(st, "p p r"); st = f.state;
  f = EC.feed(st, "no wait, start over"); st = f.state;
  f = EC.feed(st, "t t"); st = f.state;
  ok(!f.email, "start-over clears the buffer (two new letters, no address)");
  f = EC.feed(st, "at gmail dot com"); st = f.state;
  ok(f.email === "tt@gmail.com", "after a restart only the new letters assemble");
}
{ // the read-back form: letters spaced, known provider spoken as the word
  ok(EC.spellOut("pprdkt@gmail.com") === "p p r d k t at gmail dot com", "spellOut renders the read-back grouped for the ear");
  ok(EC.parseTurn("yes") === null && EC.parseTurn("") === null, "parseTurn stays silent on non-spelling turns");
}
console.log("email-capture:", n, "assertions passed");
