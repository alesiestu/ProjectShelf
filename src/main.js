// ProjectShelf backend — scans a workspace for git repos and classifies them.
// Everything privileged lives here; the page only renders and calls tiny.api.

import {
  buildRemoteScanCommand,
  classifyRemoteFailure,
  normalizeRemoteWorkspace,
  normalizeRemoteWorkspaces,
  parseRemoteScanOutput,
  shellQuote,
  sshIdentityFile,
  sshTarget,
} from './remote-workspaces.js';
import { BACKUP_KEYS, discoverRepos, mergeBackup, normalizeContext, normalizeContexts, parseBackup, persistPreference } from './project-context.js';

const dec = new TextDecoder();
const DAY = 86400000;
const PROJECT_COLORS = new Set(['blue', 'green', 'yellow', 'orange', 'red', 'purple']);
const MAX_PROJECT_RATING = 5;
const MCP_STATE_PATH = tjs.homeDir + '/.projectshelf/mcp-state.json';
const APP_ROOT = decodeURIComponent(new URL('../', import.meta.url).pathname).replace(/\/$/, '').replace(/\/\.build\/app$/, '');
const MCP_SERVER_PATH = APP_ROOT + '/mcp/server.mjs';
let scannedProjects = [];
let mcpProcess;
let mcpInfo = { state: 'stopped', endpoint: '', port: 0, token: '', error: '' };
const remoteWorkspaceCache = new Map();

function linkProtocol(value) {
  try {
    return new URL(value).protocol;
  } catch {
    return '';
  }
}

function isAllowedLink(value, provider) {
  const protocol = linkProtocol(value);
  if (provider === 'obsidian') return protocol === 'obsidian:';
  return protocol === 'http:' || protocol === 'https:';
}

function cleanKnowledgeLinks(entries) {
  const clean = {};
  if (!entries || typeof entries !== 'object') return clean;
  for (const [path, links] of Object.entries(entries)) {
    if (!links || typeof links !== 'object') continue;
    const item = {};
    if (typeof links.notion === 'string' && isAllowedLink(links.notion, 'notion')) item.notion = links.notion;
    if (typeof links.obsidian === 'string' && isAllowedLink(links.obsidian, 'obsidian')) item.obsidian = links.obsidian;
    if (Object.keys(item).length) clean[path] = item;
  }
  return clean;
}

function cleanTodos(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map((todo) => {
    if (!todo || typeof todo !== 'object') return null;
    const text = typeof todo.text === 'string' ? todo.text.trim() : '';
    if (!text) return null;
    const projectPaths = Array.isArray(todo.projectPaths)
      ? [...new Set(todo.projectPaths.filter((path) => typeof path === 'string' && path))]
      : [];
    return {
      id: typeof todo.id === 'string' && todo.id ? todo.id : 'todo-' + Date.now(),
      text,
      projectPaths,
      done: todo.done === true,
    };
  }).filter(Boolean);
}

function cleanProjectTags(entries) {
  if (!entries || typeof entries !== 'object') return {};
  const clean = {};
  for (const [path, tags] of Object.entries(entries)) {
    if (typeof path !== 'string' || !Array.isArray(tags)) continue;
    const seen = new Set();
    const projectTags = [];
    for (const value of tags) {
      if (typeof value !== 'string') continue;
      const tag = value.trim().slice(0, 50);
      const normalized = tag.toLocaleLowerCase();
      if (!tag || seen.has(normalized)) continue;
      seen.add(normalized);
      projectTags.push(tag);
      if (projectTags.length === 12) break;
    }
    if (projectTags.length) clean[path] = projectTags;
  }
  return clean;
}

function parseGitStatus(output) {
  const lines = output.split('\n').filter(Boolean);
  const branchLine = lines.find((line) => line.startsWith('## ')) || '';
  const files = lines.filter((line) => !line.startsWith('## ')).map((line) => {
    const code = line.slice(0, 2);
    const path = line.slice(3).trim();
    const status = code === '??' ? 'untracked'
      : code.includes('D') ? 'deleted'
      : code.includes('A') ? 'added'
      : code.includes('R') ? 'renamed'
      : 'modified';
    return { code, path, status, staged: code[0] !== ' ', unstaged: code[1] !== ' ' };
  });
  return { branchLine, files };
}

