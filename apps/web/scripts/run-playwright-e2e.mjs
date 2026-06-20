import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const playwrightCli = resolve(
  packageRoot,
  'node_modules',
  '@playwright',
  'test',
  'cli.js',
);
const nextCli = resolve(
  packageRoot,
  'node_modules',
  'next',
  'dist',
  'bin',
  'next',
);
const healthUrl = 'http://localhost:3006/api/health';
const childEnv = sanitizeLifecycleEnv({
  ...process.env,
  PLAYWRIGHT_SKIP_WEB_SERVER: '1',
});

let serverProcess = null;

process.on('SIGINT', async () => {
  await stopServer();
  process.exit(130);
});

process.on('SIGTERM', async () => {
  await stopServer();
  process.exit(143);
});

try {
  if (!(await isHealthy())) {
    serverProcess = startNextDevServer();
    await waitForHealth(serverProcess);
  }

  const code = await runPlaywright();
  await stopServer();
  process.exit(code);
} catch (error) {
  console.error(error);
  await stopServer();
  process.exit(1);
}

function sanitizeLifecycleEnv(env) {
  const nextEnv = { ...env };
  for (const key of Object.keys(nextEnv)) {
    if (key.startsWith('npm_') || key === 'INIT_CWD') {
      delete nextEnv[key];
    }
  }
  return nextEnv;
}

function startNextDevServer() {
  const child = spawn(process.execPath, [nextCli, 'dev', '-p', '3006'], {
    cwd: packageRoot,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));

  return child;
}

function runPlaywright() {
  return new Promise((resolveCode, reject) => {
    const child = spawn(
      process.execPath,
      [playwrightCli, 'test', '--workers=1', '--reporter=line'],
      {
        cwd: packageRoot,
        env: childEnv,
        stdio: 'inherit',
      },
    );

    child.on('error', reject);
    child.on('close', (code) => resolveCode(code ?? 1));
  });
}

async function waitForHealth(child) {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error(`Next dev server exited early with code ${child.exitCode}`);
    }
    if (await isHealthy()) return;
    await delay(250);
  }

  throw new Error(`Timed out waiting for ${healthUrl}`);
}

async function isHealthy() {
  try {
    const response = await fetch(healthUrl);
    return response.ok;
  } catch {
    return false;
  }
}

async function stopServer() {
  if (!serverProcess || serverProcess.exitCode != null) return;

  serverProcess.kill('SIGTERM');
  const stopped = await waitForExit(serverProcess, 5_000);
  if (!stopped && serverProcess.exitCode == null) {
    serverProcess.kill('SIGKILL');
    await waitForExit(serverProcess, 2_000);
  }
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolveDone) => {
    const timeout = setTimeout(() => {
      child.off('exit', onExit);
      resolveDone(false);
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timeout);
      resolveDone(true);
    };

    child.once('exit', onExit);
  });
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
