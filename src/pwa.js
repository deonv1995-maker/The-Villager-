const FALLBACK_BUILD_VERSION = '0.5.3';

async function getServerBuildVersion() {
  try {
    const response = await fetch(`./build-info.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`build-info ${response.status}`);
    const info = await response.json();
    return String(info.version || FALLBACK_BUILD_VERSION);
  } catch (error) {
    console.warn('Could not read build-info.json:', error);
    return FALLBACK_BUILD_VERSION;
  }
}

function markBuildVersion(version) {
  const badge = document.getElementById('build-version');
  if (badge) badge.textContent = `v${version}`;
}

async function clearOldVillagerCaches(currentCacheName) {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys
    .filter((key) => key.startsWith('the-villager-') && key !== currentCacheName)
    .map((key) => caches.delete(key)));
}

async function bootPwa() {
  const serverVersion = await getServerBuildVersion();
  markBuildVersion(serverVersion);

  const expectedCache = `the-villager-v${serverVersion}`;
  await clearOldVillagerCaches(expectedCache);

  const pageVersion = document.documentElement.dataset.buildVersion || FALLBACK_BUILD_VERSION;
  const reloadKey = `the-villager-version-sync-${serverVersion}`;

  if (pageVersion !== serverVersion && !sessionStorage.getItem(reloadKey)) {
    sessionStorage.setItem(reloadKey, '1');
    const url = new URL(window.location.href);
    url.searchParams.set('build', serverVersion);
    window.location.replace(url.href);
    return;
  }

  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register(`./sw.js?v=${serverVersion}`, {
      scope: './',
      updateViaCache: 'none'
    });
    await registration.update();

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const key = `the-villager-controller-${serverVersion}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      window.location.reload();
    });
  } catch (error) {
    console.warn('Service worker registration failed:', error);
  }
}

bootPwa();
