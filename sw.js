const CACHE = 'scoreboard-v6-basic-stats-live-awareness';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './team-page-v4.css',
  './team-page-v5.css',
  './roster-groups-v5.css',
  './live-score-v6.css',
  './basic-stats-v6.css',
  './live-awareness-v6.css',
  './team-data-v5.js',
  './standings-repair-v6.js',
  './team-page-v5.js',
  './roster-groups-v5.js',
  './live-score-v6.js',
  './app.js',
  './basic-stats-v6.js',
  './live-awareness-v6.js',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/giants.webp',
  './assets/yankees.webp',
  './assets/mets.webp',
  './assets/jets.webp',
  './assets/rangers.webp',
  './assets/army.webp',
  './assets/fever.webp'
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
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
