import { describe, expect, it } from 'vitest';
import type { Session } from '@/types/auth';
import type { ClassificationLevel, DocumentStatus, UserRole } from '@/types/enums';
import {
  canDownloadDocument,
  canPreviewDocument,
  getAnalyticsVisibility,
  canViewDocumentDetail,
  getDocumentAccessDecision,
  getExplainableDocumentAccessDecision,
} from './permissions';

type TestDocument = {
  status: DocumentStatus;
  ownerId?: string;
  classification?: ClassificationLevel;
  currentVersion?: number;
  aclEntries?: Array<{
    subjectType: 'USER' | 'ROLE' | 'GROUP' | 'ALL';
    subjectId?: string | null;
    permission: 'READ' | 'DOWNLOAD' | 'WRITE' | 'APPROVE';
    effect: 'ALLOW' | 'DENY';
  }>;
};

function session(roles: UserRole[], overrides?: Partial<Session['user']>): Session {
  return {
    accessToken: 'test-token',
    user: {
      sub: overrides?.sub ?? 'user-1',
      username: overrides?.username ?? 'user-1',
      roles,
      groups: overrides?.groups,
      ...overrides,
    },
  };
}

function doc(overrides?: Partial<TestDocument>): TestDocument {
  return {
    status: 'PUBLISHED',
    ownerId: 'owner-1',
    classification: 'PUBLIC',
    currentVersion: 1,
    ...overrides,
  };
}

