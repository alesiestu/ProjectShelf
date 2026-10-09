import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

globalThis.tjs = { homeDir: '/test-home', readFile, writeFile };
const { api, runRemote, decorateRemoteProject } = await import('../src/main.js');
function memoryApp(writable = true) {
  const data = new Map();
  return { data, store: { async get(key) { return data.get(key); }, async set(key, value) { data.set(key, value); return writable; } }, push() {} };
}

test('savePrefs itself propagates a failed store write', async () => {
  await assert.rejects(api.savePrefs({ projectRatings: { '/repo': 3 } }, memoryApp(false)), /Unable to save/);
  const app = memoryApp();
  assert.equal(await api.savePrefs({ projectContexts: { '/repo': { nextAction: 'Ship' } } }, app), true);
  assert.equal((await api.loadPrefs({}, app)).projectContexts['/repo'].nextAction, 'Ship');
});

test('unknown remote commit date and missing upstream prevent favorable cleanup', () => {
  const base = { remote: true, tracked: true, dirtyFiles: 0, unpushed: 0, lastCommitDays: null };
  const unknown = decorateRemoteProject(base);
  assert.equal(unknown.status, 'unknown');
  assert.equal(unknown.safeToRemove, false);
  assert.equal(unknown.reasonKeys.includes('unknownCommit'), true);
  assert.equal(decorateRemoteProject({ ...base, tracked: false, lastCommitDays: 300 }).safeToRemove, false);
});

test('timeout covers a process with stdout that never reaches EOF', async () => {
  let killed = false;
  tjs.spawn = () => ({ stdout: new ReadableStream({}), stderr: new ReadableStream({}), wait: () => new Promise(() => {}), kill() { killed = true; } });
  const start = Date.now();
  const result = await runRemote(['test-only'], 30);
  assert.equal(result.timedOut, true);
  assert.equal(killed, true);
  assert.ok(Date.now() - start < 1000);
});

test('backend backup export/import keeps user metadata and excludes tokens', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'projectshelf-backup-'));
  try {
    const path = join(dir, 'metadata.json');
    const app = memoryApp();
    await api.savePrefs({ projectContexts: { '/repo': { nextAction: 'Export me' } }, todos: [{ id: 'a', text: 'A', projectPaths: ['/repo'] }] }, app);
    await api.exportBackup({ path }, app);
    const backup = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(backup.preferences.projectContexts['/repo'].nextAction, 'Export me');
    assert.equal('token' in backup.preferences, false);
    const target = memoryApp();
    await api.savePrefs({ projectContexts: { '/repo': { nextAction: 'Keep current' } } }, target);
    const restored = await api.importBackup({ path }, target);
    assert.equal(restored.projectContexts['/repo'].nextAction, 'Keep current');
    assert.equal(restored.todos[0].id, 'a');
    assert.equal(target.data.has('backupBeforeImport'), true);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('resume uses the preferred environment and records a session only after opening', async () => {
  const stream = (text) => new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(text)); controller.close(); } });
  tjs.readDir = async () => [{ name: '.git', isFile: true }];
  tjs.stat = async () => { throw new Error('Not found'); };
  tjs.spawn = () => ({ stdout: stream(''), stderr: stream(''), wait: async () => ({ exit_status: 0 }) });
  const app = memoryApp();
  await api.savePrefs({ projectContexts: { '/repo': { goal: 'Ship', environment: 'xcode' } } }, app);
  await api.scan({ root: '/repo' }, app);
  const original = api.openIn;
  const opened = [];
  try {
    api.openIn = async ({ kind }) => { opened.push(kind); return false; };
    await assert.rejects(api.resumeProject({ path: '/repo' }, app), /Unable to open/);
    assert.equal((await api.loadPrefs({}, app)).projectContexts['/repo'].lastOpened, null);
    api.openIn = async ({ kind }) => { opened.push(kind); return true; };
    const result = await api.resumeProject({ path: '/repo' }, app);
    assert.deepEqual(opened, ['xcode', 'xcode']);
    assert.equal(result.goal, 'Ship');
    assert.ok(result.lastOpened > 0);
    await assert.rejects(api.resumeProject({ path: '/missing' }, app), /not present/);
  } finally { api.openIn = original; }
});
