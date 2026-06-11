import { MetadataProxyController } from './metadata.proxy.controller';
import { ProxyService } from './proxy.service';
import { SensitiveActionProofService } from './sensitive-action-proof.service';

const STEP_UP_HEADER = 'x-docvault-step-up-proof';

function makeReq(options?: {
  user?: Record<string, unknown>;
  headers?: Record<string, string>;
  url?: string;
}) {
  return {
    user: options?.user ?? {
      sub: 'admin-1',
      username: 'admin1',
      roles: ['admin'],
    },
    headers: options?.headers ?? {},
    url: options?.url ?? '/metadata/retention/run',
  };
}

function makeAuditClient() {
  return {
    emitEvent: jest.fn().mockResolvedValue(undefined),
  };
}

function makeController(
  proxyService: ProxyService,
  auditClient = makeAuditClient(),
): MetadataProxyController {
  return new (MetadataProxyController as any)(
    proxyService,
    new SensitiveActionProofService(),
    auditClient,
  );
}

describe('MetadataProxyController sensitive action proof', () => {
  const metadataUrl = 'http://metadata-service:3002';

  beforeEach(() => {
    process.env.METADATA_SERVICE_URL = metadataUrl;
    process.env.AUDIT_SERVICE_URL = 'http://audit-service:3001';
    process.env.SENSITIVE_ACTION_PROOF_SECRET = 'test-step-up-secret';
  });

  afterEach(() => {
    delete process.env.SENSITIVE_ACTION_PROOF_SECRET;
    delete process.env.SENSITIVE_ACTION_REQUIRE_RECENT_AUTH;
    delete process.env.SENSITIVE_ACTION_REAUTH_MAX_AGE_SECONDS;
  });

  it('rejects retention runs before proxying when the step-up proof is missing', async () => {
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: { archived: 1 } }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);

    await expect(
      (controller as any).runRetention(
        makeReq({ url: '/metadata/retention/run?asOf=2026-06-01' }),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ statusCode: 403 }),
    });
    expect(proxyService.forward).not.toHaveBeenCalled();
  });

  it('rejects evidence packet exports before proxying when the step-up proof is missing', async () => {
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: { records: [] } }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);

    await expect(
      (controller as any).getEvidencePacket(
        'doc-1',
        makeReq({
          user: {
            sub: 'co-1',
            username: 'co1',
            roles: ['compliance_officer'],
          },
          url: '/metadata/documents/doc-1/evidence-packet',
        }),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ statusCode: 403 }),
    });
    expect(proxyService.forward).not.toHaveBeenCalled();
  });

  it('issues a short-lived proof for a matching normalized challenge phrase', async () => {
    const proxyService = {
      forward: jest.fn(),
    } as unknown as ProxyService;
    const auditClient = makeAuditClient();
    const controller = makeController(proxyService, auditClient);

    const issued = await (controller as any).issueSensitiveActionProof(
      makeReq(),
      {
        action: 'run-retention',
        challengePhrase: ' run   retention ',
      },
    );

    expect(issued).toMatchObject({
      proof: expect.any(String),
      expiresAt: expect.any(String),
    });
    expect(issued.proof.split('.')).toHaveLength(2);
    expect(new Date(issued.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(issued.expiresAt).getTime()).toBeLessThanOrEqual(
      Date.now() + 5 * 60 * 1000,
    );
    expect(auditClient.emitEvent).toHaveBeenCalledWith(expect.anything(), {
      action: 'SENSITIVE_ACTION_PROOF_ISSUED',
      resourceType: 'SENSITIVE_ACTION',
      resourceId: 'run-retention',
      result: 'SUCCESS',
      metadata: expect.objectContaining({
        sensitiveAction: 'run-retention',
        reauthChecked: false,
      }),
    });
  });

  it('rejects proof requests when the phrase does not match the action', async () => {
    const proxyService = {
      forward: jest.fn(),
    } as unknown as ProxyService;
    const auditClient = makeAuditClient();
    const controller = makeController(proxyService, auditClient);

    await expect(
      (controller as any).issueSensitiveActionProof(makeReq(), {
        action: 'run-retention',
        challengePhrase: 'EXPORT EVIDENCE',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ statusCode: 400 }),
    });
    expect(auditClient.emitEvent).toHaveBeenCalledWith(expect.anything(), {
      action: 'SENSITIVE_ACTION_PROOF_DENIED',
      resourceType: 'SENSITIVE_ACTION',
      resourceId: 'run-retention',
      result: 'DENY',
      reason: 'Invalid sensitive action challenge phrase',
      metadata: {
        sensitiveAction: 'run-retention',
      },
    });
  });

  it('does not block proof issuance when audit logging is unavailable', async () => {
    const proxyService = {
      forward: jest.fn(),
    } as unknown as ProxyService;
    const auditClient = {
      emitEvent: jest.fn().mockRejectedValue(new Error('audit unavailable')),
    };
    const controller = makeController(proxyService, auditClient);

    const issued = await (controller as any).issueSensitiveActionProof(
      makeReq(),
      {
        action: 'run-retention',
        challengePhrase: 'RUN RETENTION',
      },
    );

    expect(issued.proof).toEqual(expect.any(String));
    expect(auditClient.emitEvent).toHaveBeenCalled();
  });

  it('allows a retention run with a proof issued for the same actor and action', async () => {
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: { archived: 1 } }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);
    const req = makeReq({ url: '/metadata/retention/run' });
    const issued = await (controller as any).issueSensitiveActionProof(req, {
      action: 'run-retention',
      challengePhrase: 'RUN RETENTION',
    });

    const result = await (controller as any).runRetention({
      ...req,
      headers: { [STEP_UP_HEADER]: issued.proof },
    });

    expect(result).toEqual({ archived: 1 });
    expect(proxyService.forward).toHaveBeenCalledWith(expect.anything(), {
      method: 'POST',
      url: `${metadataUrl}/retention/run`,
    });
  });

  it('rejects a proof issued for a different sensitive action', async () => {
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: { archived: 1 } }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);
    const req = makeReq({ url: '/metadata/retention/run' });
    const issued = await (controller as any).issueSensitiveActionProof(req, {
      action: 'export-evidence-packet',
      challengePhrase: 'EXPORT EVIDENCE',
    });

    await expect(
      (controller as any).runRetention({
        ...req,
        headers: { [STEP_UP_HEADER]: issued.proof },
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ statusCode: 403 }),
    });
    expect(proxyService.forward).not.toHaveBeenCalled();
  });

  it('audits a sensitive proof use when a retention run is authorized', async () => {
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: { archived: 1 } }),
    } as unknown as ProxyService;
    const auditClient = makeAuditClient();
    const controller = makeController(proxyService, auditClient);
    const req = makeReq({ url: '/metadata/retention/run' });
    const issued = await (controller as any).issueSensitiveActionProof(req, {
      action: 'run-retention',
      challengePhrase: 'RUN RETENTION',
    });
    auditClient.emitEvent.mockClear();

    await (controller as any).runRetention({
      ...req,
      headers: { [STEP_UP_HEADER]: issued.proof },
    });

    expect(auditClient.emitEvent).toHaveBeenCalledWith(expect.anything(), {
      action: 'SENSITIVE_ACTION_PROOF_USED',
      resourceType: 'SENSITIVE_ACTION',
      resourceId: 'run-retention',
      result: 'SUCCESS',
      metadata: { sensitiveAction: 'run-retention' },
    });
  });

  it('audits a denied sensitive proof use when the retention proof is invalid', async () => {
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: { archived: 1 } }),
    } as unknown as ProxyService;
    const auditClient = makeAuditClient();
    const controller = makeController(proxyService, auditClient);
    const req = makeReq({ url: '/metadata/retention/run' });
    const issued = await (controller as any).issueSensitiveActionProof(req, {
      action: 'export-evidence-packet',
      challengePhrase: 'EXPORT EVIDENCE',
    });
    auditClient.emitEvent.mockClear();

    await expect(
      (controller as any).runRetention({
        ...req,
        headers: { [STEP_UP_HEADER]: issued.proof },
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ statusCode: 403 }),
    });

    expect(auditClient.emitEvent).toHaveBeenCalledWith(expect.anything(), {
      action: 'SENSITIVE_ACTION_PROOF_USE_DENIED',
      resourceType: 'SENSITIVE_ACTION',
      resourceId: 'run-retention',
      result: 'DENY',
      reason: expect.any(String),
      metadata: { sensitiveAction: 'run-retention' },
    });
    expect(proxyService.forward).not.toHaveBeenCalled();
  });

  it('rejects proof requests when recent re-auth is required but auth_time is stale', async () => {
    process.env.SENSITIVE_ACTION_REQUIRE_RECENT_AUTH = 'true';
    process.env.SENSITIVE_ACTION_REAUTH_MAX_AGE_SECONDS = '300';
    const proxyService = {
      forward: jest.fn(),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);

    await expect(
      (controller as any).issueSensitiveActionProof(
        makeReq({
          user: {
            sub: 'admin-1',
            username: 'admin1',
            roles: ['admin'],
            raw: {
              auth_time: Math.floor(Date.now() / 1000) - 600,
            },
          },
        }),
        {
          action: 'run-retention',
          challengePhrase: 'RUN RETENTION',
        },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ statusCode: 403 }),
    });
  });

  it('issues proof when recent re-auth is required and auth_time is fresh', async () => {
    process.env.SENSITIVE_ACTION_REQUIRE_RECENT_AUTH = 'true';
    process.env.SENSITIVE_ACTION_REAUTH_MAX_AGE_SECONDS = '300';
    const proxyService = {
      forward: jest.fn(),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);

    const issued = await (controller as any).issueSensitiveActionProof(
      makeReq({
        user: {
          sub: 'admin-1',
          username: 'admin1',
          roles: ['admin'],
          raw: {
            auth_time: Math.floor(Date.now() / 1000) - 60,
          },
        },
      }),
      {
        action: 'run-retention',
        challengePhrase: 'RUN RETENTION',
      },
    );

    expect(issued).toMatchObject({
      proof: expect.any(String),
      expiresAt: expect.any(String),
      reauth: {
        checked: true,
        maxAgeSeconds: 300,
      },
    });
  });
});

