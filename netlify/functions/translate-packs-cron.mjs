// Runs every 15 minutes. If any language still lacks phrases from /lang/phrases.json, starts the background translation job.
// When everything is complete it does one cheap check and stops, so it costs nothing afterwards.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const C = require("./lib/translate-core.js");
export default async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return new Response("no key");
  const base = process.env.URL || "https://potentoperations.netlify.app";
  const pr = await fetch(base + "/lang/phrases.json?" + Date.now()); if (!pr.ok) return new Response("no phrases");
  const total = (await pr.json()).length; let need = false;
  for (const l of Object.keys(C.LANGS)) {
    const q = await C.sb("ui_packs?lang=eq." + l + "&select=n"); const n = q.ok && q.data && q.data[0] ? q.data[0].n : 0;
    if (n < total * 0.995) { need = true; break; }          // a few untranslatable strings are expected; 99.5% counts as complete
  }
  if (!need) return new Response("complete");
  const r = await fetch(base + "/.netlify/functions/translate-packs-background", { method: "POST", headers: { "x-pack-key": C.packKey() } });
  return new Response("started " + r.status);
};
export const config = { schedule: "*/15 * * * *" };
