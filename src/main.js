// ProjectShelf backend — scans a workspace for git repos and classifies them.
// Everything privileged lives here; the page only renders and calls tiny.api.

import {
  buildRemoteScanCommand,
  classifyRemoteFailure,
  normalizeRemoteWorkspace,
  normalizeRemoteWorkspaces,
  parseRemoteScanOutput,
  shellQuote,
} from './remote-workspaces.js';

const dec = new TextDecoder();
const DAY = 86400000;
const PROJECT_COLORS = new Set(['blue', 'green', 'yellow', 'orange', 'red', 'purple']);
const MAX_PROJECT_RATING = 5;
const MCP_STATE_PATH = tjs.homeDir + '/.projectshelf/mcp-state.json';
const MCP_SERVER_PATH = tjs.cwd + '/mcp/server.mjs';
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

// txiki.js spawn: current runtimes expose a Web Streams reader. Keep the
// older read(buf) and wait() result shapes as fallbacks for dev runtimes.
async function run(args, cwd) {
  let proc;
  try {
    proc = tjs.spawn(args, { cwd, stdout: 'pipe', stderr: 'ignore' });
  } catch (e) {
    return { out: '', code: -1 };
  }
  let out = '';
  if (proc.stdout && typeof proc.stdout.getReader === 'function') {
    const reader = proc.stdout.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) out += dec.decode(value, { stream: true });
    }
    out += dec.decode();
  } else if (proc.stdout && typeof proc.stdout.read === 'function') {
    const buf = new Uint8Array(1 << 16);
    for (;;) {
      const n = await proc.stdout.read(buf);
      if (!n) break;
      out += dec.decode(buf.subarray(0, n));
    }
  }
  const st = await proc.wait();
  if (!out && st && typeof st.stdout === 'string') out = st.stdout;
  const code = st ? (st.exit_status ?? st.exitCode ?? st.exit_code ?? 0) : 0;
  return { out: out.trim(), code };
}

async function readProcessStream(stream) {
  if (!stream?.getReader) return '';
  const reader = stream.getReader();
  let output = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    output += dec.decode(value, { stream: true });
  }
  return output + dec.decode();
}

