import { randomBytes } from 'node:crypto';
import { access, writeFile } from 'node:fs/promises';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { CHAIN_ID, testnetClient } from '../server/config.mjs';

const file = new URL('../.env', import.meta.url);
try {
  await access(file);
  console.log('Existing .env preserved. No keys overwritten.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const key = generatePrivateKey();
  const recipient = privateKeyToAccount(generatePrivateKey()).address;
  await writeFile(file, `# Disposable Tempo Testnet accounts only. Never use real funds.\nMPP_SECRET_KEY=${randomBytes(32).toString('hex')}\nMPP_RECIPIENT=${recipient}\nTEMPO_TESTNET_PRIVATE_KEY=${key}\n`, { mode: 0o600, flag: 'wx' });
  console.log('Test configuration saved in barra/.env (ignored by Git).');
}
process.loadEnvFile(file);
const account = privateKeyToAccount(process.env.TEMPO_TESTNET_PRIVATE_KEY);
const client = testnetClient();
const chainId = Number(await client.request({ method: 'eth_chainId' }));
if (chainId !== CHAIN_ID) throw new Error('RPC rejected: not Tempo Moderato Testnet.');
await client.request({ method: 'tempo_fundAddress', params: [account.address] });
console.log(`Testnet faucet requested for ${account.address}. Chain ${chainId}.`);
console.log('Run npm run dev and select Generate quote. Real payments remain disabled.');
