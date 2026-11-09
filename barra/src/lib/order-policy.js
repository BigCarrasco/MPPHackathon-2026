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
  if (policy.paused) return "My Autopilot está en pausa. Reanúdalo para continuar.";
  if (policy.mode === "observe") return "El modo Solo observar no permite solicitar pedidos.";
  if (!draft?.items.length) return "El pedido no contiene productos.";
  if (draft.items.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) return "Revisa las cantidades del pedido.";
  if (draft.items.some((item) => !policy.allowedIngredients.includes(item.productId))) return "El pedido contiene un ingrediente fuera de los permisos del agente.";
  if (draft.items.reduce((sum, item) => sum + item.quantity, 0) > policy.maxPackages) return `El pedido supera el límite de ${policy.maxPackages} envases por solicitud.`;
  if (now - draft.createdAt >= policy.expiresMinutes * 60000) return "El borrador ha caducado. Vuelve a preparar el pedido.";
  if (orders.some(({ id }) => id === draft.id)) return "Este pedido ya está registrado.";
  if (orders.filter(({ createdAt }) => localDay(createdAt) === localDay(now)).length >= policy.maxDailyOrders) return "Has alcanzado el límite de solicitudes de hoy.";
  return "";
}
