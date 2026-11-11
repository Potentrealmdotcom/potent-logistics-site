// Runs every 15 minutes. If any language still lacks phrases from /lang/phrases.json, starts the background translation job.
// When everything is complete it does one cheap check and stops, so it costs nothing afterwards.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const C = require("./lib/translate-core.js");
export default async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return new Response("no key");
  const base = process.env.URL || "https://potentoperations.netlify.app";
  const pr = await fetch(base + "/lang/phrases.json?" + Date.now()); if (!pr.ok) return new Response("no phrases");
  const phrases = await pr.json(), total = phrases.length, below = [];
  for (const l of Object.keys(C.LANGS)) {
    const q = await C.sb("ui_packs?lang=eq." + l + "&select=n"); const n = q.ok && q.data && q.data[0] ? q.data[0].n : 0;
    if (!C.isComplete(n, total)) below.push({ lang: l, n: n });          // a few untranslatable strings are expected; 99.5% counts as complete — the shared bar in translate-core
  }
  if (!below.length) return new Response("complete");
  // ZERO-GAIN BACKOFF, enforced HERE too (egress fix, Nov 11 2026): if every incomplete language
  // gained nothing on its last attempt and is still inside its 24h wait (the shared gate in
  // translate-core — the background job applies the identical rule), do not even start the job:
  // a launch would burn its run bookkeeping and count checks every 15 minutes for nothing.
  // The pack count stands in for the stored count — the pack is built from the stored rows and
  // the Nov 11 fingerprint verified the two are equal for all 13 languages. If the log cannot
  // be read, fall through and start the job (the old behaviour) rather than stall translations.
  let allBackoff = true;
  for (const b of below) {
    let bo = false;
    try { bo = await C.zeroGainBackoff(b.lang, b.n, phrases); } catch (e) { bo = false; }
    if (!bo) { allBackoff = false; break; }
  }
  if (allBackoff) return new Response("backoff");
  const r = await fetch(base + "/.netlify/functions/translate-packs-background", { method: "POST", headers: { "x-pack-key": C.packKey() } });
  return new Response("started " + r.status);
};
export const config = { schedule: "*/15 * * * *" };
