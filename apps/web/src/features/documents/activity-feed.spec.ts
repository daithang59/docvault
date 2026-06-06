import { describe, expect, it } from 'vitest';
import { buildActivityFeed } from './activity-feed';
import type { WorkflowHistoryEntry } from './documents.types';
import type { DocumentComment } from '@/lib/hooks/use-comments';
import type { AuditLogEntry } from '@/features/audit/audit.types';

const workflow: WorkflowHistoryEntry[] = [
  {
    id: 'wf-1',
    action: 'SUBMIT',
    actorId: 'editor1',
    fromStatus: 'DRAFT',
    toStatus: 'PENDING',
    reason: 'Ready for review',
    createdAt: '2026-06-01T08:00:00.000Z',
  } as WorkflowHistoryEntry,
];

const comments: DocumentComment[] = [
  {
    id: 'c-1',
    docId: 'doc-1',
    authorId: 'approver1',
    content: 'Looks good',
    createdAt: '2026-06-02T09:00:00.000Z',
  },
];

const audit: AuditLogEntry[] = [
  {
    eventId: 'a-1',
    action: 'DOCUMENT_SHARE_LINK_CREATED',
    actorId: 'admin1',
    actorRoles: ['admin'],
    result: 'SUCCESS',
    resourceType: 'DOCUMENT',
    resourceId: 'doc-1',
    timestamp: '2026-06-03T10:00:00.000Z',
  } as AuditLogEntry,
  {
    eventId: 'a-2',
    action: 'DOCUMENT_APPROVED',
    actorId: 'approver1',
    actorRoles: ['approver'],
    result: 'SUCCESS',
    resourceType: 'DOCUMENT',
    resourceId: 'doc-1',
    timestamp: '2026-06-02T12:00:00.000Z',
  } as AuditLogEntry,
];

describe('buildActivityFeed', () => {
  it('merges sources into reverse-chronological order', () => {
    const feed = buildActivityFeed({ workflowHistory: workflow, comments, auditEvents: audit });
    const times = feed.map((e) => e.timestamp);
    const sorted = [...times].sort((a, b) => (a < b ? 1 : -1));
    expect(times).toEqual(sorted);
    expect(feed[0].timestamp).toBe('2026-06-03T10:00:00.000Z');
  });

  it('labels each source kind correctly', () => {
    const feed = buildActivityFeed({ workflowHistory: workflow, comments, auditEvents: audit });
    expect(feed.find((e) => e.kind === 'workflow')?.title).toBe('Submitted for approval');
    expect(feed.find((e) => e.kind === 'comment')?.title).toBe('Commented');
    expect(feed.find((e) => e.kind === 'audit')?.title).toBe('Document Share Link Created');
  });

  it('drops audit events that duplicate workflow/comment activity', () => {
    const feed = buildActivityFeed({ workflowHistory: workflow, comments, auditEvents: audit });
    expect(feed.some((e) => e.title === 'Document Approved')).toBe(false);
    expect(feed).toHaveLength(3);
  });

  it('works with only some sources present', () => {
    const feed = buildActivityFeed({ comments });
    expect(feed).toHaveLength(1);
    expect(feed[0].kind).toBe('comment');
  });

  it('humanizes unknown audit actions', () => {
    const feed = buildActivityFeed({
      auditEvents: [
        {
          eventId: 'a-9',
          action: 'DOCUMENT_LEGAL_HOLD_PLACED',
          actorId: 'admin1',
          actorRoles: ['admin'],
          result: 'SUCCESS',
          resourceType: 'DOCUMENT',
          timestamp: '2026-06-04T00:00:00.000Z',
        } as AuditLogEntry,
      ],
    });
    expect(feed[0].title).toBe('Document Legal Hold Placed');
  });
});
