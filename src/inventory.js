import { ITEM_TYPES } from './config.js';

export class Inventory {
  constructor(onChanged = null) {
    this.items = new Map();
    this.onChanged = onChanged;
  }

  add(itemId, amount = 1) {
    if (!ITEM_TYPES[itemId] || amount <= 0) return;
    this.items.set(itemId, (this.items.get(itemId) || 0) + amount);
    this.onChanged?.(this.snapshot());
  }

  get(itemId) {
    return this.items.get(itemId) || 0;
  }

  snapshot() {
    return [...this.items.entries()].map(([id, quantity]) => ({
      id,
      quantity,
      ...ITEM_TYPES[id],
    }));
  }
}

export function renderInventory(container, inventory) {
  const entries = inventory.snapshot();
  container.innerHTML = '';

  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'inventory-empty';
    empty.textContent = 'Nothing collected yet.';
    container.appendChild(empty);
    return;
  }

  for (const item of entries) {
    const slot = document.createElement('div');
    slot.className = 'inventory-slot';
    slot.innerHTML = `
      <div class="icon">${item.icon}</div>
      <div class="name">${item.name}</div>
      <div class="qty">× ${item.quantity}</div>
    `;
    container.appendChild(slot);
  }
}