async function runRemote(args, timeoutMs = 60000) {
  let proc;
  try {
    proc = tjs.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
  } catch (error) {
    return { code: -1, out: '', err: error?.message || 'Unable to start SSH.', timedOut: false };
  }
  const output = Promise.all([readProcessStream(proc.stdout), readProcessStream(proc.stderr)]);
  let timedOut = false;
  let timer;
  const wait = proc.wait().then((status) => ({ status, output }));
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      try { proc.kill?.(); } catch {}
      resolve({ status: null, output });
    }, timeoutMs);
  });
  const result = await Promise.race([wait, timeout]);
  clearTimeout(timer);
  const [out, err] = await result.output;
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
  const response = await fetch(base + path, {
    ...options,
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + mcpInfo.token, ...(options.headers || {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'MCP service request failed.');
  return body;
}

async function refreshMcpInfo() {
  const state = await readJsonFile(MCP_STATE_PATH);
  if (state?.token && mcpInfo.endpoint) mcpInfo.token = state.token;
  return mcpInfo;
}

async function mcpMigration(app) {
  const prefs = {};
  for (const key of ['projectColors', 'projectRatings', 'projectKnowledgeLinks', 'projectNotionLinks', 'projectTags', 'todos']) {
    prefs[key] = await app.store.get(key);
  }
  return prefs;
}

async function syncPrefsToMcp(payload) {
  if (mcpInfo.state !== 'running') return;
  try { await mcpFetch('/app/state', { method: 'POST', body: JSON.stringify(payload) }); } catch {}
}

async function findNode() {
  const candidates = [
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    '/usr/bin/node',
    '/Users/alessandro/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node',
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
  if (project.lastCommitDays == null || project.lastCommitDays <= 180) {
    reasons.push('newer than 180 days'); reasonKeys.push('tooRecent');
  }
  return {
    ...project,
    status: classify(project.lastCommitDays == null ? 9999 : project.lastCommitDays),
    safeToRemove: reasons.length === 0,
    reasons,
    reasonKeys,
  };
}

async function scanRemoteWorkspace(workspace) {
  const args = ['ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10', '-o', 'ConnectionAttempts=1', workspace.alias, buildRemoteScanCommand(workspace)];
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

function remoteGitArgs(alias, command) {
  return ['ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10', '-o', 'ConnectionAttempts=1', alias, command];
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
  const hasCommits = Number.isFinite(ts);
  const lastCommitDays = hasCommits
    ? Math.floor((Date.now() - ts * 1000) / DAY)
    : 9999;

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
  if (lastCommitDays <= 180) {
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
  if (depth < 0 || found.length >= 400) return;
  let iter;
  try { iter = await tjs.readDir(root); } catch { return; }
  const subdirs = [];
  for await (const e of iter) {
    if (!e.isDirectory) continue;
    if (e.name.startsWith('.') && e.name !== '.git') continue;
    if (ignored.includes(e.name)) continue;
    if (e.name === '.git') { found.push(root); return; }
    subdirs.push(root.replace(/\/$/, '') + '/' + e.name);
  }
  for (const d of subdirs) await findRepos(d, ignored, depth - 1, found);
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
      remoteWorkspaces: normalizeRemoteWorkspaces(await app.store.get('remoteWorkspaces')),
    };
  },

  async savePrefs({ workspace, ignored, language, projectColors, projectRatings, projectKnowledgeLinks, todos, projectTags, remoteWorkspaces }, app) {
    if (workspace) await app.store.set('workspace', workspace);
    if (ignored) await app.store.set('ignored', ignored);
    if (language === 'it' || language === 'en') await app.store.set('language', language);
    if (projectColors && typeof projectColors === 'object') {
      const cleanColors = {};
      for (const [path, color] of Object.entries(projectColors)) {
        if (typeof path === 'string' && PROJECT_COLORS.has(color)) cleanColors[path] = color;
      }
      await app.store.set('projectColors', cleanColors);
    }
    if (projectRatings && typeof projectRatings === 'object') {
      const cleanRatings = {};
      for (const [path, rating] of Object.entries(projectRatings)) {
        if (typeof path === 'string' && Number.isInteger(rating) && rating >= 1 && rating <= MAX_PROJECT_RATING) {
          cleanRatings[path] = rating;
        }
      }
      await app.store.set('projectRatings', cleanRatings);
    }
    if (projectKnowledgeLinks && typeof projectKnowledgeLinks === 'object') {
      await app.store.set('projectKnowledgeLinks', cleanKnowledgeLinks(projectKnowledgeLinks));
    }
    if (Array.isArray(todos)) await app.store.set('todos', cleanTodos(todos));
    if (projectTags && typeof projectTags === 'object') await app.store.set('projectTags', cleanProjectTags(projectTags));
    if (remoteWorkspaces) await app.store.set('remoteWorkspaces', normalizeRemoteWorkspaces(remoteWorkspaces));
    await syncPrefsToMcp({ projectColors, projectRatings, projectKnowledgeLinks, todos, projectTags });
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

    const projects = [];
    for (let i = 0; i < found.length; i++) {
      try {
        projects.push(await scanProject(found[i]));
      } catch (e) {
        // A repo we can't read shouldn't kill the whole scan.
      }
      app.push('scan-progress', { done: i + 1, total: found.length });
    }
    const remoteResults = await Promise.all(remoteWorkspaces.map(async (workspace, index) => {
      const result = await scanRemoteWorkspace(workspace);
      app.push('scan-remote-progress', { workspaceId: workspace.id, done: index + 1, total: remoteWorkspaces.length, state: result.connectionState });
      return result;
    }));
    for (const result of remoteResults) projects.push(...result.projects);
    if (mcpInfo.state === 'running') {
      try { await mcpFetch('/app/scan-projects', { method: 'POST', body: JSON.stringify(projects) }); } catch {}
    }
    return { root, projects, remoteWorkspaces: remoteResults };
  },

  async testRemoteWorkspace({ workspace }) {
    const [normalized] = normalizeRemoteWorkspaces([workspace]);
    if (!normalized) return { connectionState: 'error', errorKind: 'invalid', errorMessage: 'Invalid remote workspace.' };
    return scanRemoteWorkspace(normalized);
  },

  async openRemoteTerminal({ alias, path }, app) {
    const workspaces = normalizeRemoteWorkspaces(await app.store.get('remoteWorkspaces'));
    const workspace = workspaces.find((item) => item.alias === alias && path.startsWith(item.path + '/'));
    if (!workspace) return false;
    const remotePath = path.replace(/\/$/, '');
    const command = `ssh -o BatchMode=yes ${shellQuote(alias)} -t "cd -- ${shellQuote(remotePath)} && exec \$SHELL"`;
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
        cwd: tjs.cwd,
        stdout: 'pipe',
        stderr: 'ignore',
        env: { PROJECTSHELF_PORT: '0', PROJECTSHELF_STATE_PATH: MCP_STATE_PATH, PROJECTSHELF_MIGRATION: JSON.stringify(migration) },
      });
      const ready = await waitForMcpReady(mcpProcess);
      mcpInfo = { state: 'running', endpoint: ready.endpoint, port: ready.port, token: '', error: '' };
      await refreshMcpInfo();
      try { await mcpFetch('/app/scan-projects', { method: 'POST', body: JSON.stringify([]) }); } catch {}
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
    if (metadata.projectColors) await app.store.set('projectColors', metadata.projectColors);
    if (metadata.projectRatings) await app.store.set('projectRatings', metadata.projectRatings);
    if (metadata.projectKnowledgeLinks) await app.store.set('projectKnowledgeLinks', metadata.projectKnowledgeLinks);
    if (metadata.projectTags) await app.store.set('projectTags', metadata.projectTags);
    if (Array.isArray(metadata.todos)) await app.store.set('todos', cleanTodos(metadata.todos));
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
      prompt: `Connect Codex to ProjectShelf by adding the generated block to ~/.codex/config.toml. The MCP endpoint is ${url} and authentication is the Authorization bearer token shown above. Use list_projects before update_project. You may change only project colors, ratings, tags, Notion links, Obsidian links, and Todo items. Never edit files, run shell commands, perform Git operations, or delete repositories.`,
    };
  },

  async openIn({ path, kind }) {
    if (kind === 'finder') return (await run(['open', path])).code === 0;
    if (kind === 'terminal') return (await run(['open', '-a', 'Terminal', path])).code === 0;
    if (kind === 'code') {
      const r = await run(['code', path]);
      // `code` isn't on PATH unless the shell command was installed.
      if (r.code !== 0) await run(['open', '-a', 'Visual Studio Code', path]);
      return true;
    }
    return false;
  },

  async repoStatus({ path }) {
    const remote = parseRemoteProjectKey(path);
    if (remote) {
      const result = await runRemote(remoteGitArgs(remote.alias, `git -C ${shellQuote(remote.path)} status --short --branch`), 60000);
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
    const [status, branch, remote, commit] = await Promise.all([
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
      remote: remote.out || '',
      commit: hash ? { hash, subject, timestamp: Number(timestamp) || null } : null,
      files: parsed.files,
      counts: {
        total: parsed.files.length,
        staged: parsed.files.filter((file) => file.staged).length,
        unstaged: parsed.files.filter((file) => file.unstaged).length,
      },
    };
  },

  async repoDiff({ path, file }) {
    if (!path || !file) return { diff: '', available: false };
    const remote = parseRemoteProjectKey(path);
    if (remote) {
      if (file.includes('\0') || file.includes('..')) return { diff: '', available: false };
      const command = `git -C ${shellQuote(remote.path)} diff --no-ext-diff -- ${shellQuote(file)}`;
      const result = await runRemote(remoteGitArgs(remote.alias, command), 60000);
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
