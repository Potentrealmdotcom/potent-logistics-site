// lib/google.js — "Continue with Google" for every POTENT platform.
//
// The browser gets a Google ID token (a signed proof of "this person controls this Gmail").
// We never trust the browser's word for it: the token is checked here, on the server, with Google.
//
// Setup (once): Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID
//   → Web application → add every site address under "Authorized JavaScript origins".
//   Put the Client ID in Netlify as GOOGLE_CLIENT_ID. No client secret is needed for this flow.
//
// What it proves: that the Gmail address is real, verified by Google, and belongs to the person
// signing in. What it does NOT do: grant any role. Each platform decides what an email may become:
//   customers / buyers   → account is created on first sign-in
//   company staff        → only an email the company owner has ALREADY added (never created here)
//   POTENT owner/staff   → not allowed with Google; the owner login stays password-only
var crypto = require("crypto");

var CLIENT_ID = function () { return String(process.env.GOOGLE_CLIENT_ID || "").trim(); };
var ISS = ["accounts.google.com", "https://accounts.google.com"];

function configured() { return !!CLIENT_ID(); }

// Verify an ID token with Google. Returns { ok:true, email, name, sub, picture } or { ok:false, error }.
// `fetchImpl` is injectable so tests never call the network.
async function verifyIdToken(idToken, fetchImpl) {
    var f = fetchImpl || fetch;
    if (!configured()) return { ok: false, error: "Google sign-in is not turned on yet." };
    if (typeof idToken !== "string" || idToken.length < 100 || idToken.length > 4096 || idToken.split(".").length !== 3) {
        return { ok: false, error: "Google sign-in failed. Try again." };
    }
    var d;
    try {
        var r = await f("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken));
        if (!r.ok) return { ok: false, error: "Google did not accept that sign-in. Try again." };
        d = await r.json();
    } catch (e) { return { ok: false, error: "Could not reach Google. Try again." }; }
    if (!d || String(d.aud || "") !== CLIENT_ID()) return { ok: false, error: "Google sign-in failed." };      // token was minted for someone else's app
    if (ISS.indexOf(String(d.iss || "")) < 0) return { ok: false, error: "Google sign-in failed." };
    if (!(Number(d.exp) * 1000 > Date.now())) return { ok: false, error: "That Google sign-in expired. Try again." };
    if (!(d.email_verified === true || d.email_verified === "true")) return { ok: false, error: "That Google account's email is not verified." };
    var email = String(d.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !d.sub) return { ok: false, error: "Google sign-in failed." };
    return { ok: true, email: email, name: String(d.name || "").slice(0, 80), sub: String(d.sub), picture: d.picture || null };
}

// A password nobody can ever type: Google-created accounts get this so the password path stays closed
// (an attacker cannot "sign in with a blank/legacy password" to a Google-made account).
function lockedPasswordHash(hashPw) {
    return hashPw(crypto.randomBytes(32).toString("hex"));
}

module.exports = { configured: configured, verifyIdToken: verifyIdToken, lockedPasswordHash: lockedPasswordHash, clientId: CLIENT_ID };
