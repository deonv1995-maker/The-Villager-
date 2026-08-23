export const GAME_CONFIG = Object.freeze({
  world: {
    width: 1800,
    height: 1200,
    grid: 32,
  },
  player: {
    speed: 190,
    radius: 14,
    harvestRange: 68,
  },
  camera: {
    followLerp: 0.14,
  },
  joystick: {
    radius: 42,
    deadZone: 0.12,
  },
});

export const RESOURCE_TYPES = Object.freeze({
  tree: {
    name: 'Tree',
    yieldItem: 'wood',
    yieldAmount: 3,
    harvestSeconds: 3.0,
    respawnSeconds: 8,
    radius: 22,
  },
  rock: {
    name: 'Stone',
    yieldItem: 'stone',
    yieldAmount: 2,
    harvestSeconds: 4.0,
    respawnSeconds: 10,
    radius: 20,
  },
  grass: {
    name: 'Tall Grass',
    yieldItem: 'grass',
    yieldAmount: 2,
    harvestSeconds: 1.7,
    respawnSeconds: 6,
    radius: 16,
  },
});

export const ITEM_TYPES = Object.freeze({
  wood: { name: 'Wood', icon: '🪵' },
  stone: { name: 'Stone', icon: '🪨' },
  grass: { name: 'Grass', icon: '🌿' },
});
