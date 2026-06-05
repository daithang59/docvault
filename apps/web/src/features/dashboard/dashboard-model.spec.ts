import { describe, expect, it } from 'vitest';
import { buildDashboardModel } from './dashboard-model';
import type { DocumentListItem } from '@/features/documents/documents.types';

const now = new Date('2026-06-04T09:00:00.000Z');

const documents: DocumentListItem[] = [
  {
    id: 'doc-pending-dlp',
    title: 'Incident Export',
    description: 'Detected sensitive data export',
    status: 'PENDING',
    classification: 'SECRET',
    dlpStatus: 'DETECTED',
    retentionClass: 'SECRET_90D',
    retentionUntil: '2026-06-20T00:00:00.000Z',
    ownerId: 'editor-1',
    ownerDisplay: 'Editor One',
    currentVersion: 2,
    filename: 'incident.csv',
    tags: ['security'],
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-04T08:00:00.000Z',
  },
  {
    id: 'doc-draft',
    title: 'Policy Draft',
    status: 'DRAFT',
    classification: 'INTERNAL',
    ownerId: 'editor-2',
    currentVersion: 1,
    filename: 'policy.docx',
    tags: ['policy'],
    createdAt: '2026-06-02T00:00:00.000Z',
    updatedAt: '2026-06-03T08:00:00.000Z',
  },
  {
    id: 'doc-published',
    title: 'Library Index',
    status: 'PUBLISHED',
    classification: 'INTERNAL',
    ownerId: 'viewer-1',
    currentVersion: 1,
    filename: 'library.pdf',
    tags: ['library'],
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-06-02T08:00:00.000Z',
  },
  {
    id: 'doc-archived',
    title: 'Closed Archive',
    status: 'ARCHIVED',
    classification: 'CONFIDENTIAL',
    retentionClass: 'CONFIDENTIAL_180D',
    retentionUntil: '2026-12-01T00:00:00.000Z',
    ownerId: 'records-1',
    currentVersion: 3,
    filename: 'archive.pdf',
    tags: ['records'],
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
];

describe('buildDashboardModel', () => {
  it('builds operational widgets for approvals, retention, security, notifications, and workflow activity', () => {
    const model = buildDashboardModel(documents, {
      unreadNotifications: 3,
      now,
    });

    expect(model.stats).toEqual({
      total: 4,
      DRAFT: 1,
      PENDING: 1,
      PUBLISHED: 1,
      ARCHIVED: 1,
    });

    expect(model.operationalWidgets).toEqual([
      expect.objectContaining({
        key: 'pending-approvals',
        label: 'Pending approvals',
        value: 1,
        href: '/approvals',
        tone: 'warning',
      }),
      expect.objectContaining({
        key: 'dlp-detected',
        label: 'DLP detected',
        value: 1,
        href: '/security',
        tone: 'critical',
      }),
      expect.objectContaining({
        key: 'retention-due-soon',
        label: 'Retention due soon',
        value: 1,
        href: '/retention',
        tone: 'warning',
      }),
      expect.objectContaining({
        key: 'unread-notifications',
        label: 'Unread notifications',
        value: 3,
        href: '/notifications',
        tone: 'info',
      }),
    ]);

    expect(model.workQueue.map((item) => item.documentId)).toEqual([
      'doc-pending-dlp',
      'doc-draft',
    ]);
    expect(model.workQueue[0]).toEqual(
      expect.objectContaining({
        reason: 'Approval and security review',
        href: '/documents/doc-pending-dlp',
      }),
    );
    expect(model.recentDocuments.map((item) => item.id)).toEqual([
      'doc-pending-dlp',
      'doc-draft',
      'doc-published',
      'doc-archived',
    ]);
  });
});
