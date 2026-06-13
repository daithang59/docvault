import { ROUTES } from '@/lib/constants/routes';
import type { NotificationRecord } from './notifications.api';

export type NotificationGroupKey =
  | 'all'
  | 'approvals'
  | 'retention'
  | 'security'
  | 'documents';

export type NotificationReadState = 'all' | 'unread' | 'read';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical';

export interface NotificationCenterFilter {
  group: NotificationGroupKey;
  readState: NotificationReadState;
}

export interface NotificationGroupSummary {
  key: NotificationGroupKey;
  label: string;
  total: number;
  unread: number;
}

export interface NotificationTarget {
  href: string;
  label: string;
}

export interface NotificationCenterItem extends NotificationRecord {
  group: Exclude<NotificationGroupKey, 'all'>;
  groupLabel: string;
  severity: NotificationSeverity;
  typeLabel: string;
  description: string;
  targetHref: string;
  actionLabel: string;
  workflowSummary?: string;
}

export interface NotificationCenterModel {
  total: number;
  unread: number;
  groupSummaries: NotificationGroupSummary[];
  items: NotificationCenterItem[];
}

const GROUP_LABELS: Record<NotificationGroupKey, string> = {
  all: 'All',
  approvals: 'Approvals',
  retention: 'Retention',
  security: 'Security',
  documents: 'Documents',
};

const TYPE_LABELS: Record<string, string> = {
  SUBMITTED: 'Submitted for review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ARCHIVED: 'Archived',
  DELETED: 'Deleted',
  RETENTION_DUE_SOON: 'Retention due soon',
  RETENTION_OVERDUE: 'Retention overdue',
  SECURITY_RECOMMENDATION_OVERDUE: 'Recommendation overdue',
  MALWARE_BLOCKED: 'Malware blocked',
  DLP_DETECTED: 'DLP detection',
  AUDIT_CHAIN_INVALID: 'Audit chain invalid',
  VERSION_UPLOADED: 'New version uploaded',
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  SUBMITTED: 'A document is waiting for approval.',
  APPROVED: 'A document was published.',
  REJECTED: 'A document was returned to draft.',
  ARCHIVED: 'A document entered archived retention state.',
  DELETED: 'A document was removed from the active workspace.',
  RETENTION_DUE_SOON: 'A retention deadline needs review.',
  RETENTION_OVERDUE: 'A retention deadline is overdue.',
  SECURITY_RECOMMENDATION_OVERDUE:
    'A security recommendation passed its SLA target.',
  MALWARE_BLOCKED: 'A malware upload attempt was blocked.',
  DLP_DETECTED: 'Sensitive content was detected by DLP controls.',
  AUDIT_CHAIN_INVALID: 'Audit tamper-evidence needs investigation.',
  VERSION_UPLOADED: 'A new version was uploaded to a document.',
};

export function buildNotificationCenterModel(
  records: NotificationRecord[],
  filter: NotificationCenterFilter,
): NotificationCenterModel {
  const decorated = records
    .map(toNotificationCenterItem)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const items = decorated.filter((item) => {
    if (filter.group !== 'all' && item.group !== filter.group) {
      return false;
    }
    if (filter.readState === 'unread') {
      return !item.read;
    }
    if (filter.readState === 'read') {
      return item.read;
    }
    return true;
  });

  return {
    total: records.length,
    unread: records.filter((item) => !item.read).length,
    groupSummaries: (Object.keys(GROUP_LABELS) as NotificationGroupKey[]).map(
      (key) => ({
        key,
        label: GROUP_LABELS[key],
        total:
          key === 'all'
            ? decorated.length
            : decorated.filter((item) => item.group === key).length,
        unread:
          key === 'all'
            ? decorated.filter((item) => !item.read).length
            : decorated.filter((item) => item.group === key && !item.read)
                .length,
      }),
    ),
    items,
  };
}

export function toNotificationCenterItem(
  record: NotificationRecord,
): NotificationCenterItem {
  const group = getNotificationGroup(record.type);
  const target = getNotificationTarget(record.type, record.docId);

  return {
    ...record,
    group,
    groupLabel: GROUP_LABELS[group],
    severity: getNotificationSeverity(record.type),
    typeLabel: TYPE_LABELS[record.type] ?? formatTypeLabel(record.type),
    description:
      record.reason ??
      TYPE_DESCRIPTIONS[record.type] ??
      'A document notification needs attention.',
    targetHref: target.href,
    actionLabel: target.label,
    workflowSummary: getWorkflowSummary(record.metadata),
  };
}

export function getNotificationGroup(
  type: string,
): Exclude<NotificationGroupKey, 'all'> {
  if (type === 'SUBMITTED' || type === 'APPROVED' || type === 'REJECTED') {
    return 'approvals';
  }
  if (type === 'ARCHIVED' || type.startsWith('RETENTION_')) {
    return 'retention';
  }
  if (
    type.includes('MALWARE') ||
    type.includes('DLP') ||
    type.includes('SECURITY') ||
    type.includes('AUDIT') ||
    type.includes('CHAIN')
  ) {
    return 'security';
  }
  return 'documents';
}

export function getNotificationSeverity(type: string): NotificationSeverity {
  if (
    type === 'REJECTED' ||
    type === 'DELETED' ||
    type.includes('OVERDUE') ||
    type.includes('MALWARE') ||
    type.includes('INVALID')
  ) {
    return 'critical';
  }
  if (type === 'SUBMITTED' || type.includes('DUE_SOON') || type.includes('DLP')) {
    return 'warning';
  }
  if (type === 'APPROVED') {
    return 'success';
  }
  return 'info';
}

export function getNotificationTarget(
  type: string,
  docId?: string,
): NotificationTarget {
  if (type === 'SUBMITTED') {
    return { href: ROUTES.APPROVALS, label: 'Open approvals' };
  }
  if (type === 'ARCHIVED' || type.startsWith('RETENTION_')) {
    return { href: ROUTES.RETENTION, label: 'Open retention' };
  }
  if (
    type.includes('MALWARE') ||
    type.includes('DLP') ||
    type.includes('SECURITY')
  ) {
    return { href: ROUTES.SECURITY, label: 'Open security dashboard' };
  }
  if (type.includes('AUDIT') || type.includes('CHAIN')) {
    return { href: ROUTES.AUDIT, label: 'Open audit trail' };
  }
  if (docId) {
    return { href: ROUTES.DOCUMENT_DETAIL(docId), label: 'Open document' };
  }
  return { href: ROUTES.DOCUMENTS, label: 'Open documents' };
}

function formatTypeLabel(type: string): string {
  return type
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function getWorkflowSummary(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const workflow = (metadata as { workflow?: unknown }).workflow;
  if (!workflow || typeof workflow !== 'object') return undefined;

  const {
    fromStatus,
    toStatus,
    actorId,
  } = workflow as {
    fromStatus?: unknown;
    toStatus?: unknown;
    actorId?: unknown;
  };

  if (
    typeof fromStatus !== 'string' ||
    typeof toStatus !== 'string' ||
    typeof actorId !== 'string'
  ) {
    return undefined;
  }

  return `${fromStatus} -> ${toStatus} by ${actorId}`;
}
