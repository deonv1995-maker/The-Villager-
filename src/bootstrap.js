const RELEASE_MANIFEST_URL = './release-manifest.json';
const APP_SCOPE = new URL('./', window.location.href).href;

async function fetchReleaseManifest() {
  const url = new URL(RELEASE_MANIFEST_URL, window.location.href);
  url.searchParams.set('_', Date.now().toString());
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`release-manifest ${response.status}`);
  const manifest = await response.json();
  if (!manifest?.version || !manifest?.releaseId || !manifest?.entry || !manifest?.pwa) {
    throw new Error('release-manifest is incomplete');
  }
  return manifest;
}

async function clearStaleRuntime(releaseId) {
  const storedRelease = localStorage.getItem('the-villager-release-id');
  if (storedRelease === releaseId) return;

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('the-villager-')).map(key => caches.delete(key)));
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations
      .filter(registration => registration.scope.startsWith(APP_SCOPE))
      .map(registration => registration.unregister()));
  }

  localStorage.setItem('the-villager-release-id', releaseId);
}

function releaseUrl(path, releaseId) {
  const url = new URL(path, window.location.href);
  url.searchParams.set('r', releaseId);
  return url.href;
}

function applyReleaseToDocument(release) {
  document.documentElement.dataset.releaseId = release.releaseId;
  document.documentElement.dataset.buildVersion = release.version;

  const badge = document.getElementById('build-version');
  if (badge) badge.textContent = `v${release.version}`;

  const styles = document.getElementById('app-styles');
  if (styles) styles.href = releaseUrl('styles.css', release.releaseId);

  const manifestLink = document.getElementById('app-manifest');
  if (manifestLink) manifestLink.href = releaseUrl('manifest.webmanifest', release.releaseId);
}

function showBootError(error) {
  console.error('The Villager failed to boot:', error);
  const hint = document.getElementById('hint');
  if (hint) {
    hint.textContent = 'Update failed to load. Close and reopen the game.';
    hint.classList.remove('hidden');
  }
  const badge = document.getElementById('build-version');
  if (badge) badge.textContent = 'UPDATE ERROR';
}

async function boot() {
  try {
    const release = await fetchReleaseManifest();
    await clearStaleRuntime(release.releaseId);
    window.__THE_VILLAGER_RELEASE__ = Object.freeze(release);
    applyReleaseToDocument(release);

    await import(releaseUrl(release.entry, release.releaseId));
    await import(releaseUrl(release.pwa, release.releaseId));
  } catch (error) {
    showBootError(error);
  }
}

boot();
