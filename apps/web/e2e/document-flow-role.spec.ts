import { expect, test, type Page, type Route } from '@playwright/test';

type Role = 'admin' | 'editor' | 'approver' | 'viewer' | 'compliance_officer';
type DocumentStatus = 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'ARCHIVED';
type Classification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET';

interface FlowDocument {
  id: string;
  title: string;
  description: string;
  status: DocumentStatus;
  classification: Classification;
  ownerId: string;
  ownerDisplay: string;
  currentVersion: number;
  filename?: string;
  mimeType?: string;
  fileSize?: number;
  tags: string[];
  dlpStatus: 'NOT_SCANNED' | 'CLEAR' | 'DETECTED';
  retentionClass?: string | null;
  retentionUntil?: string | null;
  retentionReason?: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  versions?: Array<{
    id: string;
    docId: string;
    version: number;
    filename: string;
    contentType: string;
    size: number;
    createdAt: string;
    createdBy: string;
  }>;
  aclEntries?: Array<Record<string, unknown>>;
}

interface FlowSession {
  accessToken: string;
  user: {
    sub: string;
    username: string;
    preferred_username: string;
    displayName: string;
    firstName: string;
    lastName: string;
    email: string;
    roles: Role[];
    groups: string[];
  };
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function sessionFor(role: Role): FlowSession {
  const userByRole: Record<Role, { sub: string; displayName: string }> = {
    admin: { sub: 'admin1', displayName: 'Admin One' },
    editor: { sub: 'editor1', displayName: 'Editor One' },
    approver: { sub: 'approver1', displayName: 'Approver One' },
    viewer: { sub: 'viewer1', displayName: 'Viewer One' },
    compliance_officer: { sub: 'compliance1', displayName: 'Compliance One' },
  };
  const user = userByRole[role];

  return {
    accessToken: `demo_token_${role}`,
    user: {
      sub: user.sub,
      username: user.sub,
      preferred_username: user.sub,
      displayName: user.displayName,
      firstName: user.displayName.split(' ')[0],
      lastName: user.displayName.split(' ')[1] ?? 'User',
      email: `${user.sub}@example.test`,
      roles: [role],
      groups: [],
    },
  };
}

function baseDocuments(): FlowDocument[] {
  return [
    {
      id: 'doc-pending-review',
      title: 'Pending Review Packet',
      description: 'Submitted package waiting for approval.',
      status: 'PENDING',
      classification: 'CONFIDENTIAL',
      ownerId: 'editor1',
      ownerDisplay: 'Editor One',
      currentVersion: 1,
      filename: 'pending-review.pdf',
      mimeType: 'application/pdf',
      fileSize: 120_000,
      tags: ['approval', 'finance'],
      dlpStatus: 'CLEAR',
      retentionClass: 'CONFIDENTIAL_180D',
      retentionUntil: hoursFromNow(180 * 24),
      retentionReason: 'Approval archive.',
      createdAt: hoursAgo(72),
      updatedAt: hoursAgo(20),
      versions: [
        {
          id: 'version-pending-1',
          docId: 'doc-pending-review',
          version: 1,
          filename: 'pending-review.pdf',
          contentType: 'application/pdf',
          size: 120_000,
          createdAt: hoursAgo(22),
          createdBy: 'editor1',
        },
      ],
      aclEntries: [],
    },
    {
      id: 'doc-secret-draft',
      title: 'Secret Draft Plan',
      description: 'Draft material that a viewer must not see.',
      status: 'DRAFT',
      classification: 'SECRET',
      ownerId: 'editor1',
      ownerDisplay: 'Editor One',
      currentVersion: 1,
      filename: 'secret-draft.pdf',
      mimeType: 'application/pdf',
      fileSize: 96_000,
      tags: ['secret'],
      dlpStatus: 'CLEAR',
      createdAt: hoursAgo(48),
      updatedAt: hoursAgo(6),
      versions: [
        {
          id: 'version-secret-1',
          docId: 'doc-secret-draft',
          version: 1,
          filename: 'secret-draft.pdf',
          contentType: 'application/pdf',
          size: 96_000,
          createdAt: hoursAgo(7),
          createdBy: 'editor1',
        },
      ],
      aclEntries: [],
    },
    {
      id: 'doc-published-viewable',
      title: 'Published Handbook',
      description: 'Published internal document available to viewers.',
      status: 'PUBLISHED',
      classification: 'INTERNAL',
      ownerId: 'editor1',
      ownerDisplay: 'Editor One',
      currentVersion: 1,
      filename: 'published-handbook.pdf',
      mimeType: 'application/pdf',
      fileSize: 88_000,
      tags: ['handbook'],
      dlpStatus: 'CLEAR',
      retentionClass: 'INTERNAL_365D',
      retentionUntil: hoursFromNow(300 * 24),
      retentionReason: 'Operational reference.',
      publishedAt: hoursAgo(8),
      createdAt: hoursAgo(96),
      updatedAt: hoursAgo(8),
      versions: [
        {
          id: 'version-handbook-1',
          docId: 'doc-published-viewable',
          version: 1,
          filename: 'published-handbook.pdf',
          contentType: 'application/pdf',
          size: 88_000,
          createdAt: hoursAgo(9),
          createdBy: 'editor1',
        },
      ],
      aclEntries: [],
    },
  ];
}

async function mockDocumentFlowApi(
  page: Page,
  session: FlowSession,
  documents = baseDocuments(),
) {
  await page.addInitScript((storedSession) => {
    window.localStorage.setItem('docvault_session', JSON.stringify(storedSession));
    window.localStorage.removeItem('docvault.documents.savedViews');
  }, session);

  const store = documents.map((document) => ({ ...document }));

  await page.route('**/api/**', async (route) => {
    await fulfillFlowApi(route, session, store);
  });
}

async function fulfillFlowApi(
  route: Route,
  session: FlowSession,
  documents: FlowDocument[],
) {
  const request = route.request();
  const url = new URL(request.url());
  const pathname = url.pathname;
  const method = request.method();

  if (pathname === '/api/auth/me') {
    await route.fulfill({ status: 200, json: session });
    return;
  }

  if (pathname === '/api/metadata/documents' && method === 'GET') {
    await route.fulfill({
      status: 200,
      json: documents.filter((document) => canReadMetadata(session, document)),
    });
    return;
  }

  if (pathname === '/api/metadata/documents' && method === 'POST') {
    const body = JSON.parse(request.postData() || '{}') as Partial<FlowDocument>;
    const document: FlowDocument = {
      id: 'doc-uploaded',
      title: body.title ?? 'Untitled Document',
      description: body.description ?? '',
      status: 'DRAFT',
      classification: body.classification ?? 'INTERNAL',
      ownerId: session.user.sub,
      ownerDisplay: session.user.displayName,
      currentVersion: 0,
      tags: Array.isArray(body.tags) ? body.tags : [],
      dlpStatus: 'NOT_SCANNED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versions: [],
      aclEntries: [],
    };
    documents.unshift(document);
    await route.fulfill({ status: 200, json: document });
    return;
  }

  const metadataMatch = pathname.match(/^\/api\/metadata\/documents\/([^/]+)(?:\/([^/]+))?$/);
  if (metadataMatch) {
    const [, docId, action] = metadataMatch;
    const document = documents.find((item) => item.id === docId);
    if (!document) {
      await route.fulfill({ status: 404, json: { message: 'Document not found' } });
      return;
    }

    if (action === 'workflow-history') {
      await route.fulfill({ status: 200, json: workflowHistoryFor(document) });
      return;
    }

    if (action === 'comments') {
      await route.fulfill({ status: 200, json: [] });
      return;
    }

    if (action === 'ai-guardrails') {
      await route.fulfill({
        status: 200,
        json: {
          docId,
          classification: document.classification,
          status: document.status,
          canUseContent: document.status === 'PUBLISHED',
          allowedOperations: ['METADATA_CLASSIFICATION', 'METADATA_TAGGING'],
          deniedOperations:
            document.status === 'PUBLISHED'
              ? []
              : [
                  {
                    operation: 'CONTENT_SUMMARIZATION',
                    reason: 'Only published file content can be used.',
                  },
                ],
          guardrails: ['Metadata-only evidence is always allowed.'],
        },
      });
      return;
    }

    if (action === 'download-authorize' || action === 'preview-authorize') {
      await route.fulfill({
        status: 200,
        json: { grantToken: `grant-${docId}`, version: document.currentVersion },
      });
      return;
    }

    if (!action && method === 'GET') {
      if (!canReadMetadata(session, document)) {
        await route.fulfill({
          status: 403,
          json: { message: 'Metadata read denied by classification policy.' },
        });
        return;
      }

      await route.fulfill({ status: 200, json: document });
      return;
    }
  }

  const uploadMatch = pathname.match(/^\/api\/documents\/([^/]+)\/upload$/);
  if (uploadMatch && method === 'POST') {
    const docId = uploadMatch[1];
    const document = documents.find((item) => item.id === docId);
    if (!document) {
      await route.fulfill({ status: 404, json: { message: 'Document not found' } });
      return;
    }

    const multipartBody = request.postData() ?? '';
    const filename = multipartBody.match(/filename="([^"]+)"/)?.[1] ?? 'uploaded-file.txt';
    const version = {
      id: `version-${docId}-${document.currentVersion + 1}`,
      docId,
      version: document.currentVersion + 1,
      filename,
      contentType: 'text/plain',
      size: Math.max(1, multipartBody.length),
      createdAt: new Date().toISOString(),
      createdBy: session.user.sub,
    };
    document.currentVersion = version.version;
    document.filename = filename;
    document.mimeType = version.contentType;
    document.fileSize = version.size;
    document.updatedAt = version.createdAt;
    document.versions = [...(document.versions ?? []), version];

    await route.fulfill({ status: 200, json: version });
    return;
  }

