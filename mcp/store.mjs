import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { normalizeMetadataDocument } from './validation.mjs';

let writeQueue = Promise.resolve();

export function getStorePath(homeDir) {
  return join(homeDir, '.projectshelf', 'mcp-state.json');
}

export function createToken() {
  return randomBytes(24).toString('hex');
}

function migrate(input = {}) {
  const links = input.projectKnowledgeLinks || Object.fromEntries(
    Object.entries(input.projectNotionLinks || {}).map(([path, url]) => [path, { notion: url }]),
  );
  return normalizeMetadataDocument({ ...input, projectKnowledgeLinks: links, token: input.token || createToken() });
}

async function atomicWrite(file, document) {
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(document, null, 2) + '\n', 'utf8');
    await rename(temp, file);
  } catch (error) {
    try { await rename(temp, `${temp}.failed`); } catch {}
    const wrapped = new Error('Unable to persist ProjectShelf metadata.');
    wrapped.code = 'STORE_WRITE_FAILED';
    wrapped.cause = error;
    throw wrapped;
  }
}

export async function loadStore(file, migration = {}) {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    const document = migrate(parsed);
    if (!document.token) document.token = createToken();
    return { document, recovered: false };
  } catch (error) {
    if (error?.code !== 'ENOENT' && error instanceof SyntaxError) {
      const backup = `${file}.${Date.now()}.bak`;
      try { await rename(file, backup); } catch {}
      const document = migrate({ ...migration, token: createToken() });
      await atomicWrite(file, document);
      return { document, recovered: true, backup };
    }
    if (error?.code !== 'ENOENT') throw error;
    const document = migrate(migration);
    await atomicWrite(file, document);
    return { document, recovered: false, migrated: true };
  }
}

export async function updateStore(file, updater) {
  const operation = writeQueue.then(async () => {
    const { document } = await loadStore(file);
    const updated = normalizeMetadataDocument(await updater(document));
    updated.token = document.token;
    await atomicWrite(file, updated);
    return updated;
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

export async function rotateToken(file) {
  return writeQueue.then(async () => {
    const { document } = await loadStore(file);
    const updated = { ...document, token: createToken() };
    await atomicWrite(file, updated);
    return updated;
  });
}

export { migrate, atomicWrite };
