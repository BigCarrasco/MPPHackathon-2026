import { createHash } from 'node:crypto';
import { PaymentRequest } from 'mppx';
import { ingredients } from '../src/data/ingredients.js';
import { getReplenishment } from '../src/lib/inventory.js';

const prices = { 'tequila-don-juan': 2400, 'tequila-don-pepe': 2100, 'coconut-milk': 250, 'lime-juice': 300, 'orange-liqueur': 1800, 'grapefruit-juice': 280, 'orange-juice': 240, grenadine: 650, coffee: 700, matcha: 1200, 'beer-lager': 120, 'beer-ipa': 180, 'beer-stout': 160, 'beer-zero': 130 };
export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const fingerprint = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const scopeFor = (items) => `barra-quote:${fingerprint(items)}`;

export function normalizeItems(value) {
  if (!Array.isArray(value) || !value.length || value.length > ingredients.length) throw new ApiError(400, 'The quote needs valid products.');
  const seen = new Set();
  const items = value.map(({ productId, quantity } = {}) => {
    const ingredient = ingredients.find(({ id }) => id === productId);
    if (!ingredient || seen.has(productId) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 200) throw new ApiError(400, 'Invalid product, quantity or duplicate product.');
    seen.add(productId);
    return { productId, quantity };
  }).sort((a, b) => a.productId.localeCompare(b.productId));
  if (items.reduce((sum, item) => sum + item.quantity, 0) > 200) throw new ApiError(400, 'A quote can contain up to 200 packs.');
  return items;
}

export function itemsFromState(state) {
  if (!state?.inventory || !state.targets || typeof state.targets !== 'object') throw new ApiError(400, 'Demo inventory is missing.');
  for (const { id } of ingredients) {
    if (!Number.isSafeInteger(state.inventory[id]) || state.inventory[id] < 0 || state.inventory[id] > 100_000) throw new ApiError(400, 'Invalid stock quantities.');
  }
  for (const [id, quantity] of Object.entries(state.targets)) {
    if (!ingredients.some((item) => item.id === id) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100_000) throw new ApiError(400, 'Invalid stock target.');
  }
  const items = getReplenishment(state);
  return items.length ? normalizeItems(items) : [];
}

export function checkPolicy(items, policy, config, ledger, now = Date.now()) {
  if (!policy || typeof policy.paused !== 'boolean' || !['propose', 'observe'].includes(policy.mode)
    || !Array.isArray(policy.allowedIngredients) || !Number.isInteger(policy.maxPackages) || policy.maxPackages < 1
    || !Number.isInteger(policy.maxDailyOrders) || policy.maxDailyOrders < 1) throw new ApiError(400, 'Invalid Autopilot policy.');
  if (config.paused || policy.paused || policy.mode === 'observe') throw new ApiError(403, 'Autopilot is paused or observing. No payment made.');
  if (items.some(({ productId }) => !policy.allowedIngredients.includes(productId))) throw new ApiError(403, 'Product is not allowed. No payment made.');
  if (items.reduce((sum, item) => sum + item.quantity, 0) > Math.min(policy.maxPackages, config.maxPackages)) throw new ApiError(403, 'Pack limit exceeded. No payment made.');
  const day = new Date(now).toISOString().slice(0, 10);
  const today = Object.values(ledger).filter((entry) => entry.day === day && entry.status !== 'failed');
  if (today.length >= Math.min(config.maxDailyQuotes, policy.maxDailyOrders)) throw new ApiError(403, 'Daily quote limit reached. No payment made.');
  return { day, spentMicros: today.reduce((sum, entry) => sum + entry.feeMicros, 0) };
}

export function checkChallenge(challenge, config, spentMicros, scope) {
  const request = challenge.request;
  const details = request?.methodDetails;
  const meta = challenge.opaque ? PaymentRequest.deserialize(challenge.opaque) : challenge.meta;
  if (challenge.method !== 'tempo' || challenge.intent !== 'charge' || details?.chainId !== 42431
    || request.currency?.toLowerCase() !== '0x20c0000000000000000000000000000000000000'
    || request.recipient?.toLowerCase() !== config.recipient.toLowerCase()
    || (request.splits?.length ?? 0) > 0 || request.amount !== '10000'
    || meta?._mppx_scope !== scope) throw new ApiError(403, 'Payment terms are not allowed. Nothing signed.');
  const amount = Number(request.amount);
  if (amount > config.maxPerQuoteMicros || spentMicros + amount > config.maxDailyMicros) throw new ApiError(403, 'Payment exceeds the spending policy. Nothing signed.');
  return amount;
}

export function quote(items, now = Date.now()) {
  const lines = items.map(({ productId, quantity }) => {
    const ingredient = ingredients.find(({ id }) => id === productId);
    return { productId, product: ingredient.name, quantity, unit: quantity === 1 ? ingredient.packUnit : ingredient.packPlural, unitPriceCents: prices[productId], subtotalCents: prices[productId] * quantity, available: 200 };
  });
  return { supplier: 'barra. demo supplier', simulated: true, currency: 'EUR', lines, totalCents: lines.reduce((sum, line) => sum + line.subtotalCents, 0), createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 15 * 60_000).toISOString(), inventoryPurchased: false };
}
