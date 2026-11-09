import test from "node:test";
import assert from "node:assert/strict";
import { products } from "../src/data/products.js";
import { ingredients } from "../src/data/ingredients.js";
import { createInitialState, getAvailableServings, getIngredientConsumption, getRecipe, getReplenishment, getReplenishmentTotals, getSummary, getTargetStock, refillIngredient, resetState, sellProduct, setIngredientTarget } from "../src/lib/inventory.js";

const product = (id) => products.find((item) => item.id === id);
function sellMany(state, id, count) {
  for (let i = 0; i < count; i++) state = sellProduct(state, id);
  return state;
}

test("las 31 bebidas tienen recetas válidas y los ejemplos de café conservan reservas amplias", () => {
  const state = createInitialState();
  assert.equal(products.length, 31);
  assert.equal(new Set(products.map(({ id }) => id)).size, 31);
  for (const drink of products) {
    assert.ok(Object.keys(drink.recipe).length > 0);
    assert.ok(getAvailableServings(state, drink) >= (drink.category === "beer" ? 1 : 50), drink.name);
    for (const [id, quantity] of Object.entries(drink.recipe)) {
      assert.ok(ingredients.some((item) => item.id === id));
      assert.ok(Number.isInteger(quantity) && quantity > 0);
    }
  }
  assert.deepEqual(getSummary(state), { sold: 0, ingredientsAvailable: 14, ingredientsTotal: 14 });
});

test("una margarita consume su receta sin modificar el estado anterior", () => {
  const initial = createInitialState();
  const next = sellProduct(initial, "margarita-juan", "2026-11-09T12:00:00.000Z");
  assert.equal(next.inventory["tequila-don-juan"], 7450);
  assert.equal(next.inventory["lime-juice"], 5970);
  assert.equal(next.inventory["orange-liqueur"], 3480);
  assert.equal(next.sold["margarita-juan"], 1);
  assert.equal(initial.inventory["tequila-don-juan"], 7500);
  assert.deepEqual(next.recentSales[0], { productId: "margarita-juan", timestamp: "2026-11-09T12:00:00.000Z" });
});

test("los dos tequilas conservan inventarios independientes", () => {
  const next = sellProduct(createInitialState(), "margarita-pepe");
  assert.equal(next.inventory["tequila-don-pepe"], 7450);
  assert.equal(next.inventory["tequila-don-juan"], 7500);
});

test("la reposición acumula el consumo y redondea los envases de coco", () => {
  const initial = createInitialState();
  assert.equal(getReplenishment(initial).length, 4);
  const before = sellMany(initial, "coconut-latte", 89);
  assert.equal(getReplenishment(before).find(({ productId }) => productId === "coconut-milk").quantity, 11);
  const next = sellProduct(before, "coconut-latte");
  assert.equal(next.inventory["coconut-milk"], 1200);
  assert.equal(next.inventory.coffee, 1980);
  assert.deepEqual(getReplenishment(next).find(({ productId }) => productId === "coconut-milk"),
    { productId: "coconut-milk", product: "Leche de coco", quantity: 11, unit: "envases" });
});

test("un ingrediente compartido actualiza otras bebidas sin sumarles ventas", () => {
  const next = sellMany(createInitialState(), "coconut-latte", 2);
  assert.equal(getAvailableServings(next, product("coconut-latte")), 98);
  assert.equal(getAvailableServings(next, product("iced-coconut-latte")), 98);
  assert.equal(getAvailableServings(next, product("coconut-matcha")), 98);
  assert.equal(getAvailableServings(next, product("coco-juan")), 117);
  assert.equal(next.sold["coco-juan"], 0);
});

test("100 lattes agotan el coco y bloquean sus recetas de forma atómica", () => {
  const state = sellMany(createInitialState(), "coconut-latte", 100);
  assert.equal(state.inventory["coconut-milk"], 0);
  assert.equal(getAvailableServings(state, product("coco-juan")), 0);
  assert.strictEqual(sellProduct(state, "coco-juan"), state);
  assert.strictEqual(sellProduct(state, "coconut-latte"), state);
  assert.equal(state.inventory["tequila-don-juan"], 7500);
  assert.equal(getSummary(state).sold, 100);
});

