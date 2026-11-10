import { initOperations } from "./features/operations.js";
import { products } from "./data/products.js";
import { ingredients } from "./data/ingredients.js";
import { getAvailableServings, getIngredientConsumption, getRecipe, getReplenishment, getTargetStock, refillIngredient, resetState, sellProduct, setIngredientTarget } from "./lib/inventory.js";
import { icon } from "./lib/icons.js";
import { loadState, saveState } from "./services/storage.js";

const $ = (selector) => document.querySelector(selector);
let state = loadState();
let activeCategory = "cocktail";
let currentPage = 1;
const pageSize = 6;
let searchTerm = "";
let toastTimer;
let copyTimer;

document.querySelectorAll("[data-icon]").forEach((element) => { element.innerHTML = icon(element.dataset.icon); });

const operations = initOperations({ getState: () => state, onNotice: showToast });

function imageStyle(product) {
  const beer = product.atlas === "beers";
  const cocktail = product.atlas === "cocktails";
  const columns = beer ? 2 : 4;
  const rows = beer || cocktail ? 2 : 3;
  const file = beer ? "beers" : cocktail ? "cocktails" : "drinks";
  return `--photo-url:url('/images/${file}-atlas.png');--photo-size:${columns * 100}% ${rows * 100}%;--photo-x:${product.image % columns * 100 / (columns - 1)}%;--photo-y:${Math.floor(product.image / columns) * 100 / (rows - 1)}%`;
}

function renderProducts(lastSoldId) {
  const normalize = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const visible = products.filter((product) =>
    (activeCategory === "all" || product.category === activeCategory)
    && normalize(product.name + " " + getRecipe(product).map((item) => item.product).join(" ")).includes(normalize(searchTerm)),
  );

  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  currentPage = Math.min(currentPage, pages);
  const start = (currentPage - 1) * pageSize;
  $("#page-label").textContent = visible.length ? `${start + 1}–${Math.min(start + pageSize, visible.length)} of ${visible.length} drinks` : "No results";
  $("#page-number").textContent = `${currentPage} / ${pages}`;
  $("#previous-page").disabled = currentPage === 1;
  $("#next-page").disabled = currentPage === pages;
  $("#product-grid").innerHTML = visible.slice(start, start + pageSize).map((product) => {
    const available = getAvailableServings(state, product);
    const sold = state.sold[product.id];
    const empty = available === 0;
    const recipe = getRecipe(product).map((item) => `${item.quantity} ${item.unit} ${item.shortName}`).join(" · ");
    return `<article class="product-card ${empty ? "is-empty" : ""} ${product.id === lastSoldId ? "just-sold" : ""}" data-product="${product.id}" tabindex="-1" aria-label="${product.name}">
      <div class="product-image" style="${imageStyle(product)}" role="img" aria-label="${product.name}, sample photo">
        ${empty ? '<span class="stock-badge">Out of stock</span>' : ""}
        <span class="sale-pop" aria-hidden="true">${icon("check")} +1 sale</span>
      </div>
      <div class="product-details">
        <h3>${product.name}</h3>
        <details class="recipe-details"><summary>Recipe</summary><p>${recipe}</p></details>
        <div class="product-stock-row"><span class="stock-number ${empty ? "text-empty" : ""}"><span class="status-dot"></span><strong>${available}</strong> available</span><span class="sold-number">${sold} ${sold === 1 ? "sold" : "sold"}</span></div>
        <button class="sell-button" type="button" data-sell="${product.id}" ${empty ? "disabled" : ""} aria-label="${empty ? `${product.name}, out of stock` : `Sell ${product.name}. Available: ${available}`}">${icon(empty ? "close" : "plus")} ${empty ? "Out of stock" : "Sell"}</button>
      </div>
    </article>`;
  }).join("");
  $("#empty-search").hidden = visible.length > 0;
}

