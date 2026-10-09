import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

test('MCP works from arbitrary cwd and safely updates resume context', { timeout: 20000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'projectshelf-integration-'));
  const statePath = join(dir, 'state.json');
  const entry = process.env.PROJECTSHELF_TEST_MCP_ENTRY || fileURLToPath(new URL('../mcp/server.mjs', import.meta.url));
  const binary = process.env.PROJECTSHELF_TEST_NODE || process.execPath;
  const child = spawn(binary, [entry], { cwd: dir, env: { ...process.env, PROJECTSHELF_PORT: '0', PROJECTSHELF_STATE_PATH: statePath, PROJECTSHELF_MIGRATION: JSON.stringify({ projectContexts: { '/repo': { goal: 'Ship', nextAction: 'Test', lastOpened: 1234 } } }) }, stdio: ['ignore', 'pipe', 'pipe'] });
  const client = new Client({ name: 'projectshelf-test', version: '1.0.0' });
  try {
    const ready = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Startup timeout')), 10000);
      let stdout = '';
      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
        if (stdout.includes('\n')) {
          clearTimeout(timeout);
          try { resolve(JSON.parse(stdout.split('\n')[0])); } catch (error) { reject(error); }
        }
      });
      child.once('error', (error) => { clearTimeout(timeout); reject(error); });
      child.once('exit', (code) => { clearTimeout(timeout); reject(new Error('Server exited ' + code + ': ' + stderr)); });
    });
    const { token } = JSON.parse(await readFile(statePath, 'utf8'));
    const base = ready.endpoint.replace(/\/mcp$/, '');
    assert.equal((await fetch(base + '/health')).status, 401);
    const headers = { authorization: 'Bearer ' + token, 'content-type': 'application/json' };
    assert.equal((await fetch(base + '/app/scan-projects', { method: 'POST', headers, body: JSON.stringify([{ path: '/repo', name: 'Repo' }]) })).status, 200);
    await client.connect(new StreamableHTTPClientTransport(new URL(ready.endpoint), { requestInit: { headers } }));
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ['list_projects', 'update_project', 'list_todos', 'create_todo', 'update_todo', 'delete_todo'].sort());
    const before = await client.callTool({ name: 'list_projects', arguments: {} });
    assert.equal(before.structuredContent.projects[0].metadata.context.nextAction, 'Test');
    const result = await client.callTool({ name: 'update_project', arguments: { path: '/repo', context: { checkpoint: 'Tests passed', favorite: true } } });
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent.metadata.context.nextAction, 'Test');
    assert.equal(result.structuredContent.metadata.context.lastOpened, 1234);
    const invalid = await client.callTool({ name: 'update_project', arguments: { path: '/missing', context: { goal: 'Invalid' } } });
    assert.equal(invalid.isError, true);
    const saved = JSON.parse(await readFile(statePath, 'utf8'));
    assert.equal(saved.projectContexts['/repo'].checkpoint, 'Tests passed');
    assert.equal(saved.projectContexts['/repo'].favorite, true);
  } finally {
    await client.close();
    child.kill('SIGKILL');
    await new Promise((resolve) => child.exitCode !== null || child.signalCode !== null ? resolve() : child.once('exit', resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
