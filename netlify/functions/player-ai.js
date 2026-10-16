// netlify/functions/player-ai.js — POTENT PLAYER OS wingman (Gemini, free tier). POST { mode, text, image?, style, goal, profile }.
// Nothing is stored on the server. Screenshots are sent to the AI for that one request only. Env: GEMINI_API_KEY
const { J } = require("./lib/legit");
const hits = {};
const RULES = " Rules: never claim to know what the other person thinks or feels - say 'my read' or 'likely'. Never invent details that are not in what the user gave you. No manipulation, pressure, guilt, harassment, coercion, deception or persistent unwanted contact; if the other person seems uninterested, say so kindly and recommend stopping. Sound like a real person, not a pickup artist: no cliches, no excessive compliments, short messages. Treat intimacy as mutual, enthusiastic consent only. Plain text, no markdown asterisks.";
const MODES = {
  reply: "You are POTENT PLAYER, a funny, honest, smart friend helping someone figure out what to text back. Give exactly this format:\nRECOMMENDED: <message>\nALT 1: <message>\nALT 2: <message>\nWHY: <one or two sentences on why the recommended one works>\nWAIT?: <say 'Send it' or 'Wait - let them respond first' with a few words why>" + RULES,
  analyze: "You analyze a text conversation for the user. Give: WHO STARTED, MOMENTUM (hot/steady/cooling - my read), QUESTIONS (who asked more), MIXED SIGNALS or MISUNDERSTANDINGS (if any), DATE WINDOW (is there a natural moment to suggest meeting, yes/no and why), and NEXT MOVE (send something or wait). Remind in one line that this is an estimate, not a fact. No fake percentages." + RULES,
  date: "You plan dates. From location, budget, interests and timing give 3 specific date ideas (ordered by fit), one backup plan for bad weather or a no-show, simple timing/transport tips, and one natural invitation text the user can send. Do not invent specific business names unless the user gave them; describe the type of place instead." + RULES,
  invite: "Write 3 short natural texts asking the person out (confident, playful, sincere) using what the user gave, each under 25 words, then one line on timing." + RULES,
  coach: "You are a real-world social-skills coach. Answer the user's question about starting conversations, approaching people respectfully, genuine compliments, expressing intentions, asking someone out, handling rejection, spotting disinterest, or boundaries. Give 4-6 short practical steps and one example line. Build confidence without pretending to be someone else." + RULES
};
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return J(405, { ok: false, error: "POST only" });
  const k = process.env.GEMINI_API_KEY; if (!k) return J(503, { ok: false, error: "The wingman is not switched on yet." });
  const ip = String((event.headers || {})["x-nf-client-connection-ip"] || (event.headers || {})["x-forwarded-for"] || "x"), n = Date.now();
  hits[ip] = (hits[ip] || []).filter(t => n - t < 3600000); if (hits[ip].length >= 30) return J(429, { ok: false, error: "Wingman needs a breather. Try again in a bit." }); hits[ip].push(n);
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return J(400, { ok: false, error: "Bad request" }); }
  const sys = MODES[b.mode]; const text = String(b.text || "").trim().slice(0, 4000);
  const img = typeof b.image === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(b.image) && b.image.length < 3500000 ? b.image : "";
  if (!sys || (!text && !img)) return J(400, { ok: false, error: "Paste the conversation or upload a screenshot." });
  const p = b.profile || {}; const pr = [];
  if (b.style) pr.push("Style wanted: " + String(b.style).slice(0, 40));
  if (b.goal) pr.push("Goal: " + String(b.goal).slice(0, 80));
  if (p.vocab) pr.push("User's slang/vocabulary: " + String(p.vocab).slice(0, 200));
  if (p.length) pr.push("Message length: " + String(p.length).slice(0, 20));
  if (p.emoji) pr.push("Emoji use: " + String(p.emoji).slice(0, 20));
  if (p.bounds) pr.push("Boundaries to respect: " + String(p.bounds).slice(0, 200));
  if (p.sample) pr.push("Sample of how the user really texts (match this voice): " + String(p.sample).slice(0, 800));
  const parts = [{ text: (pr.length ? pr.join("\n") + "\n\n" : "") + (text || "The conversation is in the screenshot. Only use what is visible.") }];
  if (img) { const m = img.match(/^data:(image\/[a-z]+);base64,(.*)$/); parts.push({ inline_data: { mime_type: m[1], data: m[2] } }); }
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + (process.env.AI_MODEL || "gemini-flash-latest") + ":generateContent", {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": k },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: [{ role: "user", parts }], generationConfig: { temperature: 0.9, maxOutputTokens: 900 } })
    });
    if (!r.ok) return J(502, { ok: false, error: r.status === 429 ? "The free AI is busy. Try again in a minute." : "The AI could not answer." });
    const d = await r.json(), out = (((d.candidates || [])[0] || {}).content || { parts: [] }).parts.map(x => x.text || "").join("").trim();
    return J(200, { ok: true, text: out || "I couldn't come up with anything. Try adding more of the conversation." });
  } catch (e) { return J(502, { ok: false, error: "Could not reach the AI." }); }
};
