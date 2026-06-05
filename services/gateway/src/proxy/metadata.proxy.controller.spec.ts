import { MetadataProxyController } from './metadata.proxy.controller';
import { ProxyService } from './proxy.service';

describe('MetadataProxyController evidence packet', () => {
  const metadataUrl = 'http://metadata-service:3002';
  const auditUrl = 'http://audit-service:3001';

  beforeEach(() => {
    process.env.METADATA_SERVICE_URL = metadataUrl;
    process.env.AUDIT_SERVICE_URL = auditUrl;
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
    const controller = new MetadataProxyController(proxyService);

    const packet = await (controller as any).getEvidencePacket('doc-1', {
      user: {
        sub: 'co-1',
        username: 'co1',
        roles: ['compliance_officer'],
      },
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
    const controller = new MetadataProxyController(proxyService);

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
    const controller = new MetadataProxyController(proxyService);

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
    const controller = new MetadataProxyController(proxyService);
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
    const controller = new MetadataProxyController(proxyService);
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
    const controller = new MetadataProxyController(proxyService);
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
