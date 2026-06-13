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
  aclEntries?: MockAclEntry[];
};

type MockAclEntry = {
  id: string;
  docId?: string;
  subjectType: 'USER' | 'ROLE' | 'GROUP' | 'ALL';
  subjectId?: string | null;
  subjectDisplay?: string;
  permission: 'READ' | 'DOWNLOAD' | 'WRITE' | 'APPROVE';
  effect: 'ALLOW' | 'DENY';
  createdAt: string;
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

const STEP_UP_HEADER = 'x-docvault-step-up-proof';
const STEP_UP_PROOF = 'playwright-step-up-proof';

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
      retentionUntil: hoursFromNow(14 * 24),
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
      aclEntries: [
        {
          id: 'acl-secret-all-download',
          docId: 'doc-secret-overdue',
          subjectType: 'ALL',
          subjectDisplay: 'Everyone',
          permission: 'DOWNLOAD',
          effect: 'ALLOW',
          createdAt: '2025-05-01T00:00:00.000Z',
        },
      ],
    },
    {
      id: 'doc-confidential-due-soon',
      title: 'Board Report',
      description: 'Quarterly finance package for review.',
      status: 'PENDING',
      classification: 'CONFIDENTIAL',
      dlpStatus: 'CLEAR',
      retentionClass: 'CONFIDENTIAL_180D',
      retentionUntil: hoursFromNow(20 * 24),
      retentionReason: 'Board reporting archive.',
      ownerId: 'editor1',
      ownerDisplay: 'Editor One',
      currentVersion: 2,
      filename: 'board-report.pdf',
      mimeType: 'application/pdf',
      fileSize: 256_000,
      tags: ['finance', 'board', 'finance/q1'],
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

function buildVersionsFor(docId: string) {
  return [
    {
      id: `${docId}-v1`,
      docId,
      version: 1,
      versionNumber: 1,
      objectKey: `doc/${docId}/v1/report-v1.pdf`,
      checksum: 'sha256:1111111111111111',
      size: 100_000,
      fileSize: 100_000,
      filename: 'report-v1.pdf',
      contentType: 'application/pdf',
      mimeType: 'application/pdf',
      dlpStatus: 'CLEAR',
      createdAt: hoursAgo(60),
      uploadedAt: hoursAgo(60),
      createdBy: 'editor1',
      uploadedById: 'editor1',
    },
    {
      id: `${docId}-v2`,
      docId,
      version: 2,
      versionNumber: 2,
      objectKey: `doc/${docId}/v2/report-v2.pdf`,
      checksum: 'sha256:2222222222222222',
      size: 220_000,
      fileSize: 220_000,
      filename: 'report-v2.pdf',
      contentType: 'application/pdf',
      mimeType: 'application/pdf',
      dlpStatus: 'CLEAR',
      createdAt: hoursAgo(10),
      uploadedAt: hoursAgo(10),
      createdBy: 'editor1',
      uploadedById: 'editor1',
    },
  ];
}

function buildSecuritySummary() {
  return {
    chain: {
      valid: true,
      checked: 42,
      epochId: 'epoch-active',
      historicalCompromisedCount: 0,
      compromisedEpochs: [],
    },
    totals: {
      deniedEvents: 7,
      malwareBlocked: 1,
      dlpDetections: 2,
      downloadDenied: 3,
    },
    repeatedDenyActors: [{ actorId: 'viewer1', denyCount: 4 }],
    riskyDocuments: [
      {
        documentId: 'doc-secret-overdue',
        classification: 'SECRET',
        accessCount: 5,
        actorCount: 3,
        latestAccessAt: hoursAgo(2),
        riskScore: 95,
        reasons: ['SECRET classification', '5 content access grants'],
      },
      {
        documentId: 'doc-confidential-due-soon',
        classification: 'CONFIDENTIAL',
        accessCount: 3,
        actorCount: 2,
        latestAccessAt: hoursAgo(4),
        riskScore: 64,
        reasons: ['CONFIDENTIAL classification', '2 distinct actors'],
      },
    ],
    behaviorSignals: [
      {
        signalId: 'MASS_CONTENT_ACCESS:editor1',
        type: 'MASS_CONTENT_ACCESS',
        severity: 'critical',
        actorId: 'editor1',
        actionCount: 5,
        documentCount: 5,
        windowStartedAt: hoursAgo(3),
        windowEndedAt: hoursAgo(2),
        riskScore: 100,
        reasons: ['5 successful content grants'],
      },
      {
        signalId: 'DENY_BURST:viewer1',
        type: 'DENY_BURST',
        severity: 'warning',
        actorId: 'viewer1',
        actionCount: 4,
        documentCount: 2,
        windowStartedAt: hoursAgo(8),
        windowEndedAt: hoursAgo(7),
        riskScore: 58,
        reasons: ['4 denied security events'],
      },
    ],
    recommendations: [
      {
        id: 'document-access-review:doc-secret-overdue',
        type: 'DOCUMENT_ACCESS_REVIEW',
        severity: 'critical',
        title: 'Tighten access for high-risk SECRET document',
        reason: 'Document reached critical risk score.',
        recommendedAction: 'Review ACLs and recent grants.',
        evidence: ['SECRET classification'],
        affectedDocumentIds: ['doc-secret-overdue'],
        affectedActorIds: [],
        auditFilters: { documentId: 'doc-secret-overdue' },
        workflow: {
          status: 'INVESTIGATING',
          updatedAt: hoursAgo(30),
        },
      },
      {
        id: 'actor-access-review:DENY_BURST:viewer1',
        type: 'ACTOR_ACCESS_REVIEW',
        severity: 'warning',
        title: 'Investigate denied access burst',
        reason: 'Actor crossed repeated deny threshold.',
        recommendedAction: 'Inspect role and group membership.',
        evidence: ['4 denied security events'],
        affectedDocumentIds: [],
        affectedActorIds: ['viewer1'],
        auditFilters: { actorId: 'viewer1' },
        workflow: {
          status: 'OPEN',
        },
      },
    ],
  };
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

  if (pathname === '/api/metadata/access-review/documents') {
    await route.fulfill({
      status: 200,
      json: documents.map((document) => ({
        ...document,
        versions: [],
        aclEntries: document.aclEntries ?? [],
      })),
    });
    return;
  }

  if (pathname === '/api/metadata/documents/trash') {
    await route.fulfill({
      status: 200,
      json: [
        {
          docId: 'doc-trashed',
          title: 'Deleted draft proposal',
          ownerId: 'admin1',
          classification: 'INTERNAL',
          deletedAt: hoursAgo(48),
          purgeAt: hoursFromNow(28 * 24),
          daysUntilPurge: 28,
          recoverable: true,
        },
      ],
    });
    return;
  }

  const restoreTrashMatch = pathname.match(
    /^\/api\/metadata\/documents\/([^/]+)\/restore$/,
  );
  if (restoreTrashMatch) {
    await route.fulfill({
      status: 200,
      json: { id: restoreTrashMatch[1], status: 'DRAFT' },
    });
    return;
  }

  const documentDetailMatch = pathname.match(/^\/api\/metadata\/documents\/([^/]+)$/);
  if (documentDetailMatch) {
    const document = documents.find((item) => item.id === documentDetailMatch[1]);
    if (!document) {
      await route.fulfill({ status: 404, json: { message: 'Document not found' } });
      return;
    }
    await route.fulfill({
      status: 200,
      json: {
        ...document,
        versions: buildVersionsFor(document.id),
        aclEntries: document.aclEntries ?? [],
        workflowHistory: [],
      },
    });
    return;
  }

  const restoreMatch = pathname.match(
    /^\/api\/metadata\/documents\/([^/]+)\/versions\/(\d+)\/restore$/,
  );
  if (restoreMatch) {
    await route.fulfill({
      status: 200,
      json: { id: 'version-restored', docId: restoreMatch[1], version: 3 },
    });
    return;
  }

  if (pathname === '/api/metadata/retention/documents') {
    await route.fulfill({
      status: 200,
      json: {
        checkedAt: new Date().toISOString(),
        summary: {
          tracked: 1,
          active: 0,
          dueSoon: 1,
          overdue: 0,
          archived: 0,
        },
        records: [
          {
            docId: 'doc-published-library',
            title: 'Published Library Index',
            status: 'PUBLISHED',
            classification: 'INTERNAL',
            publishedAt: hoursAgo(8),
            archivedAt: null,
            retentionClass: 'INTERNAL_365D',
            retentionUntil: hoursFromNow(300 * 24),
            retentionReason: 'Published operational reference.',
            retentionStatus: 'DUE_SOON',
            daysRemaining: 300,
          },
        ],
      },
    });
    return;
  }

  if (pathname === '/api/metadata/sensitive-actions/proof') {
    const body = request.postDataJSON() as {
      action?: string;
      challengePhrase?: string;
    };
    const expectedPhrase =
      body.action === 'run-retention'
        ? 'RUN RETENTION'
        : body.action === 'export-evidence-packet'
          ? 'EXPORT EVIDENCE'
          : null;

    if (!expectedPhrase || body.challengePhrase !== expectedPhrase) {
      await route.fulfill({
        status: 400,
        json: { message: 'Invalid sensitive action challenge phrase' },
      });
      return;
    }

    await route.fulfill({
      status: 200,
      json: {
        proof: STEP_UP_PROOF,
        expiresAt: hoursFromNow(1),
      },
    });
    return;
  }

  if (pathname === '/api/metadata/retention/run') {
    if (request.headers()[STEP_UP_HEADER] !== STEP_UP_PROOF) {
      await route.fulfill({
        status: 403,
        json: { message: 'Invalid or expired sensitive action proof' },
      });
      return;
    }

    await route.fulfill({
      status: 200,
      json: {
        archived: 1,
        checkedAt: new Date().toISOString(),
      },
    });
    return;
  }

  const evidencePacketMatch = pathname.match(
    /^\/api\/metadata\/documents\/([^/]+)\/evidence-packet$/,
  );
  if (evidencePacketMatch) {
    if (request.headers()[STEP_UP_HEADER] !== STEP_UP_PROOF) {
      await route.fulfill({
        status: 403,
        json: { message: 'Invalid or expired sensitive action proof' },
      });
      return;
    }

    const document = documents.find((item) => item.id === evidencePacketMatch[1]);
    await route.fulfill({
      status: document ? 200 : 404,
      json: document
        ? {
            generatedAt: new Date().toISOString(),
            metadataOnly: true,
            document,
            versions: [],
            aclEntries: document.aclEntries ?? [],
            workflowHistory: [],
            retention: { record: null },
            audit: { chain: { valid: true }, events: [] },
          }
        : { message: 'Document not found' },
    });
    return;
  }

  const shareLinksMatch = pathname.match(
    /^\/api\/metadata\/documents\/([^/]+)\/share-links$/,
  );
  if (shareLinksMatch) {
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as {
        permission?: string;
        expiresInHours?: number;
        maxAccessCount?: number;
      };
      await route.fulfill({
        status: 200,
        json: {
          id: 'link-e2e-1',
          docId: shareLinksMatch[1],
          permission: body.permission ?? 'VIEW',
          createdBy: 'admin1',
          createdAt: new Date().toISOString(),
          expiresAt: hoursFromNow(body.expiresInHours ?? 24),
          maxAccessCount: body.maxAccessCount ?? null,
          accessCount: 0,
          lastAccessedAt: null,
          revokedAt: null,
          revokedBy: null,
          status: 'ACTIVE',
          token: 'playwright-share-token',
        },
      });
      return;
    }
    await route.fulfill({ status: 200, json: [] });
    return;
  }

  // activity feed sources
  if (pathname.match(/^\/api\/metadata\/documents\/[^/]+\/comments$/)) {
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as { content?: string };
      await route.fulfill({
        status: 200,
        json: {
          id: 'comment-new',
          docId: pathname.split('/').at(-2),
          authorId: 'admin1',
          content: body.content ?? '',
          createdAt: new Date().toISOString(),
        },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      json: [
        {
          id: 'comment-1',
          docId: pathname.split('/').at(-2),
          authorId: 'editor1',
          content: 'Please double-check the figures.',
          createdAt: hoursAgo(12),
        },
      ],
    });
    return;
  }

  if (pathname === '/api/audit/query') {
    const action = url.searchParams.get('action');
    await route.fulfill({
      status: 200,
      json: {
        data: [
          action === 'DLP_PATTERN_DETECTED'
            ? {
                eventId: 'evt-dlp-1',
                action: 'DLP_PATTERN_DETECTED',
                actorId: 'editor1',
                actorRoles: ['editor'],
                result: 'SUCCESS',
                resourceType: 'DOCUMENT',
                resourceId: 'doc-secret-overdue',
                timestamp: hoursAgo(3),
                reason: 'PII pattern detected',
              }
            : {
                eventId: 'evt-share-1',
                action: 'DOCUMENT_SHARE_LINK_CREATED',
                actorId: 'admin1',
                actorRoles: ['admin'],
                result: 'SUCCESS',
                resourceType: 'DOCUMENT',
                resourceId: 'doc-published-library',
                timestamp: hoursAgo(4),
              },
        ],
        total: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      },
    });
    return;
  }

  if (pathname === '/api/audit/security-summary') {
    await route.fulfill({ status: 200, json: buildSecuritySummary() });
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
  await expect(page.getByText('Control queue clear')).toBeVisible();
  await expect(page.getByText('Classification mix')).toBeVisible();
  await expect(page.getByText('Saved view load')).toBeVisible();
  await expect(page.getByRole('button', { name: /Sensitive attention/ })).toBeVisible();
  await expect(page.getByText('Incident Export')).toBeVisible();

  await page.getByRole('button', { name: /Filter/ }).click();
  await expect(page.getByRole('button', { name: 'tag:security' })).toBeVisible();
  await page.getByRole('button', { name: 'tag:security' }).click();
  await expect(page).toHaveURL(/q=tag%3Asecurity/);
  await expect(page.getByText('Incident Export')).toBeVisible();
  await expect(page.getByText('Board Report')).not.toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByLabel('Search documents').fill('status:pending tag:security incident');
  await expect(page).toHaveURL(/q=status%3Apending\+tag%3Asecurity\+incident/);
  await expect(page.getByText('Incident Export')).toBeVisible();
  await expect(page.getByText('Board Report')).not.toBeVisible();

  await page.getByLabel('Search documents').fill('');
  await page.getByRole('button', { name: /^finance\s+1$/i }).click();
  await expect(page).toHaveURL(/folder=finance/);
  await expect(page.getByText('Board Report')).toBeVisible();
  await expect(page.getByText('Incident Export')).not.toBeVisible();

  await page.getByRole('button', { name: /Folder: Finance/ }).click();
  await page.getByRole('button', { name: /Sensitive attention/ }).click();
  await expect(page).toHaveURL(/view=sensitive/);
  await expect(page.getByText('Incident Export')).toBeVisible();
  await expect(page.getByText('Board Report')).toBeVisible();
  await expect(page.getByText('Draft Policy')).not.toBeVisible();
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

  await page.getByRole('button', { name: 'Save view' }).click();
  await page.getByLabel('Saved view name').fill('Security triage');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

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
}, testInfo) => {
  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Lifecycle pipeline')).toBeVisible();
  await expect(page.getByText('Attention by priority')).toBeVisible();
  await expect(page.getByText('DLP triage')).not.toBeVisible();
  await expect(page.getByText('Demo story coverage')).toBeVisible();
  await expect(page.getByText('Demo ready')).toBeVisible();
  await expect(page.getByText('Lifecycle coverage')).toBeVisible();
  await expect(page.getByText('Approval workflow')).toBeVisible();
  await expect(page.getByText('Evidence export')).toBeVisible();
  await expect(page.getByText('Security posture')).toBeVisible();

  await screenshot(page, testInfo.file, 'dashboard-command-center-playwright.png');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  const readinessPanel = page.getByTestId('business-demo-readiness');
  await expect(readinessPanel.getByText('Demo story coverage')).toBeVisible();
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

test('access review flags broad sensitive grants and retention run requires step-up', async ({
  page,
}) => {
  await page.goto('/access-review');

  await expect(
    page.getByRole('heading', { name: 'Access Review', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Access review required')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Incident Export' }).first()).toBeVisible();
  await expect(page.getByText('Everyone').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Review ACL/ }).first()).toBeVisible();

  await page.goto('/retention');
  await page.getByRole('button', { name: 'Run Retention' }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Step-up verification required',
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Type RUN RETENTION to continue')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Run retention' })).toBeDisabled();

  await dialog.getByLabel(/Type RUN RETENTION/).fill('RUN RETENTION');
  await expect(dialog.getByRole('button', { name: 'Run retention' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Run retention' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Retention run archived 1 record.')).toBeVisible();
});

