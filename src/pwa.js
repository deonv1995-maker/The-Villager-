const release = window.__THE_VILLAGER_RELEASE__;

if (!release?.releaseId) {
  throw new Error('PWA boot requires the active release manifest.');
}

async function clearOldVillagerCaches(currentCacheName) {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys
    .filter(key => key.startsWith('the-villager-') && key !== currentCacheName)
    .map(key => caches.delete(key)));
}

async function bootPwa() {
  const expectedCache = `the-villager-${release.releaseId}`;
  await clearOldVillagerCaches(expectedCache);

  if (!('serviceWorker' in navigator)) return;

  try {
    const scriptUrl = new URL('./sw.js', window.location.href);
    scriptUrl.searchParams.set('r', release.releaseId);

    const registration = await navigator.serviceWorker.register(scriptUrl.href, {
      scope: './',
      updateViaCache: 'none'
    });

    await registration.update();

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const key = `the-villager-controller-${release.releaseId}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      window.location.reload();
    });
  } catch (error) {
    console.warn('Service worker registration failed:', error);
  }
}

bootPwa();
