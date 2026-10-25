// Əlevate service worker — same idea as POTENT OS Ghost Mode: once installed, the app opens and works with no signal.
// Network first (so updates arrive), saved copy when the network is gone. API calls (POST) are never cached or touched here:
// the page keeps its own offline outbox for those. Voice and the AI assistant need a connection; this file cannot change that.
var CACHE = "elevate-v3";
var SHELL = ["/elevate/", "/elevate/index.html", "/elevate/map.js", "/elevate/manifest.json", "/elevate/icon.svg", "/google-signin.js", "/lang-core.js"];
self.addEventListener("install", function (e) { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(function (c) { return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); })); })); });
self.addEventListener("activate", function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE && k.indexOf("elevate-") === 0; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener("fetch", function (e) {
  var r = e.request; if (r.method !== "GET") return;
  var u = new URL(r.url);
  var ours = u.origin === self.location.origin && (u.pathname.indexOf("/elevate/") === 0 || u.pathname === "/google-signin.js" || u.pathname === "/lang-core.js");
  var map = u.hostname === "cdn.jsdelivr.net" && u.pathname.indexOf("world-atlas") >= 0;
  if (!ours && !map) return;
  e.respondWith(fetch(r).then(function (res) { if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, copy); }); } return res; })
    .catch(function () { return caches.match(r, { ignoreSearch: true }).then(function (m) { return m || (r.mode === "navigate" ? caches.match("/elevate/") : undefined) || Response.error(); }); }));
});