describe('MetadataProxyController access review documents', () => {
  const metadataUrl = 'http://metadata-service:3002';

  beforeEach(() => {
    process.env.METADATA_SERVICE_URL = metadataUrl;
  });

  it('returns a batch review dataset while only fetching ACL detail for sensitive documents', async () => {
    const listDocuments = [
      {
        id: 'doc-public',
        title: 'Public handbook',
        status: 'PUBLISHED',
        classification: 'PUBLIC',
        ownerId: 'viewer-1',
        currentVersion: 1,
        filename: 'public.pdf',
        tags: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 'doc-secret',
        title: 'Secret plan',
        status: 'PUBLISHED',
        classification: 'SECRET',
        ownerId: 'owner-1',
        currentVersion: 1,
        filename: 'secret.pdf',
        tags: ['board'],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 'doc-confidential',
        title: 'Confidential plan',
        status: 'PUBLISHED',
        classification: 'CONFIDENTIAL',
        ownerId: 'owner-2',
        currentVersion: 1,
        filename: 'confidential.pdf',
        tags: ['finance'],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ];
    const secretDetail = {
      ...listDocuments[1],
      aclEntries: [
        {
          id: 'acl-secret-all',
          subjectType: 'ALL',
          permission: 'DOWNLOAD',
          effect: 'ALLOW',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ],
      versions: [],
    };
    const confidentialDetail = {
      ...listDocuments[2],
      aclEntries: [],
      versions: [],
    };
    const proxyService = {
      forward: jest.fn((_req: unknown, config: { url: string }) => {
        if (config.url === `${metadataUrl}/documents`) {
          return Promise.resolve({ data: listDocuments });
        }
        if (config.url === `${metadataUrl}/documents/doc-secret`) {
          return Promise.resolve({ data: secretDetail });
        }
        if (config.url === `${metadataUrl}/documents/doc-confidential`) {
          return Promise.resolve({ data: confidentialDetail });
        }
        throw new Error(`Unexpected proxy call: ${config.url}`);
      }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);
    const req = makeReq({
      user: {
        sub: 'co-1',
        username: 'co1',
        roles: ['compliance_officer'],
      },
      url: '/metadata/access-review/documents',
    });

    const result = await (controller as any).listAccessReviewDocuments(req);

    expect(result).toEqual([
      {
        ...listDocuments[0],
        aclEntries: [],
        versions: [],
      },
      secretDetail,
      confidentialDetail,
    ]);
    expect(proxyService.forward).toHaveBeenCalledTimes(3);
    expect(proxyService.forward).not.toHaveBeenCalledWith(expect.anything(), {
      method: 'GET',
      url: `${metadataUrl}/documents/doc-public`,
    });
  });

  it('forwards access review list query params to the metadata service', async () => {
    const proxyService = {
      forward: jest.fn((_req: unknown, config: { url: string }) => {
        if (config.url === `${metadataUrl}/documents?q=secret`) {
          return Promise.resolve({ data: [] });
        }
        throw new Error(`Unexpected proxy call: ${config.url}`);
      }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);

    const result = await (controller as any).listAccessReviewDocuments(
      makeReq({
        url: '/metadata/access-review/documents?q=secret',
      }),
    );

    expect(result).toEqual([]);
    expect(proxyService.forward).toHaveBeenCalledWith(expect.anything(), {
      method: 'GET',
      url: `${metadataUrl}/documents?q=secret`,
    });
  });
});

describe('MetadataProxyController evidence packet', () => {
  const metadataUrl = 'http://metadata-service:3002';
  const auditUrl = 'http://audit-service:3001';

  beforeEach(() => {
    process.env.METADATA_SERVICE_URL = metadataUrl;
    process.env.AUDIT_SERVICE_URL = auditUrl;
    process.env.SENSITIVE_ACTION_PROOF_SECRET = 'test-step-up-secret';
  });

  it('assembles document metadata, retention, workflow, and audit evidence without file grants', async () => {
    const document = {
      id: 'doc-1',
      title: 'Board policy',
      status: 'ARCHIVED',
      classification: 'CONFIDENTIAL',
      ownerId: 'editor-1',
      tags: ['board'],
      currentVersion: 2,
      dlpStatus: 'DETECTED',
      dlpFindings: [{ type: 'EMAIL', count: 1 }],
      dlpDetectedAt: '2026-05-30T01:00:00.000Z',
      retentionClass: 'CONFIDENTIAL-180D',
      retentionUntil: '2026-11-26T00:00:00.000Z',
      retentionReason: 'Confidential retention policy',
      createdAt: '2026-05-29T00:00:00.000Z',
      updatedAt: '2026-05-30T00:00:00.000Z',
      versions: [
        {
          id: 'version-2',
          version: 2,
          filename: 'board-v2.txt',
          checksum: 'sha256-v2',
          objectKey: 'documents/doc-1/v2/board-v2.txt',
          storagePath: 'documents/doc-1/v2/board-v2.txt',
        },
      ],
      aclEntries: [
        {
          id: 'acl-1',
          subjectType: 'ROLE',
          subjectId: 'viewer',
          permission: 'READ',
          effect: 'ALLOW',
        },
      ],
    };
    const workflowHistory = [
      {
        id: 'wf-1',
        action: 'RETENTION',
        actorId: 'system:retention',
        createdAt: '2026-05-30T02:00:00.000Z',
      },
    ];
    const retentionRecord = {
      docId: 'doc-1',
      retentionStatus: 'ARCHIVED',
      daysRemaining: null,
    };
    const chain = { valid: true, checked: 42 };
    const auditEvent = {
      eventId: 'event-1',
      action: 'DOCUMENT_AUTO_ARCHIVED',
      resourceType: 'DOCUMENT',
      resourceId: 'doc-1',
      result: 'SUCCESS',
      metadata: {
        objectKey: 'documents/doc-1/v2/board-v2.txt',
        grantToken: 'grant-token',
        downloadToken: 'download-token',
        nested: {
          presignedUrl: 'https://storage.example/board-v2.txt',
          fileContent: 'board bytes',
          kept: 'metadata',
        },
      },
    };

    const proxyService = {
      forward: jest.fn(
        (req: unknown, config: { url: string; params?: any }) => {
          if (config.url === `${metadataUrl}/documents/doc-1`) {
            return Promise.resolve({ data: document });
          }
          if (
            config.url === `${metadataUrl}/documents/doc-1/workflow-history`
          ) {
            return Promise.resolve({ data: workflowHistory });
          }
          if (config.url === `${metadataUrl}/retention/documents`) {
            return Promise.resolve({ data: { records: [retentionRecord] } });
          }
          if (config.url === `${auditUrl}/audit/verify-chain`) {
            return Promise.resolve({ data: chain });
          }
          if (config.url === `${auditUrl}/audit/query`) {
            return Promise.resolve({
              data: {
                data: [auditEvent],
                total: 1,
                page: 1,
                pageSize: 200,
              },
            });
          }
          throw new Error(`Unexpected proxy call: ${config.url}`);
        },
      ),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);
    const req = {
      user: {
        sub: 'co-1',
        username: 'co1',
        roles: ['compliance_officer'],
      },
      headers: {},
      url: '/metadata/documents/doc-1/evidence-packet',
    };
    const issued = await (controller as any).issueSensitiveActionProof(req, {
      action: 'export-evidence-packet',
      challengePhrase: 'EXPORT EVIDENCE',
    });

    const packet = await (controller as any).getEvidencePacket('doc-1', {
      ...req,
      headers: { [STEP_UP_HEADER]: issued.proof },
    });

    expect(packet).toMatchObject({
      generatedAt: expect.any(String),
      generatedBy: {
        id: 'co-1',
        username: 'co1',
        roles: ['compliance_officer'],
      },
      document: {
        id: 'doc-1',
        classification: 'CONFIDENTIAL',
        dlpStatus: 'DETECTED',
      },
      versions: [
        {
          id: 'version-2',
          version: 2,
          filename: 'board-v2.txt',
          checksum: 'sha256-v2',
        },
      ],
      aclEntries: document.aclEntries,
      workflowHistory,
      retention: {
        record: retentionRecord,
      },
      audit: {
        chain,
        events: [
          {
            ...auditEvent,
            metadata: {
              nested: {
                kept: 'metadata',
              },
            },
          },
        ],
        total: 1,
      },
    });
    expect(packet.metadataOnly).toBe(true);
    expect(packet.excludedSensitiveFields).toEqual([
      'file-payload',
      'storage-reference',
      'direct-download-link',
      'temporary-access-grant',
    ]);
    expect(packet.versions[0]).not.toHaveProperty('objectKey');
    expect(packet.versions[0]).not.toHaveProperty('storagePath');
    expect(packet.audit.events[0].metadata).not.toHaveProperty('objectKey');
    expect(packet.audit.events[0].metadata).not.toHaveProperty('grantToken');
    expect(packet.audit.events[0].metadata).not.toHaveProperty('downloadToken');
    expect(JSON.stringify(packet)).not.toContain(
      'documents/doc-1/v2/board-v2.txt',
    );
    expect(JSON.stringify(packet)).not.toContain('grant-token');
    expect(JSON.stringify(packet)).not.toContain('download-token');
    expect(JSON.stringify(packet)).not.toContain(
      'https://storage.example/board-v2.txt',
    );
    expect(JSON.stringify(packet)).not.toContain('board bytes');
    expect(proxyService.forward).toHaveBeenCalledWith(expect.anything(), {
      method: 'GET',
      url: `${auditUrl}/audit/query`,
      params: { documentId: 'doc-1', pageSize: 200 },
    });
  });
});

describe('MetadataProxyController AI guardrails', () => {
  const metadataUrl = 'http://metadata-service:3002';

  beforeEach(() => {
    process.env.METADATA_SERVICE_URL = metadataUrl;
  });

  it('proxies document AI guardrails without assembling content grants', async () => {
    const aiGuardrails = {
      documentId: 'doc-1',
      actorId: 'co-1',
      canUseMetadata: true,
      canUseContent: false,
      allowedOperations: ['METADATA_CLASSIFICATION', 'METADATA_TAGGING'],
      deniedOperations: [
        {
          operation: 'CONTENT_SUMMARIZATION',
          reason:
            'Compliance officers cannot use file content for AI operations',
        },
      ],
    };
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: aiGuardrails }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);

    const result = await (controller as any).getAiGuardrails('doc-1', {
      user: {
        sub: 'co-1',
        roles: ['compliance_officer'],
      },
    });

    expect(result).toBe(aiGuardrails);
    expect(proxyService.forward).toHaveBeenCalledWith(expect.anything(), {
      method: 'GET',
      url: `${metadataUrl}/documents/doc-1/ai-guardrails`,
    });
  });
});

describe('MetadataProxyController document detail', () => {
  const metadataUrl = 'http://metadata-service:3002';

  beforeEach(() => {
    process.env.METADATA_SERVICE_URL = metadataUrl;
  });

  it('forwards share token query params to metadata detail', async () => {
    const document = { id: 'doc-1', title: 'Shared document' };
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: document }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);
    const req = makeReq({
      url: '/metadata/documents/doc-1?shareToken=raw%20token',
    });

    const result = await (controller as any).findOne('doc-1', req);

    expect(result).toBe(document);
    expect(proxyService.forward).toHaveBeenCalledWith(req, {
      method: 'GET',
      url: `${metadataUrl}/documents/doc-1?shareToken=raw%20token`,
    });
  });
});

