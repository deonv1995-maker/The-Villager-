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
 // Never rewrite module URLs. Rewriting one versioned module onto another can
 // create an incompatible dependency graph. Always request the exact URL the
 // page asked for and bypass HTTP cache for same-origin game files.
 event.respondWith(fetch(request,{cache:'no-store'}));
});
