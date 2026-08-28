const RECOVERY_VERSION='645';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.map(key=>caches.delete(key)));
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;

 // Any cached/older shell may still request main.js with an old query key.
 // Route every main module request onto the current recovery graph.
 if(url.pathname.endsWith('/src/main.js')){
  const fresh=new URL(url.href);
  fresh.search=`?v=${RECOVERY_VERSION}`;
  event.respondWith(fetch(fresh.href,{cache:'no-store'}));
  return;
 }

 event.respondWith(fetch(request,{cache:'no-store'}));
});