describe('MetadataProxyController access impact preview', () => {
  const metadataUrl = 'http://metadata-service:3002';

  beforeEach(() => {
    process.env.METADATA_SERVICE_URL = metadataUrl;
  });

  it('proxies document access impact preview without assembling content grants', async () => {
    const preview = {
      documentId: 'doc-1',
      current: { classification: 'CONFIDENTIAL', watermarkRequired: true },
      proposed: { classification: 'PUBLIC', watermarkRequired: false },
      changes: { accessExpanded: true, watermarkReduced: true },
      roleImpacts: [],
    };
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: preview }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);

    const result = await (controller as any).getAccessImpactPreview(
      'doc-1',
      {
        user: {
          sub: 'admin-1',
          roles: ['admin'],
        },
      },
      { classification: 'PUBLIC' },
    );

    expect(result).toBe(preview);
    expect(proxyService.forward).toHaveBeenCalledWith(expect.anything(), {
      method: 'POST',
      url: `${metadataUrl}/documents/doc-1/access-impact`,
      data: { classification: 'PUBLIC' },
    });
  });
});

describe('MetadataProxyController share links', () => {
  const metadataUrl = 'http://metadata-service:3002';

  beforeEach(() => {
    process.env.METADATA_SERVICE_URL = metadataUrl;
  });

  it('proxies share link creation body to metadata service', async () => {
    const created = { id: 'link-1', token: 'raw-token' };
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: created }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);
    const req = { user: { sub: 'owner-1', roles: ['editor'] }, headers: {} };
    const body = { permission: 'VIEW', expiresInHours: 24 };

    const result = await (controller as any).createShareLink('doc-1', req, body);

    expect(result).toBe(created);
    expect(proxyService.forward).toHaveBeenCalledWith(req, {
      method: 'POST',
      url: `${metadataUrl}/documents/doc-1/share-links`,
      data: body,
    });
  });

  it('proxies share link listing to metadata service', async () => {
    const links = [{ id: 'link-1', status: 'ACTIVE' }];
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: links }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);
    const req = { user: { sub: 'owner-1', roles: ['editor'] }, headers: {} };

    const result = await (controller as any).listShareLinks('doc-1', req);

    expect(result).toBe(links);
    expect(proxyService.forward).toHaveBeenCalledWith(req, {
      method: 'GET',
      url: `${metadataUrl}/documents/doc-1/share-links`,
    });
  });

  it('proxies share link revocation to metadata service', async () => {
    const revoked = { id: 'link-1', status: 'REVOKED' };
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: revoked }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);
    const req = { user: { sub: 'owner-1', roles: ['editor'] }, headers: {} };

    const result = await (controller as any).revokeShareLink('doc-1', 'link-1', req);

    expect(result).toBe(revoked);
    expect(proxyService.forward).toHaveBeenCalledWith(req, {
      method: 'DELETE',
      url: `${metadataUrl}/documents/doc-1/share-links/link-1`,
    });
  });

  it('proxies share link redemption body to metadata service', async () => {
    const redeemed = { docId: 'doc-1', permission: 'VIEW' };
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: redeemed }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);
    const req = { user: { sub: 'viewer-1', roles: ['viewer'] }, headers: {} };
    const body = { token: 'raw-token' };

    const result = await (controller as any).redeemShareLink(req, body);

    expect(result).toBe(redeemed);
    expect(proxyService.forward).toHaveBeenCalledWith(req, {
      method: 'POST',
      url: `${metadataUrl}/share-links/redeem`,
      data: body,
    });
  });
});