// Bound both process completion and stream reads; SSH cannot hold the UI forever.
async function run(args, cwd) {
  return runRemote(args, 60000, cwd);
}

async function readProcessStream(stream) {
  const decoder = new TextDecoder();
  if (!stream?.getReader) return '';
  const reader = stream.getReader();
  let output = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
  }
  return output + decoder.decode();
}

async function runRemote(args, timeoutMs = 60000, cwd) {
  let proc;
  try {
    proc = tjs.spawn(args, { cwd, stdout: 'pipe', stderr: 'pipe' });
  } catch (error) {
    return { code: -1, out: '', err: error?.message || 'Unable to start SSH.', timedOut: false };
  }
  const output = Promise.all([readProcessStream(proc.stdout), readProcessStream(proc.stderr)]);
  let timedOut = false;
  let timer;
  const wait = Promise.all([proc.wait(), output]).then(([status, streams]) => ({ status, streams }));
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      try { proc.kill?.(); } catch {}
      resolve({ status: null, streams: ['', 'Operation timed out.'] });
    }, timeoutMs);
  });
  const result = await Promise.race([wait, timeout]);
  clearTimeout(timer);
  const [out, err] = result.streams;
  const status = result.status;
  return {
    code: status ? (status.exit_status ?? status.exitCode ?? status.exit_code ?? 0) : -1,
    out: out.trim(),
    err: err.trim(),
    timedOut,
  };
}

const git = (dir, ...args) => run(['git', '-C', dir, ...args]);

async function exists(path) {
  try { await tjs.stat(path); return true; } catch { return false; }
}

async function readJsonFile(path, fallback = null) {
  try { return JSON.parse(dec.decode(await tjs.readFile(path))); } catch { return fallback; }
}

async function mcpFetch(path, options = {}) {
  if (!mcpInfo.endpoint || !mcpInfo.token) throw new Error('MCP service is not running.');
  const base = mcpInfo.endpoint.replace(/\/mcp$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
  const response = await fetch(base + path, {
    ...options,
    signal: controller.signal,
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + mcpInfo.token, ...(options.headers || {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'MCP service request failed.');
  return body;
  } finally { clearTimeout(timeout); }
}

async function refreshMcpInfo() {
  const state = await readJsonFile(MCP_STATE_PATH);
  if (state?.token && mcpInfo.endpoint) mcpInfo.token = state.token;
  return mcpInfo;
}

async function mcpMigration(app) {
  const prefs = {};
  for (const key of ['projectColors', 'projectRatings', 'projectKnowledgeLinks', 'projectNotionLinks', 'projectTags', 'projectContexts', 'todos']) {
    prefs[key] = await app.store.get(key);
  }
  return prefs;
}

async function syncPrefsToMcp(payload) {
  if (mcpInfo.state !== 'running') return;
  await mcpFetch('/app/state', { method: 'POST', body: JSON.stringify(payload) });
}

async function findNode() {
  const candidates = [
    APP_ROOT + '/runtime/node',
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    '/usr/bin/node',
  ];
  for (const candidate of candidates) if (await exists(candidate)) return candidate;
  return '';
}

async function waitForMcpReady(child) {
  if (!child.stdout?.getReader) throw new Error('MCP process did not expose a readable output stream.');
  const reader = child.stdout.getReader();
  let buffer = '';
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('MCP service startup timed out.')), 8000);
    const read = async () => {
      try {
        const { value, done } = await reader.read();
        if (done) return reject(new Error('MCP service stopped during startup.'));
        buffer += dec.decode(value, { stream: true });
        const line = buffer.split('\n')[0];
        if (line) {
          try {
            const ready = JSON.parse(line);
            if (ready.ready && ready.port) {
              clearTimeout(timeout);
              resolve(ready);
              return;
            }
          } catch {}
        }
        await read();
      } catch (error) { clearTimeout(timeout); reject(error); }
    };
    read();
  });
}

