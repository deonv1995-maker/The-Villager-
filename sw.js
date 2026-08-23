const CACHE_NAME = 'the-villager-v0.5.1';
const APP_SHELL = [
  './','./index.html','./styles.css?v=0.5.1','./manifest.webmanifest','./icons/icon.svg','./icons/icon-maskable.svg',
  './assets/world-ground-v05.png.base64','./assets/tree-raster.png','./assets/rock-raster.png','./assets/grass-raster.png','./assets/ranger-walk-sheet-v051.png.base64',
  './src/game-v03.js?v=0.5.1','./src/art.js?v=0.5.1','./src/config.js','./src/input.js','./src/inventory.js','./src/resources.js','./src/crafting.js','./src/pwa.js?v=0.5.1'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('the-villager-')&&key!==CACHE_NAME).map(key=>caches.delete(key)));await self.clients.claim();})());});
async function networkFirst(request){try{const response=await fetch(request,{cache:'no-store'});if(response&&response.ok){const cache=await caches.open(CACHE_NAME);cache.put(request,response.clone());}return response;}catch(error){const cached=await caches.match(request);if(cached)return cached;if(request.mode==='navigate')return caches.match('./index.html');throw error;}}
async function cacheFirst(request){const cached=await caches.match(request);if(cached)return cached;const response=await fetch(request);if(response&&response.ok){const cache=await caches.open(CACHE_NAME);cache.put(request,response.clone());}return response;}
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;const fresh=event.request.mode==='navigate'||url.pathname.endsWith('.html')||url.pathname.endsWith('.js')||url.pathname.endsWith('.css')||url.pathname.endsWith('.webmanifest')||url.pathname.endsWith('.base64');event.respondWith(fresh?networkFirst(event.request):cacheFirst(event.request));});