describe('MetadataProxyController version restore', () => {
  const metadataUrl = 'http://metadata-service:3002';

  beforeEach(() => {
    process.env.METADATA_SERVICE_URL = metadataUrl;
  });

  it('proxies version restore to metadata service', async () => {
    const restored = { id: 'version-new', version: 4 };
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: restored }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);
    const req = { user: { sub: 'editor-1', roles: ['editor'] }, headers: {} };

    const result = await (controller as any).restoreVersion('doc-1', '1', req);

    expect(result).toBe(restored);
    expect(proxyService.forward).toHaveBeenCalledWith(req, {
      method: 'POST',
      url: `${metadataUrl}/documents/doc-1/versions/1/restore`,
    });
  });
});

describe('MetadataProxyController trash', () => {
  const metadataUrl = 'http://metadata-service:3002';

  beforeEach(() => {
    process.env.METADATA_SERVICE_URL = metadataUrl;
  });

  it('proxies trash listing to metadata service', async () => {
    const trash = [{ docId: 'doc-1', recoverable: true }];
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: trash }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);
    const req = { user: { sub: 'editor-1', roles: ['editor'] }, headers: {} };

    const result = await (controller as any).listTrash(req);

    expect(result).toBe(trash);
    expect(proxyService.forward).toHaveBeenCalledWith(req, {
      method: 'GET',
      url: `${metadataUrl}/documents/trash`,
    });
  });

  it('proxies restore-from-trash to metadata service', async () => {
    const restored = { id: 'doc-1', status: 'DRAFT' };
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: restored }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);
    const req = { user: { sub: 'editor-1', roles: ['editor'] }, headers: {} };

    const result = await (controller as any).restoreFromTrash('doc-1', req);

    expect(result).toBe(restored);
    expect(proxyService.forward).toHaveBeenCalledWith(req, {
      method: 'POST',
      url: `${metadataUrl}/documents/doc-1/restore`,
    });
  });
});

