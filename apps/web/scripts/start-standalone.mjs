import { spawn } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const standaloneRoot = join(packageRoot, '.next', 'standalone');
const serverPath = [
  join(standaloneRoot, 'server.js'),
  join(standaloneRoot, 'apps', 'web', 'server.js'),
].find((candidate) => existsSync(candidate));

if (!serverPath) {
  console.error(
    'Missing standalone server. Run `pnpm --filter web build` before `pnpm --filter web start`.',
  );
  process.exit(1);
}

const serverDir = dirname(serverPath);
copyRuntimeAssets(join(packageRoot, 'public'), join(serverDir, 'public'));
copyRuntimeAssets(join(packageRoot, '.next', 'static'), join(serverDir, '.next', 'static'));

const child = spawn(process.execPath, [serverPath], {
  env: process.env,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

function copyRuntimeAssets(source, target) {
  if (!existsSync(source)) return;
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
}