// Marker files, most specific first — first hit wins.
const STACKS = [
  ['composer.json', 'PHP'],
  ['artisan', 'Laravel'],
  ['next.config.js', 'Next.js'],
  ['next.config.mjs', 'Next.js'],
  ['nuxt.config.ts', 'Nuxt'],
  ['svelte.config.js', 'Svelte'],
  ['Cargo.toml', 'Rust'],
  ['go.mod', 'Go'],
  ['pyproject.toml', 'Python'],
  ['requirements.txt', 'Python'],
  ['Gemfile', 'Ruby'],
  ['pubspec.yaml', 'Flutter'],
  ['Package.swift', 'Swift'],
  ['pom.xml', 'Java'],
  ['build.gradle', 'Gradle'],
  ['tinyjs.json', 'TinyJS'],
  ['package.json', 'Node'],
  ['Dockerfile', 'Docker'],
];

async function detectStack(dir) {
  for (const [file, name] of STACKS) {
    if (await exists(dir + '/' + file)) return name;
  }
  return '—';
}

async function sizeMB(dir) {
  const { out } = await run(['du', '-sk', dir]);
  const kb = parseInt(out.split(/\s+/)[0], 10);
  return Number.isFinite(kb) ? Math.round(kb / 1024) : 0;
}

function classify(days) {
  if (days == null) return 'unknown';
  if (days < 30) return 'active';
  if (days < 90) return 'idle';
  if (days < 180) return 'stale';
  return 'cleanup';
}

function decorateRemoteProject(project) {
  const reasons = [];
  const reasonKeys = [];
  if (!project.remote) { reasons.push('no remote'); reasonKeys.push('noRemote'); }
  if (project.dirtyFiles) {
    reasons.push(project.dirtyFiles + ' modified file' + (project.dirtyFiles > 1 ? 's' : ''));
    reasonKeys.push('modifiedFiles');
  }
  if (project.unpushed) {
    reasons.push(project.unpushed + ' unpushed commit' + (project.unpushed > 1 ? 's' : ''));
    reasonKeys.push('unpushedCommits');
  }
  if (project.remote && !project.tracked) { reasons.push('no upstream'); reasonKeys.push('noTracking'); }
  if (project.lastCommitDays == null) { reasons.push('commit date unavailable'); reasonKeys.push('unknownCommit'); }
  else if (project.lastCommitDays < 180) {
    reasons.push('newer than 180 days'); reasonKeys.push('tooRecent');
  }
  return {
    ...project,
    status: classify(project.lastCommitDays),
    safeToRemove: reasons.length === 0,
    reasons,
    reasonKeys,
  };
}

async function scanRemoteWorkspace(workspace) {
  const args = ['ssh', '-i', resolveIdentityFile(sshIdentityFile(workspace)), '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10', '-o', 'ConnectionAttempts=1', sshTarget(workspace), buildRemoteScanCommand(workspace)];
  const result = await runRemote(args, 60000);
  if (result.code !== 0 || result.timedOut) {
    const failure = classifyRemoteFailure(result);
    const previous = remoteWorkspaceCache.get(workspace.id);
    return {
      ...workspace,
      ...failure,
      projects: previous?.projects || [],
      retained: Boolean(previous),
    };
  }
  try {
    const parsed = parseRemoteScanOutput(result.out, workspace);
    const current = { ...parsed, projects: parsed.projects.map(decorateRemoteProject) };
    remoteWorkspaceCache.set(workspace.id, current);
    return current;
  } catch (error) {
    const previous = remoteWorkspaceCache.get(workspace.id);
    return {
      ...workspace,
      connectionState: 'error',
      errorKind: 'malformed-output',
      errorMessage: 'Remote scan returned invalid data.',
      projects: previous?.projects || [],
      retained: Boolean(previous),
    };
  }
}

function parseRemoteProjectKey(path) {
  const match = typeof path === 'string' ? path.match(/^ssh:\/\/([^/]+)(\/.*)$/) : null;
  return match ? { alias: match[1], path: match[2] } : null;
}

