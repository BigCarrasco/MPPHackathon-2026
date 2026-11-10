// Reglas de la simulación. La autorización real deberá ejecutarse en el servidor.
export const DEMO_KEY = "BARRA-DEMO";
export const defaultPolicy = {
  paused: false,
  mode: "propose",
  maxPackages: 50,
  maxDailyOrders: 5,
  expiresMinutes: 15,
};

export function localDay(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function getOrderBlock(draft, policy, orders, now = Date.now()) {
  if (policy.paused) return "Autopilot is paused.";
  if (policy.mode === "observe") return "Observe-only mode blocks requests.";
  if (!draft?.items.length) return "The request is empty.";
  if (draft.items.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) return "Check the quantities.";
  if (draft.items.some((item) => !policy.allowedIngredients.includes(item.productId))) return "An ingredient is outside the allowed permissions.";
  if (draft.items.reduce((sum, item) => sum + item.quantity, 0) > policy.maxPackages) return `The request exceeds the limit of ${policy.maxPackages} packs.`;
  if (now - draft.createdAt >= policy.expiresMinutes * 60000) return "This draft has expired. Review it again.";
  if (orders.some(({ id }) => id === draft.id)) return "This request is already recorded.";
  if (orders.filter(({ createdAt }) => localDay(createdAt) === localDay(now)).length >= policy.maxDailyOrders) return "The daily request limit has been reached.";
  return "";
}