function renderReplenishmentCount() {
  const count = getReplenishment(state).length;
  $("#mobile-reorder-count").textContent = count;
  $("#mobile-reorder-count").hidden = count === 0;
}

function renderIngredients(lastSoldId) {
  const used = lastSoldId ? products.find(({ id }) => id === lastSoldId).recipe : {};
  const consumption = (ingredient) => getIngredientConsumption(state, ingredient.id) / getTargetStock(state, ingredient);
  const order = $("#ingredient-sort").value;
  const sorted = [...ingredients].sort((a, b) => {
    const difference = order === "name" ? 0 : (consumption(a) - consumption(b)) * (order === "least" ? 1 : -1);
    return difference || a.name.localeCompare(b.name, "en-GB");
  });
  $("#ingredients-list").innerHTML = sorted.map((ingredient) => {
    const stock = state.inventory[ingredient.id];
    const target = getTargetStock(state, ingredient);
    const consumed = getIngredientConsumption(state, ingredient.id);
    const low = stock < target && stock <= ingredient.reorderAt;
    const percent = Math.min(100, stock / target * 100);
    return `<div class="ingredient-item ${low ? "is-low" : ""} ${used[ingredient.id] ? "was-used" : ""}" data-ingredient="${ingredient.id}">
      <div class="ingredient-row"><strong>${ingredient.name}</strong><span><b>${stock}</b> ${ingredient.unit}</span></div>
      <div class="ingredient-meter" aria-hidden="true"><span style="width:${percent}%"></span></div>
      <p class="ingredient-consumption">Used: ${consumed} ${ingredient.unit === "bottles" && consumed === 1 ? "bottle" : ingredient.unit}</p>
      <div class="ingredient-meta"><span>Target ${target} ${ingredient.unit}</span><span>${stock === 0 ? "Empty" : low ? "Low stock" : stock < target ? "Below target" : "At target"}</span></div>
      <form class="ingredient-target-form" data-target-form="${ingredient.id}">
        <label for="target-${ingredient.id}">Target stock (${ingredient.unit})</label>
        <div class="ingredient-target-controls"><input id="target-${ingredient.id}" name="target" type="number" min="1" max="${Number.MAX_SAFE_INTEGER}" step="1" value="${target}" required /><button type="submit">Save target</button></div>
      </form>
      <button class="ingredient-refill" type="button" data-refill="${ingredient.id}" ${stock >= target ? "disabled" : ""}>Refill to target</button>
    </div>`;
  }).join("");
}

$("#ingredient-sort").addEventListener("change", () => {
  renderIngredients();
  $("#ingredients-panel").scrollTop = 0;
});

$("#ingredients-list").addEventListener("submit", (event) => {
  const form = event.target.closest("[data-target-form]");
  if (!form) return;
  event.preventDefault();
  if (!form.reportValidity()) return;
  const ingredientId = form.dataset.targetForm;
  const nextState = setIngredientTarget(state, ingredientId, form.elements.target.valueAsNumber);
  if (nextState === state) return;
  state = nextState;
  const persisted = saveState(state);
  render();
  $(`#target-${ingredientId}`).focus({ preventScroll: true });
  showToast(persisted ? "Target saved. Stock unchanged." : "Target updated for this session only.", persisted ? "success" : "info");
});

$("#ingredients-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-refill]");
  if (!button || button.disabled) return;
  const ingredientId = button.dataset.refill;
  const nextState = refillIngredient(state, ingredientId);
  if (nextState === state) return;
  const added = nextState.inventory[ingredientId] - state.inventory[ingredientId];
  state = nextState;
  const persisted = saveState(state);
  const ingredient = ingredients.find(({ id }) => id === ingredientId);
  render();
  $(`#target-${ingredientId}`).focus({ preventScroll: true });
  showToast(persisted ? `${ingredient.name}: added ${added} ${ingredient.unit}.` : "Stock refilled for this session only.", persisted ? "success" : "info");
});

