import { products } from "../data/products.js";
import { ingredients } from "../data/ingredients.js";
import { createInitialState } from "../lib/inventory.js";

const STORAGE_KEY = "barra:simulation:ingredients:v3";

export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !saved.inventory || !Array.isArray(saved.recentSales)) return createInitialState();

    // Una versión antigua o un almacenamiento corrupto no debe romper la barra.
    const validSales = products.every(({ id }) => Number.isSafeInteger(saved.sold?.[id] ?? 0) && (saved.sold?.[id] ?? 0) >= 0);
    if (!validSales) return createInitialState();
    const valid = ingredients.every((ingredient) => {
      const stock = saved.inventory?.[ingredient.id] ?? ingredient.initialStock;
      const adjustment = saved.stockAdjustments?.[ingredient.id] ?? 0;
      const target = saved.targets?.[ingredient.id] ?? ingredient.targetStock;
      const used = products.reduce((total, product) => total + (product.recipe[ingredient.id] || 0) * (saved.sold?.[product.id] ?? 0), 0);
      return Number.isSafeInteger(stock) && stock >= 0
        && Number.isSafeInteger(adjustment) && Number.isSafeInteger(used)
        && Number.isSafeInteger(target) && target > 0
        && stock === ingredient.initialStock + adjustment - used;
    });
    if (!valid) return createInitialState();

    return {
      inventory: Object.fromEntries(ingredients.map(({ id, initialStock }) => [id, saved.inventory[id] ?? initialStock])),
      targets: Object.fromEntries(ingredients.filter(({ id }) => saved.targets?.[id] != null).map(({ id }) => [id, saved.targets[id]])),
      stockAdjustments: Object.fromEntries(ingredients.map(({ id }) => [id, saved.stockAdjustments?.[id] ?? 0])),
      sold: Object.fromEntries(products.map(({ id }) => [id, saved.sold?.[id] ?? 0])),
      recentSales: saved.recentSales.filter((sale) =>
        sale && products.some(({ id }) => id === sale.productId)
        && typeof sale.timestamp === "string" && Number.isFinite(Date.parse(sale.timestamp)),
      ).slice(0, 5).map((sale) => ({ productId: sale.productId, timestamp: new Date(sale.timestamp).toISOString() })),
    };
  } catch {
    return createInitialState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    // Si el navegador bloquea el almacenamiento, se puede seguir vendiendo.
    return false;
  }
}
