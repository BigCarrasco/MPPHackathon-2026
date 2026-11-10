import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

// Durable, atomic writes for ONE local server process. Never silently reset a corrupt ledger.
export async function openStore(file) {
  let data;
  try { data = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; data = {}; }
  if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Registro de gasto inválido.');
  let queue = Promise.resolve();
  const serial = (fn) => {
    const next = queue.then(fn);
    queue = next.catch(() => {});
    return next;
  };
  const save = async (next) => {
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(`${file}.tmp`, JSON.stringify(next), { mode: 0o600 });
    await rename(`${file}.tmp`, file);
    data = next;
  };
  const store = {
    get: (key) => serial(() => structuredClone(data[key] ?? null)),
    put: (key, value) => serial(() => save({ ...data, [key]: value })),
    delete: (key) => serial(() => { const next = { ...data }; delete next[key]; return save(next); }),
    update: (key, fn) => serial(async () => {
      const change = fn(structuredClone(data[key] ?? null));
      if (change.op === 'set') await save({ ...data, [key]: change.value });
      if (change.op === 'delete') { const next = { ...data }; delete next[key]; await save(next); }
      return change.result;
    }),
  };
  return store;
}
