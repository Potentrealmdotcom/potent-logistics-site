// Free translation via MyMemory (no API key needed for basic use).
// Expects: { lang: "es", phrases: ["Hello", "World"] }
// Returns: { t: { "Hello": "Hola", "World": "Mundo" } }
// The app caches results client-side, so repeat phrases don't re-hit the API.
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }
  var body;
  try { body = JSON.parse(event.body || "{}"); }
  catch (e) { return { statusCode: 400, body: "Bad JSON" }; }

  var lang = (body.lang || "").toLowerCase().slice(0, 5);
  var phrases = Array.isArray(body.phrases) ? body.phrases.slice(0, 60) : [];
  if (!lang || lang === "en" || !phrases.length) {
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: {} }) };
  }

  var out = {};
  // MyMemory free endpoint: 5000 chars/day anonymous, 50000/day with free key.
  // Optional: set MYMEMORY_EMAIL env var for the higher free quota.
  var email = process.env.MYMEMORY_EMAIL ? "&de=" + encodeURIComponent(process.env.MYMEMORY_EMAIL) : "";
  for (var i = 0; i < phrases.length; i++) {
    var p = String(phrases[i] || "").slice(0, 500);
    if (!p) continue;
    try {
      var url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(p) + "&langpair=en|" + encodeURIComponent(lang) + email;
      var res = await fetch(url);
      var data = await res.json();
      var t = data && data.responseData && data.responseData.translatedText;
      // MyMemory returns the query back on failure or quota errors — skip those.
      if (t && t !== p && !/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(t)) {
        out[p] = t;
      }
    } catch (e) { /* leave untranslated, client marks as miss */ }
  }
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: out }) };
};
