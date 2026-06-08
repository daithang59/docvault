// Playwright screenshot capture for DocVault web UI.
// Usage: node scripts/capture-screenshots.mjs
// Requires the web app running on http://localhost:3010 (override with WEB_BASE_URL).
// For authenticated pages, the full stack (Docker infra + services) must be up and
// you must be logged in; pass a storage-state file via PW_STATE to reuse a session.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const require = createRequire(join(repoRoot, 'package.json'));
const pwPath = join(repoRoot, 'node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.js');
const { chromium } = require(pwPath);

const BASE = process.env.WEB_BASE_URL ?? 'http://localhost:3010';
const OUT = join(repoRoot, 'docs/images/web');
const STATE = process.env.PW_STATE; // optional storageState json for auth

// Public pages (no auth). Authenticated pages are listed for when a session exists.
const PUBLIC_PAGES = [
  { name: 'login', path: '/login' },
];

const AUTH_PAGES = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'documents', path: '/documents' },
  { name: 'new-document', path: '/documents/new' },
  { name: 'approvals', path: '/approvals' },
  { name: 'notifications', path: '/notifications' },
  { name: 'audit', path: '/audit' },
  { name: 'security', path: '/security' },
  { name: 'evidence', path: '/evidence' },
  { name: 'retention', path: '/retention' },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    ...(STATE ? { storageState: STATE } : {}),
  });
  const page = await context.newPage();

  const pages = STATE ? [...PUBLIC_PAGES, ...AUTH_PAGES] : PUBLIC_PAGES;
  for (const p of pages) {
    const url = `${BASE}${p.path}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1200);
      const file = join(OUT, `${p.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`captured ${p.name} -> ${file}`);
    } catch (err) {
      console.log(`skip ${p.name}: ${err.message}`);
    }
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

