import { products } from "../data/products.js";
import { ingredients } from "../data/ingredients.js";
import { getIngredientConsumption, getReplenishment, getReplenishmentTotals, getTargetStock } from "../lib/inventory.js";
import { defaultPolicy, DEMO_KEY, getOrderBlock, localDay } from "../lib/order-policy.js";
import { icon } from "../lib/icons.js";
import { initBudget } from "./budget.js";

const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const storageKey = "barra:operations:v1";
const freshPolicy = () => ({ ...defaultPolicy, allowedIngredients: ingredients.map(({ id }) => id) });
const time = (value) => new Intl.DateTimeFormat("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

function loadOperations() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    const policy = saved?.policy;
    if (!policy || typeof policy.paused !== "boolean" || !["observe", "propose"].includes(policy.mode)
      || !Number.isInteger(policy.maxPackages) || policy.maxPackages < 1 || policy.maxPackages > 200
      || !Number.isInteger(policy.maxDailyOrders) || policy.maxDailyOrders < 1 || policy.maxDailyOrders > 50
      || !Number.isInteger(policy.expiresMinutes) || policy.expiresMinutes < 1 || policy.expiresMinutes > 60
      || !Array.isArray(policy.allowedIngredients) || !policy.allowedIngredients.every((id) => ingredients.some((item) => item.id === id))) throw new Error("Invalid policy");
    return {
      policy,
      orders: (Array.isArray(saved.orders) ? saved.orders : []).filter((order) => typeof order.id === "string" && Number.isFinite(order.createdAt) && Array.isArray(order.items) && order.items.length && order.items.every((item) => ingredients.some(({ id }) => id === item.productId) && Number.isInteger(item.quantity) && item.quantity > 0)).slice(0, 100),
      audit: (Array.isArray(saved.audit) ? saved.audit : []).filter((entry) => Number.isFinite(entry.at) && typeof entry.message === "string").slice(0, 30),
    };
  } catch { return { policy: freshPolicy(), orders: [], audit: [] }; }
}