  const workflowMatch = pathname.match(/^\/api\/workflow\/([^/]+)\/(submit|approve|reject|archive)$/);
  if (workflowMatch && method === 'POST') {
    const [, docId, action] = workflowMatch;
    const document = documents.find((item) => item.id === docId);
    if (!document) {
      await route.fulfill({ status: 404, json: { message: 'Document not found' } });
      return;
    }

    if (action === 'submit') {
      document.status = 'PENDING';
    }
    if (action === 'approve') {
      document.status = 'PUBLISHED';
      document.publishedAt = new Date().toISOString();
    }
    if (action === 'reject') {
      document.status = 'DRAFT';
    }
    if (action === 'archive') {
      document.status = 'ARCHIVED';
      document.archivedAt = new Date().toISOString();
    }
    document.updatedAt = new Date().toISOString();

    await route.fulfill({ status: 200, json: document });
    return;
  }

  if (pathname === '/api/users/batch') {
    await route.fulfill({
      status: 200,
      json: {
        admin1: { displayName: 'Admin One', username: 'admin1' },
        editor1: { displayName: 'Editor One', username: 'editor1' },
        approver1: { displayName: 'Approver One', username: 'approver1' },
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
    json: { message: `Unhandled Playwright mock: ${method} ${pathname}` },
  });
}

function canReadMetadata(session: FlowSession, document: FlowDocument): boolean {
  const roles = session.user.roles;
  if (roles.includes('admin')) return true;
  if (document.ownerId === session.user.sub) return true;
  if (roles.includes('approver')) {
    return ['PENDING', 'PUBLISHED', 'ARCHIVED'].includes(document.status);
  }
  if (roles.includes('compliance_officer')) {
    return ['PUBLISHED', 'ARCHIVED'].includes(document.status);
  }
  if (document.status !== 'PUBLISHED') return false;
  if (roles.includes('viewer')) {
    return ['PUBLIC', 'INTERNAL'].includes(document.classification);
  }
  if (roles.includes('editor')) {
    return ['PUBLIC', 'INTERNAL'].includes(document.classification);
  }

  return false;
}

function workflowHistoryFor(document: FlowDocument) {
  if (document.status === 'DRAFT') {
    return [];
  }

  return [
    {
      id: `history-${document.id}`,
      docId: document.id,
      action: document.status === 'PUBLISHED' ? 'APPROVE' : 'SUBMIT',
      actorId: document.status === 'PUBLISHED' ? 'approver1' : 'editor1',
      actorDisplay:
        document.status === 'PUBLISHED' ? 'Approver One' : 'Editor One',
      fromStatus: document.status === 'PUBLISHED' ? 'PENDING' : 'DRAFT',
      toStatus: document.status,
      reason: 'Playwright flow state transition.',
      createdAt: document.updatedAt,
    },
  ];
}

async function mockEvidenceApi(page: Page) {
  const session = sessionFor('admin');
  await page.addInitScript((storedSession) => {
    window.localStorage.setItem('docvault_session', JSON.stringify(storedSession));
  }, session);

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === '/api/auth/me') {
      await route.fulfill({ status: 200, json: session });
      return;
    }
    if (pathname === '/api/audit/security-summary') {
      await route.fulfill({ status: 200, json: securitySummary() });
      return;
    }
    if (pathname === '/api/metadata/retention/documents') {
      await route.fulfill({ status: 200, json: retentionEvidence() });
      return;
    }
    if (pathname === '/api/users/batch') {
      await route.fulfill({
        status: 200,
        json: {
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
  });
}

function securitySummary() {
  return {
    chain: { valid: true, checked: 42 },
    totals: {
      deniedEvents: 3,
      malwareBlocked: 0,
      dlpDetections: 1,
      downloadDenied: 2,
    },
    repeatedDenyActors: [],
    riskyDocuments: [],
    behaviorSignals: [],
    recommendations: [
      {
        id: 'actor-access-review:DENY_BURST:viewer1',
        type: 'ACTOR_ACCESS_REVIEW',
        severity: 'warning',
        title: 'Investigate denied access burst for viewer1',
        reason: 'Actor viewer1 triggered repeated denied events.',
        recommendedAction: 'Review group membership and ACL grants.',
        evidence: ['3 denied events'],
        affectedDocumentIds: [],
        affectedActorIds: ['viewer1'],
        auditFilters: { actorId: 'viewer1' },
        workflow: { status: 'OPEN' },
      },
    ],
  };
}

function retentionEvidence() {
  return {
    checkedAt: '2026-06-02T08:00:00.000Z',
    summary: {
      tracked: 1,
      active: 0,
      dueSoon: 1,
      overdue: 0,
      archived: 0,
    },
    records: [
      {
        docId: 'doc-published-viewable',
        title: 'Published Handbook',
        status: 'PUBLISHED',
        classification: 'INTERNAL',
        publishedAt: '2026-06-01T08:00:00.000Z',
        archivedAt: null,
        retentionClass: 'INTERNAL_365D',
        retentionUntil: '2027-06-01T08:00:00.000Z',
        retentionReason: 'Operational reference.',
        retentionStatus: 'DUE_SOON',
        daysRemaining: 5,
      },
    ],
  };
}

test('editor creates a document, uploads a file, and submits it for approval', async ({ page }) => {
  await mockDocumentFlowApi(page, sessionFor('editor'), []);

  await page.goto('/documents/new');
  await page.getByPlaceholder('Enter document title').fill('Playwright Upload Packet');
  await page
    .getByPlaceholder('Brief description of this document...')
    .fill('Created by Playwright for upload coverage.');
  await page.getByPlaceholder('Type and press Enter to add tags...').fill('e2e');
  await page.keyboard.press('Enter');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'e2e-policy.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('DocVault Playwright upload'),
  });
  await expect(page.getByText('e2e-policy.txt')).toBeVisible();

  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expect(page).toHaveURL(/\/documents\/doc-uploaded/);
  await expect(page.getByText('Playwright Upload Packet')).toBeVisible();
  await expect(page.getByText('e2e-policy.txt')).toBeVisible();
  await expect(page.getByText('v1').first()).toBeVisible();

  await page.getByRole('button', { name: 'Submit for Approval' }).click();
  await expect(page.getByRole('heading', { name: 'Submit Document' })).toBeVisible();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByText('Pending').first()).toBeVisible();
});

