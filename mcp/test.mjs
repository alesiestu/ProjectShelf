import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeProjectMetadata, normalizeTags, normalizeTodo, McpValidationError } from './validation.mjs';
import { getStorePath, loadStore, updateStore, rotateToken } from './store.mjs';

test('validation normalizes metadata', () => {
  assert.deepEqual(normalizeProjectMetadata({ color: 'blue', rating: 3, tags: [' Work ', 'work'], notion: 'https://notion.so/a', obsidian: 'obsidian://open?vault=x' }), {
    color: 'blue', rating: 3, tags: ['Work'], notion: 'https://notion.so/a', obsidian: 'obsidian://open?vault=x',
  });
});

test('validation rejects invalid values', () => {
  assert.throws(() => normalizeProjectMetadata({ color: 'black' }), (error) => error instanceof McpValidationError && error.code === 'INVALID_COLOR');
  assert.throws(() => normalizeProjectMetadata({ rating: 6 }), /0 to 5/);
  assert.throws(() => normalizeProjectMetadata({ notion: 'file:///tmp/a' }), /Notion link/);
  assert.throws(() => normalizeProjectMetadata({ obsidian: 'https://example.com' }), /Obsidian link/);
});

test('tags are capped and deduplicated', () => {
  const tags = normalizeTags(['a', 'A', ...Array.from({ length: 20 }, (_, i) => `tag-${i}`)]);
  assert.equal(tags.length, 12);
  assert.deepEqual(tags.slice(0, 2), ['a', 'tag-0']);
});

test('todos require known projects', () => {
  const todo = normalizeTodo({ text: 'Plan release', projectPaths: ['/repo', '/repo'] }, ['/repo']);
  assert.equal(typeof todo.id, 'string');
  assert.deepEqual({ text: todo.text, done: todo.done, projectPaths: todo.projectPaths }, {
    text: 'Plan release', done: false, projectPaths: ['/repo'],
  });
  assert.throws(() => normalizeTodo({ text: 'Bad', projectPaths: ['/missing'] }, ['/repo']), /not present/);
});

test('store migrates links and keeps token stable', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'projectshelf-mcp-'));
  const file = join(dir, 'state.json');
  try {
    const first = await loadStore(file, { projectNotionLinks: { '/repo': 'https://notion.so/a' }, projectTags: { '/repo': ['x'] } });
    const second = await loadStore(file);
    assert.equal(second.document.token, first.document.token);
    assert.equal(second.document.projectKnowledgeLinks['/repo'].notion, 'https://notion.so/a');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('store serializes updates and rotates token', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'projectshelf-mcp-'));
  const file = join(dir, 'state.json');
  try {
    const first = await loadStore(file);
    await Promise.all([
      updateStore(file, (doc) => ({ ...doc, projectTags: { '/a': ['one'] } })),
      updateStore(file, (doc) => ({ ...doc, projectTags: { ...(doc.projectTags || {}), '/b': ['two'] } })),
    ]);
    const rotated = await rotateToken(file);
    assert.notEqual(rotated.token, first.document.token);
    const saved = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(saved.token, rotated.token);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('store recovers malformed JSON into a backup', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'projectshelf-mcp-'));
  const file = join(dir, 'state.json');
  try {
    await writeFile(file, '{broken', 'utf8');
    const loaded = await loadStore(file);
    assert.equal(loaded.recovered, true);
    assert.match(loaded.backup, /\.bak$/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('store path is scoped to the user home', () => {
  assert.equal(getStorePath('/tmp/user'), '/tmp/user/.projectshelf/mcp-state.json');
});
