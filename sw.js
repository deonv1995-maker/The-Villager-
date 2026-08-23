const scriptUrl=new URL(self.location.href);
const RELEASE_ID=scriptUrl.searchParams.get('r');
if(!RELEASE_ID)throw new Error('Service worker requires a release id.');
const CACHE_NAME=`the-villager-${RELEASE_ID}`;

function versioned(path){const url=new URL(path,self.registration.scope);url.searchParams.set('r',RELEASE_ID);return url.href;}

async function getManifest(){
  const url=new URL('release-manifest.json',self.registration.scope);
  url.searchParams.set('_',Date.now().toString());
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw new Error(`release-manifest ${response.status}`);
  const manifest=await response.json();
  if(manifest.releaseId!==RELEASE_ID)throw new Error(`Release mismatch: worker=${RELEASE_ID}, manifest=${manifest.releaseId}`);
  return manifest;
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const manifest=await getManifest();
    const cache=await caches.open(CACHE_NAME);
    const shell=['index.html','release-manifest.json',...manifest.shell,...Object.values(manifest.assets)];
    const unique=[...new Set(shell)];
    await cache.addAll(unique.map(versioned));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('the-villager-')&&key!==CACHE_NAME).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok){const cache=await caches.open(CACHE_NAME);cache.put(request,response.clone());}
    return response;
  }catch(error){
    const cached=await caches.match(request);
    if(cached)return cached;
    if(request.mode==='navigate')return caches.match(versioned('index.html'));
    throw error;
  }
}

async function immutableCacheFirst(request){
  const cached=await caches.match(request);
  if(cached)return cached;
  const response=await fetch(request,{cache:'no-store'});
  if(response&&response.ok){const cache=await caches.open(CACHE_NAME);cache.put(request,response.clone());}
  return response;
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  const isCurrentRelease=url.searchParams.get('r')===RELEASE_ID;
  const alwaysFresh=event.request.mode==='navigate'||url.pathname.endsWith('/release-manifest.json')||url.pathname.endsWith('/index.html');
  event.respondWith(alwaysFresh||!isCurrentRelease?networkFirst(event.request):immutableCacheFirst(event.request));
});
