export const CONTEXT_FIELDS = ['goal', 'checkpoint', 'nextAction', 'blocker'];
export const ENVIRONMENTS = ['code', 'xcode', 'codex', 'terminal'];

export function normalizeContext(input = {}) {
  const result = {};
  for (const field of CONTEXT_FIELDS) result[field] = typeof input[field] === 'string' ? input[field].trim().slice(0, 4000) : '';
  result.environment = ENVIRONMENTS.includes(input.environment) ? input.environment : 'code';
  result.favorite = input.favorite === true;
  result.openTerminal = input.openTerminal === true;
  result.openReferences = input.openReferences === true;
  result.lastOpened = Number.isFinite(input.lastOpened) && input.lastOpened > 0 ? input.lastOpened : null;
  return result;
}

export function normalizeContexts(entries) {
  const clean = {};
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return clean;
  for (const [path, value] of Object.entries(entries)) {
    if (path && value && typeof value === 'object') clean[path] = normalizeContext(value);
  }
  return clean;
}

export async function persistPreference(store, key, value) {
  if (await store.set(key, value) === false) throw new Error(`Unable to save ${key}. Please retry.`);
}

// The adapter makes the same traversal testable with real Git worktrees.
export async function discoverRepos(root, ignored, depth, found, fs) {
  if (depth < 0 || found.length >= 400) return;
  let entries;
  try { entries = await fs.readDir(root); } catch { return; }
  const subdirs = [];
  for await (const entry of entries) {
    if (entry.name === '.git') {
      // Both the directory marker and worktree's gitdir file are repositories.
      if (entry.isDirectory || entry.isFile) { found.push(root); return; }
    }
    if (!entry.isDirectory || entry.name.startsWith('.') || ignored.includes(entry.name)) continue;
    subdirs.push(root.replace(/\/$/, '') + '/' + entry.name);
  }
  for (const path of subdirs) await discoverRepos(path, ignored, depth - 1, found, fs);
}

export const BACKUP_KEYS = ['workspace', 'ignored', 'language', 'projectColors', 'projectRatings', 'projectKnowledgeLinks', 'projectTags', 'projectContexts', 'todos', 'remoteWorkspaces'];

export function parseBackup(text) {
  const document = JSON.parse(text);
  if (document?.format !== 'projectshelf-backup' || document.version !== 1 || !document.preferences || typeof document.preferences !== 'object' || Array.isArray(document.preferences)) throw new Error('Invalid ProjectShelf backup.');
  const result = {};
  for (const key of BACKUP_KEYS) if (Object.hasOwn(document.preferences, key)) result[key] = document.preferences[key];
  for (const key of BACKUP_KEYS.filter((key) => key.startsWith('project'))) {
    if (key in result && (!result[key] || typeof result[key] !== 'object' || Array.isArray(result[key]))) throw new Error('Invalid backup metadata: ' + key);
  }
  for (const key of ['todos', 'remoteWorkspaces', 'ignored']) if (key in result && !Array.isArray(result[key])) throw new Error('Invalid backup list: ' + key);
  if (result.projectContexts) result.projectContexts = normalizeContexts(result.projectContexts);
  return result;
}

// Restore missing entries only. Existing project metadata is never overwritten.
export function mergeBackup(current, incoming) {
  const merged = { ...current };
  for (const key of BACKUP_KEYS.filter((key) => key.startsWith('project'))) merged[key] = { ...(incoming[key] || {}), ...(current[key] || {}) };
  for (const key of ['todos', 'remoteWorkspaces']) {
    const items = new Map((incoming[key] || []).filter((item) => item && typeof item.id === 'string').map((item) => [item.id, item]));
    for (const item of current[key] || []) items.set(item.id, item);
    merged[key] = [...items.values()];
  }
  return merged;
}
