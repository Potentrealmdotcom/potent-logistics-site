// POTENT OS — Service Worker
// Caches app for offline use and queues jobs when offline

const CACHE_NAME = 'potent-os-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
];

// Install — cache all static assets
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — serve from cache if offline
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);

  // Always go network-first for Supabase and Stripe API calls
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('stripe.com') ||
      url.hostname.includes('emailjs.com') ||
      url.hostname.includes('netlify')) {
    e.respondWith(
      fetch(e.request).catch(function() {
        return new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Fallback to index.html for navigation requests
        if (e.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Background sync — fires when connection restores
self.addEventListener('sync', function(e) {
  if (e.tag === 'potent-sync-jobs') {
    e.waitUntil(syncOfflineJobs());
  }
});

async function syncOfflineJobs() {
  // Notify all open windows to sync
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(function(client) {
    client.postMessage({ type: 'SYNC_OFFLINE_JOBS' });
  });
}
