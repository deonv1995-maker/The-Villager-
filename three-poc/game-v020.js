// v0.2.0 intentionally reuses the proven v0.1.5 gameplay/runtime.
// The only behavioral change is that the external character asset is now present
// at the path expected by player-visual-glb.js, so it can replace the procedural
// fallback after a successful load.
await import('./game-v015.js?v=020-runtime');
