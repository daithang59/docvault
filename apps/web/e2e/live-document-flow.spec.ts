import { expect, test, type Page } from '@playwright/test';

type LiveUser = 'editor1' | 'approver1' | 'viewer1';

type JwtPayload = {
  sub?: string;
  preferred_username?: string;
  username?: string;
  name?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  groups?: string[];
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  roles?: string[];
};

const LIVE_E2E_ENABLED = process.env.DOCVAULT_LIVE_E2E === '1';
const KEYCLOAK_TOKEN_URL =
  process.env.DOCVAULT_KEYCLOAK_TOKEN_URL ??
  'http://localhost:8080/realms/docvault/protocol/openid-connect/token';
const KEYCLOAK_CLIENT_ID =
  process.env.DOCVAULT_KEYCLOAK_CLIENT_ID ?? 'docvault-gateway';
const KEYCLOAK_CLIENT_SECRET =
  process.env.DOCVAULT_KEYCLOAK_CLIENT_SECRET ?? 'dev-gateway-secret';
const DEMO_PASSWORD = process.env.DOCVAULT_DEMO_PASSWORD ?? 'Passw0rd!';

test.skip(
  !LIVE_E2E_ENABLED,
  'Set DOCVAULT_LIVE_E2E=1 and run the local backend stack to execute live DocVault UI E2E.',
);

test('live backend document upload, approval, and viewer access flow', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);

  const runId = Date.now();
  const title = `Live Playwright Contract ${runId}`;
  const filename = `live-contract-${runId}.txt`;

  const editorSession = await buildSession('editor1');
  const approverSession = await buildSession('approver1');
  const viewerSession = await buildSession('viewer1');

  await installSession(page, editorSession);
  await page.goto('/documents/new');

  await page.getByPlaceholder('Enter document title').fill(title);
  await page
    .getByPlaceholder('Brief description of this document...')
    .fill('Live Playwright proof for upload, approval, and viewer access.');
  await page.getByRole('button', { name: 'Internal' }).click();
  await page
    .getByPlaceholder('Type and press Enter to add tags...')
    .fill('live-e2e');
  await page.keyboard.press('Enter');
  await page.locator('input[type="file"]').setInputFiles({
    name: filename,
    mimeType: 'text/plain',
    buffer: Buffer.from(`DocVault live E2E ${runId}`),
  });

  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expectCreatedDocumentDetailUrl(page);
  const docId = getCurrentDocumentId(page);
  if (!docId) throw new Error('Created document id was not present in URL.');

  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByText(filename)).toBeVisible();
  await page.getByRole('button', { name: 'Submit for Approval' }).click();
  await page.getByRole('button', { name: /^Submit$/ }).click();
  await expectDocumentStatus(page, 'Pending');

  await installSession(page, approverSession);
  await page.goto(`/documents/${docId}`);
  await page.getByRole('button', { name: 'Approve Document' }).click();
  await page.getByRole('button', { name: /^Approve$/ }).click();
  await expectDocumentStatus(page, 'Published');

  await installSession(page, viewerSession);
  await page.goto('/documents');
  await page.getByLabel('Search documents').fill(`file:${filename}`);
  await expect(page.getByText(title)).toBeVisible();
  await page.getByRole('link', { name: title }).click();
  await expect(page).toHaveURL(new RegExp(`/documents/${docId}$`));
  await expect(page.getByRole('button', { name: /^Download$/ })).toBeVisible();

  const restricted = await request.post('/api/metadata/documents', {
    headers: {
      Authorization: `Bearer ${editorSession.accessToken}`,
    },
    data: {
      title: `Restricted Playwright ${runId}`,
      description: 'Confidential metadata should not be visible to viewer.',
      classification: 'CONFIDENTIAL',
      tags: ['restricted-live-e2e'],
    },
  });
  expect(restricted.status()).toBe(201);
  const restrictedDocument = (await restricted.json()) as { id: string };

  await installSession(page, viewerSession);
  await page.goto(`/documents/${restrictedDocument.id}`);
  await expect(page.getByText('Failed to load document.')).toBeVisible();
});

async function buildSession(username: LiveUser) {
  const accessToken = await getAccessToken(username);
  const payload = parseJwt(accessToken);
  if (!payload) throw new Error(`Could not parse JWT for ${username}.`);

  const normalizedRoles = normalizeRoles([
    ...(payload.realm_access?.roles ?? []),
    ...(Array.isArray(payload.roles) ? payload.roles : []),
    ...Object.values(payload.resource_access ?? {}).flatMap(
      (entry) => entry.roles ?? [],
    ),
  ]);
  const preferredUsername =
    payload.preferred_username ??
    payload.username ??
    payload.name ??
    payload.email ??
    payload.sub ??
    username;

  return {
    accessToken,
    user: {
      sub: payload.sub ?? username,
      username: preferredUsername,
      preferred_username: preferredUsername,
      name: payload.name,
      email: payload.email,
      firstName: payload.given_name,
      lastName: payload.family_name,
      displayName:
        payload.name ??
        [payload.given_name, payload.family_name].filter(Boolean).join(' ') ??
        undefined,
      roles: normalizedRoles,
      groups: normalizeGroups(payload.groups),
    },
  };
}

async function getAccessToken(username: LiveUser): Promise<string> {
  const body = new URLSearchParams({
    client_id: KEYCLOAK_CLIENT_ID,
    client_secret: KEYCLOAK_CLIENT_SECRET,
    grant_type: 'password',
    username,
    password: DEMO_PASSWORD,
  });

  const response = await fetch(KEYCLOAK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(
      `Token request failed for ${username}: ${response.status} ${await response.text()}`,
    );
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error(`Token response for ${username} did not include access_token.`);
  }
  return data.access_token;
}

async function installSession(
  page: Page,
  session: Awaited<ReturnType<typeof buildSession>>,
) {
  await page.goto('/login');
  await page.evaluate((nextSession) => {
    window.localStorage.setItem('docvault_session', JSON.stringify(nextSession));
  }, session);
}

async function expectCreatedDocumentDetailUrl(page: Page) {
  await expect
    .poll(() => new URL(page.url()).pathname, {
      message: 'created document detail URL',
    })
    .toMatch(/^\/documents\/(?!new$)[^/]+$/);
}

function getCurrentDocumentId(page: Page) {
  const pathname = new URL(page.url()).pathname;
  const docId = pathname.split('/').at(-1);
  return docId === 'new' ? undefined : docId;
}

async function expectDocumentStatus(page: Page, label: 'Pending' | 'Published') {
  await expect(
    page.locator(`[aria-label="Document status: ${label}"]`),
  ).toBeVisible();
}

function parseJwt(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function normalizeRoles(roles: string[]) {
  const known = ['viewer', 'editor', 'approver', 'compliance_officer', 'admin'];
  return Array.from(
    new Set(
      roles
        .flatMap((role) =>
          role === 'co' ? ['compliance_officer'] : [role],
        )
        .filter((role) => known.includes(role)),
    ),
  );
}

function normalizeGroups(groups: string[] | undefined) {
  return Array.from(
    new Set(
      (groups ?? [])
        .map((group) => group.trim())
        .filter(Boolean)
        .map((group) => group.replace(/^\/+/, '')),
    ),
  );
}