test("las capacidades descritas en el manual coinciden con las recetas", () => {
  const state = createInitialState();
  assert.equal(getAvailableServings(state, product("margarita-juan")), 150);
  assert.equal(getAvailableServings(state, product("coconut-latte")), 100);
  assert.equal(getAvailableServings(state, product("americano")), 200);
  const next = sellMany(state, "margarita-juan", 135);
  assert.equal(next.inventory["tequila-don-juan"], 750);
  assert.deepEqual(getReplenishment(next).find(({ productId }) => productId === "tequila-don-juan"),
    { productId: "tequila-don-juan", product: "Tequila Don Juan", quantity: 9, unit: "botellas" });
});

test("las ventas repetidas no producen existencias negativas y limitan el historial", () => {
  const state = sellMany(createInitialState(), "margarita-juan", 300);
  assert.equal(state.sold["margarita-juan"], 150);
  assert.ok(Object.values(state.inventory).every((quantity) => quantity >= 0));
  assert.equal(state.recentSales.length, 5);
  assert.strictEqual(sellProduct(state, "does-not-exist"), state);
});

test("la compra redondea a envases completos y conserva las unidades", () => {
  const next = sellMany(createInitialState(), "americano", 180);
  assert.equal(next.inventory.coffee, 360);
  assert.deepEqual(getReplenishment(next).find(({ productId }) => productId === "coffee"),
    { productId: "coffee", product: "Café molido", quantity: 13, unit: "bolsas" });
});

test("las recetas exponen cantidades y unidades para una API", () => {
  assert.deepEqual(getRecipe(product("coconut-latte")), [
    { productId: "coffee", product: "Café molido", shortName: "Café", quantity: 18, unit: "g" },
    { productId: "coconut-milk", product: "Leche de coco", shortName: "Leche de coco", quantity: 120, unit: "ml" },
  ]);
});

test("reiniciar llena el inventario y deja ventas y abastecimiento a cero", () => {
  const sold = sellProduct(createInitialState(), "coconut-latte");
  const reset = resetState(sold);
  assert.equal(sold.inventory["coconut-milk"], 11880);
  assert.ok(ingredients.every((ingredient) => reset.inventory[ingredient.id] === getTargetStock(reset, ingredient)));
  assert.ok(products.every((drink) => getAvailableServings(reset, drink) > 0));
  assert.deepEqual(getReplenishment(reset), []);
  assert.deepEqual(reset.recentSales, []);
  assert.equal(getSummary(reset).sold, 0);
  assert.deepEqual(resetState(reset), reset);
  const next = sellProduct(reset, "coconut-latte");
  assert.equal(next.sold["coconut-latte"], 1);
  assert.deepEqual(getReplenishment(next), [
    { productId: "coconut-milk", product: "Leche de coco", quantity: 1, unit: "envase" },
    { productId: "coffee", product: "Café molido", quantity: 1, unit: "bolsa" },
  ]);
});

test("el abastecimiento incluye todas las cervezas y coloca primero las urgentes", () => {
  const state = createInitialState();
  assert.deepEqual(getReplenishment(state).filter(({ productId }) => productId.startsWith("beer-")), [
    { productId: "beer-lager", product: "Cerveza lager", quantity: 19, unit: "botellas" },
    { productId: "beer-ipa", product: "Cerveza IPA", quantity: 3, unit: "botellas" },
    { productId: "beer-stout", product: "Cerveza negra", quantity: 12, unit: "botellas" },
    { productId: "beer-zero", product: "Cerveza sin alcohol", quantity: 6, unit: "botellas" },
  ]);
  const sold = sellProduct(state, "lager");
  assert.equal(sold.inventory["beer-lager"], 4);
  assert.equal(getReplenishment(sold).find(({ productId }) => productId === "beer-lager").quantity, 20);
});


