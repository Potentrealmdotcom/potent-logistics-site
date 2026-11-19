// netlify/functions/legit-ai.js — STAGED SCAFFOLD (G79 fold-in, Nov 18 2026). NOT YET DEPLOYED.
// To deploy: copy this file to netlify/functions/legit-ai.js. No other change needed.
// LEGIT's AI calls, in the same shape as estimate-load.js: POST JSON + Bearer LEGIT token, Gemini does the work.
// Actions:
//   { action:"photo_scan", image:<dataUrl> }      -> { ok, scan:{ filtered, ai_generated, heavy_edit, confidence, reason } }
//   { action:"photo_describe", image:<dataUrl> }  -> { ok, description }   (natural-language photo description for screen readers)
//   { action:"voice_transcribe", audio:<dataUrl> }-> { ok, transcript }    (voice intro transcription)
// Env: AUTH_SECRET (same one legit-api uses), GEMINI_API_KEY (free at aistudio.google.com). No keys are invented here:
// without GEMINI_API_KEY every action answers 503 and the app degrades honestly (photos stay scan:"pending").
var crypto = require("crypto");
function J(s, o) { return { statusCode: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(o) }; }
function b64u(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
// LEGIT tokens are HMAC'd with AUTH_SECRET + "|legit" (see lib/legit.js sign/verify). Replicated here so this
// function stays self-contained like estimate-load.js.
function verifyLegit(token) {
    if (!token || typeof token !== "string" || token.indexOf(".") < 0 || !process.env.AUTH_SECRET) return null;
    var p = token.split(".");
    var exp = b64u(crypto.createHmac("sha256", process.env.AUTH_SECRET + "|legit").update(p[0]).digest());
    var a = Buffer.from(p[1] || ""), b = Buffer.from(exp);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try { var d = JSON.parse(Buffer.from(p[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); return d.exp && d.exp >= Date.now() ? d : null; } catch (e) { return null; }
}
function dataPart(u, kinds) {
    var m = String(u || "").match(/^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!m || kinds.indexOf(m[1]) < 0) return null;
    return { inline_data: { mime_type: m[1], data: m[2] } };
}
async function gem(parts, json, maxTokens) {
    var key = process.env.GEMINI_API_KEY;
    if (!key) return { err: 503, msg: "AI is not switched on yet (GEMINI_API_KEY missing)." };
    try {
        var r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + (process.env.AI_MODEL || "gemini-flash-latest") + ":generateContent", {
            method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({ contents: [{ role: "user", parts: parts }], generationConfig: Object.assign({ temperature: 0.2, maxOutputTokens: maxTokens || 700 }, json ? { responseMimeType: "application/json" } : {}) })
        });
        if (!r.ok) return { err: 502, msg: r.status === 429 ? "The free AI is busy. Try again in a minute." : "The AI could not answer." };
        var d = await r.json();
        var txt = (((d.candidates || [])[0] || {}).content || { parts: [] }).parts.map(function (p) { return p.text || ""; }).join("").trim();
        if (!txt) return { err: 502, msg: "The AI had nothing." };
        if (!json) return { text: txt };
        try { return { json: JSON.parse(txt) }; } catch (e) { return { err: 502, msg: "The AI answer was unreadable. Try again." }; }
    } catch (e) { return { err: 502, msg: "Could not reach the AI." }; }
}

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") return J(405, { ok: false, error: "POST only" });
    if (!process.env.AUTH_SECRET) return J(500, { ok: false, error: "Server not configured" });
    var h = event.headers || {};
    if (!verifyLegit(String(h.authorization || h.Authorization || "").replace(/^Bearer\s+/i, ""))) return J(401, { ok: false, error: "Sign in again" });
    if ((event.body || "").length > 6000000) return J(413, { ok: false, error: "File too large." });
    var b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return J(400, { ok: false, error: "Bad request" }); }
    var a = String(b.action || "");

    if (a === "photo_scan") {
        var img = dataPart(b.image, ["image/jpeg", "image/png", "image/webp"]);
        if (!img) return J(400, { ok: false, error: "No usable photo. Use JPG or PNG." });
        var out = await gem([img, { text: "You screen dating-profile photos for LEGIT, an app whose rule is NO filtered photos. Judge ONLY the image treatment, never the person's attractiveness or identity. filtered = a social-media beauty filter is applied (skin smoothing/beauty mode, dog ears, face-distorting or face-slimming filter). ai_generated = the image appears AI-generated rather than a real camera photo. heavy_edit = heavy retouching (FaceTune-style reshaping, extreme skin blur) short of a named filter. Reply with ONLY JSON: {\"filtered\":false,\"ai_generated\":false,\"heavy_edit\":false,\"confidence\":\"low|medium|high\",\"reason\":\"one short sentence\"}" }], true, 300);
        if (out.err) return J(out.err, { ok: false, error: out.msg });
        var s = out.json || {};
        return J(200, { ok: true, scan: { filtered: !!s.filtered, ai_generated: !!s.ai_generated, heavy_edit: !!s.heavy_edit, confidence: ["low", "medium", "high"].indexOf(s.confidence) >= 0 ? s.confidence : "low", reason: String(s.reason || "").slice(0, 200) } });
    }
    if (a === "photo_describe") {
        var img2 = dataPart(b.image, ["image/jpeg", "image/png", "image/webp"]);
        if (!img2) return J(400, { ok: false, error: "No usable photo." });
        var out2 = await gem([img2, { text: "Describe this dating-profile photo in one or two natural sentences for a blind user listening with a screen reader. Cover: how many people, setting, clothing style, activity, and mood. Never guess the person's name, age, race, or identity, and never comment on attractiveness." }], false, 200);
        if (out2.err) return J(out2.err, { ok: false, error: out2.msg });
        return J(200, { ok: true, description: String(out2.text || "").slice(0, 400) });
    }
    if (a === "voice_transcribe") {
        var au = dataPart(b.audio, ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav"]);
        if (!au) return J(400, { ok: false, error: "No usable audio." });
        var out3 = await gem([au, { text: "Transcribe this short voice introduction exactly as spoken. Return ONLY the transcript text, no labels, no commentary. If there is no speech, return an empty string." }], false, 500);
        if (out3.err) return J(out3.err, { ok: false, error: out3.msg });
        return J(200, { ok: true, transcript: String(out3.text || "").slice(0, 1200) });
    }
    return J(400, { ok: false, error: "Unknown action" });
};
