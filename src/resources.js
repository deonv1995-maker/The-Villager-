import { RESOURCE_TYPES } from './config.js';

export class ResourceNode {
  constructor(type, x, y) {
    this.type = type;
    this.config = RESOURCE_TYPES[type];
    this.x = x;
    this.y = y;
    this.active = true;
    this.respawnTimer = 0;
  }

  harvest() {
    if (!this.active) return null;
    this.active = false;
    this.respawnTimer = this.config.respawnSeconds;
    return {
      itemId: this.config.yieldItem,
      amount: this.config.yieldAmount,
    };
  }

  update(dt) {
    if (this.active) return;
    this.respawnTimer -= dt;
    if (this.respawnTimer <= 0) {
      this.active = true;
      this.respawnTimer = 0;
    }
  }
}

export function createStarterResources() {
  return [
    new ResourceNode('tree', 480, 420),
    new ResourceNode('tree', 690, 320),
    new ResourceNode('tree', 940, 560),
    new ResourceNode('tree', 1160, 370),
    new ResourceNode('tree', 1370, 710),
    new ResourceNode('rock', 580, 650),
    new ResourceNode('rock', 850, 780),
    new ResourceNode('rock', 1240, 540),
    new ResourceNode('rock', 1480, 410),
    new ResourceNode('grass', 430, 760),
    new ResourceNode('grass', 760, 520),
    new ResourceNode('grass', 1040, 340),
    new ResourceNode('grass', 1280, 820),
    new ResourceNode('grass', 1540, 650),
  ];
}
