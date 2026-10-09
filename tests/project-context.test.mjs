import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { discoverRepos, normalizeContext, parseBackup, mergeBackup, persistPreference } from '../src/project-context.js';
import { parseRemoteScanOutput, buildRemoteScanCommand } from '../src/remote-workspaces.js';
import { normalizeMetadataDocument } from '../mcp/validation.mjs';

test('discovers actual Git worktrees with .git files, respecting depth', async () => {
  const root = await mkdtemp(join(tmpdir(), 'projectshelf-worktree-'));
  const git = (...args) => execFileSync('git', args, { stdio: 'ignore', timeout: 10000 });
  try {
    const repo = join(root, 'repo');
    git('init', repo);
    git('-C', repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', 'Initial');
    const worktree = join(root, 'other');
    git('-C', repo, 'worktree', 'add', '-b', 'test-worktree', worktree);
    const fs = { async readDir(path) { return (await readdir(path, { withFileTypes: true })).map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory(), isFile: entry.isFile() })); } };
    const found = [];
    await discoverRepos(root, [], 3, found, fs);
    assert.deepEqual(found.sort(), [worktree, repo].sort());
    const shallow = [];
    await discoverRepos(root, [], 0, shallow, fs);
    assert.deepEqual(shallow, []);
    const remote = { alias: 'test', path: root };
    const parsed = parseRemoteScanOutput(execFileSync('sh', ['-c', buildRemoteScanCommand(remote)], { encoding: 'utf8', timeout: 10000 }), remote);
    assert.equal(parsed.projects.length, 2);
    assert.equal(parsed.projects.every((project) => project.lastCommitDays === 0), true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('missing remote timestamps are unknown, never epoch dates', () => {
  const [project] = parseRemoteScanOutput('/repo\trepo\tmain\t\t0\tgit@example/repo\t0\tNode\t100\t0', { alias: 'test', path: '/' }).projects;
  assert.equal(project.lastCommitDays, null);
  assert.equal(project.tracked, false);
});

test('false persistence results throw and can be retried', async () => {
  let writable = false;
  const store = { async set() { return writable; } };
  await assert.rejects(persistPreference(store, 'projectContexts', {}), /Unable to save/);
  writable = true;
  await persistPreference(store, 'projectContexts', {});
});

test('backup round trip preserves context and merges without overwriting existing entries', () => {
  const preferences = { projectContexts: { '/repo': normalizeContext({ nextAction: 'Continue', environment: 'xcode', lastOpened: 1234 }) }, todos: [{ id: '1', text: 'A' }] };
  const parsed = parseBackup(JSON.stringify({ format: 'projectshelf-backup', version: 1, preferences, token: 'excluded' }));
  assert.deepEqual(parsed, preferences);
  const current = { projectContexts: { '/repo': normalizeContext({ nextAction: 'Newer' }) }, todos: [{ id: '1', text: 'Newer' }], workspace: '/current' };
  const merged = mergeBackup(current, parsed);
  assert.equal(merged.projectContexts['/repo'].nextAction, 'Newer');
  assert.equal(merged.todos[0].text, 'Newer');
  assert.equal(merged.workspace, '/current');
  assert.throws(() => parseBackup('{"format":"projectshelf-backup","version":1,"preferences":{"todos":{}}}'), /Invalid/);
  assert.throws(() => parseBackup('{}'), /Invalid/);
});

test('MCP metadata normalization preserves all resume context fields', () => {
  const context = normalizeContext({ goal: 'Build', checkpoint: 'Tests', nextAction: 'Ship', blocker: 'None', favorite: true, lastOpened: 1234 });
  const result = normalizeMetadataDocument({ projectContexts: { '/repo': context } });
  assert.deepEqual(result.projectContexts['/repo'], context);
});
