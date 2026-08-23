# Release versioning rule

Every public build must use a new version string. The version must be updated in the service-worker cache name and the cache-busted entry URLs before merge. The game UI must display the active version so the installed PWA and browser build are easy to verify. Old `the-villager-*` caches are deleted during service-worker activation, and HTML/JS/CSS use network-first loading so an older cached build cannot silently override a newer release.
