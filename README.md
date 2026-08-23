# The Villager

Mobile-first pixel-art harvesting game prototype.

## Playable v0.1

Current gameplay:

- Virtual thumb joystick movement on mobile
- Pixel-art player and scrolling outdoor world
- Trees, rocks and tall grass as harvestable resource nodes
- Automatic range-based harvesting: move close and remain in range
- Different harvest times and yields per resource type
- Harvest progress indicator
- Inventory with Wood, Stone and Grass quantities
- Resource respawning
- Keyboard WASD / arrow support for desktop testing

## Running locally

Serve the repository as a static website. Because the game uses JavaScript modules, opening `index.html` directly as a `file://` URL is not recommended.

## GitHub Pages

This repository is intentionally dependency-free and can be hosted directly from the repository root with GitHub Pages.

In GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root)**.

## Architecture

- `src/config.js` — centralized gameplay tuning and item/resource definitions
- `src/input.js` — virtual joystick input
- `src/inventory.js` — inventory data + inventory rendering
- `src/resources.js` — resource nodes, harvesting output and respawning
- `src/game.js` — game loop, player, camera, targeting and rendering

The prototype keeps player movement, inventory, resources and tuning separate so future systems such as tools, crafting, farming, buildings, NPC villagers and larger worlds can build on the same foundation.
