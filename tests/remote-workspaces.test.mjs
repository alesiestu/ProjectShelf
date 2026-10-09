import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRemoteScanCommand,
  classifyRemoteFailure,
  normalizeRemoteWorkspace,
  normalizeRemoteWorkspaces,
  parseRemoteScanOutput,
  remoteProjectKey,
  shellQuote,
} from '../src/remote-workspaces.js';

test('normalizes a remote workspace and creates a stable id', () => {
  assert.deepEqual(normalizeRemoteWorkspace({ alias: 'dev-vm', path: '/home/alessandro/workspace', name: 'Dev VM' }), {
    id: 'remote-dev-vm-home-alessandro-workspace', alias: 'dev-vm', host: 'dev-vm', user: '', identityFile: '~/.ssh/id_rsa', path: '/home/alessandro/workspace', name: 'Dev VM', enabled: true,
  });
  assert.equal(remoteProjectKey('dev-vm', '/home/alessandro/workspace/app'), 'ssh://dev-vm/home/alessandro/workspace/app');
});

test('supports an IP, SSH user, and custom private key', () => {
  const workspace = normalizeRemoteWorkspace({ host: '192.168.1.20', user: 'alessandro', identityFile: '~/.ssh/work-vm', path: '/srv/projects' });
  assert.equal(workspace.id, 'remote-alessandro@192.168.1.20-srv-projects');
  assert.equal(remoteProjectKey(workspace, '/srv/projects/app'), 'ssh://alessandro@192.168.1.20/srv/projects/app');
});

test('rejects unsafe aliases and non-absolute paths', () => {
  assert.throws(() => normalizeRemoteWorkspace({ alias: 'dev vm', path: '/tmp' }), /unsupported/);
  assert.throws(() => normalizeRemoteWorkspace({ alias: 'dev;vm', path: '/tmp' }), /unsupported/);
  assert.throws(() => normalizeRemoteWorkspace({ alias: 'dev-vm', path: 'relative/path' }), /absolute/);
  assert.throws(() => normalizeRemoteWorkspace({ alias: 'dev-vm', path: '/tmp/../private' }), /parent traversal/);
});

test('normalizes duplicate workspaces and preserves disabled entries', () => {
  const result = normalizeRemoteWorkspaces([
    { alias: 'dev-vm', path: '/tmp', enabled: false },
    { alias: 'dev-vm', path: '/tmp', name: 'duplicate' },
    { alias: 'bad alias', path: '/tmp' },
  ]);
  assert.deepEqual(result, [{ id: 'remote-dev-vm-tmp', alias: 'dev-vm', host: 'dev-vm', user: '', identityFile: '~/.ssh/id_rsa', path: '/tmp', name: 'dev-vm:/tmp', enabled: false }]);
});

test('quotes shell values without allowing a quote to escape', () => {
  assert.equal(shellQuote("/tmp/a'b"), "'/tmp/a'\"'\"'b'");
  const command = buildRemoteScanCommand({ alias: 'dev-vm', path: "/home/alessandro/my workspace" });
  assert.match(command, /PROJECTSHELF_REMOTE_SCAN/);
  assert.match(command, /my workspace/);
  assert.doesNotMatch(command, /git commit|git push|rm -rf/);
});

test('parses valid remote records and ignores malformed records', () => {
  const stdout = [
    '/home/ws/app\tapp\tmain\t1700000000\t2\thttps://github.com/a/app.git\t1\tpackage.json\t1024',
    'malformed',
    '/home/ws/other\tother\t\tbad\t0\t\t0\t\t0',
  ].join('\n');
  const result = parseRemoteScanOutput(stdout, { alias: 'dev-vm', path: '/home/ws' });
  assert.equal(result.connectionState, 'online');
  assert.equal(result.projects.length, 2);
  assert.equal(result.projects[0].path, 'ssh://dev-vm/home/ws/app');
  assert.equal(result.projects[0].location, 'remote');
});

test('classifies timeout and authentication failures', () => {
  assert.equal(classifyRemoteFailure({ timedOut: true }).connectionState, 'timeout');
  assert.equal(classifyRemoteFailure({ code: 255, stderr: 'Permission denied (publickey).' }).errorKind, 'authentication');
  assert.equal(classifyRemoteFailure({ code: 1, stderr: 'No such file or directory' }).errorKind, 'path-or-host');
});
