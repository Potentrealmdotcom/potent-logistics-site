// Run: node tests/selfhost.test.js  (own-server helpers: AWS SigV4 against AWS's published vector, Jitsi token, upload links)
process.env.AUTH_SECRET = "t";
const assert = require("assert"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const S = require("../netlify/functions/lib/selfhost.js");
const v = S.presign({ method: "GET", host: "examplebucket.s3.amazonaws.com", path: "/test.txt", access: "AKIAIOSFODNN7EXAMPLE", secret: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", region: "us-east-1", expires: 86400, now: Date.UTC(2013, 4, 24) });
ok(v.signature === "aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404", "SigV4 matches AWS's official example");
ok(!S.minioOn() && !S.jitsiOn() && !S.liveOn(), "everything off without env");
process.env.MINIO_ENDPOINT = "https://files.example.test"; process.env.MINIO_ACCESS_KEY = "ak"; process.env.MINIO_SECRET_KEY = "sk";
const u = S.videoUpload("prod1/1-my video.mp4", 123456);
ok(/^https:\/\/files\.example\.test\/videos\/prod1\/1-my%20video\.mp4\?/.test(u.uploadUrl) && /X-Amz-SignedHeaders=content-length%3Bhost/.test(u.uploadUrl) && /X-Amz-Signature=[0-9a-f]{64}/.test(u.uploadUrl), "upload link signed for exact size");
ok(u.publicUrl === "https://files.example.test/videos/prod1/1-my%20video.mp4", "public link");
const u2 = S.videoUpload("prod1/1-my video.mp4", 123457); ok(u.uploadUrl.split("Signature=")[1] !== u2.uploadUrl.split("Signature=")[1], "size is part of the signature");
ok(S.MAX_VIDEO === 2147483648, "2 GB cap");
console.log("PASS: " + n + " assertions");
