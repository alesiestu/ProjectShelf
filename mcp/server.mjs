import http from 'node:http';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { getStorePath, loadStore, updateStore, rotateToken } from './store.mjs';
import { MAX_RATING, PROJECT_COLORS, normalizeProjectMetadata, normalizeTodo, validateProjectPath } from './validation.mjs';

const PORT = Number(process.env.PROJECTSHELF_PORT || 0);
const STATE_PATH = process.env.PROJECTSHELF_STATE_PATH || getStorePath(homedir());
const initialMigration = process.env.PROJECTSHELF_MIGRATION ? JSON.parse(process.env.PROJECTSHELF_MIGRATION) : {};
let { document } = await loadStore(STATE_PATH, initialMigration);
let projects = [];
let projectSnapshot = [];

function bearer(req) {
  const value = req.headers.get('authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

function json(res, status, body, extra = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...extra });
  res.end(JSON.stringify(body));
}

function requireToken(req) {
  return bearer(req) && bearer(req) === document.token;
}

function currentPaths() {
  return projectSnapshot.map((project) => project.path).filter(Boolean);
}

function metadataFor(path) {
  const links = document.projectKnowledgeLinks[path] || {};
  return {
    color: document.projectColors[path] || null,
    rating: document.projectRatings[path] || 0,
    tags: document.projectTags[path] || [],
    notion: links.notion || null,
    obsidian: links.obsidian || null,
    todoIds: document.todos.filter((todo) => todo.projectPaths.includes(path)).map((todo) => todo.id),
  };
}

function result(text, structuredContent) {
  return { structuredContent, content: [{ type: 'text', text }] };
}

function buildMcp() {
  const server = new McpServer(
    { name: 'projectshelf-local', version: '0.1.0' },
    { instructions: 'Use list_projects before updating metadata. This local server changes only ProjectShelf colors, ratings, tags, knowledge links, and Todo items. Never use it for files, shell commands, Git operations, or repository deletion.' },
  );
  server.registerTool('list_projects', {
    title: 'List ProjectShelf projects',
    description: 'List scanned projects and their ProjectShelf metadata.',
    inputSchema: { },
    outputSchema: { projects: z.array(z.record(z.string(), z.any())) },
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  }, async () => {
    const items = projectSnapshot.map((project) => ({ ...project, metadata: metadataFor(project.path) }));
    return result(`Found ${items.length} ProjectShelf projects.`, { projects: items });
  });
  server.registerTool('update_project', {
    title: 'Update ProjectShelf project metadata',
    description: 'Update color, rating, tags, Notion link, or Obsidian link for an existing scanned project.',
    inputSchema: {
      path: z.string(),
      color: z.enum(PROJECT_COLORS).nullable().optional(),
      rating: z.number().int().min(0).max(MAX_RATING).optional(),
      tags: z.array(z.string()).max(12).optional(),
      notion: z.string().nullable().optional(),
      obsidian: z.string().nullable().optional(),
    },
    outputSchema: { path: z.string(), metadata: z.record(z.string(), z.any()) },
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  }, async ({ path, ...input }) => {
    validateProjectPath(path, currentPaths());
    const normalized = normalizeProjectMetadata(input);
    document = await updateStore(STATE_PATH, (current) => {
      const next = structuredClone(current);
      if ('color' in normalized) normalized.color ? next.projectColors[path] = normalized.color : delete next.projectColors[path];
      if ('rating' in normalized) normalized.rating ? next.projectRatings[path] = normalized.rating : delete next.projectRatings[path];
      if ('tags' in normalized) normalized.tags.length ? next.projectTags[path] = normalized.tags : delete next.projectTags[path];
      const links = { ...(next.projectKnowledgeLinks[path] || {}) };
      if ('notion' in normalized) normalized.notion ? links.notion = normalized.notion : delete links.notion;
      if ('obsidian' in normalized) normalized.obsidian ? links.obsidian = normalized.obsidian : delete links.obsidian;
      if (Object.keys(links).length) next.projectKnowledgeLinks[path] = links; else delete next.projectKnowledgeLinks[path];
      return next;
    });
    return result(`Updated metadata for ${path}.`, { path, metadata: metadataFor(path) });
  });
  server.registerTool('list_todos', {
    title: 'List ProjectShelf todos',
    description: 'List ProjectShelf Todo items and their linked projects.',
    inputSchema: { },
    outputSchema: { todos: z.array(z.record(z.string(), z.any())) },
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  }, async () => result(`Found ${document.todos.length} Todo items.`, { todos: document.todos }));
  server.registerTool('create_todo', {
    title: 'Create a ProjectShelf todo',
    description: 'Create a Todo and optionally link it to existing scanned projects.',
    inputSchema: { text: z.string(), done: z.boolean().optional(), projectPaths: z.array(z.string()).optional() },
    outputSchema: { todo: z.record(z.string(), z.any()) },
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  }, async (input) => {
    const todo = normalizeTodo(input, currentPaths());
    document = await updateStore(STATE_PATH, (current) => ({ ...current, todos: [todo, ...current.todos] }));
    return result(`Created Todo ${todo.id}.`, { todo });
  });
  server.registerTool('update_todo', {
    title: 'Update a ProjectShelf todo',
    description: 'Update text, completion, or project links for an existing Todo.',
    inputSchema: { id: z.string(), text: z.string().optional(), done: z.boolean().optional(), projectPaths: z.array(z.string()).optional() },
    outputSchema: { todo: z.record(z.string(), z.any()) },
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  }, async ({ id, ...input }) => {
    const existing = document.todos.find((todo) => todo.id === id);
    if (!existing) throw Object.assign(new Error('Todo not found.'), { code: 'UNKNOWN_TODO' });
    const todo = normalizeTodo({ ...existing, ...input }, currentPaths(), id);
    document = await updateStore(STATE_PATH, (current) => ({ ...current, todos: current.todos.map((item) => item.id === id ? todo : item) }));
    return result(`Updated Todo ${id}.`, { todo });
  });
  server.registerTool('delete_todo', {
    title: 'Delete a ProjectShelf todo',
    description: 'Delete one Todo item. This does not modify any project.',
    inputSchema: { id: z.string() },
    outputSchema: { deleted: z.string() },
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: true },
  }, async ({ id }) => {
    if (!document.todos.some((todo) => todo.id === id)) throw Object.assign(new Error('Todo not found.'), { code: 'UNKNOWN_TODO' });
    document = await updateStore(STATE_PATH, (current) => ({ ...current, todos: current.todos.filter((todo) => todo.id !== id) }));
    return result(`Deleted Todo ${id}.`, { deleted: id });
  });
  return server;
}