export function initOperations({ getState, onNotice }) {
  const saved = loadOperations();
  let policy = saved.policy;
  let orders = saved.orders;
  let audit = saved.audit;
  let dayTab = "sales";
  let draft = null;
  let submitted = false;
  const budget = initBudget({ getState, getPolicy: () => ({ ...policy }), onNotice, log });

  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify({ policy, orders, audit })); }
    catch { onNotice("Los cambios funcionan durante esta sesión, pero no se pudieron guardar.", "info"); }
  }
  function log(message) {
    audit = [{ at: Date.now(), message }, ...audit].slice(0, 30);
    persist();
    renderAudit();
  }
  function getItems() {
    return getReplenishment(getState());
  }

  function itemRows(items) {
    return items.map((item) => {
      const ingredient = ingredients.find(({ id }) => id === item.productId);
      return `<div class="receipt-item"><div><strong>${escape(ingredient.name)}</strong><small>Hay ${getState().inventory[ingredient.id]} ${ingredient.unit} · Objetivo ${getTargetStock(getState(), ingredient)}</small></div><span>${item.quantity} ${escape(item.quantity === 1 ? ingredient.packUnit : ingredient.packPlural)}</span></div>`;
    }).join("");
  }
  function renderDayDetail() {
    const state = getState();
    const rows = dayTab === "sales"
      ? products.filter(({ id }) => state.sold[id] > 0).map((product) => ({ name: product.name, value: `${state.sold[product.id]} ${state.sold[product.id] === 1 ? "bebida" : "bebidas"}` }))
      : ingredients.filter((item) => getIngredientConsumption(state, item.id) > 0).map((item) => ({ name: item.name, value: `${getIngredientConsumption(state, item.id)} ${item.unit}` }));
    $("#day-detail").innerHTML = rows.length ? rows.map((row) => `<div class="day-detail-row"><span>${escape(row.name)}</span><strong>${row.value}</strong></div>`).join("") : '<div class="ops-empty">Tu jornada empieza con la primera venta.</div>';
  }
  function renderAudit() {
    $("#audit-entries").innerHTML = audit.length ? audit.map((entry) => `<div class="audit-entry"><span class="status-dot"></span><p>${escape(entry.message)}</p><time>${time(entry.at)}</time></div>`).join("") : '<div class="ops-empty">Aquí aparecerán los cambios de reglas y las solicitudes de prueba.</div>';
  }
  function render() {
    budget.update();
    const state = getState();
    const items = getItems();
    const totals = getReplenishmentTotals(items);
    $("#operations-date").textContent = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    $("#day-sales").textContent = totals.units;
    $("#day-reorder").textContent = getReplenishment(state).length;
    $("#day-orders").textContent = orders.filter(({ createdAt }) => localDay(createdAt) === localDay()).length;
    renderDayDetail();
    $("#receipt-status").textContent = "Reposición completa";
    $("#receipt-items").innerHTML = items.length ? itemRows(items) : '<div class="receipt-empty">Tu inventario está completo.<br/><span>Cada venta actualizará lo que falta para recuperar el objetivo.</span></div>';
    $("#receipt-lines").textContent = totals.products;
    $("#receipt-units").textContent = totals.units;
    $("#example-order").textContent = "Recalcular necesidades";
    const block = getOrderBlock({ id: "preview", createdAt: Date.now(), items }, policy, orders);
    $("#order-policy-note").textContent = items.length ? block || "Aprobación humana + clave demo antes de registrar." : "";
    $("#close-order").disabled = Boolean(block);
    $("#autopilot-status").textContent = policy.paused ? "Autopilot en pausa" : policy.mode === "observe" ? "Solo observar · No se permiten solicitudes" : "Aprobación humana obligatoria";
    $("#pause-autopilot").textContent = policy.paused ? "Reanudar Autopilot" : "Pausar Autopilot";
    $("#request-history").innerHTML = orders.length ? orders.slice(0, 8).map((order) => `<details class="request-record"><summary><span>${escape(order.reference)}</span><span class="ops-chip">Registrada · Demo</span><time>${time(order.createdAt)}</time></summary>${itemRows(order.items)}</details>`).join("") : '<div class="ops-empty">Aún no has registrado solicitudes. Ningún pedido se envía automáticamente.</div>';
    renderAudit();
  }

  const form = $("#governance-form");
  function fillPolicy() {
    for (const name of ["mode", "maxPackages", "maxDailyOrders", "expiresMinutes"]) form.elements[name].value = policy[name];
    $("#allowed-ingredients").innerHTML = ingredients.map((item) => `<label><input type="checkbox" name="allowed" value="${item.id}" ${policy.allowedIngredients.includes(item.id) ? "checked" : ""}/><span>${item.name}</span></label>`).join("");
  }
  fillPolicy();
  form.addEventListener("input", () => { $("#policy-save-state").textContent = "Cambios sin guardar"; });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    policy = { ...policy, mode: form.elements.mode.value, maxPackages: Number(form.elements.maxPackages.value), maxDailyOrders: Number(form.elements.maxDailyOrders.value), expiresMinutes: Number(form.elements.expiresMinutes.value), allowedIngredients: [...form.querySelectorAll('[name="allowed"]:checked')].map((input) => input.value) };
    log("Reglas actualizadas. Se mantiene la aprobación humana obligatoria.");
    $("#policy-save-state").textContent = "Guardada localmente";
    render();
    onNotice("Reglas de demostración guardadas.");
  });
  $("#pause-autopilot").addEventListener("click", () => {
    policy = { ...policy, paused: !policy.paused };
    log(policy.paused ? "Autopilot pausado por el responsable." : "Autopilot reanudado por el responsable.");
    render();
  });
  document.querySelectorAll("[data-day-tab]").forEach((button) => button.addEventListener("click", () => {
    dayTab = button.dataset.dayTab;
    document.querySelectorAll("[data-day-tab]").forEach((tab) => { tab.classList.toggle("is-active", tab === button); tab.setAttribute("aria-pressed", String(tab === button)); });
    renderDayDetail();
  }));
  document.querySelectorAll("[data-governance-tab]").forEach((button) => button.addEventListener("click", () => {
    const tab = button.dataset.governanceTab;
    form.hidden = tab !== "rules";
    $("#agents-panel").hidden = tab !== "agents";
    $("#audit-panel").hidden = tab !== "audit";
    document.querySelectorAll("[data-governance-tab]").forEach((item) => { item.classList.toggle("is-active", item === button); item.setAttribute("aria-pressed", String(item === button)); });
  }));
  $("#example-order").addEventListener("click", () => { render(); onNotice("Pedido actualizado desde el inventario."); });
  const dialog = $("#order-dialog");
  const password = $("#demo-password");
  function clearPassword() {
    password.value = "";
    password.type = "password";
    $("#show-demo-password").textContent = "Ver";
    $("#show-demo-password").setAttribute("aria-label", "Mostrar clave");
    $("#show-demo-password").setAttribute("aria-pressed", "false");
  }
  function dismiss() { clearPassword(); dialog.close(); }
  $("#close-order").addEventListener("click", () => {
    draft = { id: crypto.randomUUID(), createdAt: Date.now(), items: getItems().map((item) => ({ ...item })) };
    const error = getOrderBlock(draft, policy, orders);
    if (error) { onNotice(error, "info"); return; }
    submitted = false;
    $("#confirmation-items").innerHTML = itemRows(draft.items);
    $("#order-review").hidden = false;
    $("#order-success").hidden = true;
    $("#order-step").textContent = "Paso 1 de 2 · Cajero de cierre";
    $("#authorization-error").textContent = "";
    $("#confirm-order").disabled = false;
    clearPassword();
    dialog.showModal();
  });
  $("#authorize-order").addEventListener("submit", (event) => {
    event.preventDefault();
    if (submitted) return;
    const block = getOrderBlock(draft, policy, orders);
    const error = block || (password.value !== DEMO_KEY ? "La clave de demostración no coincide. Usa BARRA-DEMO." : "");
    if (error) {
      $("#authorization-error").textContent = error;
      log(block ? `Solicitud bloqueada: ${block}` : "Validación de clave demo fallida. No se registró el pedido.");
      password.focus();
      return;
    }
    submitted = true;
    $("#confirm-order").disabled = true;
    const order = { ...draft, createdAt: Date.now(), reference: `DEMO-${draft.id.slice(0, 8).toUpperCase()}` };
    orders = [order, ...orders].slice(0, 100);
    log(`Solicitud ${order.reference} registrada con aprobación humana. Sin envío ni pago.`);
    clearPassword();
    $("#order-review").hidden = true;
    $("#order-success").hidden = false;
    $("#order-step").textContent = "Paso 2 de 2 · Registrada en la demo";
    $("#order-reference").textContent = order.reference;
    render();
    $("#finish-order").focus();
  });
  $("#show-demo-password").addEventListener("click", () => {
    const show = password.type === "password";
    password.type = show ? "text" : "password";
    $("#show-demo-password").textContent = show ? "Ocultar" : "Ver";
    $("#show-demo-password").setAttribute("aria-pressed", String(show));
    $("#show-demo-password").setAttribute("aria-label", show ? "Ocultar clave" : "Mostrar clave");
  });
  for (const selector of ["#dismiss-order", "#back-to-draft", "#finish-order"]) $(selector).addEventListener("click", dismiss);
  dialog.addEventListener("close", clearPassword);
  dialog.addEventListener("cancel", clearPassword);
  return {
    render,
    reset() { orders = []; audit = []; draft = null; budget.reset(); dismiss(); persist(); render(); },
  };
}

