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
    new ResourceNode('tree', 380, 330),
    new ResourceNode('tree', 565, 255),
    new ResourceNode('tree', 1280, 285),
    new ResourceNode('tree', 1480, 395),
    new ResourceNode('tree', 1510, 830),
    new ResourceNode('rock', 430, 655),
    new ResourceNode('rock', 585, 900),
    new ResourceNode('rock', 1260, 905),
    new ResourceNode('rock', 1510, 560),
    new ResourceNode('grass', 340, 810),
    new ResourceNode('grass', 560, 520),
    new ResourceNode('grass', 1215, 455),
    new ResourceNode('grass', 1320, 810),
    new ResourceNode('grass', 1580, 690),
  ];
}
