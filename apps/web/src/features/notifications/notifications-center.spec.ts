import { describe, expect, it } from 'vitest';
import {
  buildNotificationCenterModel,
  getNotificationTarget,
  type NotificationCenterFilter,
} from './notifications-center';
import type { NotificationRecord } from './notifications.api';

const records: NotificationRecord[] = [
  {
    id: 'n-submitted',
    type: 'SUBMITTED',
    docId: 'doc-1',
    recipientId: 'approver-1',
    docTitle: 'Board Report',
    createdAt: '2026-06-01T09:00:00.000Z',
    read: false,
  },
  {
    id: 'n-archived',
    type: 'ARCHIVED',
    docId: 'doc-2',
    recipientId: 'co-1',
    docTitle: 'Retention File',
    createdAt: '2026-06-01T10:00:00.000Z',
    read: true,
  },
  {
    id: 'n-deleted',
    type: 'DELETED',
    docId: 'doc-3',
    recipientId: 'admin-1',
    docTitle: 'Deleted File',
    createdAt: '2026-06-01T11:00:00.000Z',
    read: false,
  },
  {
    id: 'n-security',
    type: 'MALWARE_BLOCKED',
    docId: 'doc-4',
    recipientId: 'co-1',
    docTitle: 'Blocked File',
    createdAt: '2026-06-01T12:00:00.000Z',
    read: false,
  } as NotificationRecord,
];

describe('buildNotificationCenterModel', () => {
  it('groups notifications into commercial work queues with unread counts', () => {
    const model = buildNotificationCenterModel(records, {
      group: 'all',
      readState: 'all',
    });

    expect(model.total).toBe(4);
    expect(model.unread).toBe(3);
    expect(model.groupSummaries).toEqual([
      expect.objectContaining({ key: 'all', total: 4, unread: 3 }),
      expect.objectContaining({ key: 'approvals', total: 1, unread: 1 }),
      expect.objectContaining({ key: 'retention', total: 1, unread: 0 }),
      expect.objectContaining({ key: 'security', total: 1, unread: 1 }),
      expect.objectContaining({ key: 'documents', total: 1, unread: 1 }),
    ]);
    expect(model.items.map((item) => item.id)).toEqual([
      'n-security',
      'n-deleted',
      'n-archived',
      'n-submitted',
    ]);
    expect(model.items[0]).toMatchObject({
      id: 'n-security',
      group: 'security',
      severity: 'critical',
      targetHref: '/security',
      actionLabel: 'Open security dashboard',
    });
  });

  it('filters by group and read state without losing source counts', () => {
    const filter: NotificationCenterFilter = {
      group: 'approvals',
      readState: 'unread',
    };

    const model = buildNotificationCenterModel(records, filter);

    expect(model.total).toBe(4);
    expect(model.unread).toBe(3);
    expect(model.items).toEqual([
      expect.objectContaining({
        id: 'n-submitted',
        group: 'approvals',
        read: false,
        targetHref: '/approvals',
      }),
    ]);
  });

  it('maps workflow timeline notifications to actionable targets with transition context', () => {
    const model = buildNotificationCenterModel(
      [
        {
          id: 'n-rejected',
          type: 'REJECTED',
          docId: 'doc-5',
          recipientId: 'editor-1',
          docTitle: 'Rejected Draft',
          reason: 'Missing retention evidence',
          createdAt: '2026-06-01T13:00:00.000Z',
          read: false,
          metadata: {
            workflow: {
              action: 'REJECT',
              fromStatus: 'PENDING',
              toStatus: 'DRAFT',
              actorId: 'approver-1',
            },
          },
        } as NotificationRecord,
      ],
      {
        group: 'all',
        readState: 'all',
      },
    );

    expect(model.items).toEqual([
      expect.objectContaining({
        id: 'n-rejected',
        group: 'approvals',
        severity: 'critical',
        description: 'Missing retention evidence',
        targetHref: '/documents/doc-5',
        actionLabel: 'Open document',
        workflowSummary: 'PENDING -> DRAFT by approver-1',
      }),
    ]);
  });
});

describe('getNotificationTarget', () => {
  it('maps known and future notification types to stable target routes', () => {
    expect(getNotificationTarget('SUBMITTED', 'doc-1')).toEqual({
      href: '/approvals',
      label: 'Open approvals',
    });
    expect(getNotificationTarget('ARCHIVED', 'doc-1')).toEqual({
      href: '/retention',
      label: 'Open retention',
    });
    expect(getNotificationTarget('DLP_DETECTED', 'doc-1')).toEqual({
      href: '/security',
      label: 'Open security dashboard',
    });
    expect(getNotificationTarget('AUDIT_CHAIN_INVALID', 'doc-1')).toEqual({
      href: '/audit',
      label: 'Open audit trail',
    });
    expect(getNotificationTarget('APPROVED', 'doc-1')).toEqual({
      href: '/documents/doc-1',
      label: 'Open document',
    });
  });
});
