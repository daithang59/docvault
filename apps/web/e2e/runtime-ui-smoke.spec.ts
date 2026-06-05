import { expect, test, type Page, type Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

type MockDocument = {
  id: string;
  title: string;
  description: string;
  status: 'DRAFT' | 'PENDING' | 'PUBLISHED';
  classification: 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET';
  dlpStatus: 'CLEAR' | 'DETECTED';
  dlpFindings?: Array<Record<string, unknown>> | null;
  dlpDetectedAt?: string | null;
  retentionClass?: string | null;
  retentionUntil?: string | null;
  retentionReason?: string | null;
  ownerId: string;
  ownerDisplay: string;
  currentVersion: number;
  filename: string;
  mimeType?: string;
  fileSize?: number;
  tags: string[];
  publishedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

const SESSION = {
  accessToken: 'demo_token_admin',
  user: {
    sub: 'admin1',
    username: 'admin1',
    preferred_username: 'admin1',
    displayName: 'Admin One',
    firstName: 'Admin',
    lastName: 'One',
    email: 'admin1@example.test',
    roles: ['admin'],
    groups: [],
  },
};

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function buildDocuments(): MockDocument[] {
  return [
    {
      id: 'doc-secret-overdue',
      title: 'Incident Export',
      description: 'Investigation export with detected sensitive fields.',
      status: 'PENDING',
      classification: 'SECRET',
      dlpStatus: 'DETECTED',
      dlpFindings: [{ type: 'PII', count: 3 }],
      dlpDetectedAt: hoursAgo(20),
      retentionClass: 'SECRET_90D',
      retentionUntil: hoursFromNow(90 * 24),
      retentionReason: 'Security investigation package.',
      ownerId: 'editor1',
      ownerDisplay: 'Editor One',
      currentVersion: 3,
      filename: 'incident-export.csv',
      mimeType: 'text/csv',
      fileSize: 42_000,
      tags: ['security', 'dlp', 'incident'],
      createdAt: hoursAgo(72),
      updatedAt: hoursAgo(20),
    },
    {
      id: 'doc-confidential-due-soon',
      title: 'Board Report',
      description: 'Quarterly finance package for review.',
      status: 'PENDING',
      classification: 'CONFIDENTIAL',
      dlpStatus: 'CLEAR',
      retentionClass: 'CONFIDENTIAL_180D',
      retentionUntil: hoursFromNow(180 * 24),
      retentionReason: 'Board reporting archive.',
      ownerId: 'editor1',
      ownerDisplay: 'Editor One',
      currentVersion: 2,
      filename: 'board-report.pdf',
      mimeType: 'application/pdf',
      fileSize: 256_000,
      tags: ['finance', 'board'],
      createdAt: hoursAgo(48),
      updatedAt: hoursAgo(18),
    },
    {
      id: 'doc-draft-policy',
      title: 'Draft Policy',
      description: 'Internal policy draft before submission.',
      status: 'DRAFT',
      classification: 'INTERNAL',
      dlpStatus: 'CLEAR',
      retentionClass: 'INTERNAL_365D',
      retentionUntil: hoursFromNow(365 * 24),
      retentionReason: 'Policy lifecycle record.',
      ownerId: 'admin1',
      ownerDisplay: 'Admin One',
      currentVersion: 1,
      filename: 'draft-policy.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: 96_000,
      tags: ['policy'],
      createdAt: hoursAgo(36),
      updatedAt: hoursAgo(4),
    },
    {
      id: 'doc-published-library',
      title: 'Published Library Index',
      description: 'Approved index for public reference.',
      status: 'PUBLISHED',
      classification: 'INTERNAL',
      dlpStatus: 'CLEAR',
      retentionClass: 'INTERNAL_365D',
      retentionUntil: hoursFromNow(300 * 24),
      retentionReason: 'Published operational reference.',
      ownerId: 'viewer1',
      ownerDisplay: 'Viewer One',
      currentVersion: 4,
      filename: 'library-index.pdf',
      mimeType: 'application/pdf',
      fileSize: 120_000,
      tags: ['library'],
      publishedAt: hoursAgo(8),
      createdAt: hoursAgo(90),
      updatedAt: hoursAgo(8),
    },
  ];
}

async function mockRuntimeApi(page: Page) {
  await page.addInitScript((session) => {
    window.localStorage.setItem('docvault_session', JSON.stringify(session));
    window.localStorage.removeItem('docvault.documents.savedViews');
  }, SESSION);

  await page.route('**/api/**', async (route) => {
    await fulfillApi(route);
  });
}

async function fulfillApi(route: Route) {
  const request = route.request();
  const url = new URL(request.url());
  const pathname = url.pathname;
  const documents = buildDocuments();

  if (pathname === '/api/auth/me') {
    await route.fulfill({ status: 200, json: SESSION });
    return;
  }

  if (pathname === '/api/metadata/documents') {
    await route.fulfill({ status: 200, json: documents });
    return;
  }

  if (pathname.endsWith('/workflow-history')) {
    const docId = pathname.split('/').at(-2) ?? 'unknown';
    await route.fulfill({
      status: 200,
      json: [
        {
          id: `history-${docId}`,
          docId,
          action: 'SUBMIT',
          actorId: 'editor1',
          actorDisplay: 'Editor One',
          fromStatus: 'DRAFT',
          toStatus: 'PENDING',
          reason: 'Submitted for approval.',
          createdAt: hoursAgo(18),
        },
      ],
    });
    return;
  }

  if (pathname === '/api/users/batch') {
    await route.fulfill({
      status: 200,
      json: {
        admin1: { displayName: 'Admin One', username: 'admin1' },
        editor1: { displayName: 'Editor One', username: 'editor1' },
        viewer1: { displayName: 'Viewer One', username: 'viewer1' },
      },
    });
    return;
  }

  if (pathname === '/api/notify/unread-count') {
    await route.fulfill({ status: 200, json: { count: 0 } });
    return;
  }

  if (pathname === '/api/notify') {
    await route.fulfill({
      status: 200,
      json: { records: [], total: 0, page: 1, pages: 0 },
    });
    return;
  }

  await route.fulfill({
    status: 404,
    json: { message: `Unhandled Playwright mock: ${pathname}` },
  });
}

async function screenshot(page: Page, testFile: string, filename: string) {
  const outputDir = path.resolve(
    path.dirname(testFile),
    '..',
    '..',
    '..',
    'docs',
    'evidence',
    'screenshots',
  );
  mkdirSync(outputDir, { recursive: true });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
        scroll-behavior: auto !important;
      }
    `,
  });
  await page.evaluate(async () => {
    await Promise.allSettled(
      document.getAnimations().map((animation) => animation.finished),
    );
  });
  await page.screenshot({
    path: path.join(outputDir, filename),
    fullPage: true,
  });
}

test.beforeEach(async ({ page }) => {
  await mockRuntimeApi(page);
});

test('demo kit renders the evidence capture workflow', async ({ page }, testInfo) => {
  await page.goto('/demo-kit');

  await expect(page).toHaveTitle(/DocVault/);
  await expect(page.getByRole('heading', { name: 'Demo Kit' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Screenshot Targets' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download markdown' })).toBeVisible();
  await expect(page.getByText('Web runtime evidence')).toBeVisible();
  await expect(page.getByText('DevSecOps pipeline evidence')).toBeVisible();

  await screenshot(page, testInfo.file, 'demo-kit-playwright.png');
});

test('documents page supports built-in and custom saved views', async ({ page }, testInfo) => {
  await page.goto('/documents');

  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
  await expect(page.getByText('Saved views')).toBeVisible();
  await expect(page.getByText('Query chips')).toBeVisible();
  await expect(page.getByRole('button', { name: 'tag:security' })).toBeVisible();
  await expect(page.getByText('Smart folders')).toBeVisible();
  await expect(page.getByRole('button', { name: /Folder: security/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sensitive attention/ })).toBeVisible();
  await expect(page.getByText('Incident Export')).toBeVisible();

  await page.getByRole('button', { name: 'tag:security' }).click();
  await expect(page).toHaveURL(/q=tag%3Asecurity/);
  await expect(page.getByText('Incident Export')).toBeVisible();
  await expect(page.getByText('Board Report')).not.toBeVisible();

  await page.getByLabel('Search documents').fill('status:pending tag:security incident');
  await expect(page).toHaveURL(/q=status%3Apending\+tag%3Asecurity\+incident/);
  await expect(page.getByText('Incident Export')).toBeVisible();
  await expect(page.getByText('Board Report')).not.toBeVisible();

  await page.getByLabel('Search documents').fill('');
  await page.getByRole('button', { name: /Folder: security/ }).click();
  await expect(page).toHaveURL(/folder=security/);
  await expect(page.getByText('Incident Export')).toBeVisible();
  await expect(page.getByText('Board Report')).not.toBeVisible();

  await page.getByRole('button', { name: /Folder: security/ }).click();
  await page.getByRole('button', { name: /Sensitive attention/ }).click();
  await expect(page).toHaveURL(/view=sensitive/);
  await expect(page.getByText('View: Sensitive')).toBeVisible();
  await expect(page.getByLabel('Sort documents')).toBeVisible();

  const sortBox = await page.getByLabel('Sort documents').boundingBox();
  expect(sortBox).not.toBeNull();
  if (!sortBox) throw new Error('Sort documents control was not measurable.');

  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(sortBox.x + sortBox.width).toBeLessThanOrEqual(viewportWidth);
  await expect
    .poll(async () =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);

  await page.getByLabel('Saved view name').fill('Security triage');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('button', { name: 'Security triage 2' })).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => window.localStorage.getItem('docvault.documents.savedViews')),
    )
    .toContain('Security triage');

  await screenshot(page, testInfo.file, 'documents-saved-views-playwright.png');
});

test('dashboard shows business demo readiness without horizontal overflow', async ({
  page,
}) => {
  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Business Demo Readiness')).toBeVisible();
  await expect(page.getByText('Demo ready')).toBeVisible();
  await expect(page.getByText('Lifecycle coverage')).toBeVisible();
  await expect(page.getByText('Approval workflow')).toBeVisible();
  await expect(page.getByText('Evidence export')).toBeVisible();
  await expect(page.getByText('Security posture')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  const readinessPanel = page.getByTestId('business-demo-readiness');
  await expect(readinessPanel.getByText('Business Demo Readiness')).toBeVisible();
  const readinessBox = await readinessPanel.boundingBox();
  expect(readinessBox).not.toBeNull();
  if (!readinessBox) throw new Error('Business Demo Readiness panel was not measurable.');

  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(readinessBox.x).toBeGreaterThanOrEqual(0);
  expect(readinessBox.x + readinessBox.width).toBeLessThanOrEqual(viewportWidth + 1);
  await expect
    .poll(async () =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);
  await expect
    .poll(async () =>
      readinessPanel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    )
    .toBe(true);
});

test('documents filters stay usable on a mobile viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/documents');

  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  const roleBadge = page.locator('header').getByText('Admin', { exact: true });
  await expect(roleBadge).toBeVisible();
  await expect(page.getByText('Saved views')).toBeVisible();
  await expect(page.getByLabel('Sort documents')).toBeVisible();

  const navButtonBox = await page
    .getByRole('button', { name: 'Open navigation' })
    .boundingBox();
  const roleBadgeBox = await roleBadge.boundingBox();
  expect(navButtonBox).not.toBeNull();
  expect(roleBadgeBox).not.toBeNull();
  if (!navButtonBox || !roleBadgeBox) {
    throw new Error('Mobile navigation spacing could not be measured.');
  }
  expect(navButtonBox.x + navButtonBox.width).toBeLessThanOrEqual(roleBadgeBox.x);

  await expect
    .poll(async () =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);

  await screenshot(page, testInfo.file, 'documents-mobile-filters-playwright.png');
});

test('settings page summarizes product readiness and role capabilities', async ({ page }) => {
  await page.goto('/settings');

  await expect(page.getByRole('heading', { name: 'System Information' })).toBeVisible();
  await expect(page.getByText('Product Readiness')).toBeVisible();
  await expect(page.getByText('Commercial demo readiness')).toBeVisible();
  await expect(page.getByText('100%')).toBeVisible();
  await expect(page.getByText('Evidence export', { exact: true })).toBeVisible();
  await expect(page.getByText('Available', { exact: true })).toBeVisible();
  await expect(page.getByText('Enabled capabilities')).toBeVisible();
  await expect(page.getByText('4 active')).toBeVisible();
  await expect(page.getByText('Manage ACLs and application readiness')).toBeVisible();
});

test('approvals page renders SLA queue and review drawer context', async ({ page }, testInfo) => {
  await page.goto('/approvals');

  await expect(page.getByRole('heading', { name: 'Approvals' })).toBeVisible();
  await expect(page.getByText('SLA queue')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Overdue' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Due soon' })).toBeVisible();
  await expect(page.getByText('Assignment')).toBeVisible();
  await expect(page.getByText('Compliance review')).toBeVisible();
  await expect(page.getByText(/h overdue/)).toBeVisible();

  await page.getByRole('button', { name: /Review/ }).first().click();

  const drawer = page.getByRole('dialog', { name: 'Review Document' });
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute('aria-modal', 'true');
  await expect(page.getByRole('button', { name: 'Close review drawer' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review Document' })).toBeVisible();
  await expect(page.getByText('Approval readiness')).toBeVisible();
  await expect(page.getByText('DLP findings need review before approval.').last()).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();

  await page.getByRole('button', { name: /Review/ }).first().click();
  await expect(page.getByRole('dialog', { name: 'Review Document' })).toBeVisible();
  await page.getByRole('button', { name: 'Reject' }).click();
  const rejectDialog = page.getByRole('dialog', { name: 'Reject Document' });
  await expect(rejectDialog).toBeVisible();
  await expect(rejectDialog).toHaveAttribute('aria-modal', 'true');
  await expect(page.getByPlaceholder('Rejection reason (optional)...')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Classification needs review.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retention evidence is incomplete.' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(rejectDialog).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Review Document' })).toBeVisible();

  await screenshot(page, testInfo.file, 'approvals-sla-readiness-playwright.png');
});
