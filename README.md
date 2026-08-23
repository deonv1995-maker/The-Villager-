# The Villager

Mobile-first pixel-art harvesting and crafting game prototype.

## Playable v0.2

Current gameplay:

- Virtual thumb joystick movement on mobile
- Pixel-art player and scrolling outdoor world
- Trees, rocks and tall grass as harvestable resource nodes
- Automatic range-based harvesting: move close and remain in range
- Different harvest times and yields per resource type
- Idle, walk, tree chopping, rock mining and grass gathering animation states
- Inventory with Wood, Stone, Grass and crafted tools
- Crafting panel with wooden and stone tool progression
- Automatic tool equipment by resource type
- Tool-based harvesting speed and yield bonuses
- Resource respawning
- Keyboard WASD / arrow support for desktop testing

## Crafting progression

Collect raw materials first, then open **Crafting**. Crafted tools equip automatically for the matching resource type.

- Wooden Axe → faster tree harvesting
- Wooden Pickaxe → faster stone harvesting
- Grass Sickle → faster grass gathering with improved yield
- Stone Axe → stronger tree harvesting and improved yield
- Stone Pickaxe → stronger stone harvesting and improved yield

Harvesting remains automatic: there are no manual chop or mine buttons.

## Running locally

Serve the repository as a static website. Because the game uses JavaScript modules, opening `index.html` directly as a `file://` URL is not recommended.

## GitHub Pages

This repository is dependency-free and can be hosted directly from the repository root with GitHub Pages.

In GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root)**.

## Architecture

- `src/config.js` — centralized gameplay tuning, recipes, items and tool definitions
- `src/input.js` — virtual joystick input
- `src/inventory.js` — inventory data, safe consumption and rendering
- `src/resources.js` — resource nodes, harvesting output and respawning
- `src/crafting.js` — crafting, owned tools, equipment and harvesting modifiers
- `src/game.js` — game loop, player state, camera, targeting, animation and rendering

The systems remain separated so later crafting tiers, durability, farming, buildings, NPC villagers, biomes and larger worlds can extend the existing foundation rather than duplicate harvesting logic.
