import { ROUTES } from '@/lib/constants/routes';
import type { DocumentListItem } from '@/features/documents/documents.types';
import type { UserRole } from '@/types/enums';

export type DashboardWidgetTone = 'info' | 'success' | 'warning' | 'critical';

export interface DashboardStats {
  total: number;
  DRAFT: number;
  PENDING: number;
  PUBLISHED: number;
  ARCHIVED: number;
}

export interface DashboardOperationalWidget {
  key:
    | 'pending-approvals'
    | 'dlp-detected'
    | 'retention-due-soon'
    | 'unread-notifications';
  label: string;
  value: number;
  description: string;
  href: string;
  tone: DashboardWidgetTone;
}

export interface DashboardWorkQueueItem {
  documentId: string;
  title: string;
  reason: string;
  actionLabel: string;
  roleScope: 'general' | 'owner' | 'approver' | 'compliance' | 'admin';
  updatedAt: string;
  href: string;
  tone: DashboardWidgetTone;
}

export interface DashboardDemoReadinessSignal {
  key:
    | 'lifecycle-coverage'
    | 'approval-workflow'
    | 'evidence-export'
    | 'security-posture';
  label: string;
  value: string;
  description: string;
  tone: DashboardWidgetTone;
  href: string;
}

export interface DashboardDemoReadiness {
  score: number;
  label: string;
  description: string;
  signals: DashboardDemoReadinessSignal[];
}

export interface DashboardGaugeSummary {
  label: string;
  value: number;
  tone: DashboardWidgetTone;
  description: string;
  href: string;
}

export interface DashboardCommandSegment {
  key: string;
  label: string;
  value: number;
  percentage: number;
  tone: DashboardWidgetTone;
  href?: string;
}

export interface DashboardRiskSpotlight {
  label: string;
  value: number;
  tone: DashboardWidgetTone;
  description: string;
  href: string;
}

export interface DashboardCommandCenter {
  readinessGauge: DashboardGaugeSummary;
  lifecycleSegments: DashboardCommandSegment[];
  attentionSegments: DashboardCommandSegment[];
  riskSpotlight: DashboardRiskSpotlight;
}

export interface DashboardModel {
  stats: DashboardStats;
  demoReadiness: DashboardDemoReadiness;
  commandCenter: DashboardCommandCenter;
  operationalWidgets: DashboardOperationalWidget[];
  workQueue: DashboardWorkQueueItem[];
  recentDocuments: DocumentListItem[];
}

interface DashboardModelOptions {
  unreadNotifications?: number;
  now?: Date;
  actor?: {
    id: string;
    roles: UserRole[];
  };
}

export function buildDashboardModel(
  documents: DocumentListItem[],
  options: DashboardModelOptions = {},
): DashboardModel {
  const now = options.now ?? new Date();
  const stats = buildStats(documents);
  const dlpDetected = documents.filter((document) => document.dlpStatus === 'DETECTED');
  const retentionDueSoon = documents.filter((document) =>
    isRetentionDueSoon(document, now),
  );
  const demoReadiness = buildDemoReadiness(documents, stats, dlpDetected, options.actor);
  const operationalWidgets = buildOperationalWidgets(
    stats,
    dlpDetected.length,
    retentionDueSoon.length,
    options.unreadNotifications ?? 0,
  );
  const workQueue = buildWorkQueue(documents, now, options.actor);

  return {
    stats,
    demoReadiness,
    commandCenter: buildCommandCenter(
      documents,
      now,
      stats,
      demoReadiness,
      dlpDetected.length,
      retentionDueSoon.length,
    ),
    operationalWidgets,
    workQueue,
    recentDocuments: sortByUpdatedDesc(documents).slice(0, 5),
  };
}

