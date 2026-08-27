const CACHE_NAME='the-villager-shell-0.6.18';
const SHELL_ASSETS=[
 './',
 './index.html',
 './manifest.webmanifest',
 './icons/icon.svg',
 './icons/icon-maskable.svg'
];

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL_ASSETS)));
 self.skipWaiting();
});

self.addEventListener('activate',event=>{
 event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))))
 );
 self.clients.claim();
});

self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;

 if(request.mode==='navigate'){
  event.respondWith(
   fetch(request,{cache:'no-store'})
    .then(response=>{
     const copy=response.clone();
     caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy)).catch(()=>{});
     return response;
    })
    .catch(()=>caches.match('./index.html').then(cached=>cached||Response.error()))
  );
  return;
 }

 if(url.pathname.endsWith('/manifest.webmanifest')||url.pathname.endsWith('/icons/icon.svg')||url.pathname.endsWith('/icons/icon-maskable.svg')){
  event.respondWith(
   caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE_NAME).then(cache=>cache.put(request,copy)).catch(()=>{});
    return response;
   }))
  );
 }
});
