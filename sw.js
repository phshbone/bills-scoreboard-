const CACHE = 'scoreboard-v11a2-philly-teams';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './team-page-v4.css',
  './team-page-v5.css',
  './team-page-v8.css',
  './roster-groups-v5.css',
  './live-score-v6.css',
  './basic-stats-v6.css',
  './live-awareness-v6.css',
  './full-stats-v7.css',
  './home-score-rail-v8.css',
  './home-score-overlay-v9.css',
  './mlb-depth-chart-v9.css',
  './global-standings-v10.css',
  './team-data-v8.js',
  './standings-repair-v6.js',
  './nfl-standings-v9.js',
  './team-data-freshness-v8.js',
  './team-page-v8.js',
  './roster-groups-v8.js',
  './live-score-v6.js',
  './app.js',
  './basic-stats-v6.js',
  './full-stats-v7.js',
  './mlb-depth-chart-v9.js',
  './live-awareness-v6.js',
  './home-score-rail-v8.js',
  './global-standings-v10.js',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/giants.webp',
  './assets/yankees.webp',
  './assets/mets.webp',
  './assets/jets.webp',
  './assets/rangers.webp',
  './assets/army.webp',
  './assets/fever.webp',
  './assets/eagles.webp',
  './assets/phillies.webp',
  './assets/flyers.webp',
  './assets/sixers.webp'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;

  // Navigations are network-first so a fresh launch receives the newest app shell.
  // Cached HTML remains the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put('./index.html', response.clone());
        }
        return response;
      } catch {
        return (await caches.match(request))
          || (await caches.match('./index.html'))
          || (await caches.match('./'));
      }
    })());
    return;
  }

  // Versioned app assets remain cache-first for speed/offline use.
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
