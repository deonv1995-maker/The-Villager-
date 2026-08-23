# Art direction v0.5

The Villager uses raster pixel artwork for the playable world, character and harvestable resources. The ground must be rendered from large-format world texture chunks rather than repeating a small decorative tile, because obvious repetition makes the scene look procedural. Player movement and harvest animation may transform raster frames, but player/resource silhouettes must come from raster artwork rather than canvas-drawn body shapes. Every public art pass must increment the visible build version and PWA cache version before merge.