test('documents filters stay usable on a mobile viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/documents');

  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  const roleBadge = page.locator('header').getByText('Admin', { exact: true });
  await expect(roleBadge).toBeVisible();
  await expect(page.getByText('Control queue clear')).toBeVisible();
  await expect(page.getByText('Classification mix')).toBeVisible();
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

test('audit page renders command center and keeps filters usable', async ({
  page,
}, testInfo) => {
  await page.goto('/audit');

  await expect(
    page.getByRole('heading', { name: 'Audit', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Security posture')).toBeVisible();
  await expect(page.getByText('Alert distribution')).toBeVisible();
  await expect(page.getByText('Audit event distribution')).toBeVisible();
  await expect(page.getByText('Document risk bands')).toBeVisible();
  await expect(page.getByText('Behavior anomaly bands')).toBeVisible();
  await expect(page.getByText('Recommendation SLA')).toBeVisible();
  await expect(page.getByText('Quick investigations')).toBeVisible();

  await screenshot(page, testInfo.file, 'audit-command-center-playwright.png');

  await page.getByRole('button', { name: 'DLP DETECTED' }).click();
  await expect(page.getByLabel('Action')).toHaveValue('DLP_PATTERN_DETECTED');
  await expect(page.getByText('DLP_PATTERN_DETECTED')).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/audit');
  await expect(page.getByText('Security posture')).toBeVisible();
  await expect(page.getByText('Alert distribution')).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);
});

test('security page scopes recommendation queue by workflow status', async ({
  page,
}, testInfo) => {
  await page.goto('/security');

  await expect(
    page.getByRole('heading', { name: 'Security', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Evidence-backed findings')).toBeVisible();
  await expect(page.getByText('Cases', { exact: true })).toBeVisible();
  await expect(page.getByText('Reviews', { exact: true })).toBeVisible();
  await expect(page.getByText('Signals', { exact: true })).toBeVisible();
  await expect(page.getByText('Case workflow required', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Lightweight review', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Active 2' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resolved 0' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'All 2' })).toBeVisible();

  await page.getByRole('button', { name: 'Resolved 0' }).click();
  await expect(page.getByText('No resolved recommendations are available.')).toBeVisible();
  await page.getByRole('button', { name: 'All 2' }).click();
  await expect(page.getByText('Tighten access for high-risk SECRET document')).toBeVisible();
  await expect(page.getByText('Investigate denied access burst')).toBeVisible();

  await expect
    .poll(async () =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);

  await screenshot(page, testInfo.file, 'security-recommendation-queue-playwright.png');
});

test('security case workflow requires evidence before resolving a case', async ({
  page,
}) => {
  await page.route(
    /\/api\/audit\/security-recommendations\/.+\/workflow$/,
    async (route) => {
      const payload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        json: {
          eventId: 'evt-case-workflow-resolved',
          action: 'SECURITY_RECOMMENDATION_STATUS_UPDATED',
          actorId: 'admin1',
          actorRoles: ['admin'],
          resourceType: 'SECURITY_RECOMMENDATION',
          resourceId: 'document-access-review:doc-secret-overdue',
          result: 'SUCCESS',
          reason: payload.note,
          metadata: payload,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  await page.goto('/security');

  await expect(page.getByText('Case workflow', { exact: true })).toBeVisible();

  const resolveButton = page.getByRole('button', { name: 'Resolve case' });
  await expect(resolveButton).toBeDisabled();
  await expect(page.getByText('Missing before resolve')).toBeVisible();
  await expect(
    page.getByText(
      'Investigation note · Remediation or accepted-risk decision · Remediation or accepted-risk evidence · Verification confirmation',
      { exact: true },
    ),
  ).toBeVisible();

  await page
    .getByLabel('Investigation')
    .fill('Confirmed SECRET document exposes DOWNLOAD to Everyone.');
  await page.getByLabel('Remediated').check();
  await page
    .getByLabel('Remediation or accepted-risk evidence')
    .fill('Removed Everyone DOWNLOAD grant and kept owner READ only.');
  await page.getByLabel(/Verification confirmed/).check();

  await expect(resolveButton).toBeEnabled();

  const requestPromise = page.waitForRequest(
    (request) =>
      request.method() === 'PATCH' &&
      request
        .url()
        .includes(
          '/api/audit/security-recommendations/document-access-review%3Adoc-secret-overdue/workflow',
        ),
  );
  await resolveButton.click();

  const request = await requestPromise;
  const payload = request.postDataJSON() as { status?: string; note?: string };
  expect(payload.status).toBe('RESOLVED');
  expect(payload.note).toContain('Case workflow');
  expect(payload.note).toContain(
    'Investigation: Confirmed SECRET document exposes DOWNLOAD to Everyone.',
  );
  expect(payload.note).toContain('Decision: Remediated');
  expect(payload.note).toContain(
    'Resolution evidence: Removed Everyone DOWNLOAD grant and kept owner READ only.',
  );
  expect(payload.note).toContain('Verification: Confirmed');
});

test('evidence center renders readiness visuals and packet builder', async ({
  page,
}, testInfo) => {
  await page.goto('/evidence');

  await expect(
    page.getByRole('heading', { name: 'Evidence Center' }),
  ).toBeVisible();
  await expect(page.getByText('Evidence readiness')).toBeVisible();
  await expect(page.getByText('Evidence source states')).toBeVisible();
  await expect(page.getByText('Export packet targets')).toBeVisible();
  await expect(page.getByText('Retention posture')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recommendation packet queue' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Active 2' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resolved 0' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'All 2' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Document evidence packets' })).toBeVisible();

  await screenshot(page, testInfo.file, 'evidence-command-center-playwright.png');

  await page.getByRole('button', { name: 'Resolved 0' }).click();
  await expect(page.getByText('No resolved recommendation packets are available.')).toBeVisible();
  await page.getByRole('button', { name: 'Active 2' }).click();
  await expect
    .poll(async () =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);

  await page.getByRole('button', { name: 'Presentation' }).click();
  await expect(page.getByText(/Evidence packet sections/i)).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);
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


test('creates a time-limited share link and reveals the token once', async ({
  page,
}) => {
  await page.goto('/documents/doc-published-library');

  await expect(
    page.getByRole('heading', { name: 'Share links' }),
  ).toBeVisible();

  await page
    .getByRole('button', { name: 'Create share link' })
    .click();

  await expect(
    page.getByText('Copy this link now. The token is not shown again.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Copy/ })).toBeVisible();
});


test('command palette opens with Ctrl+K and navigates to a page', async ({
  page,
}) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.locator('body').click();

  await page.keyboard.press('Control+KeyK');

  const dialog = page.getByRole('dialog', { name: 'Command palette' });
  await expect(dialog).toBeVisible();

  await dialog.getByPlaceholder('Search pages and actions...').fill('retention');
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/retention$/);
});

test('version history compares two versions and restores an older one', async ({
  page,
}) => {
  await page.goto('/documents/doc-published-library');

  await expect(page.getByRole('heading', { name: 'Version History' })).toBeVisible();
  await expect(page.getByText('report-v1.pdf')).toBeVisible();
  await expect(page.getByText('report-v2.pdf')).toBeVisible();

  await page.getByRole('checkbox', { name: 'Compare version 1' }).check();
  await page.getByRole('checkbox', { name: 'Compare version 2' }).check();

  await expect(page.getByText(/Comparing v1 to v2/)).toBeVisible();
  await expect(page.getByText('report-v1.pdf').first()).toBeVisible();

  await page.getByRole('button', { name: 'Restore version 1' }).click();
  const dialog = page.getByRole('dialog', { name: 'Restore version 1' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Restore version' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Version restored')).toBeVisible();
});


test('activity feed merges workflow, comments, and audit events', async ({
  page,
}) => {
  await page.goto('/documents/doc-published-library');

  const feed = page.getByRole('region', { name: 'Activity' });
  await expect(feed.getByRole('heading', { name: 'Activity' })).toBeVisible();

  await expect(feed.getByText('Please double-check the figures.')).toBeVisible();
  await expect(feed.getByText(/document share link created/i)).toBeVisible();
});


test('bulk delete can be undone before it reaches the server', async ({
  page,
}) => {
  const deleteRequests: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'DELETE' && req.url().includes('/api/workflow/')) {
      deleteRequests.push(req.url());
    }
  });

  await page.goto('/documents');
  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

  const firstRowCheckbox = page.getByRole('checkbox', { name: 'Select row' }).first();
  await firstRowCheckbox.check();

  await page.getByRole('button', { name: /^Delete \(/ }).click();

  const undo = page.getByRole('button', { name: 'Undo' });
  await expect(undo).toBeVisible();
  await undo.click();

  await expect(page.getByText('Delete cancelled')).toBeVisible();

  // Wait past the deferred window and confirm nothing was sent.
  await page.waitForTimeout(5500);
  expect(deleteRequests).toHaveLength(0);
});


test('trash lists deleted documents and restores one', async ({ page }) => {
  await page.goto('/trash');

  await expect(page.getByRole('heading', { name: 'Trash', exact: true })).toBeVisible();
  await expect(page.getByText('Deleted draft proposal')).toBeVisible();
  await expect(page.getByText('28 days left')).toBeVisible();

  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByText('Document restored')).toBeVisible();
});


test('folder tree filters documents by hierarchical tag', async ({ page }) => {
  await page.goto('/documents');
  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

  const folders = page.getByRole('complementary', { name: 'Folders' });
  await expect(folders).toBeVisible();

  // The slash tag finance/q1 yields a "finance" root node.
  await folders.getByRole('button', { name: /^finance/ }).first().click();

  // After selecting the folder, the active filter should be reflected in the URL.
  await expect(page).toHaveURL(/folder=finance/);
});
