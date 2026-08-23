const CACHE_NAME = 'the-villager-v0.4.2';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=0.4.2',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
  './assets/ground-tile.svg',
  './assets/tree-atlas.svg',
  './assets/rock-atlas.svg',
  './assets/grass-atlas.svg',
  './assets/player-sheet.svg',
  './src/game-v03.js?v=0.4.2',
  './src/art.js?v=0.4.2',
  './src/config.js',
  './src/input.js',
  './src/inventory.js',
  './src/resources.js',
  './src/crafting.js',
  './src/pwa.js?v=0.4.2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('the-villager-') && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') return caches.match('./index.html');
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isFreshCode = event.request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.webmanifest');

  event.respondWith(isFreshCode ? networkFirst(event.request) : cacheFirst(event.request));
});
