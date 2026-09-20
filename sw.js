const CACHE = 'scoreboard-v11b46-painted-back-rail';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './branding-v11.css',
  './team-page-v4.css',
  './team-page-v5.css',
  './team-page-v8.css',
  './roster-groups-v5.css',
  './live-score-v6.css',
  './live-batting-v11.css',
  './basic-stats-v6.css',
  './live-awareness-v6.css',
  './full-stats-v7.css',
  './home-score-rail-v8.css',
  './home-score-overlay-v9.css',
  './mlb-depth-chart-v9.css',
  './global-standings-v10.css',
  './sports-news-v11.css',
  './team-theme-v12.css',
  './team-theme-v13.css',
  './team-theme-v14.css',
  './team-theme-v15.css',
  './team-theme-v16.css',
  './team-theme-v17.css',
  './team-theme-v18.css',
  './team-theme-v19.css',
  './team-theme-v20.css',
  './desktop-nav-v11.css',
  './header-plate-v11.css',
  './team-data-v8.js',
  './standings-repair-v6.js',
  './nfl-standings-v9.js',
  './team-data-freshness-v8.js',
  './team-page-v8.js',
  './roster-groups-v8.js',
  './live-score-v11.js',
  './app.js',
  './live-panel-freshness-v11.js',
  './basic-stats-v6.js',
  './full-stats-v7.js',
  './mlb-depth-chart-v9.js',
  './live-awareness-v6.js',
  './home-score-rail-v8.js',
  './news-sources-v12.js',
  './sports-news-v11.js',
  './global-standings-v10.js',
  './desktop-nav-v11.js',
  './swipe-repair-v11.js',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/score-metal-tread.svg',
  './assets/score-metal-footer.webp',
  './assets/scoreboard-header.webp',
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

  const request = event.request;
  const url = new URL(request.url);

  // Sports-provider requests remain ordinary network requests. The service worker
  // only owns this app's own shell/assets.
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      // Network-first + no-store prevents a newly deployed HTML shell from being
      // paired with stale CSS/JS/images from an older Scoreboard release.
      const response = await fetch(request, { cache: 'no-store' });
      if (response && response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
      throw new Error('Scoreboard asset unavailable offline.');
    }
  })());
});
