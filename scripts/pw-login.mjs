// Logs into DocVault via Keycloak and saves a Playwright storageState file.
// Usage: node scripts/pw-login.mjs [username] [password]
// Output: scripts/.pw-state.json  (consumed by capture-screenshots.mjs via PW_STATE)

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const require = createRequire(join(repoRoot, 'package.json'));
const pwPath = join(repoRoot, 'node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.js');
const { chromium } = require(pwPath);

const BASE = process.env.WEB_BASE_URL ?? 'http://localhost:3010';
const USER = process.argv[2] ?? 'admin1';
const PASS = process.argv[3] ?? 'Passw0rd!';
const STATE = join(__dirname, '.pw-state.json');

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });

  // Click the SSO button (text may vary slightly).
  const ssoButton = page.getByRole('button', { name: /sign in/i }).first();
  await ssoButton.click({ timeout: 10000 }).catch(async () => {
    await page.getByText(/sign in with sso/i).first().click({ timeout: 10000 });
  });

  // Keycloak login form.
  await page.waitForSelector('#username', { timeout: 30000 });
  await page.fill('#username', USER);
  await page.fill('#password', PASS);
  await page.click('#kc-login');

  // Wait for redirect back to the app (dashboard).
  await page.waitForURL(`${BASE}/**`, { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);

  await context.storageState({ path: STATE });
  console.log(`logged in as ${USER}; state saved -> ${STATE}`);
  console.log(`current url: ${page.url()}`);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
