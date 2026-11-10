import test from 'node:test';
import assert from 'node:assert/strict';
import { Challenge, Credential, Receipt } from 'mppx';
import { Store } from 'mppx/server';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApi } from '../server/api.mjs';
import { readConfig, testnetResolver } from '../server/config.mjs';
import { createPayments } from '../server/payments.mjs';
import { openStore } from '../server/store.mjs';
import { checkChallenge, checkPolicy, normalizeItems, quote, scopeFor } from '../server/quotes.mjs';
import { createInitialState, getReplenishment, resetState } from '../src/lib/inventory.js';
import { defaultPolicy } from '../src/lib/order-policy.js';
import { ingredients } from '../src/data/ingredients.js';

const config = { recipient: '0x1111111111111111111111111111111111111111', secretKey: 'a'.repeat(64), maxPerQuoteMicros: 10000, maxDailyMicros: 20000, maxDailyQuotes: 5, maxPackages: 50 };
const policy = { ...defaultPolicy, allowedIngredients: ingredients.map(({ id }) => id) };
const items = normalizeItems(getReplenishment(createInitialState()));
const request = { amount: '10000', currency: '0x20c0000000000000000000000000000000000000', recipient: config.recipient, methodDetails: { chainId: 42431 } };
const challenge = { method: 'tempo', intent: 'charge', request, meta: { _mppx_scope: scopeFor(items) } };

test('calcula 40 envases y 55,20 EUR sin mutar inventario', () => {
  const state = createInitialState(), before = structuredClone(state);
  const result = quote(normalizeItems(getReplenishment(state)));
  assert.equal(result.totalCents, 5520);
  assert.equal(result.inventoryPurchased, false);
  assert.deepEqual(state, before);
  for (const value of [[], [{ productId: 'unknown', quantity: 1 }], [{ productId: 'beer-lager', quantity: -1 }], [items[0], items[0]]]) assert.throws(() => normalizeItems(value));
});

test('rechaza mainnet, RPC configurable y pagos no autorizados antes de firmar', () => {
  for (const key of ['TEMPO_CHAIN_ID', 'TEMPO_RPC_URL', 'MPP_CURRENCY', 'MPP_TESTNET']) assert.throws(() => readConfig({ [key]: '4217' }), /solo Tempo Testnet/);
  assert.throws(() => testnetResolver({ chain: { id: 42431 } })({ chainId: 4217 }));
  assert.equal(checkChallenge(challenge, config, 0, scopeFor(items)), 10000);
  for (const patch of [{ amount: '10001' }, { recipient: '0x2222222222222222222222222222222222222222' }, { currency: 'usd' }, { methodDetails: { chainId: 4217 } }, { splits: [{}] }]) assert.throws(() => checkChallenge({ ...challenge, request: { ...request, ...patch } }, config, 0, scopeFor(items)));
  assert.throws(() => checkChallenge(challenge, config, 10001, scopeFor(items)), /gasto/);
  assert.throws(() => checkChallenge(challenge, config, 0, 'different-cart'));
});

test('políticas bloquean pausa, modo observar, permisos y límites', () => {
  for (const patch of [{ paused: true }, { mode: 'observe' }, { allowedIngredients: [] }, { maxPackages: 39 }]) assert.throws(() => checkPolicy(items, { ...policy, ...patch }, config, {}));
  assert.throws(() => checkPolicy(items, policy, { ...config, maxDailyQuotes: 0 }, {}));
});

test('registro durable conserva reservas tras reinicio y no reinicia datos corruptos', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'barra-store-'));
  const file = join(dir, 'ledger.json');
  const store = await openStore(file);
  await Promise.all(Array.from({ length: 10 }, () => store.update('count', (current) => ({ op: 'set', value: (current ?? 0) + 1, result: null }))));
  assert.equal(await (await openStore(file)).get('count'), 10);
  assert.equal(JSON.parse(await readFile(file, 'utf8')).count, 10);
  await writeFile(file, '{broken');
  await assert.rejects(openStore(file));
});

async function fixture({ failRetry = false } = {}) {
  const store = Store.memory();
  const server = createPayments(config, store).server;
  let signed = 0;
  const client = { preparePayment: async (response) => {
    const challenge = Challenge.fromResponse(response);
    return { challenge, createCredential: async () => { signed++; return Credential.serialize({ challenge, payload: { type: 'hash', hash: '0x' + '1'.repeat(64) } }); }, setCredential: () => ({ headers: { Authorization: 'test-fixture' } }) };
  } };
  let calls = 0;
  const api = createApi({ config, store, payments: { server, client }, supplierOrigin: () => 'http://localhost', logger: () => {}, fetchImpl: async (url, init) => {
    calls++;
    if (!init.headers) return api(new Request(url));
    if (failRetry) throw new Error('lost connection after sending credential');
    return Response.json(quote(items), { headers: { 'Payment-Receipt': Receipt.serialize({ method: 'tempo', reference: '0x' + '1'.repeat(64), status: 'success', timestamp: new Date().toISOString() }) } });
  } });
  const payload = { requestId: randomUUID(), state: createInitialState(), policy };
  const send = (body = payload) => api(new Request('http://localhost/api/budget', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  return { api, send, payload, store, counts: () => ({ calls, signed }) };
}

test('endpoint SDK emite 402 y no revela precios sin credencial válida', async () => {
  const { api } = await fixture();
  const response = await api(new Request('http://localhost/api/supplier/quote'));
  assert.equal(response.status, 402);
  assert.match(response.headers.get('WWW-Authenticate'), /^Payment /);
  const c = Challenge.fromResponse(response);
  assert.equal(c.request.amount, '10000');
  assert.equal(c.request.methodDetails.chainId, 42431);
  const invalid = await api(new Request('http://localhost/api/supplier/quote', { headers: { Authorization: 'Payment invalid' } }));
  assert.notEqual(invalid.status, 200);
  assert.equal((await invalid.text()).includes('unitPriceCents'), false);
});

test('402 → políticas → credencial → cotización; reintentos concurrentes pagan una vez (red simulada)', async () => {
  const { send, counts, payload } = await fixture();
  const [a, b] = await Promise.all([send(), send()]);
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.equal((await b.json()).cached, true);
  assert.deepEqual(counts(), { calls: 2, signed: 1 });
  const changed = structuredClone(payload); changed.state.inventory['beer-lager']--;
  assert.equal((await send(changed)).status, 409);
});

test('un fallo después de firmar retiene gasto y prohíbe repetir el pago', async () => {
  const { send, counts, payload } = await fixture({ failRetry: true });
  assert.equal((await send()).status, 502);
  assert.equal((await send()).status, 409);
  assert.equal(counts().signed, 1);
  const second = { ...payload, requestId: randomUUID() };
  assert.equal((await send(second)).status, 502);
  const third = { ...payload, requestId: randomUUID() };
  assert.equal((await send(third)).status, 403);
  assert.equal(counts().signed, 2);
});

test('pausa e inventario completo no pagan; un origen ajeno se rechaza', async () => {
  const { send, payload, counts, api } = await fixture();
  assert.equal((await send({ ...payload, policy: { ...policy, paused: true } })).status, 403);
  const full = await send({ ...payload, state: resetState(payload.state) });
  assert.equal(full.status, 200); assert.equal((await full.json()).payment, null);
  const cross = await api(new Request('http://localhost/api/budget', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
  assert.equal(cross.status, 403);
  assert.deepEqual(counts(), { calls: 0, signed: 0 });
});
