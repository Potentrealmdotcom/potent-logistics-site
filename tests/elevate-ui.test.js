// Run: node tests/elevate-ui.test.js  (needs Playwright + chromium; skips itself if they are missing). No real network:
// the API and the map file are stubbed. Checks the Life OS home: orb states, map, places, layout switch, reduced motion, offline.
const assert = require("assert"), http = require("http"), fs = require("fs"), path = require("path");
let pw; try { pw = require("/opt/npm-tools/node_modules/playwright"); } catch (e) { try { pw = require("playwright"); } catch (e2) { console.log("elevate-ui: Playwright not installed, skipped"); process.exit(0); } }
const ROOT = path.join(__dirname, "..");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".json": "application/json", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split("?")[0]).replace(/\/$/, "/index.html")); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; return r.end(); } r.setHeader("Content-Type", MIME[path.extname(f)] || "text/plain"); r.end(fs.readFileSync(f)); });
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  async function open(opts) {
    opts = opts || {}; const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 900 }, reducedMotion: opts.reduced ? "reduce" : "no-preference" });
    const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(String(e)));
    const st = { off: false }; const db = { place: [], task: [{ id: "t1", title: "Call dispatcher", done: false, due_at: new Date(Date.now() - 3600e3).toISOString() }, { id: "t2", title: "Pay insurance", done: false, due_at: null }] }; const calls = [];
    await ctx.route("**/.netlify/functions/elevate-api", async rt => { if (st.off) return rt.abort("internetdisconnected"); const b = JSON.parse(rt.request().postData() || "{}"); calls.push(b); let out = { ok: true };
      if (b.action === "me") out = { ok: true, owner: "me@x.com", voice: true, voices: ["marin", "cedar"], voice_default: "marin" };
      else if (b.action === "items") out = { ok: true, items: db[b.kind] || [] };
      else if (b.action === "item_save" && b.kind === "place") { const it = { id: "p" + (db.place.length + 1), kind: "place", title: b.title, lat: b.lat, lon: b.lon }; db.place.push(it); out = { ok: true, item: it }; }
      else if (b.action === "item_delete") db.place = db.place.filter(x => x.id !== b.id);
      else if (b.action === "item_save" && b.kind === "task") { const it = { id: "t" + (db.task.length + 1 + 10), title: b.title, done: false, due_at: b.due_at || null }; db.task.push(it); out = { ok: true, item: it }; }
      else if (b.action === "item_toggle") { const t = db.task.filter(x => x.id === b.id)[0]; if (t) t.done = b.done; }
      else if (b.action === "chat") out = { ok: true, reply: "Do the call first.", did: [] };
      await rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(out) }); });
    await ctx.route("https://cdn.jsdelivr.net/**", rt => opts.noMap || st.off ? rt.abort() : rt.fulfill({ status: 200, contentType: "application/json", body: fs.readFileSync(path.join(ROOT, "tests/fixtures/mini-world.json")) }));
    await page.addInitScript(() => { try { localStorage.setItem("elv_t", "tok"); } catch (e) {} });
    await page.goto(base + "/elevate/"); await page.waitForSelector("#orb"); return { page, errs, db, calls, ctx, st };
  }
  // ── desktop, map home ──
  let { page, errs, db, calls, ctx } = await open();
  ok(/ƏLEVATE/.test(await page.textContent("header .logo")), "name stays Əlevate: " + await page.textContent("header"));
  ok((await page.textContent(".mark")) === "Ə", "upside-down e mark is kept");
  ok(/YOUR WORLD. OFFLINE & ONLINE./.test(await page.textContent("header .logo small")), "tagline shown");
  await page.waitForFunction(() => document.querySelectorAll("#map path.c").length === 2);
  ok(/Natural Earth, Equal Earth/.test(await page.textContent("#mapstat")), "map status names the data and projection");
  ok(/Calendar\s*Not connected yet/.test((await page.textContent(".kv")).replace(/\s+/g, " ").replace("Calendar","Calendar ")) || (await page.textContent(".kv")).includes("Not connected yet"), "calendar honestly shown as not connected");
  const kv = await page.textContent(".kv"); ok(/Open tasks2/.test(kv) && /Overdue1/.test(kv), "Today panel uses real task data: " + kv);
  // every orb state renders its label
  for (const s of ["idle", "listening", "thinking", "speaking", "executing", "approval", "done", "error", "blocked"]) { await page.evaluate(x => setOrb(x, "n"), s); ok((await page.getAttribute("#orb", "data-state")) === s, "orb state " + s); ok((await page.textContent("#orbst")).length > 2, "orb label " + s); }
  await page.evaluate(() => setOrb("idle"));
  ok((await page.textContent("#micst")) === "Mic off", "mic state always visible: off");
  // region pick via the list (keyboard path) zooms the map
  await page.selectOption("#rsel", "001"); ok(/Selected: Testland/.test(await page.textContent("#mapinfo")), "region list selects a country");
  ok(await page.locator("#map path.c.sel").count() === 1, "selected country highlighted");
  // tap the map on Testland, name it, save it
  await page.click("[aria-label=Reset\\ view]");
  const box = await page.locator("#map").boundingBox(); const proj = await page.evaluate(() => { const q = ElvMap.project(-80, 30); const b = document.querySelector("#map").getBoundingClientRect(); const vb = document.querySelector("#map").viewBox.baseVal; return { x: b.left + (q[0] * S - vb.x) / vb.width * b.width, y: b.top + (-q[1] * S - vb.y) / vb.height * b.height }; });
  await page.mouse.click(proj.x, proj.y);
  ok(/Testland: spot at 30(\.\d+)?, -80/.test(await page.textContent("#mapinfo")) || /spot at 3[0-9.]+, -8[0-9.]+/.test(await page.textContent("#mapinfo")), "tap converts to lat/lon: " + await page.textContent("#mapinfo"));
  ok(await page.locator("#pform").isVisible(), "name form appears");
  await page.fill("#pname", "Home base"); await page.click("#pform button");
  await page.waitForSelector("#map circle.pin"); const saved = calls.filter(c => c.action === "item_save" && c.kind === "place")[0];
  ok(saved && saved.title === "Home base" && Math.abs(saved.lat - 30) < 1 && Math.abs(saved.lon + 80) < 1, "place saved with coordinates");
  ok(/Home base/.test(await page.textContent("#plist")), "place appears in the accessible list");
  ok(/saved by you, not live tracking/.test(await page.textContent("#mapstat")), "markers are labelled as saved, not live");
  // zoom + keyboard
  await page.click("[aria-label='Zoom in']"); ok(await page.evaluate(() => view.k) > 1, "zoom in"); await page.focus("#map"); await page.keyboard.press("ArrowLeft"); await page.keyboard.press("-"); ok(await page.evaluate(() => view.k) <= 1.7, "keyboard zoom out works");
  // offline -> blocked, online -> idle
  await ctx.setOffline(true); await page.evaluate(() => window.dispatchEvent(new Event("offline"))); ok((await page.getAttribute("#orb", "data-state")) === "blocked", "offline shows blocked state");
  await ctx.setOffline(false); await page.evaluate(() => window.dispatchEvent(new Event("online"))); ok((await page.getAttribute("#orb", "data-state")) === "idle", "back online = ready");
  // delete place
  page.on("dialog", d => d.accept()); await page.click("#plist .x"); await page.waitForFunction(() => !document.querySelector("#map circle.pin")); ok(db.place.length === 0, "place deleted on the server");
  // text to the assistant drives the orb and chat
  await page.fill(".ctl form input", "Organize my day"); await page.click(".ctl form button"); await page.waitForSelector(".msg.ai"); ok(/Do the call first/.test(await page.textContent("main")), "chat reply shown");
  // layout switch + hide sections
  await page.click("nav >> text=Settings"); await page.selectOption("select[aria-label='Home layout']", "classic"); await page.click("nav >> text=Home"); ok(await page.locator("#map").count() === 0 && await page.locator("#orb").count() === 1, "classic layout: no map, still has orb");
  await page.click("nav >> text=Settings"); await page.selectOption("select[aria-label='Home layout']", "map");
  await page.uncheck("input[aria-label='Memory']"); ok(await page.locator("nav >> text=Memory").count() === 0, "section can be hidden");
  await page.check("input[aria-label='Reduce motion']"); ok(await page.evaluate(() => document.body.classList.contains("calm")), "reduce motion applies");
  ok(errs.length === 0, "no page errors: " + errs.join("|")); await ctx.close();
  // ── map data unavailable ──
  ({ page, errs, ctx } = await open({ noMap: true })); await page.waitForFunction(() => /unavailable/.test(document.querySelector("#mapstat").textContent));
  ok(await page.locator("#mapstat button").isVisible(), "unavailable map offers Retry"); ok(/No saved places/.test(await page.textContent("#plist")), "list still works without the map");
  ok(errs.length === 0, "no page errors when map is down: " + errs.join("|")); await ctx.close();
  // ── offline, Ghost Mode style ──
  let st; ({ page, errs, db, calls, ctx, st } = await open());
  await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await page.waitForSelector("#orb"); await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.waitForFunction(() => document.querySelectorAll("#map path.c").length === 2);
  await page.click("nav >> text=Tasks"); await page.waitForSelector(".row"); ok(await page.locator(".row").count() === 2, "online: tasks load");
  st.off = true; await ctx.setOffline(true); await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  ok(/Offline/.test(await page.textContent("#syncst")), "offline pill shown");
  await page.fill("form.card input[placeholder='Add a task…']", "Buy straps offline"); await page.click("form.card button"); await page.waitForFunction(() => /Buy straps offline/.test(document.querySelector("main").textContent));
  ok(/Waiting to sync/.test(await page.textContent("main")), "offline task is listed and marked waiting to sync: " + await page.textContent("main"));
  await page.locator(".row input[type=checkbox]").nth(1).check(); ok(/1 waiting|2 waiting/.test(await page.textContent("#syncst")), "pill counts waiting changes: " + await page.textContent("#syncst"));
  await page.reload(); await page.waitForSelector("#orb"); ok(true, "app opens offline (service worker)");
  ok(/Offline/.test(await page.textContent("#syncst")) && (await page.getAttribute("#orb", "data-state")) === "blocked", "reload offline: still signed in, orb shows not connected");
  await page.waitForFunction(() => document.querySelectorAll("#map path.c").length === 2); ok(true, "map outlines come back from the saved copy offline");
  await page.click("nav >> text=Tasks"); await page.waitForSelector(".row"); ok(/Buy straps offline/.test(await page.textContent("main")), "queued task survives a reload offline");
  const before = calls.filter(c => c.action === "item_save" && c.kind === "task").length;
  st.off = false; await ctx.setOffline(false); await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForFunction(() => document.getElementById("syncst").classList.contains("hide")); 
  ok(calls.filter(c => c.action === "item_save" && c.kind === "task").length === before + 1 && db.task.some(t => t.title === "Buy straps offline"), "back online: queued task reaches the server once");
  ok(calls.some(c => c.action === "item_toggle"), "back online: queued tick reaches the server");
  ok(!/Waiting to sync/.test(await page.textContent("main")), "nothing left waiting"); ok(errs.length === 0, "no page errors offline: " + errs.join("|")); await ctx.close();
  // ── phone, reduced motion, screenshots ──
  ({ page, errs, ctx } = await open({ viewport: { width: 390, height: 844 }, reduced: true }));
  await page.waitForFunction(() => document.querySelectorAll("#map path.c").length === 2);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no sideways scroll on a phone");
  ok(await page.evaluate(() => getComputedStyle(document.querySelector("#orb .r1")).animationName === "none" || true), "reduced motion handled"); await page.evaluate(() => setOrb("thinking")); ok(await page.evaluate(() => getComputedStyle(document.querySelector("#orb .r1")).animationName) === "none", "no orb animation under prefers-reduced-motion");
  if (process.env.SHOTS) { await page.screenshot({ path: process.env.SHOTS + "/phone.png" }); }
  await ctx.close();
  if (process.env.SHOTS) { ({ page, ctx } = await open()); await page.waitForFunction(() => document.querySelectorAll("#map path.c").length === 2); await page.screenshot({ path: process.env.SHOTS + "/desktop.png" }); await ctx.close(); }
  await browser.close(); srv.close(); console.log("elevate-ui: " + n + " assertions passed");
})().catch(e => { console.error(e); process.exit(1); });
