const ALIAS_RE = /^[A-Za-z0-9._-]+$/;
const MAX_NAME_LENGTH = 80;

export class RemoteWorkspaceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RemoteWorkspaceError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new RemoteWorkspaceError(code, message);
}

export function isAbsoluteRemotePath(path) {
  return typeof path === 'string' && path.startsWith('/') && !path.includes('\0');
}

export function normalizeRemotePath(path) {
  if (!isAbsoluteRemotePath(path)) fail('INVALID_REMOTE_PATH', 'Remote path must be absolute.');
  const normalized = path.replace(/\/+/g, '/').replace(/\/\.\//g, '/').replace(/\/\/+$/, '') || '/';
  if (normalized.split('/').includes('..')) fail('INVALID_REMOTE_PATH', 'Remote path cannot contain parent traversal.');
  return normalized;
}

export function normalizeRemoteWorkspace(input = {}) {
  const alias = typeof input.alias === 'string' ? input.alias.trim() : '';
  if (!alias || !ALIAS_RE.test(alias)) fail('INVALID_SSH_ALIAS', 'SSH alias contains unsupported characters.');
  const path = normalizeRemotePath(input.path);
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, MAX_NAME_LENGTH) : '';
  return {
    id: `remote-${alias}-${path.slice(1).replace(/[^A-Za-z0-9._-]+/g, '-') || 'root'}`,
    alias,
    path,
    name: name || `${alias}:${path}`,
    enabled: input.enabled !== false,
  };
}

export function normalizeRemoteWorkspaces(entries) {
  if (!Array.isArray(entries)) return [];
  const seen = new Set();
  const result = [];
  for (const entry of entries) {
    try {
      const workspace = normalizeRemoteWorkspace(entry);
      if (seen.has(workspace.id)) continue;
      seen.add(workspace.id);
      result.push(workspace);
    } catch {}
  }
  return result;
}

export function remoteProjectKey(alias, projectPath) {
  return `ssh://${alias}${normalizeRemotePath(projectPath)}`;
}

export function shellQuote(value) {
  return "'" + String(value).replaceAll("'", "'\"'\"'") + "'";
}

function cleanField(value) {
  return String(value ?? '').replace(/[\t\r\n]/g, ' ');
}

const REMOTE_SCAN_SCRIPT = `
root=$1
find "$root" -type d -name .git -prune -print 2>/dev/null | while IFS= read -r gitdir; do
  repo="${'${gitdir%/.git}'}"
  branch=$(git -C "$repo" branch --show-current 2>/dev/null)
  commit=$(git -C "$repo" log -1 --format=%ct 2>/dev/null)
  dirty=$(git -C "$repo" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  remote=$(git -C "$repo" remote get-url origin 2>/dev/null)
  unpushed=$(git -C "$repo" rev-list --count '@{u}..HEAD' 2>/dev/null || printf '0')
  stack=$(for marker in composer.json artisan next.config.js next.config.mjs nuxt.config.ts svelte.config.js Cargo.toml go.mod pyproject.toml requirements.txt Gemfile pubspec.yaml Package.swift pom.xml build.gradle tinyjs.json package.json Dockerfile; do
    if [ -e "$repo/$marker" ]; then printf '%s' "$marker"; break; fi
  done)
  size=$(du -sk "$repo" 2>/dev/null | awk '{print $1}')
  printf '%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\n' "$repo" "$(basename "$repo")" "$branch" "$commit" "$dirty" "$remote" "$unpushed" "$stack" "$size"
done`;

export function buildRemoteScanCommand(workspace) {
  const normalized = normalizeRemoteWorkspace(workspace);
  return `sh -s -- ${shellQuote(normalized.path)} <<'PROJECTSHELF_REMOTE_SCAN'\n${REMOTE_SCAN_SCRIPT}\nPROJECTSHELF_REMOTE_SCAN`;
}

export function buildRemoteProjectStatusCommand(project) {
  const alias = typeof project?.sshAlias === 'string' ? project.sshAlias : '';
  const path = normalizeRemotePath(project?.remotePath || project?.path?.replace(/^ssh:\/\/[^/]+/, '') || '');
  if (!ALIAS_RE.test(alias)) fail('INVALID_SSH_ALIAS', 'SSH alias contains unsupported characters.');
  return `git -C ${shellQuote(path)} status --short --branch`;
}

export function parseRemoteScanOutput(stdout, workspace) {
  const normalized = normalizeRemoteWorkspace(workspace);
  const projects = [];
  for (const line of String(stdout || '').split('\n')) {
    if (!line.trim()) continue;
    const [projectPath, name, branch, commit, dirty, remoteUrl, unpushed, stack, sizeKB] = line.split('\t');
    if (!projectPath || !isAbsoluteRemotePath(projectPath) || !name) continue;
    const timestamp = Number(commit);
    const dirtyFiles = Number(dirty) || 0;
    projects.push({
      name: cleanField(name),
      path: remoteProjectKey(normalized.alias, projectPath),
      remotePath: normalizeRemotePath(projectPath),
      workspacePath: normalized.path,
      location: 'remote',
      sshAlias: normalized.alias,
      connectionState: 'online',
      stack: cleanField(stack) || '—',
      branch: cleanField(branch) || '(detached)',
      lastCommitDays: Number.isFinite(timestamp) ? Math.floor((Date.now() - timestamp * 1000) / 86400000) : null,
      sizeMB: Math.round((Number(sizeKB) || 0) / 1024),
      dirty: dirtyFiles > 0,
      dirtyFiles,
      remote: Boolean(cleanField(remoteUrl)),
      remoteUrl: cleanField(remoteUrl),
      unpushed: Number(unpushed) || 0,
    });
  }
  return { ...normalized, connectionState: 'online', errorKind: '', errorMessage: '', projects };
}

export function classifyRemoteFailure({ code, stderr = '', timedOut = false }) {
  if (timedOut) return { connectionState: 'timeout', errorKind: 'timeout', errorMessage: 'SSH scan timed out after 60 seconds.' };
  const text = String(stderr).toLowerCase();
  if (code === 255 && /permission denied|authentication|no supported authentication/.test(text)) {
    return { connectionState: 'error', errorKind: 'authentication', errorMessage: 'SSH authentication failed.' };
  }
  if (/no such file|not exist|could not resolve|name or service not known/.test(text)) {
    return { connectionState: 'error', errorKind: 'path-or-host', errorMessage: 'Remote host or path is unavailable.' };
  }
  return { connectionState: 'error', errorKind: 'unavailable', errorMessage: 'Unable to scan the remote workspace.' };
}

export { REMOTE_SCAN_SCRIPT };
