import { randomBytes } from 'node:crypto';
import { access, writeFile } from 'node:fs/promises';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { CHAIN_ID, testnetClient } from '../server/config.mjs';

const file = new URL('../.env', import.meta.url);
try {
  await access(file);
  console.log('Se conserva .env existente. No se sobrescriben claves.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const key = generatePrivateKey();
  const recipient = privateKeyToAccount(generatePrivateKey()).address;
  await writeFile(file, `# Cuentas desechables SOLO de Tempo Testnet. Nunca usar fondos reales.\nMPP_SECRET_KEY=${randomBytes(32).toString('hex')}\nMPP_RECIPIENT=${recipient}\nTEMPO_TESTNET_PRIVATE_KEY=${key}\n`, { mode: 0o600, flag: 'wx' });
  console.log('Configuración de prueba creada en barra/.env (ignorada por Git).');
}
process.loadEnvFile(file);
const account = privateKeyToAccount(process.env.TEMPO_TESTNET_PRIVATE_KEY);
const client = testnetClient();
const chainId = Number(await client.request({ method: 'eth_chainId' }));
if (chainId !== CHAIN_ID) throw new Error('RPC rechazado: no es Tempo Moderato Testnet.');
await client.request({ method: 'tempo_fundAddress', params: [account.address] });
console.log(`Faucet Testnet solicitado para ${account.address}. Cadena ${chainId}.`);
console.log('Ejecuta npm run dev y pulsa Generar presupuesto. No se activaron pagos reales.');
