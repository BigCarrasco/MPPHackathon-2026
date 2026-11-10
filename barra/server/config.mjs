import { createClient, http, isAddress } from 'viem';
import { tempoModerato } from 'viem/chains';

export const CHAIN_ID = 42431;
export const RPC_URL = 'https://rpc.moderato.tempo.xyz';
export const CURRENCY = '0x20c0000000000000000000000000000000000000';
export const PRICE = '0.01';
export const PRICE_MICROS = 10_000;

export function readConfig(env = process.env) {
  // No network, token or RPC override: this MVP can only use Moderato.
  for (const name of ['TEMPO_CHAIN_ID', 'TEMPO_RPC_URL', 'MPP_CURRENCY', 'MPP_TESTNET']) {
    if (env[name] !== undefined) throw new Error(`${name} is not supported: Tempo Testnet only.`);
  }
  if (!isAddress(env.MPP_RECIPIENT || '') || /^0x0{40}$/i.test(env.MPP_RECIPIENT)) throw new Error('Configure MPP_RECIPIENT with npm run setup:testnet.');
  if (!/^[0-9a-f]{64}$/i.test(env.MPP_SECRET_KEY || '')) throw new Error('MPP_SECRET_KEY must contain 32 random bytes in hexadecimal.');
  if (env.TEMPO_TESTNET_PRIVATE_KEY && !/^0x[0-9a-f]{64}$/i.test(env.TEMPO_TESTNET_PRIVATE_KEY)) throw new Error('Invalid Testnet key.');
  if (env.DEMO_ACCESS_CODE && env.DEMO_ACCESS_CODE.length < 12) throw new Error('DEMO_ACCESS_CODE must contain at least 12 characters.');
  const limit = (name, fallback, maximum) => {
    const value = Number(env[name] ?? fallback);
    if (!Number.isSafeInteger(value) || value < 0 || value > maximum) throw new Error(`${name} is invalid.`);
    return value;
  };
  return {
    recipient: env.MPP_RECIPIENT,
    secretKey: env.MPP_SECRET_KEY,
    privateKey: env.TEMPO_TESTNET_PRIVATE_KEY,
    demoAccessCode: env.DEMO_ACCESS_CODE || '',
    maxPerQuoteMicros: limit('QUOTE_MAX_FEE_MICROS', 10_000, 10_000),
    maxDailyMicros: limit('QUOTE_DAILY_BUDGET_MICROS', 50_000, 100_000),
    maxDailyQuotes: limit('QUOTE_MAX_DAILY', 5, 10),
    maxPackages: limit('QUOTE_MAX_PACKAGES', 50, 200),
    paused: env.QUOTE_PAUSED === 'true',
  };
}

export const testnetClient = () => createClient({ chain: tempoModerato, transport: http(RPC_URL, { retryCount: 0, timeout: 15_000 }) });
export function testnetResolver(client = testnetClient()) {
  return ({ chainId } = {}) => {
    if (chainId !== undefined && chainId !== CHAIN_ID) throw new Error('Network rejected: Tempo Testnet 42431 only.');
    return client;
  };
}
