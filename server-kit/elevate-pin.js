#!/usr/bin/env node
// Makes the ELEVATE_PIN_HASH value for Netlify. Run:  node server-kit/elevate-pin.js
// Type a 6-digit PIN when asked (it is not shown). Paste ONLY the printed hash into Netlify. Never write the PIN anywhere.
const readline = require("readline"), P = require("../netlify/functions/lib/elevate-phone");
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
rl._writeToOutput = function (s) { if (s.indexOf("Choose") === 0) process.stdout.write(s); };
rl.question("Choose a 6-digit PIN (hidden): ", function (pin) {
  rl.close(); process.stdout.write("\n");
  if (!/^\d{6}$/.test(pin)) { console.error("The PIN must be exactly 6 digits."); process.exit(1); }
  if (/^(\d)\1{5}$/.test(pin) || "0123456789012".indexOf(pin) >= 0 || "9876543210987".indexOf(pin) >= 0) { console.error("Too easy to guess. Pick a less obvious PIN."); process.exit(1); }
  console.log("ELEVATE_PIN_HASH=" + P.hashPin(pin));
});
