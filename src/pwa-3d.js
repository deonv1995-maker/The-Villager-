const MANIFEST_URL='./release-manifest.json';

async function getRelease(){
 const url=new URL(MANIFEST_URL,window.location.href);url.searchParams.set('_',Date.now().toString());
 const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`release-manifest ${response.status}`);
 return response.json();
}

async function register3dPwa(){
 if(!('serviceWorker' in navigator))return;
 try{
  const release=await getRelease();
  if(!release?.releaseId)throw new Error('Missing releaseId');
  const scriptUrl=new URL('./sw.js',window.location.href);scriptUrl.searchParams.set('r',release.releaseId);
  const registration=await navigator.serviceWorker.register(scriptUrl.href,{scope:'./',updateViaCache:'none'});
  await registration.update();
  localStorage.setItem('the-villager-release-id',release.releaseId);
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
   const key=`the-villager-3d-controller-${release.releaseId}`;
   if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1');window.location.reload();
  });
 }catch(error){console.warn('[The Villager] 3D PWA update registration failed.',error);}
}
register3dPwa();
