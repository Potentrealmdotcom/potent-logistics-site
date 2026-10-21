// One place to call Gemini's OpenAI-compatible chat endpoint. Netlify functions stop at about 10 seconds, so every call here has its own
// shorter timeout (a clear message beats a platform "Server error"), asks the model for LOW thinking (faster answers), and quietly retries
// without that hint if Gemini rejects it.
const URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
async function chat(body, opts) {
  opts = opts || {}; const f = opts.fetchImpl || fetch, ms = opts.timeoutMs || 8000, key = process.env.GEMINI_API_KEY;
  const go = function (b) { return f(URL, { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: JSON.stringify(b), signal: AbortSignal.timeout(ms) }); };
  let r = await go(Object.assign({ reasoning_effort: "low" }, body));
  if (r.status === 400) r = await go(body);
  return r;
}
module.exports = { chat, URL };