function buildOperationalWidgets(
  stats: DashboardStats,
  dlpDetected: number,
  retentionDueSoon: number,
  unreadNotifications: number,
): DashboardOperationalWidget[] {
  return [
    {
      key: 'pending-approvals',
      label: 'Pending approvals',
      value: stats.PENDING,
      description: 'Documents waiting for workflow decisions.',
      href: ROUTES.APPROVALS,
      tone: stats.PENDING > 0 ? 'warning' : 'success',
    },
    {
      key: 'dlp-detected',
      label: 'DLP detected',
      value: dlpDetected,
      description: 'Sensitive findings that need review.',
      href: ROUTES.SECURITY,
      tone: dlpDetected > 0 ? 'critical' : 'success',
    },
    {
      key: 'retention-due-soon',
      label: 'Retention due soon',
      value: retentionDueSoon,
      description: 'Records approaching their retention deadline.',
      href: ROUTES.RETENTION,
      tone: retentionDueSoon > 0 ? 'warning' : 'success',
    },
    {
      key: 'unread-notifications',
      label: 'Unread notifications',
      value: unreadNotifications,
      description: 'Actionable workflow and compliance queue items.',
      href: ROUTES.NOTIFICATIONS,
      tone: unreadNotifications > 0 ? 'info' : 'success',
    },
  ];
}

function buildCommandCenter(
  documents: DocumentListItem[],
  now: Date,
  stats: DashboardStats,
  demoReadiness: DashboardDemoReadiness,
  dlpDetected: number,
  retentionDueSoon: number,
): DashboardCommandCenter {
  return {
    readinessGauge: {
      label: 'Business readiness',
      value: demoReadiness.score,
      tone: demoReadiness.score >= 75 ? 'success' : demoReadiness.score >= 50 ? 'warning' : 'info',
      description: demoReadiness.description,
      href: ROUTES.DEMO_KIT,
    },
    lifecycleSegments: buildLifecycleSegments(stats),
    attentionSegments: buildAttentionSegments(documents, now),
    riskSpotlight: buildRiskSpotlight(stats, dlpDetected, retentionDueSoon),
  };
}

function buildLifecycleSegments(stats: DashboardStats): DashboardCommandSegment[] {
  const total = stats.total;

  return [
    {
      key: 'DRAFT',
      label: 'Draft',
      value: stats.DRAFT,
      percentage: toPercentage(stats.DRAFT, total),
      tone: 'info',
      href: ROUTES.DOCUMENTS,
    },
    {
      key: 'PENDING',
      label: 'Pending',
      value: stats.PENDING,
      percentage: toPercentage(stats.PENDING, total),
      tone: 'warning',
      href: ROUTES.APPROVALS,
    },
    {
      key: 'PUBLISHED',
      label: 'Published',
      value: stats.PUBLISHED,
      percentage: toPercentage(stats.PUBLISHED, total),
      tone: 'success',
      href: ROUTES.DOCUMENTS,
    },
    {
      key: 'ARCHIVED',
      label: 'Archived',
      value: stats.ARCHIVED,
      percentage: toPercentage(stats.ARCHIVED, total),
      tone: 'info',
      href: ROUTES.RETENTION,
    },
  ];
}

function buildAttentionSegments(
  documents: DocumentListItem[],
  now: Date,
): DashboardCommandSegment[] {
  const counts = documents.reduce<Record<'critical' | 'warning' | 'info', number>>(
    (acc, document) => {
      if (document.dlpStatus === 'DETECTED') {
        acc.critical += 1;
      } else if (document.status === 'PENDING' || isRetentionDueSoon(document, now)) {
        acc.warning += 1;
      } else if (document.status === 'DRAFT') {
        acc.info += 1;
      }

      return acc;
    },
    { critical: 0, warning: 0, info: 0 },
  );
  const total = counts.critical + counts.warning + counts.info;

  return [
    {
      key: 'critical',
      label: 'Critical',
      value: counts.critical,
      percentage: toPercentage(counts.critical, total),
      tone: 'critical',
      href: ROUTES.SECURITY,
    },
    {
      key: 'warning',
      label: 'Warning',
      value: counts.warning,
      percentage: toPercentage(counts.warning, total),
      tone: 'warning',
      href: ROUTES.APPROVALS,
    },
    {
      key: 'info',
      label: 'Info',
      value: counts.info,
      percentage: toPercentage(counts.info, total),
      tone: 'info',
      href: ROUTES.NOTIFICATIONS,
    },
  ];
}

