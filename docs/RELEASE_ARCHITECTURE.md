# Release architecture

`release-manifest.json` is the only authoritative runtime release source.

Rules:

1. Do not hard-code build versions in `index.html`, `src/pwa.js`, `sw.js`, renderer code, or gameplay modules.
2. Every runtime module and asset is requested with the active `releaseId` as its cache key.
3. `src/bootstrap.js` fetches the manifest with `cache: no-store`, clears all older The Villager caches/service workers when the release changes, then starts the current game and PWA modules.
4. `sw.js` derives its cache namespace from the release id in its own registration URL and refuses to install if it disagrees with the live manifest.
5. Renderers may not silently fall back to deprecated visual assets. A missing current asset must show an explicit asset error.
6. Deprecated assets must be removed from the repository once the replacement is live.
7. `build-info.json` is a compatibility mirror only. Its version must equal the manifest version.
8. `.github/workflows/release-guard.yml` validates these rules on pull requests and pushes to `main`.

For a new release, update `release-manifest.json` first. Any new asset path must be added to its `assets` map. The runtime should consume the manifest mapping rather than directly embedding release-specific paths.
