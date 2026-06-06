import { describe, expect, it } from 'vitest';
import type { DocumentListItem } from '@/features/documents/documents.types';
import {
  buildApprovalQueueSlaModel,
  buildApprovalSla,
} from './approval-sla';

const baseDocument: DocumentListItem = {
  id: 'doc-base',
  title: 'Base Document',
  status: 'PENDING',
  classification: 'INTERNAL',
  dlpStatus: 'CLEAR',
  retentionClass: 'INTERNAL_365D',
  retentionUntil: '2026-12-31T00:00:00.000Z',
  ownerId: 'editor1',
  currentVersion: 1,
  tags: ['ops'],
  createdAt: '2026-06-01T08:00:00.000Z',
  updatedAt: '2026-06-03T10:00:00.000Z',
};

function doc(overrides: Partial<DocumentListItem>): DocumentListItem {
  return {
    ...baseDocument,
    ...overrides,
  };
}

describe('buildApprovalSla', () => {
  it('marks overdue documents from classification SLA and queued time', () => {
    const result = buildApprovalSla(
      doc({
        id: 'secret-old',
        classification: 'SECRET',
        updatedAt: '2026-06-03T22:00:00.000Z',
      }),
      { now: '2026-06-04T10:00:00.000Z' },
    );

    expect(result.state).toBe('overdue');
    expect(result.slaHours).toBe(8);
    expect(result.hoursRemaining).toBe(-4);
    expect(result.dueAt).toBe('2026-06-04T06:00:00.000Z');
  });

  it('assigns DLP findings to compliance review with a tighter SLA', () => {
    const result = buildApprovalSla(
      doc({
        id: 'dlp-doc',
        classification: 'CONFIDENTIAL',
        dlpStatus: 'DETECTED',
        updatedAt: '2026-06-04T00:00:00.000Z',
      }),
      { now: '2026-06-04T10:00:00.000Z' },
    );

    expect(result.assignment.label).toBe('Compliance review');
    expect(result.assignment.reason).toContain('DLP findings');
    expect(result.slaHours).toBe(12);
    expect(result.state).toBe('due-soon');
  });

  it('keeps low-risk internal documents on track', () => {
    const result = buildApprovalSla(
      doc({
        id: 'internal-doc',
        classification: 'INTERNAL',
        updatedAt: '2026-06-03T12:00:00.000Z',
      }),
      { now: '2026-06-04T10:00:00.000Z' },
    );

    expect(result.assignment.label).toBe('Document approver');
    expect(result.state).toBe('on-track');
    expect(result.hoursRemaining).toBe(26);
  });
});

describe('buildApprovalQueueSlaModel', () => {
  it('filters by SLA state and sorts by operational priority', () => {
    const model = buildApprovalQueueSlaModel(
      [
        doc({
          id: 'on-track',
          classification: 'PUBLIC',
          updatedAt: '2026-06-03T12:00:00.000Z',
        }),
        doc({
          id: 'due-soon',
          classification: 'CONFIDENTIAL',
          updatedAt: '2026-06-03T18:00:00.000Z',
        }),
        doc({
          id: 'overdue',
          classification: 'SECRET',
          updatedAt: '2026-06-03T22:00:00.000Z',
        }),
      ],
      {
        now: '2026-06-04T10:00:00.000Z',
        filter: 'all',
        sort: 'priority',
      },
    );

    expect(model.summary).toMatchObject({
      total: 3,
      overdue: 1,
      dueSoon: 1,
      onTrack: 1,
    });
    expect(model.rows.map((row) => row.document.id)).toEqual([
      'overdue',
      'due-soon',
      'on-track',
    ]);

    const overdueOnly = buildApprovalQueueSlaModel(
      model.rows.map((row) => row.document),
      {
        now: '2026-06-04T10:00:00.000Z',
        filter: 'overdue',
        sort: 'due-date',
      },
    );

    expect(overdueOnly.rows.map((row) => row.document.id)).toEqual([
      'overdue',
    ]);
  });
});
