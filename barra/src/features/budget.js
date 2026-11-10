const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const euros = (cents) => new Intl.NumberFormat('es', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const micros = (value) => (value / 1_000_000).toFixed(2);

export function initBudget({ getState, getPolicy, onNotice, log }) {
  const button = document.querySelector('#generate-budget');
  const output = document.querySelector('#budget-result');
  let busy = false;
  let renderedSnapshot = '';
  let lastResult = null;
  let attempt = null;
  try { attempt = JSON.parse(sessionStorage.getItem('barra:budget-attempt:v1')); } catch { /* Optional persistence. */ }
  const snapshot = () => ({ state: { inventory: getState().inventory, targets: getState().targets ?? {} }, policy: getPolicy() });

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
    button.textContent = 'Consultando en Testnet…';
    output.textContent = 'Solicitando precios y comprobando la política de gasto…';
    try {
      const response = await fetch('/api/budget', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, requestId: attempt.requestId }) });
      const result = await response.json();
      if (!response.ok) {
        if ([400, 403, 410, 503].includes(response.status) || (response.status === 409 && result.error.includes('antes del pago'))) attempt = null;
        throw new Error(result.error || 'No se pudo generar el presupuesto.');
      }
      renderedSnapshot = signature;
      lastResult = result;
      const payment = result.payment;
      const reference = payment?.receipt.reference;
      const transaction = /^0x[0-9a-f]{64}$/i.test(reference ?? '') ? `<a href="https://explore.testnet.tempo.xyz/tx/${reference}" target="_blank" rel="noreferrer">Ver transacción en Tempo Testnet</a>` : '';
      output.innerHTML = `<div class="budget-heading"><strong>Presupuesto estimado · ${euros(result.quote.totalCents)}</strong><span class="ops-chip">Precios simulados</span></div>
        <div class="budget-table-wrap"><table class="budget-table"><thead><tr><th>Producto</th><th>Envases</th><th>Precio unitario</th><th>Subtotal</th></tr></thead><tbody>${result.quote.lines.map((line) => `<tr><td>${escape(line.product)}</td><td>${line.quantity}</td><td>${euros(line.unitPriceCents)}</td><td>${euros(line.subtotalCents)}</td></tr>`).join('')}</tbody></table></div>
        <p>Consulta MPP: <strong>${payment ? `${micros(payment.feeMicros)} pathUSD de prueba` : 'Sin coste: inventario completo'}</strong>${result.cached ? ' · Resultado guardado, sin nuevo pago' : ''}.</p>
        ${payment ? `<p>Gasto diario al cotizar: ${micros(payment.dailySpentMicros)} / ${micros(payment.dailyBudgetMicros)} pathUSD de prueba. Gas de Testnet aparte.</p><details><summary>Ver recorrido y recibo</summary><ol>${result.trace.map((step) => `<li>${escape(step)}</li>`).join('')}</ol><p>Solicitud: <code>${escape(result.requestId)}</code></p><p>Recibo: <code>${escape(reference)}</code></p>${transaction}</details>` : ''}
        <p id="budget-freshness">Válido hasta ${escape(new Date(result.quote.expiresAt).toLocaleTimeString('es'))}. No se ha comprado inventario ni creado un pedido.</p>`;
      log(`Presupuesto ${result.requestId.slice(0, 8)}: ${euros(result.quote.totalCents)} estimados; consulta ${payment?.fee ?? '0'} pathUSD de prueba${result.cached ? ' (guardada)' : ''}. Sin compra.`);
      update();
      onNotice('Presupuesto recibido. No se compró inventario.');
    } catch (error) { output.textContent = error.message; onNotice(error.message, 'info'); }
    finally { busy = false; button.disabled = false; button.textContent = 'Generar presupuesto'; }
  });

  function update() {
    const note = document.querySelector('#budget-freshness');
    if (note && renderedSnapshot !== JSON.stringify(snapshot())) note.textContent = 'El inventario o las reglas cambiaron. Genera un presupuesto actualizado.';
    else if (note && lastResult && Date.now() >= Date.parse(lastResult.quote.expiresAt)) note.textContent = 'Este presupuesto ha caducado. Genera uno nuevo.';
  }
  return { update, reset() { lastResult = null; renderedSnapshot = ''; output.textContent = 'Genera una cotización con micropago de prueba para ver los precios.'; } };
}
