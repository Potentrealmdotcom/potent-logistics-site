// netlify/functions/life-ai.js — the free AI behind LIFE OS (Gemini). POST { mode, text, context }.
// No login needed (LIFE OS keeps data on the person's own device), so it is rate-limited per visitor. Env: GEMINI_API_KEY
const { J } = require("./lib/legit");
const hits = {};
const MODES = {
  operator: "You are LIFE OS, a practical personal operator. The person tells you what they need done. Reply with a short numbered plan (max 7 steps), what you can draft for them right now, and what needs their approval. Plain words. Never claim you already did something you cannot do. Never ask for passwords or card numbers.",
  negotiate: "You write short scripts and letters to lower a bill, cancel a subscription, or request a refund. Give: 1) a 3-sentence phone script, 2) a ready-to-send email/letter, 3) one fallback if they say no. Polite, firm, specific to the details given. No made-up account numbers.",
  income: "You are an income coach. Given skills, time and place, list 5 realistic ways to earn money soon, ranked by speed to first dollar. For each: what to do this week, a realistic first-month range stated as an estimate, and a one-line message they could send. Honest, no get-rich promises.",
  apply: "You write a short, human job application or outreach message from the details given (max 150 words), plus a 2-line follow-up to send in 3 days. No fake credentials.",
  meals: "You plan family meals. Given household size, budget, allergies and preferences, produce a 5-day dinner plan with a combined grocery list grouped by aisle. Respect allergies strictly and say when to double-check labels.",
  quote: "You are the digital office assistant for a small service business. From the details given, draft the requested item (quote, invoice text, lead follow-up, or customer reply). Professional, brief, with clear price lines when numbers are given. Never invent prices; use only what is provided."
};
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return J(405, { ok: false, error: "POST only" });
  const k = process.env.GEMINI_API_KEY; if (!k) return J(503, { ok: false, error: "The AI is not switched on yet." });
  const ip = String((event.headers || {})["x-nf-client-connection-ip"] || (event.headers || {})["x-forwarded-for"] || "x"), n = Date.now();
  hits[ip] = (hits[ip] || []).filter(t => n - t < 3600000); if (hits[ip].length >= 40) return J(429, { ok: false, error: "That's a lot of questions this hour. Try again later." }); hits[ip].push(n);
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return J(400, { ok: false, error: "Bad request" }); }
  const sys = MODES[b.mode]; const text = String(b.text || "").trim().slice(0, 3000);
  if (!sys || !text) return J(400, { ok: false, error: "Tell me what you need." });
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + (process.env.AI_MODEL || "gemini-flash-latest") + ":generateContent", {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": k },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: [{ role: "user", parts: [{ text: (b.context ? "Context: " + String(b.context).slice(0, 2000) + "\n\n" : "") + text }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 1200 } }) });
    if (!r.ok) return J(502, { ok: false, error: r.status === 429 ? "The free AI is busy. Try again in a minute." : "The AI could not answer." });
    const d = await r.json(), out = (((d.candidates || [])[0] || {}).content || { parts: [] }).parts.map(p => p.text || "").join("").trim();
    return J(200, { ok: true, text: out || "I couldn't come up with an answer. Try rephrasing." });
  } catch (e) { return J(502, { ok: false, error: "Could not reach the AI." }); }
};