test("vender cerveza sin alcohol suma al pedido sin esperar al mínimo", () => {
  const initial = createInitialState();
  assert.deepEqual(getReplenishmentTotals(getReplenishment(initial)), { products: 4, units: 40 });
  const once = sellProduct(initial, "beer-zero");
  assert.equal(once.inventory["beer-zero"], 17);
  assert.ok(once.inventory["beer-zero"] > ingredients.find(({ id }) => id === "beer-zero").reorderAt);
  assert.equal(once.sold["beer-zero"], 1);
  const order = getReplenishment(once);
  assert.equal(order.find(({ productId }) => productId === "beer-zero").quantity, 7);
  assert.deepEqual(getReplenishmentTotals(order), { products: 4, units: 41 });
  const twice = sellProduct(once, "beer-zero");
  assert.equal(getReplenishment(twice).find(({ productId }) => productId === "beer-zero").quantity, 8);
  assert.deepEqual(getReplenishmentTotals(getReplenishment(twice)), { products: 4, units: 42 });
});

test("toda receta consumida se añade al pedido aunque sus insumos sigan altos", () => {
  let state = sellProduct(createInitialState(), "beer-zero");
  state = sellProduct(state, "lager");
  state = sellProduct(state, "coconut-latte");
  const order = getReplenishment(state);
  assert.equal(order.find(({ productId }) => productId === "beer-lager").quantity, 20);
  assert.equal(order.find(({ productId }) => productId === "coconut-milk").quantity, 1);
  assert.equal(order.find(({ productId }) => productId === "coffee").quantity, 1);
  assert.deepEqual(getReplenishmentTotals(order), { products: 6, units: 44 });
});

test("un inventario completo no genera líneas ni cantidades cero", () => {
  const state = createInitialState();
  state.inventory = Object.fromEntries(ingredients.map(({ id, targetStock }) => [id, targetStock]));
  assert.deepEqual(getReplenishment(state), []);
  assert.deepEqual(getReplenishmentTotals(getReplenishment(state)), { products: 0, units: 0 });
});

test("un objetivo personalizado recalcula compras sin cambiar stock ni ventas", () => {
  const initial = sellProduct(createInitialState(), "lager");
  const state = setIngredientTarget(initial, "beer-lager", 30);
  assert.equal(state.inventory["beer-lager"], 4);
  assert.equal(state.sold.lager, 1);
  assert.equal(getReplenishment(state).find(({ productId }) => productId === "beer-lager").quantity, 26);
  assert.equal(initial.targets["beer-lager"], undefined);
  for (const invalid of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.strictEqual(setIngredientTarget(state, "beer-lager", invalid), state);
  }
});

test("rellenar conserva el consumo y permite seguir vendiendo con el objetivo guardado", () => {
  const initial = setIngredientTarget(sellProduct(createInitialState(), "coconut-latte"), "coconut-milk", 15000);
  const filled = refillIngredient(initial, "coconut-milk");
  assert.equal(initial.inventory["coconut-milk"], 11880);
  assert.equal(filled.inventory["coconut-milk"], 15000);
  assert.equal(filled.stockAdjustments["coconut-milk"], 3120);
  assert.equal(filled.sold["coconut-latte"], 1);
  assert.deepEqual(filled.recentSales, initial.recentSales);
  assert.equal(getIngredientConsumption(filled, "coconut-milk"), 120);
  assert.ok(!getReplenishment(filled).some(({ productId }) => productId === "coconut-milk"));
  const next = sellProduct(filled, "coconut-latte");
  assert.equal(next.inventory["coconut-milk"], 14880);
  assert.equal(getTargetStock(next, ingredients.find(({ id }) => id === "coconut-milk")), 15000);
  assert.equal(getIngredientConsumption(next, "coconut-milk"), 240);
  assert.equal(getReplenishment(next).find(({ productId }) => productId === "coconut-milk").quantity, 1);
});

test("reiniciar llena hasta un objetivo personalizado aunque sea menor que el stock inicial", () => {
  const state = setIngredientTarget(sellProduct(createInitialState(), "americano"), "coffee", 1000);
  assert.strictEqual(refillIngredient(state, "coffee"), state);
  const reset = resetState(state);
  assert.equal(reset.inventory.coffee, 1000);
  assert.equal(reset.targets.coffee, 1000);
  assert.equal(reset.stockAdjustments.coffee, -2600);
  assert.equal(reset.inventory["beer-lager"], 24);
  assert.deepEqual(getReplenishment(reset), []);
  assert.equal(getSummary(reset).sold, 0);
  assert.equal(refillIngredient(reset, "coffee").inventory.coffee, 1000);
});
