import { products } from "../data/products.js";
import { ingredients } from "../data/ingredients.js";

export function createInitialState(targets = {}) {
  return {
    inventory: Object.fromEntries(ingredients.map((ingredient) => [ingredient.id, targets[ingredient.id] ?? ingredient.initialStock])),
    targets: { ...targets },
    stockAdjustments: Object.fromEntries(ingredients.map((ingredient) => [ingredient.id, (targets[ingredient.id] ?? ingredient.initialStock) - ingredient.initialStock])),
    sold: Object.fromEntries(products.map((product) => [product.id, 0])),
    recentSales: [],
  };
}

export function getTargetStock(state, ingredient) {
  return state.targets?.[ingredient.id] ?? ingredient.targetStock;
}

export function resetState(state) {
  const inventory = Object.fromEntries(ingredients.map((ingredient) => [ingredient.id, getTargetStock(state, ingredient)]));
  return {
    ...createInitialState(state.targets),
    inventory,
    stockAdjustments: Object.fromEntries(ingredients.map(({ id, initialStock }) => [id, inventory[id] - initialStock])),
  };
}

export function getIngredientConsumption(state, ingredientId) {
  return products.reduce((total, product) => total + (product.recipe[ingredientId] || 0) * state.sold[product.id], 0);
}

export function setIngredientTarget(state, ingredientId, quantity) {
  if (!ingredients.some(({ id }) => id === ingredientId) || !Number.isSafeInteger(quantity) || quantity < 1) return state;
  return { ...state, targets: { ...state.targets, [ingredientId]: quantity } };
}

export function refillIngredient(state, ingredientId) {
  const ingredient = ingredients.find(({ id }) => id === ingredientId);
  if (!ingredient) return state;
  const target = getTargetStock(state, ingredient);
  const added = target - state.inventory[ingredientId];
  if (added <= 0) return state;
  const adjustment = (state.stockAdjustments?.[ingredientId] ?? 0) + added;
  if (!Number.isSafeInteger(adjustment)) return state;
  return {
    ...state,
    inventory: { ...state.inventory, [ingredientId]: target },
    stockAdjustments: { ...state.stockAdjustments, [ingredientId]: adjustment },
  };
}

// Los ingredientes son compartidos: vender un Coco puede reducir también los lattes disponibles.
export function getAvailableServings(state, product) {
  return Math.min(...Object.entries(product.recipe).map(([id, quantity]) => Math.floor(state.inventory[id] / quantity)));
}

export function getRecipe(product) {
  return Object.entries(product.recipe).map(([id, quantity]) => {
    const ingredient = ingredients.find((item) => item.id === id);
    return { productId: id, product: ingredient.name, shortName: ingredient.shortName, quantity, unit: ingredient.unit === "botellas" && quantity === 1 ? "botella" : ingredient.unit };
  });
}

// Una venta consume toda su receta o no se registra. Nunca hay existencias negativas.
export function sellProduct(state, productId, timestamp = new Date().toISOString()) {
  const product = products.find(({ id }) => id === productId);
  if (!product || getAvailableServings(state, product) <= 0) return state;
  const inventory = { ...state.inventory };
  for (const [id, quantity] of Object.entries(product.recipe)) inventory[id] -= quantity;

  return {
    ...state,
    inventory,
    sold: { ...state.sold, [productId]: state.sold[productId] + 1 },
    recentSales: [{ productId, timestamp }, ...state.recentSales].slice(0, 5),
  };
}

export function getSummary(state) {
  return {
    sold: Object.values(state.sold).reduce((total, count) => total + count, 0),
    ingredientsAvailable: ingredients.filter(({ id }) => state.inventory[id] > 0).length,
    ingredientsTotal: ingredients.length,
  };
}

// El cierre repone todo lo que falta hasta el objetivo. El mínimo solo marca urgencia.
// Función pura: este resultado puede enviarse después a una API o Function.
export function getReplenishment(state) {
  return ingredients
    .filter((ingredient) => state.inventory[ingredient.id] < getTargetStock(state, ingredient))
    .sort((a, b) => {
      const aUrgent = state.inventory[a.id] <= a.reorderAt;
      const bUrgent = state.inventory[b.id] <= b.reorderAt;
      return Number(bUrgent) - Number(aUrgent)
        || state.inventory[a.id] / getTargetStock(state, a) - state.inventory[b.id] / getTargetStock(state, b);
    })
    .map((ingredient) => {
      const quantity = Math.ceil((getTargetStock(state, ingredient) - state.inventory[ingredient.id]) / ingredient.packSize);
      return { productId: ingredient.id, product: ingredient.name, quantity, unit: quantity === 1 ? ingredient.packUnit : ingredient.packPlural };
    });
}

export function getReplenishmentTotals(items) {
  return {
    products: items.length,
    units: items.reduce((total, item) => total + item.quantity, 0),
  };
}