function resolveIdentityFile(identityFile) {
  const value = String(identityFile || '~/.ssh/id_rsa');
  return value.startsWith('~/') ? tjs.homeDir + value.slice(1) : value;
}

function remoteGitArgs(workspace, command) {
  return ['ssh', '-i', resolveIdentityFile(sshIdentityFile(workspace)), '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10', '-o', 'ConnectionAttempts=1', sshTarget(workspace), command];
}

function workspaceFromProjectTarget(target, path, extra = {}) {
  const value = String(target || '');
  const split = value.lastIndexOf('@');
  const user = split > 0 ? value.slice(0, split) : '';
  const host = split > 0 ? value.slice(split + 1) : value;
  return normalizeRemoteWorkspace({ host, user, path: '/', ...extra });
}

async function scanProject(path) {
  const name = path.split('/').filter(Boolean).pop();

  const [commit, status, branch, remote, stack, size] = await Promise.all([
    git(path, 'log', '-1', '--format=%ct'),
    git(path, 'status', '--porcelain'),
    git(path, 'branch', '--show-current'),
    git(path, 'remote', 'get-url', 'origin'),
    detectStack(path),
    sizeMB(path),
  ]);

  const ts = parseInt(commit.out, 10);
  const hasCommits = Number.isFinite(ts) && ts > 0;
  const lastCommitDays = hasCommits
    ? Math.max(0, Math.floor((Date.now() - ts * 1000) / DAY))
    : null;

  const dirtyFiles = status.out ? status.out.split('\n').length : 0;
  const hasRemote = remote.code === 0 && !!remote.out;

  let unpushed = 0;
  let tracked = false;
  if (hasRemote && hasCommits) {
    const rl = await git(path, 'rev-list', '--count', '@{u}..HEAD');
    if (rl.code === 0) {
      tracked = true;
      unpushed = parseInt(rl.out, 10) || 0;
    }
  }

  const reasons = [];
  const reasonKeys = [];
  if (status.code !== 0 || status.timedOut || branch.code !== 0) { reasons.push('Git checks failed'); reasonKeys.push('gitUnavailable'); }
  if (!hasRemote) { reasons.push('no remote'); reasonKeys.push('noRemote'); }
  if (dirtyFiles) {
    reasons.push(dirtyFiles + ' modified file' + (dirtyFiles > 1 ? 's' : ''));
    reasonKeys.push('modifiedFiles');
  }
  if (unpushed) {
    reasons.push(unpushed + ' unpushed commit' + (unpushed > 1 ? 's' : ''));
    reasonKeys.push('unpushedCommits');
  }
  if (hasRemote && !tracked) {
    reasons.push('branch not tracking a remote'); reasonKeys.push('noTracking');
  }
  if (lastCommitDays == null) { reasons.push('commit date unavailable'); reasonKeys.push('unknownCommit'); }
  else if (lastCommitDays < 180) {
    reasons.push('newer than 180 days'); reasonKeys.push('tooRecent');
  }

  return {
    name,
    path,
    stack,
    branch: branch.out || '(detached)',
    lastCommitDays: hasCommits ? lastCommitDays : null,
    sizeMB: size,
    dirty: dirtyFiles > 0,
    dirtyFiles,
    remote: hasRemote,
    remoteUrl: remote.out,
    unpushed,
    status: classify(lastCommitDays),
    safeToRemove: reasons.length === 0,
    reasons,
    reasonKeys,
  };
}

// Walk the workspace. A directory containing .git is a project and is not
// descended into; otherwise we go `depth` levels deep looking for nested ones.
async function findRepos(root, ignored, depth, found) {
  return discoverRepos(root, ignored, depth, found, { readDir: tjs.readDir });
}

