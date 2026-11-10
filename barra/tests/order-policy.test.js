import test from "node:test";
import assert from "node:assert/strict";
import { defaultPolicy, getOrderBlock, localDay } from "../src/lib/order-policy.js";

const now = new Date(2026, 10, 9, 12).getTime();
const policy = { ...defaultPolicy, allowedIngredients: ["coconut-milk"] };
const draft = { id: "draft-1", createdAt: now, items: [{ productId: "coconut-milk", quantity: 2 }] };

test("acepta una propuesta dentro de las reglas", () => {
  assert.equal(getOrderBlock(draft, policy, [], now), "");
});
test("bloquea un agente pausado o en modo observación", () => {
  assert.match(getOrderBlock(draft, { ...policy, paused: true }, [], now), /paused/);
  assert.match(getOrderBlock(draft, { ...policy, mode: "observe" }, [], now), /Observe/);
});
test("rechaza productos sin permiso aunque se cambien las reglas tras crear el borrador", () => {
  assert.match(getOrderBlock(draft, { ...policy, allowedIngredients: [] }, [], now), /permissions/);
});
test("cuenta envases completos y bloquea cantidades inválidas", () => {
  assert.match(getOrderBlock(draft, { ...policy, maxPackages: 1 }, [], now), /limit/);
  for (const quantity of [0, -1, 1.5]) {
    assert.match(getOrderBlock({ ...draft, items: [{ productId: "coconut-milk", quantity }] }, policy, [], now), /quantities/);
  }
  assert.match(getOrderBlock({ ...draft, items: [] }, policy, [], now), /empty/);
});
test("una autorización caduca exactamente al alcanzar el plazo", () => {
  assert.equal(getOrderBlock(draft, policy, [], now + 15 * 60000 - 1), "");
  assert.match(getOrderBlock(draft, policy, [], now + 15 * 60000), /expired/);
});
test("un mismo borrador no se registra dos veces", () => {
  assert.match(getOrderBlock(draft, policy, [{ id: draft.id, createdAt: now }], now), /already recorded/);
});
test("el límite diario usa la fecha local y no cuenta el día anterior", () => {
  const yesterday = new Date(2026, 10, 8, 12).getTime();
  assert.notEqual(localDay(yesterday), localDay(now));
  assert.equal(getOrderBlock(draft, { ...policy, maxDailyOrders: 1 }, [{ id: "old", createdAt: yesterday }], now), "");
  assert.match(getOrderBlock(draft, { ...policy, maxDailyOrders: 1 }, [{ id: "today", createdAt: now }], now), /daily request limit/);
});

