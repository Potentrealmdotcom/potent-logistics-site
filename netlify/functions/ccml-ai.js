// POST { report }  + Bearer token (paid members only). Runs the credit-report analyzer on the server with POTENT's OpenAI key.
const C = require("./lib/ccml");
const hits = {};

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return C.J(405, { ok: false });
  const user = await C.userFromEvent(event);
  if (!user) return C.J(401, { ok: false, error: "Sign in again" });
  const prof = await C.profileById(user.id);
  if (!prof || (C.RANK[prof.plan] || 0) < 1) return C.J(402, { ok: false, error: "Unlock the course first" });
  if (!process.env.OPENAI_API_KEY) return C.J(503, { ok: false, error: "The analyzer is not turned on yet." });
  const k = user.id + ":" + new Date().toISOString().slice(0, 10);
  hits[k] = (hits[k] || 0) + 1;
  if (hits[k] > 20) return C.J(429, { ok: false, error: "Daily analyzer limit reached." });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return C.J(400, { ok: false }); }
  const report = String(b.report || "").slice(0, 12000);
  if (report.trim().length < 20) return C.J(400, { ok: false, error: "Paste more of the report." });
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.CCML_AI_MODEL || "gpt-4o-mini", temperature: 0.2, max_tokens: 900, messages: [
        { role: "system", content: "You help a person organize a credit dispute. This is educational information, not legal advice, and no outcome is guaranteed. Be concise and specific." },
        { role: "user", content: "Analyze this credit report and identify: 1) Each negative item, 2) Best letter type (FCRA Fraudulent Removal, Payment History, Trademark Infringement, MOV Demand, Secondary Notice), 3) Priority order and why. Be concise and specific.\n\nReport:\n" + report }
      ] })
    });
    if (!r.ok) return C.J(502, { ok: false, error: "The analyzer is busy. Try again." });
    const d = await r.json();
    const text = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
    return text ? C.J(200, { ok: true, text: text }) : C.J(502, { ok: false, error: "No answer. Try again." });
  } catch (e) { return C.J(502, { ok: false, error: "The analyzer is busy. Try again." }); }
};
