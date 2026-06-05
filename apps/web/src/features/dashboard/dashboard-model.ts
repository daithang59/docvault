import { ROUTES } from '@/lib/constants/routes';
import type { DocumentListItem } from '@/features/documents/documents.types';

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
  updatedAt: string;
  href: string;
  tone: DashboardWidgetTone;
}

export interface DashboardModel {
  stats: DashboardStats;
  operationalWidgets: DashboardOperationalWidget[];
  workQueue: DashboardWorkQueueItem[];
  recentDocuments: DocumentListItem[];
}

interface DashboardModelOptions {
  unreadNotifications?: number;
  now?: Date;
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

  return {
    stats,
    operationalWidgets: [
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
        value: dlpDetected.length,
        description: 'Sensitive findings that need review.',
        href: ROUTES.SECURITY,
        tone: dlpDetected.length > 0 ? 'critical' : 'success',
      },
      {
        key: 'retention-due-soon',
        label: 'Retention due soon',
        value: retentionDueSoon.length,
        description: 'Records approaching their retention deadline.',
        href: ROUTES.RETENTION,
        tone: retentionDueSoon.length > 0 ? 'warning' : 'success',
      },
      {
        key: 'unread-notifications',
        label: 'Unread notifications',
        value: options.unreadNotifications ?? 0,
        description: 'Actionable workflow and compliance queue items.',
        href: ROUTES.NOTIFICATIONS,
        tone: (options.unreadNotifications ?? 0) > 0 ? 'info' : 'success',
      },
    ],
    workQueue: buildWorkQueue(documents, now),
    recentDocuments: sortByUpdatedDesc(documents).slice(0, 5),
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
): DashboardWorkQueueItem[] {
  return sortByUpdatedDesc(documents)
    .flatMap((document) => {
      const queueItem = buildWorkQueueItem(document, now);
      return queueItem ? [queueItem] : [];
    })
    .slice(0, 6);
}

function buildWorkQueueItem(
  document: DocumentListItem,
  now: Date,
): DashboardWorkQueueItem | null {
  const hasDlp = document.dlpStatus === 'DETECTED';
  const dueSoon = isRetentionDueSoon(document, now);

  if (document.status === 'PENDING' && hasDlp) {
    return toQueueItem(document, 'Approval and security review', 'critical');
  }
  if (document.status === 'PENDING') {
    return toQueueItem(document, 'Pending approval', 'warning');
  }
  if (document.status === 'DRAFT') {
    return toQueueItem(document, 'Draft handoff', 'info');
  }
  if (hasDlp) {
    return toQueueItem(document, 'Security triage', 'critical');
  }
  if (dueSoon) {
    return toQueueItem(document, 'Retention review', 'warning');
  }

  return null;
}

function toQueueItem(
  document: DocumentListItem,
  reason: string,
  tone: DashboardWidgetTone,
): DashboardWorkQueueItem {
  return {
    documentId: document.id,
    title: document.title,
    reason,
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

function sortByUpdatedDesc(documents: DocumentListItem[]): DocumentListItem[] {
  return [...documents].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}
