// POTENT OS Service Worker — v7: video + server calls bypass the cache; real push notifications
var CACHE = "potent-os-v19";
var ASSETS = ["/", "/index.html", "/app.js", "/manifest.json"];

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET") return;
  var reqUrl = new URL(e.request.url);
  // Never touch video (phones fetch it in byte-range chunks, which a caching worker breaks),
  // and never cache server/API responses (leads, logins) in the browser's cache.
  if(e.request.headers.has("range") || /\.(mp4|webm|mov|m4v)$/i.test(reqUrl.pathname) || reqUrl.pathname.indexOf("/.netlify/functions/") === 0) return;
  e.respondWith(
    fetch(e.request).then(function(res){
      var clone = res.clone();
      caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
      return res;
    }).catch(function(){
      return caches.match(e.request);
    })
  );
});

// ── PUSH NOTIFICATIONS — real, works on Android (all browsers) and
// iOS 16.4+ once installed to the Home Screen. This is what actually
// makes a notification pop up on the lock screen / in the background,
// not just while the tab is open.
self.addEventListener("push", function(e){
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) { data = { title: "POTENT OS", body: e.data ? e.data.text() : "You have a new update." }; }
  var title = data.title || "POTENT OS";
  var options = {
    body: data.body || "",
    icon: "https://raw.githubusercontent.com/potent-logistics-site/main/icon-192.png",
    badge: "https://raw.githubusercontent.com/potent-logistics-site/main/icon-192.png",
    data: { url: data.url || "/" },
    vibrate: [200, 100, 200],
    tag: data.tag || "potent-general"
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList){
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url.indexOf(self.registration.scope) === 0 && "focus" in clientList[i]) {
          return clientList[i].focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