const mcpServer = buildMcp();
const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
await mcpServer.connect(transport);

function requestUrl(req) { return `http://${req.headers.host || '127.0.0.1' }${req.url}`; }

async function requestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function handle(req, res) {
  const url = new URL(req.url, requestUrl(req));
  if (!requireToken(new Request(url, { headers: req.headers }))) {
    return json(res, 401, { error: 'Unauthorized' }, { 'www-authenticate': 'Bearer' });
  }
  if (url.pathname === '/health' && req.method === 'GET') return json(res, 200, { ok: true, mcp: '/mcp' });
  if (url.pathname === '/app/state' && req.method === 'GET') return json(res, 200, { metadata: document, projects: projectSnapshot });
  if (url.pathname === '/app/state' && req.method === 'POST') {
    const body = JSON.parse(await requestBody(req) || '{}');
    document = await updateStore(STATE_PATH, (current) => ({ ...current, ...body }));
    return json(res, 200, { metadata: document });
  }
  if (url.pathname === '/app/rotate-token' && req.method === 'POST') {
    document = await rotateToken(STATE_PATH);
    return json(res, 200, { token: document.token });
  }
  if (url.pathname === '/app/scan-projects' && req.method === 'POST') {
    projectSnapshot = JSON.parse(await requestBody(req) || '[]');
    return json(res, 200, { count: projectSnapshot.length });
  }
  if (url.pathname !== '/mcp') return json(res, 404, { error: 'Not found' });
  const headers = new Headers(req.headers);
  const body = req.method === 'GET' || req.method === 'DELETE' ? undefined : await requestBody(req);
  const request = new Request(url, { method: req.method, headers, body, duplex: body === undefined ? undefined : 'half' });
  const response = await transport.handleRequest(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (response.body) {
    for await (const chunk of response.body) res.write(Buffer.from(chunk));
  }
  res.end();
}

const server = http.createServer((req, res) => handle(req, res).catch((error) => {
  console.error(error?.code || 'MCP_ERROR');
  if (!res.headersSent) json(res, 500, { error: 'Request failed' }); else res.end();
}));
server.listen(PORT, '127.0.0.1', () => {
  const address = server.address();
  console.log(JSON.stringify({ ready: true, port: address.port, endpoint: `http://127.0.0.1:${address.port}/mcp` }));
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));

export { server, mcpServer };
