// ProjectShelf backend — scans a workspace for git repos and classifies them.
// Everything privileged lives here; the page only renders and calls tiny.api.

const dec = new TextDecoder();
const DAY = 86400000;
const PROJECT_COLORS = new Set(['blue', 'green', 'yellow', 'orange', 'red', 'purple']);
const MAX_PROJECT_RATING = 5;

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

const git = (dir, ...args) => run(['git', '-C', dir, ...args]);

async function exists(path) {
  try { await tjs.stat(path); return true; } catch { return false; }
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
    };
  },

  async savePrefs({ workspace, ignored, language, projectColors, projectRatings, projectKnowledgeLinks, todos }, app) {
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
    return true;
  },

  async scan({ root, ignored = [], depth = 3 }, app) {
    const found = [];
    await findRepos(root, ignored, depth, found);
    found.sort();
    app.push('scan-start', { total: found.length });

    const projects = [];
    for (let i = 0; i < found.length; i++) {
      try {
        projects.push(await scanProject(found[i]));
      } catch (e) {
        // A repo we can't read shouldn't kill the whole scan.
      }
      app.push('scan-progress', { done: i + 1, total: found.length });
    }
    return { root, projects };
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
