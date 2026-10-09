// Package everything needed by the local MCP; never rely on the launch cwd.
import { cp, mkdir, realpath, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', timeout: 60000 });
  if (result.error || result.status !== 0) throw result.error || new Error(command + ' failed');
}
run('tinyjs', ['build']);
const bundle = join(root, 'dist/ProjectShelf.app');
const resources = join(bundle, 'Contents/Resources/app');
await cp(join(root, 'mcp'), join(resources, 'mcp'), { recursive: true });
// pnpm's relative links stay inside this tree; npm's ordinary tree also works.
await cp(join(root, 'node_modules'), join(resources, 'node_modules'), { recursive: true, verbatimSymlinks: true });
await cp(join(root, 'package.json'), join(resources, 'package.json'));
await mkdir(join(resources, 'runtime'), { recursive: true });
const node = await realpath(process.env.PROJECTSHELF_NODE_BINARY || process.execPath);
await access(node);
await cp(node, join(resources, 'runtime/node'));
run('codesign', ['--force', '--sign', '-', join(resources, 'runtime/node')]);
run('codesign', ['--force', '--deep', '--sign', '-', bundle]);
run('codesign', ['--verify', '--deep', '--strict', bundle]);
console.log('ProjectShelf.app includes MCP sources, dependencies and Node runtime.');
