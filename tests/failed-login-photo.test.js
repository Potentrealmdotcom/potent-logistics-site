// Run: node tests/quill-failed-photo.test.js  (owner order Oct 22: a WRONG password on any staff account takes a photo for the log; Quill's successful logins and the decoy trap are unchanged)
const assert = require("assert"), fs = require("fs"); let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const src = fs.readFileSync(__dirname + "/../app.js", "utf8");
const a = src.indexOf("function captureFailedLoginPhoto()"), b = src.indexOf("function logLoginToSupabase(");
ok(a > 0 && b > a, "the failed-Quill capture helper exists");
const helper = src.slice(a, b);
const go = src.slice(src.indexOf("    function go() {"), src.indexOf("    var selectedUser = USERS.find"));
const okBranch = go.slice(go.indexOf("if (user && authRes && authRes.ok) {"), go.indexOf("else {", go.indexOf("if (user && authRes && authRes.ok) {")));
ok(/captureFailedLoginPhoto\(\)\.then\(function \(shot\) \{ logLoginToSupabase\("Failed Login Attempt", failedName, getDeviceInfo\(\), shot \|\| photoUrl\)/.test(go) && !/isQuill \? captureFailedLoginPhoto/.test(go), "a failed attempt on ANY account logs a freshly captured photo");
ok(/if \(!isQuill\) logLoginToSupabase\("Login"/.test(okBranch) && /logLoginToSupabase\("Login", name/.test(okBranch), "other accounts' successful logins are unchanged");
ok(/\(isQuill \? Promise\.resolve\(null\) : capturePhoto\(\)\)/.test(go), "Quill still does NOT open the camera before the password check");
ok(!/captureFailedLoginPhoto|capturePhoto/.test(okBranch) && /if \(!isQuill\) logLoginToSupabase\("Login"/.test(okBranch) && /if \(!isQuill\) alertLoginEmail/.test(okBranch), "Quill's SUCCESSFUL login: no camera, no photo, no log row, no email (unchanged)");
ok(/if \(!isQuill\) alertLoginEmail\(\s*\/\/ ?|if \(!isQuill\) alertLoginEmail\(   \/\/ the Quill assistant/.test(go), "Quill's failed attempts are still not emailed");
ok(/captureMultiplePhotos\(3, 4000\), recordDecoyAudio\(12000\)/.test(go) && /logDecoyToSupabase\(decoyName, decoyDevice, photoUrls, audioUrl\)/.test(go), "the decoy trap is untouched");
ok(!/captureFailedLoginPhoto/.test(src.slice(src.indexOf("if (isDecoyPassword(pw))"), src.indexOf("var isQuill = selected"))), "the decoy path does not use the new helper");
// behaviour of the helper itself, with a fake camera
const mk = (cam) => { const stops = []; const env = { stops, uploads: 0 };
  const navigator = { mediaDevices: cam ? { getUserMedia: async () => ({ getTracks: () => [{ stop: () => stops.push(1) }] }) } : (cam === false ? undefined : { getUserMedia: async () => { throw new Error("denied"); } }) };
  const document = { createElement: t => t === "video" ? { play: () => Promise.resolve(), readyState: 4 } : { getContext: () => ({ drawImage() {} }), toBlob: cb => cb({}) } };
  const uploadLoginPhoto = async () => { env.uploads++; return "https://x/login-photos/p.jpg"; };
  env.run = new Function("navigator", "document", "uploadLoginPhoto", "setTimeout", "setInterval", "clearInterval", helper + "; return captureFailedLoginPhoto();").bind(null, navigator, document, uploadLoginPhoto, setTimeout, setInterval, clearInterval);
  return env; };
(async () => {
  let e = mk(true), r = await e.run(); ok(r === "https://x/login-photos/p.jpg" && e.uploads === 1 && e.stops.length === 1, "camera opens, one photo uploaded, camera closed again");
  e = mk(null); r = await e.run(); ok(r === null && e.uploads === 0, "camera refused -> no photo, no crash (the log row is still written)");
  e = mk(false); r = await e.run(); ok(r === null, "no camera on the device -> no photo, no crash");
  console.log("PASS: " + n + " assertions");
})().catch(x => { console.error(x); process.exit(1); });
