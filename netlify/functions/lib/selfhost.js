// Glue for POTENT's own media server (see server-kit/): Jitsi room tokens, MediaMTX broadcast keys, MinIO upload links.
// Everything is off until the matching env vars exist, so the site works exactly as before without the server.
const crypto = require("crypto");
const b64u = function (b) { return Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const hmac = function (k, d, enc) { return crypto.createHmac("sha256", k).update(d).digest(enc); };
const env = function (k) { return String(process.env[k] || ""); };

function jitsiOn() { return !!(env("JITSI_DOMAIN") && env("JITSI_APP_SECRET")); }
// Room login: only people the app has already let into the session get one. Hosts moderate; nobody can record or livestream from Jitsi.
function jitsiToken(room, user, moderator, now) {
  const t = Math.floor((now || Date.now()) / 1000), head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({ aud: "jitsi", iss: env("JITSI_APP_ID") || "potent", sub: env("JITSI_DOMAIN"), room: room, nbf: t - 10, exp: t + 4 * 3600,
    context: { user: { id: String(user.id), name: String(user.name || "Guest").slice(0, 40), moderator: moderator ? "true" : "false" }, features: { recording: "false", livestreaming: "false", transcription: "false", "outbound-call": "false" } } }));
  return head + "." + body + "." + b64u(hmac(env("JITSI_APP_SECRET"), head + "." + body));
}

function liveOn() { return !!(env("LIVE_HOST") && env("AUTH_SECRET")); }
const bcPath = function (sid) { return "s-" + String(sid).toLowerCase(); };
const bcKey = function (path) { return hmac(env("AUTH_SECRET") + "|broadcast", "bc|" + path, "hex").slice(0, 32); };
// MediaMTX asks the site "may this connection publish/read?". Reads are open for session paths, publishing needs the host's key.
function mtxDecision(b) {
  if (!b || typeof b.action !== "string") return false;
  const path = String(b.path || "");
  if (!/^s-[0-9a-f-]{36}$/.test(path)) return false;
  if (b.action === "read" || b.action === "playback") return true;
  if (b.action === "publish") { const pw = String(b.password || ""), want = bcKey(path); return pw.length === want.length && crypto.timingSafeEqual(Buffer.from(pw), Buffer.from(want)); }
  return false;
}

function minioOn() { return !!(env("MINIO_ENDPOINT") && env("MINIO_ACCESS_KEY") && env("MINIO_SECRET_KEY")); }
const enc = function (s) { return encodeURIComponent(s).replace(/[!'()*]/g, function (c) { return "%" + c.charCodeAt(0).toString(16).toUpperCase(); }); };
// AWS Signature V4 query-string presign. opts: { method, host, path (already /bucket/key), access, secret, region, expires, now, signContentLength }
function presign(o) {
  const d = new Date(o.now || Date.now()), ymd = d.toISOString().replace(/[-:]/g, "").slice(0, 8), stamp = d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const scope = ymd + "/" + (o.region || "us-east-1") + "/s3/aws4_request", signed = o.signContentLength != null ? "content-length;host" : "host";
  const q = { "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": o.access + "/" + scope, "X-Amz-Date": stamp, "X-Amz-Expires": String(o.expires || 3600), "X-Amz-SignedHeaders": signed };
  const qs = Object.keys(q).sort().map(function (k) { return enc(k) + "=" + enc(q[k]); }).join("&");
  const cpath = o.path.split("/").map(function (s) { return enc(s); }).join("/");
  const headers = (o.signContentLength != null ? "content-length:" + o.signContentLength + "\n" : "") + "host:" + o.host + "\n";
  const creq = [o.method, cpath, qs, headers, signed, "UNSIGNED-PAYLOAD"].join("\n");
  const sts = ["AWS4-HMAC-SHA256", stamp, scope, crypto.createHash("sha256").update(creq).digest("hex")].join("\n");
  let k = hmac("AWS4" + o.secret, ymd); k = hmac(k, o.region || "us-east-1"); k = hmac(k, "s3"); k = hmac(k, "aws4_request");
  return { query: qs + "&X-Amz-Signature=" + hmac(k, sts, "hex"), path: cpath, signature: hmac(k, sts, "hex") };
}
// A time-limited upload link for one video of an exact size, plus the public link it will have afterwards.
function videoUpload(key, bytes) {
  const ep = new URL(env("MINIO_ENDPOINT")), bucket = env("MINIO_BUCKET") || "videos";
  const p = presign({ method: "PUT", host: ep.host, path: "/" + bucket + "/" + key, access: env("MINIO_ACCESS_KEY"), secret: env("MINIO_SECRET_KEY"), expires: 3600, signContentLength: bytes });
  return { uploadUrl: ep.origin + p.path + "?" + p.query, publicUrl: ep.origin + "/" + bucket + "/" + key.split("/").map(enc).join("/") };
}
module.exports = { jitsiOn, jitsiToken, liveOn, bcPath, bcKey, mtxDecision, minioOn, presign, videoUpload, MAX_VIDEO: 2 * 1024 * 1024 * 1024 };
