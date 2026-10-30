// POTENT OS Service Worker — v9: never cache the Voice Control Center or function responses
// (a stale cached /voice/ shell once masked a shipped fix); push tap navigates to the page.
var CACHE = "potent-os-v9";
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
var p = new URL(e.request.url).pathname;
if(p.indexOf("/voice/") === 0 || p.indexOf("/.netlify/functions/") === 0) return;
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
icon: "/potent-griffin-icon.png",
badge: "/potent-griffin-icon.png",
data: { url: data.url || "/" },
vibrate: [200, 100, 200],
tag: data.tag || "potent-general"
};
e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function(e){
e.notification.close();
var url = (e.notification.data && e.notification.data.url) || "/";
var target = new URL(url, self.registration.scope).href;
e.waitUntil(
clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList){
for (var i = 0; i < clientList.length; i++) {
if (clientList[i].url.indexOf(self.registration.scope) === 0 && "focus" in clientList[i]) {
// Old behavior only focused the open app and dropped the notification's page on the floor —
// tapping a call alert while the app was open appeared to do nothing. Navigate it instead.
var c = clientList[i];
if (c.url !== target && "navigate" in c) return c.navigate(target).then(function(){ return c.focus(); });
return c.focus();
}
}
if (clients.openWindow) return clients.openWindow(target);
})
);
});
