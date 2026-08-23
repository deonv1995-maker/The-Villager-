import { CRAFTING_RECIPES, ITEM_TYPES, TOOL_TYPES } from './config.js';

export class CraftingSystem {
  constructor(inventory, onChanged = null) {
    this.inventory = inventory;
    this.ownedTools = new Set();
    this.equippedByClass = new Map();
    this.onChanged = onChanged;
  }

  owns(toolId) {
    return this.ownedTools.has(toolId);
  }

  canCraft(recipe) {
    if (this.owns(recipe.id)) return false;
    if (recipe.requires && !this.owns(recipe.requires)) return false;
    return this.inventory.hasAll(recipe.costs);
  }

  craft(recipeId) {
    const recipe = CRAFTING_RECIPES.find((entry) => entry.id === recipeId);
    if (!recipe || !this.canCraft(recipe)) return false;
    if (!this.inventory.consume(recipe.costs)) return false;

    this.ownedTools.add(recipe.id);
    this.inventory.add(recipe.id, 1);
    this.equip(recipe.id);
    this.onChanged?.();
    return true;
  }

  equip(toolId) {
    const tool = TOOL_TYPES[toolId];
    if (!tool || !this.owns(toolId)) return false;
    this.equippedByClass.set(tool.toolClass, toolId);
    this.onChanged?.();
    return true;
  }

  getEquipped(toolClass) {
    const toolId = this.equippedByClass.get(toolClass);
    return toolId ? { id: toolId, ...TOOL_TYPES[toolId] } : null;
  }

  getHarvestModifiers(resourceConfig) {
    const tool = this.getEquipped(resourceConfig.toolClass);
    return {
      tool,
      speedMultiplier: tool?.harvestSpeed || 1,
      yieldMultiplier: tool?.yieldMultiplier || 1,
    };
  }
}

export function renderCrafting(container, crafting, inventory) {
  container.innerHTML = '';

  for (const recipe of CRAFTING_RECIPES) {
    const owned = crafting.owns(recipe.id);
    const dependencyMet = !recipe.requires || crafting.owns(recipe.requires);
    const affordable = inventory.hasAll(recipe.costs);
    const card = document.createElement('article');
    card.className = 'recipe-card';

    const costText = Object.entries(recipe.costs)
      .map(([itemId, amount]) => `${ITEM_TYPES[itemId].icon} ${amount}`)
      .join(' · ');

    const status = owned
      ? 'Owned'
      : !dependencyMet
        ? `Requires ${ITEM_TYPES[recipe.requires]?.name || recipe.requires}`
        : affordable
          ? 'Ready to craft'
          : 'Need more materials';

    card.innerHTML = `
      <div class="recipe-icon">${recipe.icon}</div>
      <div class="recipe-body">
        <h2>${recipe.name}</h2>
        <p>${recipe.description}</p>
        <div class="recipe-cost">${costText}</div>
        <div class="recipe-status">${status}</div>
      </div>
      <button type="button" ${owned || !dependencyMet || !affordable ? 'disabled' : ''}>
        ${owned ? 'Crafted' : 'Craft'}
      </button>
    `;

    const button = card.querySelector('button');
    button.addEventListener('click', () => {
      if (crafting.craft(recipe.id)) renderCrafting(container, crafting, inventory);
    });

    container.appendChild(card);
  }
}
