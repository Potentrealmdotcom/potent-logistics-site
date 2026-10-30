// Run: node tests/voice-ui.test.js  (POTENT VOICE Control Center UI: drives the REAL inline script
// from voice/index.html in a vm with a minimal DOM stub. Regression for the "Cancel does nothing"
// bug: the old handler gated on the native confirm() dialog as its first statement; where a dialog
// is silently suppressed (automation, dialog policy), confirm() returns false with no trace and the
// click dies before any request. The fix confirms INLINE via armTap (tap-again). These tests rig
// confirm() to throw if the page ever calls it, proving the cancel path has no dialog dependency.)
const fs = require("fs"), vm = require("vm"), assert = require("assert");
let n = 0; const ok = (c, m) => { assert(c, m); n++; };

const HTML = fs.readFileSync(__dirname + "/../voice/index.html", "utf8");
const SRC = HTML.split("<script>")[1].split("</script>")[0];
const SW = fs.readFileSync(__dirname + "/../sw.js", "utf8");

// ── static guards ──
ok(!/!confirm\(/.test(SRC) && !/[^.]\bconfirm\("/.test(SRC), "no native confirm() gate remains anywhere in the Control Center script");
ok((SRC.match(/armTap\(/g) || []).length >= 4, "armTap helper defined and used at the destructive actions (cancel, authorize, suppress-remove)");
ok(SRC.includes('action:"booking_cancel"'), "cancel still posts the booking_cancel action");
ok(SW.includes('potent-os-v9'), "service worker cache bumped to v9 (old caches purge on activate)");
ok(SW.includes('indexOf("/voice/")') && SW.includes('indexOf("/.netlify/functions/")'), "service worker never intercepts/caches the Control Center or function responses");

const BK_ID = "11111111-2222-4333-8444-555555555555";
const BOOKING = { id: BK_ID, reference: "PV-261029-EDHE", status: "confirmed", customer_name: "Derek Cole", customer_phone: "+14704531616", review_reason: "", snapshot: { intake: { pickup_address: "125 West Park Drive, Peachtree City", delivery_address: "880 Franklin Gateway, Marietta", service_date: "2026-10-31", time_window: "10:00" } } };
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const TOKEN = b64u({ uid: "org-a1", role: "owner", orgId: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa" }) + ".sig";
const tick = () => new Promise((r) => setTimeout(r, 30));

function makeEl(id) {
  return { id: id || "", _html: "", dataset: {}, disabled: false, textContent: "",
    set innerHTML(v) { this._html = String(v); this._btns = null; },
    get innerHTML() { return this._html; },
    querySelectorAll(sel) {
      if (!this._btns) {
        this._btns = { no: [], ok: [] };
        const re = /data-(no|ok)="([^"]+)"/g; let m;
        while ((m = re.exec(this._html))) { const b = makeEl(""); b.dataset[m[1]] = m[2]; b.textContent = m[1] === "no" ? "Cancel" : "Confirm"; this._btns[m[1]].push(b); }
      }
      if (sel === "[data-no]") return this._btns.no;
      if (sel === "[data-ok]") return this._btns.ok;
      return [];
    },
    querySelector() { return null; }, closest() { return null; }, insertAdjacentHTML() {}, scrollIntoView() {} };
}

function boot(cancelResponder) {
  const calls = [], timers = [];
  const els = { main: makeEl("main"), nav: makeEl("nav"), who: makeEl("who"), out: makeEl("out") };
  els.nav.querySelectorAll = () => [];
  const sandbox = {
    console, Promise, JSON, Math, Date, Object, Array, String, Number, Boolean, RegExp, Error,
    setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout: () => {},
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    localStorage: { getItem: (k) => (k === "pl_token" ? TOKEN : null), setItem() {}, removeItem() {} },
    location: { hash: "#book" },
    document: { getElementById: (id) => els[id] || makeEl(id) },
    confirm: () => { throw new Error("native confirm() must never be called by the Control Center"); },
    alert: () => {},
    fetch: (url, opts) => {
      const body = JSON.parse(opts.body || "{}"); calls.push(body);
      const respond = (status, j) => Promise.resolve({ status, json: () => Promise.resolve(j) });
      if (body.action === "bookings") return respond(200, { bookings: [BOOKING] });
      if (body.action === "booking_cancel") return cancelResponder(body);
      return respond(200, {});
    },
  };
  sandbox.window = { addEventListener() {} };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return { calls, timers, els };
}

(async () => {
  // ── 1. happy path: two taps cancel, no dialog anywhere ──
  {
    const { calls, els } = boot(() => Promise.resolve({ status: 200, json: () => Promise.resolve({ ok: true }) }));
    await tick();
    const btn = els.main.querySelectorAll("[data-no]")[0];
    ok(btn && btn.textContent === "Cancel", "bookings list renders a Cancel button for a confirmed booking");
    btn.onclick();
    ok(calls.filter((c) => c.action === "booking_cancel").length === 0, "first tap only ARMS the cancel — no request yet");
    ok(btn.dataset.arm === "1" && /Tap again/.test(btn.textContent), "armed button asks for a confirming second tap, inline");
    btn.onclick(); await tick();
    const cc = calls.filter((c) => c.action === "booking_cancel");
    ok(cc.length === 1 && cc[0].id === BK_ID, "second tap sends exactly one booking_cancel for the right booking");
    ok(calls.filter((c) => c.action === "bookings").length === 2, "successful cancel re-renders the bookings list");
  }
  // ── 2. a server refusal now SURFACES (Bundle A's note path is reachable) ──
  {
    const { calls, els } = boot(() => Promise.resolve({ status: 502, json: () => Promise.resolve({ error: "That booking could not be cancelled — it is still on the board." }) }));
    await tick();
    const btn = els.main.querySelectorAll("[data-no]")[0];
    btn.onclick(); btn.onclick(); await tick();
    ok(calls.filter((c) => c.action === "booking_cancel").length === 1, "error path: the cancel request is sent");
    ok(els.out.innerHTML.includes("could not be cancelled"), "error path: the refusal is shown to the user, not swallowed");
  }
  // ── 3. arming expires: a late second tap re-arms instead of cancelling ──
  {
    const { calls, els, timers } = boot(() => Promise.resolve({ status: 200, json: () => Promise.resolve({ ok: true }) }));
    await tick();
    const btn = els.main.querySelectorAll("[data-no]")[0];
    btn.onclick();
    ok(btn.dataset.arm === "1", "armed after first tap");
    timers.splice(0).forEach((fn) => fn()); // the 4s disarm timer fires
    ok(!btn.dataset.arm && btn.textContent === "Cancel", "arm expires and the button restores its label");
    btn.onclick(); await tick();
    ok(calls.filter((c) => c.action === "booking_cancel").length === 0, "a tap after expiry re-arms — it does not cancel");
  }
  console.log("voice-ui: " + n + " assertions PASS");
})().catch((e) => { console.error("voice-ui FAILED:", e); process.exit(1); });