export const api = {
  async loadPrefs(_p, app) {
    const storedKnowledgeLinks = await app.store.get('projectKnowledgeLinks');
    const legacyNotionLinks = await app.store.get('projectNotionLinks');
    const projectKnowledgeLinks = storedKnowledgeLinks || Object.fromEntries(
      Object.entries(legacyNotionLinks || {})
        .filter(([path, url]) => typeof path === 'string' && isAllowedLink(url, 'notion'))
        .map(([path, url]) => [path, { notion: url }]),
    );
    return {
      workspace: (await app.store.get('workspace')) || tjs.homeDir + '/Workspace',
      ignored: (await app.store.get('ignored')) || ['node_modules', '.cache', 'vendor', 'dist', 'build'],
      language: (await app.store.get('language')) || null,
      projectColors: (await app.store.get('projectColors')) || {},
      projectRatings: (await app.store.get('projectRatings')) || {},
      projectKnowledgeLinks: cleanKnowledgeLinks(projectKnowledgeLinks),
      todos: cleanTodos(await app.store.get('todos')),
      projectTags: cleanProjectTags(await app.store.get('projectTags')),
      projectContexts: normalizeContexts(await app.store.get('projectContexts')),
      remoteWorkspaces: normalizeRemoteWorkspaces(await app.store.get('remoteWorkspaces')),
    };
  },

  async savePrefs({ workspace, ignored, language, projectColors, projectRatings, projectKnowledgeLinks, todos, projectTags, projectContexts, remoteWorkspaces }, app) {
    const set = (key, value) => persistPreference(app.store, key, value);
    if (workspace) await set('workspace', workspace);
    if (ignored) await set('ignored', ignored);
    if (language === 'it' || language === 'en') await set('language', language);
    if (projectColors && typeof projectColors === 'object') {
      const cleanColors = {};
      for (const [path, color] of Object.entries(projectColors)) {
        if (typeof path === 'string' && PROJECT_COLORS.has(color)) cleanColors[path] = color;
      }
      await set('projectColors', cleanColors);
    }
    if (projectRatings && typeof projectRatings === 'object') {
      const cleanRatings = {};
      for (const [path, rating] of Object.entries(projectRatings)) {
        if (typeof path === 'string' && Number.isInteger(rating) && rating >= 1 && rating <= MAX_PROJECT_RATING) {
          cleanRatings[path] = rating;
        }
      }
      await set('projectRatings', cleanRatings);
    }
    if (projectKnowledgeLinks && typeof projectKnowledgeLinks === 'object') {
      await set('projectKnowledgeLinks', cleanKnowledgeLinks(projectKnowledgeLinks));
    }
    if (Array.isArray(todos)) await set('todos', cleanTodos(todos));
    if (projectTags && typeof projectTags === 'object') await set('projectTags', cleanProjectTags(projectTags));
    if (projectContexts) await set('projectContexts', normalizeContexts(projectContexts));
    if (remoteWorkspaces) await set('remoteWorkspaces', normalizeRemoteWorkspaces(remoteWorkspaces));
    await syncPrefsToMcp({ projectColors, projectRatings, projectKnowledgeLinks, todos, projectTags, projectContexts });
    return true;
  },

  async scan({ root, ignored = [], depth = 3 }, app) {
    const found = [];
    await findRepos(root, ignored, depth, found);
    found.sort();
    const remoteWorkspaces = normalizeRemoteWorkspaces(await app.store.get('remoteWorkspaces'))
      .filter((workspace) => workspace.enabled);
    const totalWorkspaces = (found.length ? 1 : 0) + remoteWorkspaces.length;
    app.push('scan-start', { total: found.length, workspaces: totalWorkspaces });

    const localResults = new Array(found.length);
    let next = 0;
    let done = 0;
    const localScan = Promise.all(Array.from({ length: Math.min(4, found.length) }, async () => {
      while (next < found.length) {
        const index = next++;
        try { localResults[index] = await scanProject(found[index]); } catch {}
        app.push('scan-progress', { done: ++done, total: found.length });
      }
    }));
    // Scan SSH concurrently so a slow VM doesn't delay the start of local work.
    const remoteScan = Promise.all(remoteWorkspaces.map(async (workspace, index) => {
      const result = await scanRemoteWorkspace(workspace);
      app.push('scan-remote-progress', { workspaceId: workspace.id, done: index + 1, total: remoteWorkspaces.length, state: result.connectionState });
      return result;
    }));
    const [, remoteResults] = await Promise.all([localScan, remoteScan]);
    const projects = localResults.filter(Boolean);
    for (const result of remoteResults) projects.push(...result.projects);
    scannedProjects = projects;
    if (mcpInfo.state === 'running') {
      try { await mcpFetch('/app/scan-projects', { method: 'POST', body: JSON.stringify(projects) }); } catch {}
    }
    return { root, projects, remoteWorkspaces: remoteResults, limits: { depth, maxRepositories: 400 } };
  },

  async testRemoteWorkspace({ workspace }) {
    const [normalized] = normalizeRemoteWorkspaces([workspace]);
    if (!normalized) return { connectionState: 'error', errorKind: 'invalid', errorMessage: 'Invalid remote workspace.' };
    return scanRemoteWorkspace(normalized);
  },

  async openRemoteTerminal({ alias, user = '', identityFile = '', path }, app) {
    const workspaces = normalizeRemoteWorkspaces(await app.store.get('remoteWorkspaces'));
    const workspace = workspaces.find((item) => item.alias === alias && item.user === user && path.startsWith(item.path + '/'))
      || workspaceFromProjectTarget(user ? `${user}@${alias}` : alias, path, { identityFile });
    const remotePath = path.replace(/\/$/, '');
    const args = ['ssh', '-i', resolveIdentityFile(sshIdentityFile(workspace)), '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10', '-o', 'ConnectionAttempts=1', sshTarget(workspace), '-t', `cd -- ${shellQuote(remotePath)} && exec \$SHELL`];
    const command = args.map((value) => shellQuote(value)).join(' ');
    const appleScript = `tell application "Terminal" to do script ${JSON.stringify(command)}`;
    return (await run(['osascript', '-e', appleScript])).code === 0;
  },

  async mcpStatus() {
    await refreshMcpInfo();
    return mcpInfo;
  },

  async mcpStart(_params, app) {
    if (mcpInfo.state === 'running') return mcpInfo;
    if (!(await exists(MCP_SERVER_PATH))) {
      mcpInfo = { ...mcpInfo, state: 'error', error: 'MCP server source was not found.' };
      return mcpInfo;
    }
    const node = await findNode();
    if (!node) {
      mcpInfo = { ...mcpInfo, state: 'error', error: 'Node.js was not found. Install Node.js or start the server manually with npm run mcp.' };
      return mcpInfo;
    }
    try {
      const migration = await mcpMigration(app);
      mcpProcess = tjs.spawn([node, MCP_SERVER_PATH], {
        cwd: APP_ROOT,
        stdout: 'pipe',
        stderr: 'ignore',
        env: { PROJECTSHELF_PORT: '0', PROJECTSHELF_STATE_PATH: MCP_STATE_PATH, PROJECTSHELF_MIGRATION: JSON.stringify(migration) },
      });
      const ready = await waitForMcpReady(mcpProcess);
      mcpInfo = { state: 'running', endpoint: ready.endpoint, port: ready.port, token: '', error: '' };
      await refreshMcpInfo();
      await syncPrefsToMcp(await mcpMigration(app));
      await mcpFetch('/app/scan-projects', { method: 'POST', body: JSON.stringify(scannedProjects) });
      return mcpInfo;
    } catch (error) {
      try { mcpProcess?.kill?.(); } catch {}
      mcpProcess = undefined;
      mcpInfo = { ...mcpInfo, state: 'error', error: error.message || 'MCP service could not start.' };
      return mcpInfo;
    }
  },

  async mcpStop() {
    try { mcpProcess?.kill?.(); } catch {}
    mcpProcess = undefined;
    mcpInfo = { ...mcpInfo, state: 'stopped', error: '' };
    return mcpInfo;
  },

  async mcpRotateToken() {
    if (mcpInfo.state !== 'running') return mcpInfo;
    const result = await mcpFetch('/app/rotate-token', { method: 'POST' });
    mcpInfo.token = result.token;
    return mcpInfo;
  },

  async mcpSync(_params, app) {
    if (mcpInfo.state !== 'running') return false;
    const result = await mcpFetch('/app/state');
    const metadata = result.metadata || {};
    // A pull must not post its snapshot back: an LLM may have written since GET.
    for (const key of ['projectColors', 'projectRatings', 'projectKnowledgeLinks', 'projectTags', 'projectContexts', 'todos']) {
      if (metadata[key] !== undefined) await persistPreference(app.store, key, metadata[key]);
    }
    return true;
  },

  async mcpConfig() {
    await refreshMcpInfo();
    const url = mcpInfo.endpoint || 'http://127.0.0.1:PORT/mcp';
    const token = mcpInfo.token || 'TOKEN';
    return {
      ...mcpInfo,
      url,
      config: `[mcp_servers.projectShelf]\nurl = "${url}"\nhttp_headers = { Authorization = "Bearer ${token}" }`,
      prompt: `Connect Codex to ProjectShelf by adding the generated block to ~/.codex/config.toml. The MCP endpoint is ${url} and authentication is the Authorization bearer token shown above. Use list_projects before update_project. Read metadata.context (goal, checkpoint, nextAction, blocker) before resuming a project. After work, update checkpoint and nextAction only when authorized. You may change only project metadata, resume context, and Todo items. Never edit files, run shell commands, perform Git operations, or delete repositories through this MCP.`,
    };
  },

  async openIn({ path, kind }) {
    if (kind === 'finder') return (await run(['open', path])).code === 0;
    if (kind === 'terminal') return (await run(['open', '-a', 'Terminal', path])).code === 0;
    if (kind === 'code') {
      const r = await run(['code', path]);
      // `code` isn't on PATH unless the shell command was installed.
      return r.code === 0 || (await run(['open', '-a', 'Visual Studio Code', path])).code === 0;
    }
    if (kind === 'xcode' || kind === 'codex') return (await run(['open', '-a', kind === 'xcode' ? 'Xcode' : 'Codex', path])).code === 0;
    return false;
  },

  async resumeProject({ path }, app) {
    const project = scannedProjects.find((item) => item.path === path);
    if (!project) throw new Error('Project is not present in the latest scan.');
    const prefs = await api.loadPrefs({}, app);
    const context = normalizeContext(prefs.projectContexts[path]);
    const opened = project.location === 'remote'
      ? await api.openRemoteTerminal({ alias: project.sshAlias, user: project.sshUser, identityFile: project.sshIdentityFile, path: project.remotePath }, app)
      : await api.openIn({ path, kind: context.environment });
    if (!opened) throw new Error('Unable to open the selected application. Check that it is installed.');
    if (context.openTerminal && context.environment !== 'terminal' && project.location !== 'remote') await api.openIn({ path, kind: 'terminal' });
    if (context.openReferences) for (const url of Object.values(prefs.projectKnowledgeLinks[path] || {})) await api.openUrl({ url });
    context.lastOpened = Date.now();
    await api.savePrefs({ projectContexts: { ...prefs.projectContexts, [path]: context } }, app);
    return context;
  },

  async exportBackup({ path }, app) {
    if (!path || !path.endsWith('.json')) throw new Error('Select a JSON file.');
    const prefs = await api.loadPrefs({}, app);
    const preferences = Object.fromEntries(BACKUP_KEYS.map((key) => [key, prefs[key]]));
    await tjs.writeFile(path, new TextEncoder().encode(JSON.stringify({ format: 'projectshelf-backup', version: 1, exportedAt: new Date().toISOString(), preferences }, null, 2)));
    return true;
  },

  async importBackup({ path }, app) {
    const incoming = parseBackup(dec.decode(await tjs.readFile(path)));
    const current = await api.loadPrefs({}, app);
    await persistPreference(app.store, 'backupBeforeImport', current);
    await api.savePrefs(mergeBackup(current, incoming), app);
    return api.loadPrefs({}, app);
  },

  async repoStatus({ path }, app) {
    const remote = parseRemoteProjectKey(path);
    if (remote) {
      const workspaces = normalizeRemoteWorkspaces(await app.store.get('remoteWorkspaces'));
      const workspace = workspaces.find((item) => sshTarget(item) === remote.alias) || workspaceFromProjectTarget(remote.alias, remote.path);
      const result = await runRemote(remoteGitArgs(workspace, `git -C ${shellQuote(remote.path)} status --short --branch`), 60000);
      if (result.code !== 0 || result.timedOut) return { error: classifyRemoteFailure(result).errorMessage };
      const parsed = parseGitStatus(result.out);
      return {
        path,
        branch: parsed.branchLine.replace(/^##\s*/, '') || '(detached)',
        remote: '',
        commit: null,
        files: parsed.files,
        counts: {
          total: parsed.files.length,
          staged: parsed.files.filter((file) => file.staged).length,
          unstaged: parsed.files.filter((file) => file.unstaged).length,
        },
      };
    }
    const [status, branch, remoteUrlResult, commit] = await Promise.all([
      git(path, 'status', '--short', '--branch'),
      git(path, 'branch', '--show-current'),
      git(path, 'remote', 'get-url', 'origin'),
      git(path, 'log', '-1', '--format=%h|%s|%ct'),
    ]);
    if (status.code !== 0) return { error: 'Unable to read Git status.' };
    const parsed = parseGitStatus(status.out);
    const [hash = '', subject = '', timestamp = ''] = commit.out.split('|');
    return {
      path,
      branch: branch.out || parsed.branchLine.replace(/^##\s*/, '') || '(detached)',
      remote: remoteUrlResult.out || '',
      commit: hash ? { hash, subject, timestamp: Number(timestamp) || null } : null,
      files: parsed.files,
      counts: {
        total: parsed.files.length,
        staged: parsed.files.filter((file) => file.staged).length,
        unstaged: parsed.files.filter((file) => file.unstaged).length,
      },
    };
  },

  async repoDiff({ path, file }, app) {
    if (!path || !file) return { diff: '', available: false };
    const remote = parseRemoteProjectKey(path);
    if (remote) {
      if (file.includes('\0') || file.includes('..')) return { diff: '', available: false };
      const command = `git -C ${shellQuote(remote.path)} diff --no-ext-diff -- ${shellQuote(file)}`;
      const workspaces = normalizeRemoteWorkspaces(await app.store.get('remoteWorkspaces'));
      const workspace = workspaces.find((item) => sshTarget(item) === remote.alias) || workspaceFromProjectTarget(remote.alias, remote.path);
      const result = await runRemote(remoteGitArgs(workspace, command), 60000);
      return { file, diff: result.out, available: Boolean(result.out), error: result.code === 0 ? '' : classifyRemoteFailure(result).errorMessage };
    }
    const [unstaged, staged] = await Promise.all([
      git(path, 'diff', '--no-ext-diff', '--', file),
      git(path, 'diff', '--no-ext-diff', '--cached', '--', file),
    ]);
    const sections = [];
    if (staged.out) sections.push('### Staged\n' + staged.out);
    if (unstaged.out) sections.push('### Unstaged\n' + unstaged.out);
    return { file, diff: sections.join('\n\n'), available: sections.length > 0 };
  },

  async openUrl({ url }) {
    if (!isAllowedLink(url, linkProtocol(url) === 'obsidian:' ? 'obsidian' : 'notion')) return false;
    return (await run(['open', url])).code === 0;
  },
};

export function init(app) {
  app.setMenu([
    {
      title: 'Workspace',
      items: [
        { id: 'pick', label: 'Choose Workspace…', key: 'o' },
        { id: 'rescan', label: 'Rescan', key: 'r' },
      ],
    },
  ]);
}

export function onMenu(id, app) {
  app.push('menu', id);
}

export function onWindowClosed() { return api.mcpStop(); }

// Pure adapters and bounded process helper are exported for regression tests,
// not exposed to the frontend or to MCP tools.
export { runRemote, scanProject, decorateRemoteProject };