describe('MetadataProxyController approval chain', () => {
  const metadataUrl = 'http://metadata-service:3002';

  beforeEach(() => {
    process.env.METADATA_SERVICE_URL = metadataUrl;
  });

  it('proxies approval chain config to metadata service', async () => {
    const updated = { id: 'doc-1', approvalChain: ['a', 'b'], approvalStep: 0 };
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: updated }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);
    const req = { user: { sub: 'editor-1', roles: ['editor'] }, headers: {} };
    const body = { approvers: ['a', 'b'] };

    const result = await (controller as any).setApprovalChain('doc-1', req, body);

    expect(result).toBe(updated);
    expect(proxyService.forward).toHaveBeenCalledWith(req, {
      method: 'POST',
      url: `${metadataUrl}/documents/doc-1/approval-chain`,
      data: body,
    });
  });
});

describe('MetadataProxyController legal hold', () => {
  const metadataUrl = 'http://metadata-service:3002';

  beforeEach(() => {
    process.env.METADATA_SERVICE_URL = metadataUrl;
  });

  it('proxies legal hold placement body to metadata service', async () => {
    const updated = { id: 'doc-1', legalHold: true };
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: updated }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);
    const req = { user: { sub: 'admin-1', roles: ['admin'] }, headers: {} };
    const body = { hold: true, reason: 'Litigation 2026-CV-01' };

    const result = await (controller as any).setLegalHold('doc-1', req, body);

    expect(result).toBe(updated);
    expect(proxyService.forward).toHaveBeenCalledWith(req, {
      method: 'POST',
      url: `${metadataUrl}/documents/doc-1/legal-hold`,
      data: body,
    });
  });
});

