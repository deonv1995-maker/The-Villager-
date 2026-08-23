# The Villager Changelog

## v0.6.1 - Village Foundation

- Added a dedicated `src/village.js` settlement module.
- Added a central village green, paths, well, village hall, cottages, workshop and storehouse.
- Added static building and well collision so the player cannot walk through village structures.
- Moved starter resource nodes outside the settlement footprint.
- Spawn the player inside the village while preserving the existing Phaser 4 harvesting, inventory and crafting systems.
- Added the village module to the release shell so PWA caching remains release-safe.

## v0.2 - Crafting and Tool Progression

- Added crafting UI and data-driven recipes.
- Added wooden axe, wooden pickaxe, grass sickle, stone axe, and stone pickaxe.
- Added automatic tool equipment by resource class.
- Added harvest speed and yield multipliers from equipped tools.
- Added idle, walking, tree harvesting, rock mining, and grass gathering animation states.
- Kept harvesting automatic and range/time based.
