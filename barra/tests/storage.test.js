import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, getReplenishment, getSummary, refillIngredient, resetState, sellProduct, setIngredientTarget } from "../src/lib/inventory.js";
import { loadState, saveState } from "../src/services/storage.js";

afterEach(() => { delete globalThis.localStorage; });

test("conserva los ingredientes consumidos y las ventas al recargar", () => {
  let stored;
  globalThis.localStorage = { getItem: () => stored, setItem: (_key, value) => { stored = value; } };
  const state = sellProduct(createInitialState(), "margarita-juan");
  assert.equal(saveState(state), true);
  assert.deepEqual(loadState(), state);
});

test("un estado corrupto o de la demo anterior se recupera sin bloquear la app", () => {
  for (const value of ["bad json", "null", JSON.stringify({ inventory: {}, recentSales: [] })]) {
    globalThis.localStorage = { getItem: () => value };
    assert.deepEqual(loadState(), createInitialState());
  }
});

test("rechaza existencias negativas o que no corresponden a las ventas", () => {
  for (const amount of [-1, 999]) {
    const invalid = createInitialState();
    invalid.inventory["tequila-don-juan"] = amount;
    globalThis.localStorage = { getItem: () => JSON.stringify(invalid) };
    assert.deepEqual(loadState(), createInitialState());
  }
});

test("rechaza ventas negativas o recetas que no se descontaron del inventario", () => {
  for (const count of [-1, 1]) {
    const invalid = createInitialState();
    invalid.sold["margarita-juan"] = count;
    globalThis.localStorage = { getItem: () => JSON.stringify(invalid) };
    assert.deepEqual(loadState(), createInitialState());
  }
});

test("se puede continuar cuando el navegador bloquea el almacenamiento", () => {
  globalThis.localStorage = {
    getItem: () => { throw new Error("Storage blocked"); },
    setItem: () => { throw new Error("Quota exceeded"); },
  };
  assert.deepEqual(loadState(), createInitialState());
  assert.equal(saveState(createInitialState()), false);
});

test("al ampliar el catálogo conserva las ventas antiguas y añade el stock de cervezas", () => {
  const previous = sellProduct(createInitialState(), "margarita-juan");
  delete previous.targets;
  delete previous.stockAdjustments;
  for (const id of ["beer-lager", "beer-ipa", "beer-stout", "beer-zero"]) delete previous.inventory[id];
  for (const id of ["lager", "ipa", "stout", "beer-zero"]) delete previous.sold[id];
  globalThis.localStorage = { getItem: () => JSON.stringify(previous) };
  const restored = loadState();
  assert.equal(restored.sold["margarita-juan"], 1);
  assert.equal(restored.inventory["tequila-don-juan"], 7450);
  assert.equal(restored.inventory["beer-lager"], 5);
  assert.equal(restored.sold.lager, 0);
  assert.deepEqual(restored.targets, {});
  assert.equal(restored.stockAdjustments["beer-lager"], 0);
});

test("objetivos, rellenos y ventas sobreviven a varias recargas y al reinicio", () => {
  let stored;
  globalThis.localStorage = { getItem: () => stored, setItem: (_key, value) => { stored = value; } };
  let state = setIngredientTarget(sellProduct(createInitialState(), "lager"), "beer-lager", 30);
  state = refillIngredient(state, "beer-lager");
  saveState(state);
  assert.deepEqual(loadState(), state);
  state = sellProduct(loadState(), "lager");
  saveState(state);
  assert.deepEqual(loadState(), state);
  assert.equal(loadState().inventory["beer-lager"], 29);
  assert.equal(loadState().sold.lager, 2);
  const reset = resetState(state);
  saveState(reset);
  assert.deepEqual(loadState(), reset);
  assert.deepEqual(getReplenishment(loadState()), []);
  assert.equal(getSummary(loadState()).sold, 0);
  assert.deepEqual(loadState().recentSales, []);
  assert.equal(loadState().inventory["beer-lager"], 30);
  assert.equal(loadState().targets["beer-lager"], 30);
  const refilled = sellProduct(refillIngredient(loadState(), "beer-lager"), "lager");
  saveState(refilled);
  assert.deepEqual(loadState(), refilled);
  assert.equal(loadState().inventory["beer-lager"], 29);
});

test("objetivos o ajustes inválidos no saltan la validación del inventario", () => {
  for (const invalidValue of [-1, 0, 1.5, "30"]) {
    const invalid = createInitialState();
    invalid.targets["beer-lager"] = invalidValue;
    globalThis.localStorage = { getItem: () => JSON.stringify(invalid) };
    assert.deepEqual(loadState(), createInitialState());
  }
  const invalid = createInitialState();
  invalid.stockAdjustments["beer-lager"] = 10;
  globalThis.localStorage = { getItem: () => JSON.stringify(invalid) };
  assert.deepEqual(loadState(), createInitialState());
});
