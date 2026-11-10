import { Credential, Receipt } from 'mppx';
import { keccak256 } from 'viem';
import { createInitialState, getReplenishment } from '../src/lib/inventory.js';
import { CHAIN_ID, CURRENCY, PRICE, PRICE_MICROS } from './config.mjs';
import { ApiError, checkChallenge, checkPolicy, fingerprint, itemsFromState, normalizeItems, quote, scopeFor } from './quotes.mjs';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export function createApi({ config, store, payments, supplierOrigin, fetchImpl = fetch, logger = console.info }) {
  let queue = Promise.resolve();
  const serial = (fn) => { const next = queue.then(fn); queue = next.catch(() => {}); return next; };

  async function budget(body) {
    const { requestId, state, policy } = body ?? {};
    if (!/^[a-f0-9-]{36}$/i.test(requestId || '')) throw new ApiError(400, 'requestId debe ser un UUID.');
    const items = itemsFromState(state);
    const hash = fingerprint({ items, policy });
    const ledger = await store.get('budget-ledger') ?? {};
    const previous = ledger[requestId];
    if (previous) {
      if (previous.hash !== hash) throw new ApiError(409, 'Este requestId pertenece a otra propuesta.');
      if (previous.status === 'complete') {
        if (Date.now() >= Date.parse(previous.result.quote.expiresAt)) throw new ApiError(410, 'Cotización caducada. Genera una nueva solicitud.');
        return json({ ...previous.result, cached: true });
      }
      throw new ApiError(409, previous.status === 'pending'
        ? 'Pago pendiente de conciliación. No se repetirá. Revisa el registro y la transacción antes de crear otra solicitud.'
        : 'La solicitud falló antes del pago. Genera una nueva solicitud.');
    }
    const { day, spentMicros } = checkPolicy(items, policy, config, ledger);
    if (!items.length) return json({ requestId, quote: quote([]), payment: null, trace: ['Inventario completo: no se consultó ni pagó.'] });
    if (!payments.client) throw new ApiError(503, 'Falta la cuenta de prueba. Ejecuta npm run setup:testnet.');
    const trace = [];
    const log = (message) => { trace.push(message); logger(`[budget ${requestId}] ${message}`); };
    const url = new URL('/api/supplier/quote', supplierOrigin());
    url.searchParams.set('items', JSON.stringify(items));
    const unpaid = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
    if (unpaid.status !== 402) throw new ApiError(502, 'El proveedor no devolvió el desafío MPP esperado.');
    log('HTTP 402: el proveedor solicita el micropago.');
    const payment = await payments.client.preparePayment(unpaid);
    const feeMicros = checkChallenge(payment.challenge, config, spentMicros, scopeFor(items));
    log('Políticas aprobadas: Testnet, destinatario, moneda y gasto verificados.');
    // Reserve before signing; pending outcomes count against daily limits even after restart.
    const entry = { hash, day, status: 'pending', feeMicros, createdAt: Date.now() };
    ledger[requestId] = entry;
    await store.put('budget-ledger', ledger);
    let credential;
    try { credential = await payment.createCredential(); }
    catch {
      entry.status = 'failed'; entry.feeMicros = 0;
      await store.put('budget-ledger', ledger);
      throw new ApiError(502, 'No se pudo firmar en Testnet; no se envió el pago. Comprueba el faucet y la conexión RPC.');
    }
    log('Credencial firmada para Tempo Testnet; se reintenta la consulta.');
    // A pull-mode transaction hash lets the operator reconcile a lost HTTP response.
    const signed = Credential.deserialize(credential).payload;
    if (signed.type === 'transaction') {
      entry.transactionHash = keccak256(signed.signature);
      await store.put('budget-ledger', ledger);
      log(`Transacción Testnet: ${entry.transactionHash}`);
    }
    let paid;
    try {
      paid = await fetchImpl(url, { ...payment.setCredential({}, credential), redirect: 'error', signal: AbortSignal.timeout(45_000) });
      if (paid.status !== 200) throw new Error('Payment not accepted');
      const receipt = Receipt.fromResponse(paid);
      if (receipt.method !== 'tempo' || receipt.status !== 'success') throw new Error('Invalid receipt');
      const resultQuote = await paid.json();
      if (resultQuote.simulated !== true || resultQuote.inventoryPurchased !== false || fingerprint(resultQuote.lines.map(({ productId, quantity }) => ({ productId, quantity }))) !== fingerprint(items)) throw new Error('Invalid quote');
      log('HTTP 200 + Payment-Receipt: cotización recibida, sin compra de inventario.');
      const result = {
        requestId, quote: resultQuote, cached: false, trace,
        payment: { network: 'Tempo Testnet (Moderato)', chainId: CHAIN_ID, currency: 'pathUSD de prueba', feeMicros, fee: PRICE, dailySpentMicros: spentMicros + feeMicros, dailyBudgetMicros: config.maxDailyMicros, receipt, receiptHeader: paid.headers.get('Payment-Receipt') },
      };
      entry.status = 'complete'; entry.result = result;
      await store.put('budget-ledger', ledger);
      return json(result);
    } catch {
      log('Resultado de pago desconocido. Reserva retenida; no hay reintento automático.');
      throw new ApiError(502, `Resultado de pago desconocido. El gasto sigue reservado y este requestId no volverá a pagar. Revisa el registro del servidor. Transacción Testnet: ${entry.transactionHash ?? 'consulta el registro'}.`);
    }
  }

  return async function handle(request) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/health') return json({ network: 'tempo-testnet', chainId: CHAIN_ID, realPayments: false, payerConfigured: Boolean(payments.client) });
      if (url.pathname === '/llms.txt') return new Response('barra. Cotizaciones simuladas de bebidas. GET /api/supplier/quote cuesta 0.01 pathUSD solo en Tempo Testnet 42431. Devuelve HTTP 402, acepta credencial MPP y entrega precios EUR con Payment-Receipt. No compra inventario. Descubrimiento: /openapi.json.');
      if (url.pathname === '/openapi.json') return json({
        openapi: '3.1.0', info: { title: 'barra. Testnet Quote API', version: '1.1.0', description: 'Precios simulados; solo micropagos Testnet; no compra inventario.' },
        paths: { '/api/supplier/quote': { get: {
          summary: 'Cotización simulada de reabastecimiento',
          parameters: [{ name: 'items', in: 'query', required: false, description: 'Array JSON de {productId,quantity}; omitido usa el inventario inicial de la demo.', schema: { type: 'string' } }],
          'x-payment-info': { offers: [{ method: 'tempo', intent: 'charge', amount: String(PRICE_MICROS), currency: CURRENCY, description: '0.01 pathUSD de prueba por cotización; Tempo Moderato 42431' }] },
          responses: { '200': { description: 'Cotización simulada', headers: { 'Payment-Receipt': { schema: { type: 'string' } } } }, '400': { description: 'Productos inválidos' }, '402': { description: 'Payment Required', headers: { 'WWW-Authenticate': { schema: { type: 'string' } } } } },
        } } },
      });
      if (url.pathname === '/api/supplier/quote') {
        if (request.method !== 'GET') return json({ error: 'Usa GET.' }, 405);
        let value;
        try { value = url.searchParams.has('items') ? JSON.parse(url.searchParams.get('items')) : getReplenishment(createInitialState()); }
        catch { throw new ApiError(400, 'items debe ser JSON válido.'); }
        const items = normalizeItems(value);
        const result = await payments.server.charge({ amount: PRICE, scope: scopeFor(items), description: 'Cotización simulada de bebidas; sin compra; solo Testnet' })(request);
        if (result.status === 402) return result.challenge;
        return result.withReceipt(json(quote(items)));
      }
      if (url.pathname === '/api/budget') {
        if (request.method !== 'POST') return json({ error: 'Usa POST.' }, 405);
        // Local single-user MVP: JSON + same-origin rejects drive-by browser payments.
        if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) throw new ApiError(403, 'Origen no permitido.');
        if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new ApiError(415, 'Usa application/json.');
        const text = await request.text();
        if (text.length > 32_768) throw new ApiError(413, 'Solicitud demasiado grande.');
        let body;
        try { body = JSON.parse(text); } catch { throw new ApiError(400, 'JSON inválido.'); }
        return await serial(() => budget(body));
      }
      return json({ error: 'Ruta no encontrada.' }, 404);
    } catch (error) {
      logger(`[api] ${error.status ?? 500}: ${error instanceof ApiError ? error.message : 'Error interno; revisa RPC y configuración.'}`);
      return json({ error: error instanceof ApiError ? error.message : 'Error interno de la API; revisa la terminal.' }, error.status ?? 500);
    }
  };
}