function buildRiskSpotlight(
  stats: DashboardStats,
  dlpDetected: number,
  retentionDueSoon: number,
): DashboardRiskSpotlight {
  if (dlpDetected > 0) {
    return {
      label: 'DLP triage',
      value: dlpDetected,
      tone: 'critical',
      description: `${dlpDetected} sensitive finding${dlpDetected === 1 ? '' : 's'} needs review.`,
      href: ROUTES.SECURITY,
    };
  }

  if (stats.PENDING > 0) {
    return {
      label: 'Approval queue',
      value: stats.PENDING,
      tone: 'warning',
      description: `${stats.PENDING} document${stats.PENDING === 1 ? '' : 's'} waiting for workflow decisions.`,
      href: ROUTES.APPROVALS,
    };
  }

  if (retentionDueSoon > 0) {
    return {
      label: 'Retention review',
      value: retentionDueSoon,
      tone: 'warning',
      description: `${retentionDueSoon} record${retentionDueSoon === 1 ? '' : 's'} approaching retention deadline.`,
      href: ROUTES.RETENTION,
    };
  }

  return {
    label: 'Operationally clear',
    value: 0,
    tone: 'success',
    description: 'No immediate dashboard risk signals.',
    href: ROUTES.DOCUMENTS,
  };
}

function buildDemoReadiness(
  documents: DocumentListItem[],
  stats: DashboardStats,
  dlpDetected: DocumentListItem[],
  actor?: DashboardModelOptions['actor'],
): DashboardDemoReadiness {
  const governedDocuments = documents.filter(
    (document) => document.status !== 'DRAFT',
  );
  const hasLifecycleCoverage = governedDocuments.length > 0;
  const hasApprovalWorkflow = stats.PENDING > 0;
  const hasSecurityStory = dlpDetected.length > 0;
  const canExportEvidence = Boolean(
    actor?.roles.some((role) => role === 'admin' || role === 'compliance_officer'),
  );
  const signals: DashboardDemoReadinessSignal[] = [
    {
      key: 'lifecycle-coverage',
      label: 'Lifecycle coverage',
      value: `${governedDocuments.length} governed`,
      description: hasLifecycleCoverage
        ? 'Governed documents demonstrate post-draft lifecycle states.'
        : 'Seed pending, published, or archived documents to demonstrate governance.',
      tone: hasLifecycleCoverage ? 'success' : 'warning',
      href: ROUTES.DOCUMENTS,
    },
    {
      key: 'approval-workflow',
      label: 'Approval workflow',
      value: `${stats.PENDING} pending`,
      description: hasApprovalWorkflow
        ? 'Pending items demonstrate approver queue and decision controls.'
        : 'Seed a pending document to demonstrate approver queue controls.',
      tone: hasApprovalWorkflow ? 'warning' : 'info',
      href: ROUTES.APPROVALS,
    },
    {
      key: 'evidence-export',
      label: 'Evidence export',
      value: canExportEvidence ? 'Enabled' : 'Role gated',
      description: canExportEvidence
        ? 'Current role can export metadata-only evidence packets.'
        : 'Compliance Officer or Admin role is required for packet export.',
      tone: canExportEvidence ? 'success' : 'info',
      href: ROUTES.EVIDENCE,
    },
    {
      key: 'security-posture',
      label: 'Security posture',
      value: `${dlpDetected.length} finding${dlpDetected.length === 1 ? '' : 's'}`,
      description: hasSecurityStory
        ? 'DLP findings and policy denies create a security review story.'
        : 'Seed a DLP-detected document to demonstrate security review.',
      tone: hasSecurityStory ? 'critical' : 'info',
      href: ROUTES.SECURITY,
    },
  ];
  const readySignals = [
    hasLifecycleCoverage,
    hasApprovalWorkflow,
    canExportEvidence,
    hasSecurityStory,
  ].filter(Boolean).length;
  const score = Math.round((readySignals / signals.length) * 100);

  return {
    score,
    label: score >= 100 ? 'Demo ready' : score >= 75 ? 'Nearly ready' : 'Needs setup',
    description:
      score >= 100
        ? 'Lifecycle, approval, evidence, and security stories are available.'
        : 'Some commercial demo stories need role access or seeded data.',
    signals,
  };
}

