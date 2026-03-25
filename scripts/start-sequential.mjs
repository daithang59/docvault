import process from 'node:process';
import { spawn } from 'node:child_process';

const SERVICES = [
  {
    name: 'metadata-service',
    port: 3001,
    healthUrl: 'http://localhost:3001/health',
    beforeStart: [
      {
        label: 'Run Prisma deploy for metadata-service',
        command: ['--filter', 'metadata-service', 'prisma:deploy'],
        optional: true,
        envFlag: 'RUN_PRISMA_DEPLOY',
      },
    ],
  },
  {
    name: 'document-service',
    port: 3002,
    healthUrl: 'http://localhost:3002/health',
  },
  {
    name: 'workflow-service',
    port: 3003,
    healthUrl: 'http://localhost:3003/health',
  },
  {
    name: 'notification-service',
    port: 3005,
    healthUrl: 'http://localhost:3005/health',
  },
  {
    name: 'audit-service',
    port: 3004,
    healthUrl: 'http://localhost:3004/health',
    afterStart: [
      {
        label: 'Migrate audit logs to MongoDB',
        command: ['--filter', 'audit-service', 'migrate:to-mongo'],
        optional: true,
        envFlag: 'RUN_AUDIT_MIGRATION',
      },
    ],
  },
  {
    name: 'gateway',
    port: 3000,
    healthUrl: 'http://localhost:3000/api/health',
  },
];

const HEALTHCHECK_TIMEOUT_MS = Number(process.env.SERVICE_HEALTH_TIMEOUT_MS ?? 120000);
const HEALTHCHECK_INTERVAL_MS = Number(process.env.SERVICE_HEALTH_INTERVAL_MS ?? 2000);
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = Number(process.env.SERVICE_SHUTDOWN_TIMEOUT_MS ?? 10000);

const children = [];
let shuttingDown = false;

function log(message) {
  process.stdout.write(`[start-sequential] ${message}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function shouldUseShell() {
  // Windows requires shell:true to spawn .cmd / .bat files.
  return process.platform === 'win32';
}

function shouldRunOptionalStep(envFlag) {
  const raw = process.env[envFlag];
  return raw === '1' || raw === 'true' || raw === 'yes';
}

async function runPnpmStep({ label, command, optional = false, envFlag }) {
  if (optional && envFlag && !shouldRunOptionalStep(envFlag)) {
    log(`Skip: ${label} (set ${envFlag}=true to enable)`);
    return;
  }

  log(`${label}...`);

  await new Promise((resolve, reject) => {
    const child = spawn(pnpmCommand(), command, {
      env: process.env,
      stdio: 'inherit',
      shell: shouldUseShell(),
    });

    child.on('error', reject);

    child.on('exit', (code, signal) => {
      if (typeof code === 'number' && code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} failed (code=${code ?? 'null'}, signal=${signal ?? 'null'})`));
    });
  });
}

async function waitForHealth(healthUrl, serviceName) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < HEALTHCHECK_TIMEOUT_MS) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // Service may still be booting, keep waiting.
    }

    await sleep(HEALTHCHECK_INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for ${serviceName} health endpoint: ${healthUrl}`);
}

function startService(service) {
  log(`Starting ${service.name} on :${service.port}...`);

  const child = spawn(
    pnpmCommand(),
    ['--filter', service.name, 'start:dev'],
    {
      env: process.env,
      stdio: 'inherit',
      shell: shouldUseShell(),
    },
  );

  child.on('error', (error) => {
    if (!shuttingDown) {
      log(`${service.name} failed to start: ${error.message}`);
      shutdown(1).catch(() => {
        process.exit(1);
      });
    }
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    log(`${service.name} exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
    shutdown(1).catch(() => {
      process.exit(1);
    });
  });

  children.push({ service: service.name, child });
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  log('Stopping all services...');

  for (const { service, child } of [...children].reverse()) {
    if (child.exitCode !== null || child.killed) continue;

    log(`Stopping ${service}...`);
    try {
      child.kill('SIGTERM');
    } catch {
      // ignore and continue
    }
  }

  const deadline = Date.now() + GRACEFUL_SHUTDOWN_TIMEOUT_MS;
  for (const { child } of children) {
    while (child.exitCode === null && Date.now() < deadline) {
      await sleep(200);
    }

    if (child.exitCode === null && !child.killed) {
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore and continue
      }
    }
  }

  process.exit(exitCode);
}

process.on('SIGINT', () => {
  shutdown(0).catch(() => {
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  shutdown(0).catch(() => {
    process.exit(1);
  });
});

async function main() {
  log('Boot sequence started. Make sure Docker infra is already healthy first.');

  for (const service of SERVICES) {
    if (service.beforeStart?.length) {
      for (const step of service.beforeStart) {
        await runPnpmStep(step);
      }
    }

    startService(service);
    await waitForHealth(service.healthUrl, service.name);
    log(`${service.name} is healthy at ${service.healthUrl}`);

    if (service.afterStart?.length) {
      for (const step of service.afterStart) {
        await runPnpmStep(step);
      }
    }
  }

  log('All services are up in sequence. Press Ctrl+C to stop all.');
}

main().catch(async (error) => {
  log(`Startup failed: ${error.message}`);
  await shutdown(1);
});
