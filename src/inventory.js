import { ITEM_TYPES } from './config.js';

export class Inventory {
  constructor(onChanged = null) {
    this.items = new Map();
    this.onChanged = onChanged;
  }

  add(itemId, amount = 1) {
    if (!ITEM_TYPES[itemId] || amount <= 0) return false;
    this.items.set(itemId, (this.items.get(itemId) || 0) + amount);
    this.emitChanged();
    return true;
  }

  remove(itemId, amount = 1) {
    if (amount <= 0) return false;
    const current = this.get(itemId);
    if (current < amount) return false;

    const next = current - amount;
    if (next > 0) this.items.set(itemId, next);
    else this.items.delete(itemId);

    this.emitChanged();
    return true;
  }

  has(itemId, amount = 1) {
    return this.get(itemId) >= amount;
  }

  hasAll(costs) {
    return Object.entries(costs).every(([itemId, amount]) => this.has(itemId, amount));
  }

  consume(costs) {
    if (!this.hasAll(costs)) return false;
    for (const [itemId, amount] of Object.entries(costs)) {
      const next = this.get(itemId) - amount;
      if (next > 0) this.items.set(itemId, next);
      else this.items.delete(itemId);
    }
    this.emitChanged();
    return true;
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

  emitChanged() {
    this.onChanged?.(this.snapshot());
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