function renderReplenishment() {
  const items = getReplenishment(state);
  $("#replenishment-list").innerHTML = items.length ? items.map((item) => {
    const ingredient = ingredients.find(({ id }) => id === item.productId);
    return `<div class="replenishment-item"><div class="replenishment-item-copy"><strong>${item.product}</strong><span>${state.inventory[item.productId]} ${ingredient.unit} in stock · ${ingredient.packSize} per pack</span></div><span class="quantity-pill">${item.quantity} ${item.unit}</span></div>`;
  }).join("") : `<div class="replenishment-empty">${icon("check")}<p>Stock is at target.</p></div>`;
  $("#copy-order").disabled = items.length === 0;
}

function renderImpact() {
  const lastSale = state.recentSales[0];
  if (!lastSale) {
    $("#sale-impact").innerHTML = '<p class="impact-tip">No sales yet.</p>';
    return;
  }
  const product = products.find(({ id }) => id === lastSale.productId);
  $("#sale-impact").innerHTML = `<p class="last-sale-name">${icon("check")} ${product.name} <span>+1 sale</span></p><div class="used-ingredients">${getRecipe(product).map((item) => `<span>−${item.quantity} ${item.unit} ${item.shortName}</span>`).join("")}</div>`;
}

function render(lastSoldId) {
  renderReplenishmentCount();
  renderProducts(lastSoldId);
  renderIngredients(lastSoldId);
  renderReplenishment();
  renderImpact();
  operations.render();
}

function showToast(message, kind = "success") {
  clearTimeout(toastTimer);
  const toast = $("#toast");
  toast.replaceChildren();
  const text = document.createElement("span");
  text.textContent = message;
  toast.insertAdjacentHTML("afterbegin", icon(kind === "success" ? "check" : "clock"));
  toast.append(text);
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3000);
}

$("#product-grid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-sell]");
  if (!button || button.disabled) return;
  const productId = button.dataset.sell;
  const nextState = sellProduct(state, productId);
  if (nextState === state) return;
  state = nextState;
  const persisted = saveState(state);
  const product = products.find(({ id }) => id === productId);
  const available = getAvailableServings(state, product);
  render(productId);
  const card = document.querySelector(`[data-product="${productId}"]`);
  (available ? card.querySelector("button") : card).focus({ preventScroll: true });
  $("#sale-announcer").textContent = `${product.name} sold. ${available} available. ${getReplenishment(state).length} ingredients need restocking.`;
  showToast(persisted ? `${product.name} · sale recorded` : "Sale recorded for this session only.", persisted ? "success" : "info");

  // Conecta una API o Function escuchando este evento. No se envía nada todavía.
  window.dispatchEvent(new CustomEvent("barra:sale", {
    detail: {
      productId, product: product.name, quantity: 1,
      available, sold: state.sold[productId],
      timestamp: state.recentSales[0].timestamp,
      consumed: getRecipe(product).map(({ shortName, ...item }) => item),
      inventory: { ...state.inventory },
      replenishment: getReplenishment(state),
    },
  }));
});

document.querySelectorAll("[data-category]").forEach((button) => {
  button.addEventListener("click", () => {
    activeCategory = button.dataset.category;
    currentPage = 1;
    document.querySelectorAll("[data-category]").forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
    renderProducts();
    $("#catalog-frame").scrollTop = 0;
  });
});

document.querySelectorAll("button[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    document.body.dataset.view = view;
    operations.render();
    $("#ingredients-panel").hidden = view !== "ingredients";
    $("#replenishment-panel").hidden = view !== "replenishment";
    $("#inspector-title").textContent = view === "ingredients" ? "Ingredients" : "Restocking";
    document.querySelectorAll("button[data-view]").forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
    if (matchMedia("(max-width: 760px)").matches && !document.body.classList.contains("navigation-collapsed")) navigationToggle.click();
    window.scrollTo(0, 0);
  });
});

$("#previous-page").addEventListener("click", () => { currentPage--; renderProducts(); });
$("#next-page").addEventListener("click", () => { currentPage++; renderProducts(); });

