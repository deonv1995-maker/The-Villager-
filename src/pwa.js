const BUILD_VERSION = '0.5.0';
const reloadKey = `the-villager-reloaded-${BUILD_VERSION}`;

function markBuildVersion() {
  const badge = document.getElementById('build-version');
  if (badge) badge.textContent = `v${BUILD_VERSION}`;
}
markBuildVersion();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`./sw.js?v=${BUILD_VERSION}`, { scope: './', updateViaCache: 'none' });
      await registration.update();
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (sessionStorage.getItem(reloadKey)) return;
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
      });
    } catch (error) {
      console.warn('Service worker registration failed:', error);
    }
  });
}
