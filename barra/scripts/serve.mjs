import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createApi } from '../server/api.mjs';
import { readConfig } from '../server/config.mjs';
import { createPayments } from '../server/payments.mjs';
import { openStore } from '../server/store.mjs';

const root = resolve(import.meta.dirname, '..');
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json' };

export async function createBarraServer(options = {}) {
  const config = options.config ?? readConfig();
  const store = options.store ?? await openStore(resolve(root, '.data/testnet.json'));
  const payments = options.payments ?? createPayments(config, store);
  const api = createApi({ config, store, payments, logger: options.logger, fetchImpl: options.fetchImpl, supplierOrigin: () => `http://127.0.0.1:${server.address().port}` });
  const server = createServer(async (incoming, outgoing) => {
    try {
      const url = new URL(incoming.url, `http://${incoming.headers.host || '127.0.0.1'}`);
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.startsWith('/api/') || ['/openapi.json', '/llms.txt'].includes(pathname)) {
        const chunks = [];
        let size = 0;
        for await (const chunk of incoming) {
          size += chunk.length;
          if (size > 32_768) { outgoing.writeHead(413).end('Solicitud demasiado grande'); return; }
          chunks.push(chunk);
        }
        const body = chunks.length ? Buffer.concat(chunks) : undefined;
        const request = new Request(url, { method: incoming.method, headers: incoming.headers, ...(body && incoming.method !== 'GET' && incoming.method !== 'HEAD' ? { body } : {}) });
        const response = await api(request);
        outgoing.writeHead(response.status, Object.fromEntries(response.headers));
        outgoing.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      if (!['GET', 'HEAD'].includes(incoming.method)) { outgoing.writeHead(405).end(); return; }
      const base = pathname.startsWith('/src/') ? root : resolve(root, 'public');
      const file = pathname === '/' ? resolve(root, 'index.html') : resolve(base, `.${pathname}`);
      if ((!file.startsWith(base + sep) && file !== resolve(root, 'index.html')) || pathname.split('/').some((part) => part.startsWith('.'))) { outgoing.writeHead(403).end('Forbidden'); return; }
      if (!(await stat(file)).isFile()) throw new Error('Not a file');
      outgoing.writeHead(200, { 'Content-Type': mimeTypes[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      outgoing.end(incoming.method === 'HEAD' ? undefined : await readFile(file));
    } catch {
      if (!outgoing.headersSent) outgoing.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      outgoing.end('Not found');
    }
  });
  server.requestTimeout = 60_000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.loadEnvFile(resolve(root, '.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!process.env.MPP_SECRET_KEY && !process.env.MPP_RECIPIENT) {
    process.env.MPP_SECRET_KEY = randomBytes(32).toString('hex');
    process.env.MPP_RECIPIENT = privateKeyToAccount(generatePrivateKey()).address;
    console.log('Dashboard ready. Run npm run setup:testnet and restart to enable test payments.');
  }
  const server = await createBarraServer();
  const port = Number(process.env.PORT || 5173);
  const host = process.env.HOST || '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !process.env.DEMO_ACCESS_CODE) throw new Error('Set DEMO_ACCESS_CODE before exposing the demo payer publicly.');
  server.listen(port, host, () => console.log(`Barra · http://localhost:${server.address().port} · Tempo Testnet 42431 only`));
}

