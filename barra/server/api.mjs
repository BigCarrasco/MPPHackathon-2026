import { Credential, Receipt } from 'mppx';
import { keccak256 } from 'viem';
import { timingSafeEqual } from 'node:crypto';
import { createInitialState, getReplenishment } from '../src/lib/inventory.js';
import { CHAIN_ID, CURRENCY, PRICE, PRICE_MICROS } from './config.mjs';
import { ApiError, checkChallenge, checkPolicy, fingerprint, itemsFromState, normalizeItems, quote, scopeFor } from './quotes.mjs';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export function createApi({ config, store, payments, supplierOrigin, fetchImpl = fetch, logger = console.info }) {
  let queue = Promise.resolve();
  const serial = (fn) => { const next = queue.then(fn); queue = next.catch(() => {}); return next; };

  async function budget(body) {
    const { requestId, state, policy } = body ?? {};
    if (!/^[a-f0-9-]{36}$/i.test(requestId || '')) throw new ApiError(400, 'requestId must be a UUID.');
    const items = itemsFromState(state);
    const hash = fingerprint({ items, policy });
    const ledger = await store.get('budget-ledger') ?? {};
    const previous = ledger[requestId];
    if (previous) {
      if (previous.hash !== hash) throw new ApiError(409, 'This requestId belongs to another proposal.');
      if (previous.status === 'complete') {
        if (Date.now() >= Date.parse(previous.result.quote.expiresAt)) throw new ApiError(410, 'Quote expired. Generate a new request.');
        return json({ ...previous.result, cached: true });
      }
      throw new ApiError(409, previous.status === 'pending'
        ? 'Payment needs reconciliation. It will not be repeated. Check the transaction before making another request.'
        : 'Request failed before payment. Generate a new request.');
    }
    const { day, spentMicros } = checkPolicy(items, policy, config, ledger);
    if (!items.length) return json({ requestId, quote: quote([]), payment: null, trace: ['Stock is at target. No quote or payment needed.'] });
    if (!payments.client) throw new ApiError(503, 'Test account missing. Run npm run setup:testnet.');
    const trace = [];
    const log = (message) => { trace.push(message); logger(`[budget ${requestId}] ${message}`); };
    const url = new URL('/api/supplier/quote', supplierOrigin());
    url.searchParams.set('items', JSON.stringify(items));
    const unpaid = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
    if (unpaid.status !== 402) throw new ApiError(502, 'Supplier did not return the expected MPP challenge.');
    log('HTTP 402: supplier requests payment.');
    const payment = await payments.client.preparePayment(unpaid);
    const feeMicros = checkChallenge(payment.challenge, config, spentMicros, scopeFor(items));
    log('Policy approved: network, recipient, currency and spending checked.');
    // Reserve before signing; pending outcomes count against daily limits even after restart.
    const entry = { hash, day, status: 'pending', feeMicros, createdAt: Date.now() };
    ledger[requestId] = entry;
    await store.put('budget-ledger', ledger);
    let credential;
    try { credential = await payment.createCredential(); }
    catch {
      entry.status = 'failed'; entry.feeMicros = 0;
      await store.put('budget-ledger', ledger);
      throw new ApiError(502, 'Testnet signing failed. No payment sent. Check test funds and RPC connection.');
    }
    log('Testnet credential signed. Retrying the quote request.');
    // A pull-mode transaction hash lets the operator reconcile a lost HTTP response.
    const signed = Credential.deserialize(credential).payload;
    if (signed.type === 'transaction') {
      entry.transactionHash = keccak256(signed.signature);
      await store.put('budget-ledger', ledger);
      log(`Testnet transaction: ${entry.transactionHash}`);
    }
    let paid;
    try {
      paid = await fetchImpl(url, { ...payment.setCredential({}, credential), redirect: 'error', signal: AbortSignal.timeout(45_000) });
      if (paid.status !== 200) throw new Error('Payment not accepted');
      const receipt = Receipt.fromResponse(paid);
      if (receipt.method !== 'tempo' || receipt.status !== 'success') throw new Error('Invalid receipt');
      const resultQuote = await paid.json();
      if (resultQuote.simulated !== true || resultQuote.inventoryPurchased !== false || fingerprint(resultQuote.lines.map(({ productId, quantity }) => ({ productId, quantity }))) !== fingerprint(items)) throw new Error('Invalid quote');
      log('HTTP 200 + Payment-Receipt: quote received. No inventory purchased.');
      const result = {
        requestId, quote: resultQuote, cached: false, trace,
        payment: { network: 'Tempo Testnet (Moderato)', chainId: CHAIN_ID, currency: 'test pathUSD', feeMicros, fee: PRICE, dailySpentMicros: spentMicros + feeMicros, dailyBudgetMicros: config.maxDailyMicros, receipt, receiptHeader: paid.headers.get('Payment-Receipt') },
      };
      entry.status = 'complete'; entry.result = result;
      await store.put('budget-ledger', ledger);
      return json(result);
    } catch {
      log('Payment outcome unknown. Spending reservation retained; no automatic retry.');
      throw new ApiError(502, `Payment outcome unknown. Spending remains reserved; this requestId will not pay again. Check the server log. Testnet transaction: ${entry.transactionHash ?? 'check the log'}.`);
    }
  }

  return async function handle(request) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/health') return json({ network: 'tempo-testnet', chainId: CHAIN_ID, realPayments: false, payerConfigured: Boolean(payments.client), demoAccessRequired: Boolean(config.demoAccessCode) });
      if (url.pathname === '/llms.txt') return new Response('barra. Simulated drink supplier quotes. GET /api/supplier/quote costs 0.01 test pathUSD on Tempo Testnet 42431. Returns HTTP 402, accepts MPP credentials and provides EUR prices with Payment-Receipt. No inventory purchase. Discovery: /openapi.json.');
      if (url.pathname === '/openapi.json') return json({
        openapi: '3.1.0', info: { title: 'barra. Testnet Quote API', version: '1.1.0', description: 'Simulated prices. Testnet payments only. No inventory purchases.' },
        paths: { '/api/supplier/quote': { get: {
          summary: 'Simulated restocking quote',
          parameters: [{ name: 'items', in: 'query', required: false, description: 'JSON array of {productId,quantity}; defaults to the initial demo inventory.', schema: { type: 'string' } }],
          'x-payment-info': { offers: [{ method: 'tempo', intent: 'charge', amount: String(PRICE_MICROS), currency: CURRENCY, description: '0.01 test pathUSD per quote; Tempo Moderato 42431' }] },
          responses: { '200': { description: 'Simulated quote', headers: { 'Payment-Receipt': { schema: { type: 'string' } } } }, '400': { description: 'Invalid products' }, '402': { description: 'Payment Required', headers: { 'WWW-Authenticate': { schema: { type: 'string' } } } } },
        } } },
      });
      if (url.pathname === '/api/supplier/quote') {
        if (request.method !== 'GET') return json({ error: 'Use GET.' }, 405);
        let value;
        try { value = url.searchParams.has('items') ? JSON.parse(url.searchParams.get('items')) : getReplenishment(createInitialState()); }
        catch { throw new ApiError(400, 'items must be valid JSON.'); }
        const items = normalizeItems(value);
        const result = await payments.server.charge({ amount: PRICE, scope: scopeFor(items), description: 'Simulated drink quote. No purchase. Testnet only.' })(request);
        if (result.status === 402) return result.challenge;
        return result.withReceipt(json(quote(items)));
      }
      if (url.pathname === '/api/budget') {
        if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
        if (config.demoAccessCode) {
          const actual = Buffer.from(request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '');
          const expected = Buffer.from(config.demoAccessCode);
          if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new ApiError(401, 'A valid demo access code is required.');
        }
        // Local single-user MVP: JSON + same-origin rejects drive-by browser payments.
        if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) throw new ApiError(403, 'Origin not allowed.');
        if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new ApiError(415, 'Use application/json.');
        const text = await request.text();
        if (text.length > 32_768) throw new ApiError(413, 'Request too large.');
        let body;
        try { body = JSON.parse(text); } catch { throw new ApiError(400, 'Invalid JSON.'); }
        return await serial(() => budget(body));
      }
      return json({ error: 'Route not found.' }, 404);
    } catch (error) {
      logger(`[api] ${error.status ?? 500}: ${error instanceof ApiError ? error.message : 'Internal error; check RPC and configuration.'}`);
      return json({ error: error instanceof ApiError ? error.message : 'Internal API error. Check the server log.' }, error.status ?? 500);
    }
  };
}