test('approver approves a pending document and removes it from the approval queue', async ({ page }) => {
  await mockDocumentFlowApi(page, sessionFor('approver'));

  await page.goto('/approvals');
  await expect(page.getByRole('heading', { name: 'Approvals' })).toBeVisible();
  await expect(page.getByText('Pending Review Packet')).toBeVisible();

  await page.getByRole('button', { name: /Review/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Review Document' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).last().click();
  await expect(page.getByRole('heading', { name: 'Approve Document' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve' }).last().click();

  await expect(page.getByText('No pending approvals')).toBeVisible();
  await page.goto('/documents/doc-pending-review');
  await expect(page.getByText('Published').first()).toBeVisible();
});

test('viewer only sees readable published documents and cannot open restricted files', async ({ page }) => {
  await mockDocumentFlowApi(page, sessionFor('viewer'));

  await page.goto('/documents');
  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
  await expect(page.getByText('Published Handbook')).toBeVisible();
  await expect(page.getByText('Secret Draft Plan')).toHaveCount(0);
  await expect(page.getByText('Pending Review Packet')).toHaveCount(0);

  await page.goto('/documents/doc-secret-draft');
  await expect(page.getByText('Failed to load document.')).toBeVisible();

  await page.goto('/documents/doc-published-viewable');
  await expect(page.getByText('Published Handbook')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Download', exact: true }),
  ).toBeVisible();
});

test('evidence packet presentation shows integrity badge, sections, and visual timeline', async ({
  page,
}) => {
  await mockEvidenceApi(page);

  await page.goto('/evidence');
  await expect(page.getByRole('heading', { name: 'Evidence Center' })).toBeVisible();
  await page.getByRole('button', { name: 'Select recommendations' }).click();
  await page.getByRole('button', { name: 'Select documents' }).click();
  await page.getByRole('button', { name: 'Presentation' }).click();

  await expect(page.getByText('Audit chain valid').first()).toBeVisible();
  await expect(page.getByText('Evidence packet sections')).toBeVisible();
  await expect(page.getByText('Visual timeline')).toBeVisible();
  await expect(page.getByText('Metadata packet selected')).toBeVisible();
  await expect(page.getByText('Workflow evidence linked')).toBeVisible();
  await expect(page.getByText('Retention posture checked')).toBeVisible();
});