$("#product-search").addEventListener("input", (event) => {
  searchTerm = event.target.value.trim();
  currentPage = 1;
  renderProducts();
  $("#catalog-frame").scrollTop = 0;
});

$("#clear-filters").addEventListener("click", () => {
  searchTerm = "";
  $("#product-search").value = "";
  document.querySelector('[data-category="cocktail"]').click();
  $("#product-search").focus();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !$("#copy-dialog").open && !$("#order-dialog").open && !event.target.matches("input, textarea, [contenteditable]")) {
    event.preventDefault();
    document.querySelector('button[data-view="catalog"]').click();
    $("#product-search").focus();
  }
});

document.querySelectorAll("[data-reset-demo]").forEach((button) => button.addEventListener("click", () => {
  state = resetState(state);
  const persisted = saveState(state);
  operations.reset();
  render();
  $("#sale-announcer").textContent = "Stock refilled. Local sales and requests cleared.";
  showToast(persisted ? "Demo reset. Stock refilled." : "Demo reset for this session only.", persisted ? "success" : "info");
}));

$("#copy-order").addEventListener("click", async () => {
  const data = JSON.stringify({ items: getReplenishment(state) }, null, 2);
  try {
    await navigator.clipboard.writeText(data);
    clearTimeout(copyTimer);
    $("#copy-order-label").textContent = "Copied";
    showToast("Restocking list copied.");
    copyTimer = setTimeout(() => { $("#copy-order-label").textContent = "Copy restocking list"; }, 2400);
  } catch {
    $("#order-json").value = data;
    $("#copy-dialog").showModal();
    $("#order-json").select();
  }
});

$("#close-copy-dialog").addEventListener("click", () => $("#copy-dialog").close());
$("#select-order").addEventListener("click", () => { $("#order-json").focus(); $("#order-json").select(); });
$("#copy-dialog").addEventListener("click", (event) => { if (event.target === $("#copy-dialog")) $("#copy-dialog").close(); });

render();

// Preferencia visual independiente del inventario.
const navigationToggle = $("#toggle-navigation");
function setNavigationCollapsed(collapsed) {
  document.body.classList.toggle("navigation-collapsed", collapsed);
  const hiddenOnMobile = collapsed && matchMedia("(max-width: 760px)").matches;
  document.querySelector(".workspace-tabs").inert = hiddenOnMobile;
  document.querySelector(".navigation-footer").inert = hiddenOnMobile;
  navigationToggle.setAttribute("aria-expanded", String(!collapsed));
  navigationToggle.setAttribute("aria-label", collapsed ? "Expand menu" : "Collapse menu");
  navigationToggle.title = collapsed ? "Expand menu" : "Collapse menu";
  navigationToggle.querySelector(".toggle-arrow").setAttribute("d", collapsed ? "m14 9 3 3-3 3" : "m16 9-3 3 3 3");
}
try {
  const saved = localStorage.getItem("barra:navigation-collapsed");
  setNavigationCollapsed(saved === null ? matchMedia("(max-width: 760px)").matches : saved === "true");
} catch { /* El menú también funciona sin almacenamiento. */ }
navigationToggle.addEventListener("click", () => {
  const collapsed = !document.body.classList.contains("navigation-collapsed");
  setNavigationCollapsed(collapsed);
  try { localStorage.setItem("barra:navigation-collapsed", String(collapsed)); } catch { /* Preferencia temporal. */ }
});

$("#navigation-scrim").addEventListener("click", () => navigationToggle.click());
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("#order-dialog").open && !$("#copy-dialog").open && !document.body.classList.contains("navigation-collapsed")) {
    navigationToggle.click();
    navigationToggle.focus();
  }
});

matchMedia("(max-width: 760px)").addEventListener("change", () => {
  setNavigationCollapsed(document.body.classList.contains("navigation-collapsed"));
});

