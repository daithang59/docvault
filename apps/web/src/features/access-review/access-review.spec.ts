import { describe, expect, it } from 'vitest';
import {
  buildAccessReviewModel,
  getAccessReviewUserSubjectIds,
  getResolvedAccessReviewEvidence,
  getResolvedAccessReviewSubject,
} from './access-review';
import type { DocumentDetail } from '@/features/documents/documents.types';

const baseDocument: DocumentDetail = {
  id: 'doc-internal',
  title: 'Internal Policy',
  status: 'PUBLISHED',
  classification: 'INTERNAL',
  ownerId: 'editor-1',
  ownerDisplay: 'Editor One',
  currentVersion: 1,
  filename: 'policy.pdf',
  tags: ['policy'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  versions: [],
  aclEntries: [],
};

function document(overrides: Partial<DocumentDetail>): DocumentDetail {
  return {
    ...baseDocument,
    ...overrides,
    aclEntries: overrides.aclEntries ?? baseDocument.aclEntries,
    versions: overrides.versions ?? baseDocument.versions,
  };
}

describe('buildAccessReviewModel', () => {
  it('flags broad and stale access on sensitive documents with clear review actions', () => {
    const model = buildAccessReviewModel(
      [
        document({
          id: 'doc-secret-board',
          title: 'Board Acquisition Plan',
          classification: 'SECRET',
          dlpStatus: 'DETECTED',
          ownerId: 'owner-1',
          ownerDisplay: 'Owner One',
          updatedAt: '2026-06-01T10:00:00.000Z',
          aclEntries: [
            {
              id: 'acl-all-download',
              docId: 'doc-secret-board',
              subjectType: 'ALL',
              subjectDisplay: 'Everyone',
              permission: 'DOWNLOAD',
              effect: 'ALLOW',
              createdAt: '2025-06-01T00:00:00.000Z',
            },
            {
              id: 'acl-editor-read',
              docId: 'doc-secret-board',
              subjectType: 'ROLE',
              subjectId: 'editor',
              subjectDisplay: 'Editor',
              permission: 'READ',
              effect: 'ALLOW',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
            {
              id: 'acl-viewer-read',
              docId: 'doc-secret-board',
              subjectType: 'ROLE',
              subjectId: 'viewer',
              subjectDisplay: 'Viewer',
              permission: 'READ',
              effect: 'ALLOW',
              createdAt: '2025-10-01T00:00:00.000Z',
            },
          ],
        }),
        document({
          id: 'doc-internal-policy',
          title: 'Internal Policy',
          classification: 'INTERNAL',
          updatedAt: '2026-06-02T10:00:00.000Z',
        }),
      ],
      { now: '2026-06-05T00:00:00.000Z', staleAfterDays: 90 },
    );

    expect(model.summary).toEqual({
      reviewedDocuments: 2,
      openReviews: 7,
      criticalReviews: 4,
      stalePermissions: 3,
      broadAccessGrants: 3,
    });
    expect(model.posture).toEqual({
      level: 'critical',
      label: 'Access review required',
      description:
        'Critical broad-access grants exist on sensitive documents and should be recertified.',
    });
    expect(model.reviews.map((review) => review.type)).toEqual([
      'broad-access',
      'broad-access',
      'broad-access',
      'sensitive-download',
      'stale-permission',
      'stale-permission',
      'stale-permission',
    ]);
    expect(model.reviews[0]).toMatchObject({
      documentId: 'doc-secret-board',
      title: 'Board Acquisition Plan',
      classification: 'SECRET',
      severity: 'critical',
      subject: 'Everyone',
      permission: 'DOWNLOAD',
      nextActionLabel: 'Review ACL',
      href: '/documents/doc-secret-board',
      auditHref: '/audit?documentId=doc-secret-board&aclId=acl-all-download',
    });
    expect(model.reviews[0].evidence).toEqual([
      'SECRET document',
      'ALLOW DOWNLOAD for Everyone',
      'DLP detected',
    ]);
  });

  it('keeps the posture healthy when sensitive documents have no broad grants', () => {
    const model = buildAccessReviewModel(
      [
        document({
          id: 'doc-secret-owner-only',
          title: 'Owner Only Secret',
          classification: 'SECRET',
          aclEntries: [
            {
              id: 'acl-owner-read',
              docId: 'doc-secret-owner-only',
              subjectType: 'USER',
              subjectId: 'owner-1',
              subjectDisplay: 'Owner One',
              permission: 'READ',
              effect: 'ALLOW',
              createdAt: '2026-06-01T00:00:00.000Z',
            },
          ],
        }),
      ],
      { now: '2026-06-05T00:00:00.000Z' },
    );

    expect(model.summary.openReviews).toBe(0);
    expect(model.reviews).toEqual([]);
    expect(model.posture).toEqual({
      level: 'healthy',
      label: 'Access posture reviewed',
      description:
        'No broad or stale sensitive-document permissions were found in the current review set.',
    });
  });

  it('keeps broad access metrics aligned to sensitive document review scope', () => {
    const model = buildAccessReviewModel(
      [
        document({
          id: 'doc-public',
          title: 'Public Handbook',
          classification: 'PUBLIC',
          aclEntries: [
            {
              id: 'acl-public-all-read',
              docId: 'doc-public',
              subjectType: 'ALL',
              subjectDisplay: 'Everyone',
              permission: 'READ',
              effect: 'ALLOW',
              createdAt: '2025-01-01T00:00:00.000Z',
            },
          ],
        }),
      ],
      { now: '2026-06-05T00:00:00.000Z' },
    );

    expect(model.summary.broadAccessGrants).toBe(0);
    expect(model.summary.openReviews).toBe(0);
    expect(model.posture.level).toBe('healthy');
  });

  it('resolves user subject ids to usernames for review display text', () => {
    const model = buildAccessReviewModel(
      [
        document({
          id: 'doc-confidential-download',
          title: 'Confidential Download',
          classification: 'CONFIDENTIAL',
          aclEntries: [
            {
              id: 'acl-user-download',
              docId: 'doc-confidential-download',
              subjectType: 'USER',
              subjectId: '45199353-ae24-4eb4-b408-0d4aea57f886',
              permission: 'DOWNLOAD',
              effect: 'ALLOW',
              createdAt: '2026-06-01T00:00:00.000Z',
            },
          ],
        }),
      ],
      { now: '2026-06-05T00:00:00.000Z' },
    );

    const review = model.reviews[0];

    expect(getAccessReviewUserSubjectIds(model.reviews)).toEqual([
      '45199353-ae24-4eb4-b408-0d4aea57f886',
    ]);
    expect(
      getResolvedAccessReviewSubject(review, {
        '45199353-ae24-4eb4-b408-0d4aea57f886': {
          displayName: 'Viewer One',
          username: 'viewer1',
        },
      }),
    ).toBe('viewer1');
    expect(
      getResolvedAccessReviewEvidence(review, {
        '45199353-ae24-4eb4-b408-0d4aea57f886': {
          displayName: 'Viewer One',
          username: 'viewer1',
        },
      }),
    ).toContain('ALLOW DOWNLOAD for viewer1');
  });
});
