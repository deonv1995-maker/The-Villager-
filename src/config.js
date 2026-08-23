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
    toolClass: 'axe',
  },
  rock: {
    name: 'Stone',
    yieldItem: 'stone',
    yieldAmount: 2,
    harvestSeconds: 4.0,
    respawnSeconds: 10,
    radius: 20,
    toolClass: 'pickaxe',
  },
  grass: {
    name: 'Tall Grass',
    yieldItem: 'grass',
    yieldAmount: 2,
    harvestSeconds: 1.7,
    respawnSeconds: 6,
    radius: 16,
    toolClass: 'sickle',
  },
});

export const ITEM_TYPES = Object.freeze({
  wood: { name: 'Wood', icon: '🪵', category: 'material' },
  stone: { name: 'Stone', icon: '🪨', category: 'material' },
  grass: { name: 'Grass', icon: '🌿', category: 'material' },
  wooden_axe: { name: 'Wooden Axe', icon: '🪓', category: 'tool' },
  wooden_pickaxe: { name: 'Wooden Pickaxe', icon: '⛏️', category: 'tool' },
  grass_sickle: { name: 'Grass Sickle', icon: '🌾', category: 'tool' },
  stone_axe: { name: 'Stone Axe', icon: '🪓', category: 'tool' },
  stone_pickaxe: { name: 'Stone Pickaxe', icon: '⛏️', category: 'tool' },
});

export const TOOL_TYPES = Object.freeze({
  wooden_axe: {
    name: 'Wooden Axe',
    toolClass: 'axe',
    harvestSpeed: 1.35,
    yieldMultiplier: 1,
  },
  wooden_pickaxe: {
    name: 'Wooden Pickaxe',
    toolClass: 'pickaxe',
    harvestSpeed: 1.35,
    yieldMultiplier: 1,
  },
  grass_sickle: {
    name: 'Grass Sickle',
    toolClass: 'sickle',
    harvestSpeed: 1.45,
    yieldMultiplier: 1.25,
  },
  stone_axe: {
    name: 'Stone Axe',
    toolClass: 'axe',
    harvestSpeed: 1.75,
    yieldMultiplier: 1.25,
  },
  stone_pickaxe: {
    name: 'Stone Pickaxe',
    toolClass: 'pickaxe',
    harvestSpeed: 1.75,
    yieldMultiplier: 1.25,
  },
});

export const CRAFTING_RECIPES = Object.freeze([
  {
    id: 'wooden_axe',
    name: 'Wooden Axe',
    icon: '🪓',
    description: 'Speeds up tree harvesting.',
    costs: { wood: 6, stone: 2 },
  },
  {
    id: 'wooden_pickaxe',
    name: 'Wooden Pickaxe',
    icon: '⛏️',
    description: 'Speeds up stone harvesting.',
    costs: { wood: 5, stone: 3 },
  },
  {
    id: 'grass_sickle',
    name: 'Grass Sickle',
    icon: '🌾',
    description: 'Harvest grass faster with improved yield.',
    costs: { wood: 4, stone: 1, grass: 4 },
  },
  {
    id: 'stone_axe',
    name: 'Stone Axe',
    icon: '🪓',
    description: 'A stronger axe with faster harvesting and better yield.',
    costs: { wood: 8, stone: 10 },
    requires: 'wooden_axe',
  },
  {
    id: 'stone_pickaxe',
    name: 'Stone Pickaxe',
    icon: '⛏️',
    description: 'A stronger pickaxe with faster mining and better yield.',
    costs: { wood: 8, stone: 12 },
    requires: 'wooden_pickaxe',
  },
]);