describe('document access decisions', () => {
  it('explains why compliance officers cannot download file content', () => {
    const decision = getDocumentAccessDecision(
      session(['compliance_officer']),
      doc(),
      'download',
    );

    expect(decision).toEqual({
      allowed: false,
      reason: 'Compliance officers cannot download file content.',
    });
    expect(canDownloadDocument(session(['compliance_officer']), doc())).toBe(false);
  });

  it('requires published status and an uploaded version for downloads', () => {
    expect(
      getDocumentAccessDecision(session(['viewer']), doc({ status: 'DRAFT' }), 'download'),
    ).toMatchObject({
      allowed: false,
      reason: 'Only published documents can be downloaded.',
    });
    expect(
      getDocumentAccessDecision(session(['viewer']), doc({ currentVersion: 0 }), 'download'),
    ).toMatchObject({
      allowed: false,
      reason: 'Document has no uploaded version.',
    });
  });

  it('lets matching download deny ACL override a normally allowed public download', () => {
    const target = doc({
      aclEntries: [
        {
          subjectType: 'ROLE',
          subjectId: 'viewer',
          permission: 'DOWNLOAD',
          effect: 'DENY',
        },
      ],
    });

    expect(getDocumentAccessDecision(session(['viewer']), target, 'download')).toEqual({
      allowed: false,
      reason: 'Download denied by ACL.',
    });
    expect(canDownloadDocument(session(['viewer']), target)).toBe(false);
  });

  it('requires ownership or explicit download allow for confidential downloads', () => {
    const target = doc({
      classification: 'CONFIDENTIAL',
      aclEntries: [
        {
          subjectType: 'GROUP',
          subjectId: '/finance-team',
          permission: 'DOWNLOAD',
          effect: 'ALLOW',
        },
      ],
    });

    expect(canDownloadDocument(session(['editor']), target)).toBe(false);
    expect(canDownloadDocument(session(['editor'], { groups: ['/finance-team'] }), target)).toBe(true);
  });

  it('does not surface ACL-dependent download denial reasons from partial list rows', () => {
    expect(
      getExplainableDocumentAccessDecision(
        session(['editor']),
        doc({ classification: 'CONFIDENTIAL' }),
        'download',
      ),
    ).toEqual({ allowed: false });

    expect(
      getExplainableDocumentAccessDecision(
        session(['editor']),
        doc({ classification: 'CONFIDENTIAL', aclEntries: [] }),
        'download',
      ),
    ).toEqual({
      allowed: false,
      reason: 'CONFIDENTIAL documents require ownership or explicit DOWNLOAD ACL allow.',
    });
  });

  it('lets a viewer with an explicit USER DOWNLOAD allow download a confidential document (Option A)', () => {
    const target = doc({
      classification: 'CONFIDENTIAL',
      ownerId: 'owner-1',
      aclEntries: [
        {
          subjectType: 'USER',
          subjectId: 'user-1',
          permission: 'DOWNLOAD',
          effect: 'ALLOW',
        },
      ],
    });

    expect(canDownloadDocument(session(['viewer'], { sub: 'user-1' }), target)).toBe(true);
    // Metadata detail must also open so the user can reach the download button.
    expect(canViewDocumentDetail(session(['viewer'], { sub: 'user-1' }), target)).toBe(true);
  });

  it('still denies a viewer without any matching ACL on a confidential document', () => {
    const target = doc({ classification: 'CONFIDENTIAL', ownerId: 'owner-1', aclEntries: [] });
    expect(canDownloadDocument(session(['viewer'], { sub: 'user-1' }), target)).toBe(false);
  });

  it('keeps SECRET downloads gated on role tier even with an explicit ACL allow', () => {
    const target = doc({
      classification: 'SECRET',
      ownerId: 'owner-1',
      aclEntries: [
        {
          subjectType: 'USER',
          subjectId: 'user-1',
          permission: 'DOWNLOAD',
          effect: 'ALLOW',
        },
      ],
    });

    expect(canDownloadDocument(session(['viewer'], { sub: 'user-1' }), target)).toBe(false);
  });

  it('blocks compliance preview and lets read deny ACL override approver preview', () => {
    expect(getDocumentAccessDecision(session(['compliance_officer']), doc(), 'preview')).toEqual({
      allowed: false,
      reason: 'Compliance officers cannot preview file content.',
    });

    const target = doc({
      classification: 'SECRET',
      aclEntries: [
        {
          subjectType: 'ROLE',
          subjectId: 'approver',
          permission: 'READ',
          effect: 'DENY',
        },
      ],
    });

    expect(canPreviewDocument(session(['approver']), target)).toBe(false);
  });

  it('lets approvers preview secret documents after ACL deny checks', () => {
    expect(canPreviewDocument(session(['approver']), doc({ classification: 'SECRET' }))).toBe(true);
  });

  it('lets owner preview their own SECRET document regardless of role', () => {
    const secretDoc = doc({ classification: 'SECRET', ownerId: 'user-1' });
    expect(canPreviewDocument(session(['editor'], { sub: 'user-1' }), secretDoc)).toBe(true);
  });

  it('denies non-owner editor from previewing SECRET documents', () => {
    const secretDoc = doc({ classification: 'SECRET', ownerId: 'other-user' });
    expect(canPreviewDocument(session(['editor']), secretDoc)).toBe(false);
  });

  it('denies owner editor from downloading their own SECRET document', () => {
    const secretDoc = doc({ classification: 'SECRET', ownerId: 'user-1' });
    expect(canDownloadDocument(session(['editor'], { sub: 'user-1' }), secretDoc)).toBe(false);
  });

  it('lets baseline readers view and preview archived PUBLIC but not INTERNAL documents', () => {
    const archivedPublic = doc({ status: 'ARCHIVED', classification: 'PUBLIC' });
    const archivedInternal = doc({ status: 'ARCHIVED', classification: 'INTERNAL' });

    // Viewer can access PUBLIC
    expect(canViewDocumentDetail(session(['viewer']), archivedPublic)).toBe(true);
    expect(canPreviewDocument(session(['viewer']), archivedPublic)).toBe(true);
    // Viewer CANNOT access INTERNAL (requires editor+)
    expect(canViewDocumentDetail(session(['viewer']), archivedInternal)).toBe(false);
    expect(canPreviewDocument(session(['viewer']), archivedInternal)).toBe(false);
    // Editor CAN access INTERNAL
    expect(canViewDocumentDetail(session(['editor']), archivedInternal)).toBe(true);
    expect(canPreviewDocument(session(['editor']), archivedInternal)).toBe(true);
    // Viewer cannot download even PUBLIC
    expect(canDownloadDocument(session(['viewer']), archivedPublic)).toBe(false);
  });

  it('models metadata detail access for owner, compliance, classification, and ACL deny cases', () => {
    expect(canViewDocumentDetail(session(['viewer'], { sub: 'owner-1' }), doc({ status: 'DRAFT' }))).toBe(true);
    expect(canViewDocumentDetail(session(['compliance_officer']), doc({ status: 'PENDING' }))).toBe(false);
    expect(canViewDocumentDetail(session(['compliance_officer']), doc({ status: 'ARCHIVED' }))).toBe(true);
    expect(canViewDocumentDetail(session(['viewer']), doc({ classification: 'CONFIDENTIAL' }))).toBe(false);
    expect(
      canViewDocumentDetail(
        session(['admin']),
        doc({
          aclEntries: [
            {
              subjectType: 'ALL',
              permission: 'READ',
              effect: 'DENY',
            },
          ],
        }),
      ),
    ).toBe(false);
  });
});

describe('analytics visibility decisions', () => {
  it('keeps sensitive aggregate analytics behind compliance or admin roles', () => {
    expect(getAnalyticsVisibility(session(['viewer']))).toEqual({
      canViewApprovalAggregates: false,
      canViewRetentionAggregates: false,
      canViewSecurityAggregates: false,
      canViewSensitiveDocumentAggregates: false,
    });

    expect(getAnalyticsVisibility(session(['approver']))).toEqual({
      canViewApprovalAggregates: true,
      canViewRetentionAggregates: false,
      canViewSecurityAggregates: false,
      canViewSensitiveDocumentAggregates: false,
    });

    expect(getAnalyticsVisibility(session(['compliance_officer']))).toEqual({
      canViewApprovalAggregates: false,
      canViewRetentionAggregates: true,
      canViewSecurityAggregates: true,
      canViewSensitiveDocumentAggregates: true,
    });

    expect(getAnalyticsVisibility(session(['admin']))).toEqual({
      canViewApprovalAggregates: true,
      canViewRetentionAggregates: true,
      canViewSecurityAggregates: true,
      canViewSensitiveDocumentAggregates: true,
    });
  });
});