describe('MetadataProxyController document saved views', () => {
  const metadataUrl = 'http://metadata-service:3002';

  beforeEach(() => {
    process.env.METADATA_SERVICE_URL = metadataUrl;
  });

  it('proxies saved view listing to metadata service', async () => {
    const savedViews = [
      {
        id: 'view-1',
        name: 'Mine',
        scope: 'PRIVATE',
        filters: { status: ['PENDING'] },
      },
    ];
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: savedViews }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);
    const req = { user: { sub: 'user-1', roles: ['viewer'] }, headers: {} };

    const result = await (controller as any).listDocumentSavedViews(req);

    expect(result).toBe(savedViews);
    expect(proxyService.forward).toHaveBeenCalledWith(req, {
      method: 'GET',
      url: `${metadataUrl}/document-saved-views`,
    });
  });

  it('proxies saved view creation body to metadata service', async () => {
    const body = {
      name: 'Team confidential',
      scope: 'TEAM',
      filters: { classification: ['CONFIDENTIAL'] },
      description: 'Shared compliance review',
    };
    const created = { id: 'view-1', ...body };
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: created }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);
    const req = { user: { sub: 'admin-1', roles: ['admin'] }, headers: {} };

    const result = await (controller as any).createDocumentSavedView(req, body);

    expect(result).toBe(created);
    expect(proxyService.forward).toHaveBeenCalledWith(req, {
      method: 'POST',
      url: `${metadataUrl}/document-saved-views`,
      data: body,
    });
  });

  it('proxies saved view deletion to metadata service', async () => {
    const deleted = { id: 'view-1' };
    const proxyService = {
      forward: jest.fn().mockResolvedValue({ data: deleted }),
    } as unknown as ProxyService;
    const controller = makeController(proxyService);
    const req = { user: { sub: 'user-1', roles: ['viewer'] }, headers: {} };

    const result = await (controller as any).deleteDocumentSavedView(
      'view-1',
      req,
    );

    expect(result).toBe(deleted);
    expect(proxyService.forward).toHaveBeenCalledWith(req, {
      method: 'DELETE',
      url: `${metadataUrl}/document-saved-views/view-1`,
    });
  });
});
