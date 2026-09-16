const CACHE = 'scoreboard-v11-branding-philly-accessibility';
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
  './stage11-v11.css',
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
  './assets/bills-scoreboard-mark.webp',
  './assets/bills-scoreboard-banner.webp',
  './assets/icon-192.webp',
  './assets/icon-512.webp',
  './assets/apple-touch-icon.png',
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

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
  return response;
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Provider/API traffic should never be pinned by the app-shell cache.
  if (url.origin !== self.location.origin) return;

  const shellRequest = event.request.mode === 'navigate' || /\.(?:html|js|css|webmanifest)$/.test(url.pathname);
  event.respondWith(shellRequest ? networkFirst(event.request) : cacheFirst(event.request));
});
