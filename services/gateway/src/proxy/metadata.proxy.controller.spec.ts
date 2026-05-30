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
    };

    const proxyService = {
      forward: jest.fn((req: unknown, config: { url: string; params?: any }) => {
        if (config.url === `${metadataUrl}/documents/doc-1`) {
          return Promise.resolve({ data: document });
        }
        if (config.url === `${metadataUrl}/documents/doc-1/workflow-history`) {
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
      }),
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
      versions: document.versions,
      aclEntries: document.aclEntries,
      workflowHistory,
      retention: {
        record: retentionRecord,
      },
      audit: {
        chain,
        events: [auditEvent],
        total: 1,
      },
    });
    expect(JSON.stringify(packet)).not.toContain('grantToken');
    expect(proxyService.forward).toHaveBeenCalledWith(expect.anything(), {
      method: 'GET',
      url: `${auditUrl}/audit/query`,
      params: { documentId: 'doc-1', pageSize: 200 },
    });
  });
});