function buildStats(documents: DocumentListItem[]): DashboardStats {
  return documents.reduce<DashboardStats>(
    (acc, document) => {
      acc.total += 1;
      if (document.status === 'DRAFT') acc.DRAFT += 1;
      if (document.status === 'PENDING') acc.PENDING += 1;
      if (document.status === 'PUBLISHED') acc.PUBLISHED += 1;
      if (document.status === 'ARCHIVED') acc.ARCHIVED += 1;
      return acc;
    },
    { total: 0, DRAFT: 0, PENDING: 0, PUBLISHED: 0, ARCHIVED: 0 },
  );
}

function buildWorkQueue(
  documents: DocumentListItem[],
  now: Date,
  actor?: DashboardModelOptions['actor'],
): DashboardWorkQueueItem[] {
  return sortByUpdatedDesc(documents)
    .flatMap((document) => {
      const queueItem = buildWorkQueueItem(document, now, actor);
      return queueItem ? [queueItem] : [];
    })
    .slice(0, 6);
}

function buildWorkQueueItem(
  document: DocumentListItem,
  now: Date,
  actor?: DashboardModelOptions['actor'],
): DashboardWorkQueueItem | null {
  const hasDlp = document.dlpStatus === 'DETECTED';
  const dueSoon = isRetentionDueSoon(document, now);

  if (actor) {
    const roles = new Set(actor.roles);
    const isAdmin = roles.has('admin');
    const isOwner = document.ownerId === actor.id;

    if ((roles.has('compliance_officer') || isAdmin) && hasDlp) {
      return toQueueItem(
        document,
        'Security triage',
        'critical',
        'Inspect evidence',
        isAdmin ? 'admin' : 'compliance',
      );
    }

    if ((roles.has('compliance_officer') || isAdmin) && dueSoon) {
      return toQueueItem(
        document,
        'Retention review',
        'warning',
        'Review retention',
        isAdmin ? 'admin' : 'compliance',
      );
    }

    if ((roles.has('approver') || isAdmin) && document.status === 'PENDING') {
      return toQueueItem(
        document,
        hasDlp ? 'Approval and security review' : 'Pending approval',
        hasDlp ? 'critical' : 'warning',
        'Review decision',
        isAdmin ? 'admin' : 'approver',
      );
    }

    if ((roles.has('editor') || isAdmin) && isOwner && document.status === 'DRAFT') {
      return toQueueItem(
        document,
        'Draft handoff',
        'info',
        'Prepare submission',
        isAdmin ? 'admin' : 'owner',
      );
    }

    return null;
  }

  if (document.status === 'PENDING' && hasDlp) {
    return toQueueItem(
      document,
      'Approval and security review',
      'critical',
      'Review decision',
      'general',
    );
  }
  if (document.status === 'PENDING') {
    return toQueueItem(
      document,
      'Pending approval',
      'warning',
      'Review decision',
      'general',
    );
  }
  if (document.status === 'DRAFT') {
    return toQueueItem(
      document,
      'Draft handoff',
      'info',
      'Prepare submission',
      'general',
    );
  }
  if (hasDlp) {
    return toQueueItem(
      document,
      'Security triage',
      'critical',
      'Inspect evidence',
      'general',
    );
  }
  if (dueSoon) {
    return toQueueItem(
      document,
      'Retention review',
      'warning',
      'Review retention',
      'general',
    );
  }

  return null;
}

function toQueueItem(
  document: DocumentListItem,
  reason: string,
  tone: DashboardWidgetTone,
  actionLabel: string,
  roleScope: DashboardWorkQueueItem['roleScope'],
): DashboardWorkQueueItem {
  return {
    documentId: document.id,
    title: document.title,
    reason,
    actionLabel,
    roleScope,
    updatedAt: document.updatedAt,
    href: ROUTES.DOCUMENT_DETAIL(document.id),
    tone,
  };
}

function isRetentionDueSoon(document: DocumentListItem, now: Date): boolean {
  if (!document.retentionUntil || document.status === 'ARCHIVED') return false;
  const retentionTime = new Date(document.retentionUntil).getTime();
  if (!Number.isFinite(retentionTime)) return false;

  const nowTime = now.getTime();
  const dueSoonLimit = nowTime + 30 * 24 * 60 * 60 * 1000;
  return retentionTime >= nowTime && retentionTime <= dueSoonLimit;
}

function toPercentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function sortByUpdatedDesc(documents: DocumentListItem[]): DocumentListItem[] {
  return [...documents].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}
