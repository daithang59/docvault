import { describe, expect, it } from 'vitest';
import { buildDashboardModel } from './dashboard-model';
import type { DocumentListItem } from '@/features/documents/documents.types';
import type { AnalyticsVisibility } from '@/lib/auth/permissions';

const now = new Date('2026-06-04T09:00:00.000Z');
const elevatedAnalytics: AnalyticsVisibility = {
  canViewApprovalAggregates: true,
  canViewRetentionAggregates: true,
  canViewSecurityAggregates: true,
  canViewSensitiveDocumentAggregates: true,
};
const viewerAnalytics: AnalyticsVisibility = {
  canViewApprovalAggregates: false,
  canViewRetentionAggregates: false,
  canViewSecurityAggregates: false,
  canViewSensitiveDocumentAggregates: false,
};

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
      analyticsVisibility: elevatedAnalytics,
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

  it('prioritizes role-specific work queues with clear next actions', () => {
    const approverModel = buildDashboardModel(documents, {
      now,
      actor: { id: 'approver-1', roles: ['approver'] },
      analyticsVisibility: {
        ...viewerAnalytics,
        canViewApprovalAggregates: true,
      },
    });

    expect(approverModel.workQueue).toEqual([
      expect.objectContaining({
        documentId: 'doc-pending-dlp',
        reason: 'Approval and security review',
        actionLabel: 'Review decision',
        roleScope: 'approver',
      }),
    ]);

    const editorModel = buildDashboardModel(documents, {
      now,
      actor: { id: 'editor-2', roles: ['editor'] },
      analyticsVisibility: viewerAnalytics,
    });

    expect(editorModel.workQueue).toEqual([
      expect.objectContaining({
        documentId: 'doc-draft',
        reason: 'Draft handoff',
        actionLabel: 'Prepare submission',
        roleScope: 'owner',
      }),
    ]);

    const complianceModel = buildDashboardModel(documents, {
      now,
      actor: { id: 'co-1', roles: ['compliance_officer'] },
      analyticsVisibility: {
        ...viewerAnalytics,
        canViewRetentionAggregates: true,
        canViewSecurityAggregates: true,
        canViewSensitiveDocumentAggregates: true,
      },
    });

    expect(complianceModel.workQueue).toEqual([
      expect.objectContaining({
        documentId: 'doc-pending-dlp',
        reason: 'Security triage',
        actionLabel: 'Inspect evidence',
        roleScope: 'compliance',
      }),
    ]);
  });

  it('keeps demo readiness out of the customer-facing dashboard model', () => {
    const model = buildDashboardModel(documents, {
      now,
      actor: { id: 'admin-1', roles: ['admin'] },
      analyticsVisibility: elevatedAnalytics,
    });

    expect(model).not.toHaveProperty('demoReadiness');
    expect(model.commandCenter).not.toHaveProperty('readinessGauge');
  });

  it('prepares command-center visual summaries from real dashboard data', () => {
    const model = buildDashboardModel(documents, {
      unreadNotifications: 3,
      now,
      actor: { id: 'admin-1', roles: ['admin'] },
      analyticsVisibility: elevatedAnalytics,
    });

    expect(model.commandCenter).not.toHaveProperty('readinessGauge');
    expect(model.commandCenter.lifecycleSegments).toEqual([
      expect.objectContaining({
        key: 'DRAFT',
        label: 'Draft',
        value: 1,
        percentage: 25,
        href: '/documents',
        tone: 'info',
      }),
      expect.objectContaining({
        key: 'PENDING',
        label: 'Pending',
        value: 1,
        percentage: 25,
        href: '/approvals',
        tone: 'warning',
      }),
      expect.objectContaining({
        key: 'PUBLISHED',
        label: 'Published',
        value: 1,
        percentage: 25,
        href: '/documents',
        tone: 'success',
      }),
      expect.objectContaining({
        key: 'ARCHIVED',
        label: 'Archived',
        value: 1,
        percentage: 25,
        href: '/retention',
        tone: 'info',
      }),
    ]);
    expect(model.commandCenter.attentionSegments).toEqual([
      expect.objectContaining({
        key: 'critical',
        label: 'Critical',
        value: 1,
        percentage: 50,
        tone: 'critical',
      }),
      expect.objectContaining({
        key: 'warning',
        label: 'Warning',
        value: 0,
        percentage: 0,
        tone: 'warning',
      }),
      expect.objectContaining({
        key: 'info',
        label: 'Info',
        value: 1,
        percentage: 50,
        tone: 'info',
      }),
    ]);
    expect(model.commandCenter).not.toHaveProperty('riskSpotlight');
  });

  it('builds an empty dashboard without demo readiness setup prompts', () => {
    const model = buildDashboardModel([], {
      now,
      actor: { id: 'admin-1', roles: ['admin'] },
      analyticsVisibility: elevatedAnalytics,
    });

    expect(model).not.toHaveProperty('demoReadiness');
    expect(model.commandCenter).not.toHaveProperty('readinessGauge');
    expect(model.commandCenter.lifecycleSegments).toHaveLength(4);
    expect(model.commandCenter.attentionSegments).toEqual([
      expect.objectContaining({ key: 'critical', value: 0 }),
      expect.objectContaining({ key: 'warning', value: 0 }),
      expect.objectContaining({ key: 'info', value: 0 }),
    ]);
  });

  it('does not expose security or retention aggregates to baseline dashboard roles', () => {
    const model = buildDashboardModel(documents, {
      unreadNotifications: 3,
      now,
      actor: { id: 'viewer-1', roles: ['viewer'] },
      analyticsVisibility: viewerAnalytics,
    });

    expect(model.operationalWidgets.map((widget) => widget.key)).not.toContain('dlp-detected');
    expect(model.operationalWidgets.map((widget) => widget.key)).not.toContain('retention-due-soon');
    expect(model.commandCenter.attentionSegments.map((segment) => segment.key)).not.toContain('critical');
    expect(model).not.toHaveProperty('demoReadiness');
  });
});
