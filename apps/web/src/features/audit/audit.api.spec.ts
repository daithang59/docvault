import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaginatedResponse } from '@/types/pagination';
import type { AuditLogEntry, AuditQueryFilters } from './audit.types';
import {
  getSecurityRecommendationWorkflowHistory,
  queryAuditLogWindow,
  updateSecurityRecommendationWorkflow,
} from './audit.api';

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  default: apiClientMock,
}));

beforeEach(() => {
  apiClientMock.get.mockReset();
  apiClientMock.patch.mockReset();
});

function auditEvent(eventId: string): AuditLogEntry {
  return {
    eventId,
    action: 'DOCUMENT_PREVIEW_AUTHORIZED',
    actorId: 'viewer-1',
    actorRoles: ['viewer'],
    result: 'SUCCESS',
    resourceType: 'DOCUMENT',
    resourceId: `doc-${eventId}`,
    timestamp: '2026-05-30T00:00:00.000Z',
    metadata: { classification: 'SECRET' },
  };
}

describe('queryAuditLogWindow', () => {
  it('fetches every reported page before returning audit activity', async () => {
    const calls: Array<{ filters?: AuditQueryFilters; page?: number; pageSize?: number }> = [];
    const pages: Record<number, AuditLogEntry[]> = {
      1: [auditEvent('event-1')],
      2: [auditEvent('event-2')],
      3: [auditEvent('event-3')],
    };

    const result = await queryAuditLogWindow(
      { action: 'DOCUMENT_PREVIEW_AUTHORIZED' },
      {
        pageSize: 1,
        fetchPage: async (filters, page, pageSize): Promise<PaginatedResponse<AuditLogEntry>> => {
          calls.push({ filters, page, pageSize });
          return {
            data: pages[page ?? 1] ?? [],
            total: 3,
            page: page ?? 1,
            pageSize: pageSize ?? 1,
            totalPages: 3,
          };
        },
      },
    );

    expect(calls.map((call) => call.page)).toEqual([1, 2, 3]);
    expect(calls.every((call) => call.pageSize === 1)).toBe(true);
    expect(result.data.map((event) => event.eventId)).toEqual([
      'event-1',
      'event-2',
      'event-3',
    ]);
    expect(result.total).toBe(3);
    expect(result.totalPages).toBe(3);
  });

  it('fails instead of silently returning a partial audit window', async () => {
    await expect(
      queryAuditLogWindow(
        { action: 'DOCUMENT_DOWNLOAD_AUTHORIZED' },
        {
          pageSize: 1,
          maxPages: 2,
          fetchPage: async (_filters, page, pageSize): Promise<PaginatedResponse<AuditLogEntry>> => ({
            data: [auditEvent(`event-${page ?? 1}`)],
            total: 3,
            page: page ?? 1,
            pageSize: pageSize ?? 1,
            totalPages: 3,
          }),
        },
      ),
    ).rejects.toThrow('Audit window exceeds 2 pages');
  });
});

describe('updateSecurityRecommendationWorkflow', () => {
  it('patches the recommendation workflow endpoint and unwraps the audit event', async () => {
    apiClientMock.patch.mockResolvedValue({
      data: {
        eventId: 'event-recommendation-updated',
        action: 'SECURITY_RECOMMENDATION_STATUS_UPDATED',
      },
    });

    const result = await updateSecurityRecommendationWorkflow(
      'actor-access-review:DENY_BURST:viewer-1',
      {
        status: 'INVESTIGATING',
        note: 'Checking role and group membership',
      },
    );

    expect(apiClientMock.patch).toHaveBeenCalledWith(
      '/audit/security-recommendations/actor-access-review%3ADENY_BURST%3Aviewer-1/workflow',
      {
        status: 'INVESTIGATING',
        note: 'Checking role and group membership',
      },
    );
    expect(result).toEqual({
      eventId: 'event-recommendation-updated',
      action: 'SECURITY_RECOMMENDATION_STATUS_UPDATED',
    });
  });
});

describe('getSecurityRecommendationWorkflowHistory', () => {
  it('gets the encoded recommendation workflow history endpoint and unwraps entries', async () => {
    apiClientMock.get.mockResolvedValue({
      data: [
        {
          eventId: 'event-reviewed',
          status: 'REVIEWED',
          note: 'Reviewed with ticket SEC-12',
          updatedAt: '2026-05-31T11:00:00.000Z',
          updatedBy: 'co1',
        },
      ],
    });

    const result = await getSecurityRecommendationWorkflowHistory(
      'actor-access-review:DENY_BURST:viewer-1',
    );

    expect(apiClientMock.get).toHaveBeenCalledWith(
      '/audit/security-recommendations/actor-access-review%3ADENY_BURST%3Aviewer-1/workflow-history',
    );
    expect(result).toEqual([
      {
        eventId: 'event-reviewed',
        status: 'REVIEWED',
        note: 'Reviewed with ticket SEC-12',
        updatedAt: '2026-05-31T11:00:00.000Z',
        updatedBy: 'co1',
      },
    ]);
  });
});
