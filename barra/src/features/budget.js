import { ingredients } from '../data/ingredients.js';

const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const euros = (cents) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const micros = (value) => (value / 1_000_000).toFixed(2);
// Display existing cached responses in English as well as newly generated quotes.
const legacyErrors = {
  'Autopilot pausado o en modo observar. No se pagó.': 'Autopilot is paused or observing. No payment made.',
  'Producto fuera de los permisos del agente. No se pagó.': 'Product is not allowed. No payment made.',
  'Se supera el límite de envases. No se pagó.': 'Pack limit exceeded. No payment made.',
  'Límite diario de cotizaciones alcanzado. No se pagó.': 'Daily quote limit reached. No payment made.',
  'El micropago supera la política de gasto. No se firmó.': 'Payment exceeds the spending policy. Nothing signed.',
  'Cotización caducada. Genera una nueva solicitud.': 'Quote expired. Generate a new request.',
  'La solicitud falló antes del pago. Genera una nueva solicitud.': 'Request failed before payment. Generate a new request.',
  'Falta la cuenta de prueba. Ejecuta npm run setup:testnet.': 'Test account missing. Run npm run setup:testnet.',
};

export function initBudget({ getState, getPolicy, onNotice, log }) {
  const button = document.querySelector('#generate-budget');
  const output = document.querySelector('#budget-result');
  let busy = false;
  let renderedSnapshot = '';
  let lastResult = null;
  let attempt = null;
  let accessCode = '';
  try { attempt = JSON.parse(sessionStorage.getItem('barra:budget-attempt:v1')); } catch { /* Optional persistence. */ }
  const snapshot = () => ({ state: { inventory: getState().inventory, targets: getState().targets ?? {} }, policy: getPolicy() });
  function askAccessCode() {
    const dialog = document.querySelector('#quote-access-dialog');
    const form = document.querySelector('#quote-access-form');
    const input = document.querySelector('#quote-access-code');
    return new Promise((resolve) => {
      function finish(value) {
        input.value = '';
        form.removeEventListener('submit', submit);
        dialog.removeEventListener('cancel', cancel);
        document.querySelector('#cancel-quote-access').removeEventListener('click', cancel);
        dialog.close();
        resolve(value);
      }
      function submit(event) { event.preventDefault(); if (form.reportValidity()) finish(input.value); }
      function cancel(event) { event.preventDefault(); finish(''); }
      form.addEventListener('submit', submit);
      dialog.addEventListener('cancel', cancel);
      document.querySelector('#cancel-quote-access').addEventListener('click', cancel);
      dialog.showModal();
      input.focus();
    });
  }

  button.addEventListener('click', async () => {
    if (busy) return;
    const payload = snapshot();
    const signature = JSON.stringify(payload);
    if (!attempt || attempt.signature !== signature || (lastResult && Date.now() >= Date.parse(lastResult.quote.expiresAt))) {
      attempt = { requestId: crypto.randomUUID(), signature };
      try { sessionStorage.setItem('barra:budget-attempt:v1', JSON.stringify(attempt)); } catch { /* Keep in memory. */ }
    }
    busy = true;
    button.disabled = true;
    button.textContent = 'Requesting quote…';
    output.textContent = 'Checking policy and supplier prices…';
    try {
      const healthResponse = await fetch('/api/health');
      if (!healthResponse.ok) throw new Error('The quote API is unavailable.');
      const health = await healthResponse.json();
      if (health.demoAccessRequired && !accessCode) accessCode = await askAccessCode();
      if (health.demoAccessRequired && !accessCode) throw new Error('Quote request cancelled.');
      const headers = { 'Content-Type': 'application/json', ...(accessCode ? { Authorization: `Bearer ${accessCode}` } : {}) };
      const response = await fetch('/api/budget', { method: 'POST', headers, body: JSON.stringify({ ...payload, requestId: attempt.requestId }) });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) accessCode = '';
        const message = legacyErrors[result.error] ?? result.error ?? 'Could not generate a quote.';
        if ([400, 403, 410, 503].includes(response.status) || (response.status === 409 && message.includes('before payment'))) attempt = null;
        throw new Error(message);
      }
      renderedSnapshot = signature;
      lastResult = result;
      const payment = result.payment;
      const reference = payment?.receipt.reference;
      const transaction = /^0x[0-9a-f]{64}$/i.test(reference ?? '') ? `<a href="https://explore.testnet.tempo.xyz/tx/${reference}" target="_blank" rel="noreferrer">View Testnet transaction</a>` : '';
      const steps = ['HTTP 402 · Supplier requests payment', 'Policy approved · Spending within limits', 'Testnet payment signed · Request retried', 'HTTP 200 · Quote and receipt received'];
      output.innerHTML = `<div class="budget-heading"><strong>Estimated total ${euros(result.quote.totalCents)}</strong><span class="ops-chip">Simulated prices</span></div>
        <div class="budget-table-wrap"><table class="budget-table"><thead><tr><th>Product</th><th>Packs</th><th>Unit price</th><th>Subtotal</th></tr></thead><tbody>${result.quote.lines.map((line) => `<tr><td>${escape(ingredients.find(({ id }) => id === line.productId)?.name ?? line.product)}</td><td>${line.quantity}</td><td>${euros(line.unitPriceCents)}</td><td>${euros(line.subtotalCents)}</td></tr>`).join('')}</tbody></table></div>
        <p>Quote fee: <strong>${payment ? `${micros(payment.feeMicros)} test pathUSD` : 'Free · Stock at target'}</strong>${result.cached ? ' · Saved result, no new payment' : ''}</p>
        ${payment ? `<details><summary>Payment flow &amp; receipt</summary><ol>${steps.map((step) => `<li>${step}</li>`).join('')}</ol><p>Daily spend at issue: ${micros(payment.dailySpentMicros)} / ${micros(payment.dailyBudgetMicros)} test pathUSD. Testnet gas excluded.</p><p>Request: <code>${escape(result.requestId)}</code></p><p>Receipt: <code>${escape(reference)}</code></p>${transaction}</details>` : ''}
        <p id="budget-freshness">Valid until ${escape(new Date(result.quote.expiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))}. No inventory purchased.</p>`;
      log(`Quote ${result.requestId.slice(0, 8)}: ${euros(result.quote.totalCents)}; fee ${payment?.fee ?? '0'} test pathUSD${result.cached ? ' (saved)' : ''}. No purchase.`);
      update();
      onNotice('Quote received. No inventory purchased.');
    } catch (error) { output.textContent = error.message; onNotice(error.message, 'info'); }
    finally { busy = false; button.disabled = false; button.textContent = 'Generate quote'; }
  });

  function update() {
    const note = document.querySelector('#budget-freshness');
    if (note && renderedSnapshot !== JSON.stringify(snapshot())) note.textContent = 'Stock or rules changed. Generate an updated quote.';
    else if (note && lastResult && Date.now() >= Date.parse(lastResult.quote.expiresAt)) note.textContent = 'Quote expired. Generate a new one.';
  }
  return { update, reset() { lastResult = null; renderedSnapshot = ''; output.textContent = 'Estimated prices will appear here.'; } };
}
