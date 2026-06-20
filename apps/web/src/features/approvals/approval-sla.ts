import type { DocumentListItem } from '@/features/documents/documents.types';
import type { ClassificationLevel } from '@/types/enums';

export type ApprovalSlaState = 'on-track' | 'due-soon' | 'overdue';
export type ApprovalSlaFilter = 'all' | ApprovalSlaState;
export type ApprovalSlaSort = 'priority' | 'due-date' | 'queued-time';

export interface ApprovalAssignment {
  id: 'document-approver' | 'security-approver' | 'compliance-review' | 'records-review';
  label: string;
  reason: string;
}

export interface ApprovalSla {
  state: ApprovalSlaState;
  stateLabel: string;
  tone: 'success' | 'warning' | 'danger';
  assignment: ApprovalAssignment;
  queuedAt: string;
  dueAt: string;
  slaHours: number;
  queuedHours: number;
  hoursRemaining: number;
}

export interface ApprovalQueueSlaRow {
  document: DocumentListItem;
  sla: ApprovalSla;
}

export interface ApprovalQueueSlaSummary {
  total: number;
  overdue: number;
  dueSoon: number;
  onTrack: number;
  complianceReview: number;
}

export interface ApprovalQueueSlaModel {
  rows: ApprovalQueueSlaRow[];
  summary: ApprovalQueueSlaSummary;
  filter: ApprovalSlaFilter;
  sort: ApprovalSlaSort;
}

const CLASSIFICATION_SLA_HOURS: Record<ClassificationLevel, number> = {
  PUBLIC: 72,
  INTERNAL: 48,
  CONFIDENTIAL: 24,
  SECRET: 8,
};

export function buildApprovalSla(
  document: DocumentListItem,
  {
    now = new Date().toISOString(),
  }: {
    now?: string;
  } = {},
): ApprovalSla {
  const nowMs = parseDateMs(now);
  const queuedMs = parseDateMs(document.updatedAt);
  const slaHours = getSlaHours(document);
  const dueMs = queuedMs + slaHours * 60 * 60 * 1000;
  const queuedHours = Math.max(0, Math.floor((nowMs - queuedMs) / 3_600_000));
  const hoursRemaining = Math.ceil((dueMs - nowMs) / 3_600_000);
  const dueSoonThreshold = Math.ceil(slaHours / 3);
  const state: ApprovalSlaState =
    hoursRemaining <= 0
      ? 'overdue'
      : hoursRemaining <= dueSoonThreshold
        ? 'due-soon'
        : 'on-track';

  return {
    state,
    stateLabel: getStateLabel(state, hoursRemaining),
    tone:
      state === 'overdue'
        ? 'danger'
        : state === 'due-soon'
          ? 'warning'
          : 'success',
    assignment: buildApprovalAssignment(document),
    queuedAt: new Date(queuedMs).toISOString(),
    dueAt: new Date(dueMs).toISOString(),
    slaHours,
    queuedHours,
    hoursRemaining,
  };
}

export function buildApprovalQueueSlaModel(
  documents: DocumentListItem[],
  {
    now = new Date().toISOString(),
    filter = 'all',
    sort = 'priority',
  }: {
    now?: string;
    filter?: ApprovalSlaFilter;
    sort?: ApprovalSlaSort;
  } = {},
): ApprovalQueueSlaModel {
  const allRows = documents.map<ApprovalQueueSlaRow>((document) => ({
    document,
    sla: buildApprovalSla(document, { now }),
  }));
  const summary = allRows.reduce<ApprovalQueueSlaSummary>(
    (acc, row) => {
      acc.total += 1;
      if (row.sla.state === 'overdue') acc.overdue += 1;
      if (row.sla.state === 'due-soon') acc.dueSoon += 1;
      if (row.sla.state === 'on-track') acc.onTrack += 1;
      if (row.sla.assignment.id === 'compliance-review') acc.complianceReview += 1;
      return acc;
    },
    {
      total: 0,
      overdue: 0,
      dueSoon: 0,
      onTrack: 0,
      complianceReview: 0,
    },
  );

  const rows = allRows
    .filter((row) => filter === 'all' || row.sla.state === filter)
    .sort((a, b) => compareRows(a, b, sort));

  return {
    rows,
    summary,
    filter,
    sort,
  };
}

function getSlaHours(document: DocumentListItem): number {
  const base = CLASSIFICATION_SLA_HOURS[document.classification];
  if (document.dlpStatus === 'DETECTED') {
    return Math.min(base, 12);
  }

  return base;
}

function buildApprovalAssignment(
  document: DocumentListItem,
): ApprovalAssignment {
  if (document.dlpStatus === 'DETECTED') {
    return {
      id: 'compliance-review',
      label: 'Compliance review',
      reason: 'DLP findings need review before approval.',
    };
  }

  if (!document.retentionClass || !document.retentionUntil) {
    return {
      id: 'records-review',
      label: 'Records reviewer',
      reason: 'Retention evidence is incomplete.',
    };
  }

  if (
    document.classification === 'CONFIDENTIAL' ||
    document.classification === 'SECRET'
  ) {
    return {
      id: 'security-approver',
      label: 'Security approver',
      reason: `${document.classification} documents require sensitive-content approval.`,
    };
  }

  return {
    id: 'document-approver',
    label: 'Document approver',
    reason: 'Standard pending document review.',
  };
}

function compareRows(
  a: ApprovalQueueSlaRow,
  b: ApprovalQueueSlaRow,
  sort: ApprovalSlaSort,
): number {
  if (sort === 'queued-time') {
    return parseDateMs(a.sla.queuedAt) - parseDateMs(b.sla.queuedAt);
  }

  if (sort === 'due-date') {
    return parseDateMs(a.sla.dueAt) - parseDateMs(b.sla.dueAt);
  }

  const stateDelta = stateRank(b.sla.state) - stateRank(a.sla.state);
  if (stateDelta !== 0) return stateDelta;

  const assignmentDelta =
    assignmentRank(b.sla.assignment.id) - assignmentRank(a.sla.assignment.id);
  if (assignmentDelta !== 0) return assignmentDelta;

  return parseDateMs(a.sla.dueAt) - parseDateMs(b.sla.dueAt);
}

function stateRank(state: ApprovalSlaState): number {
  if (state === 'overdue') return 3;
  if (state === 'due-soon') return 2;
  return 1;
}

function assignmentRank(assignment: ApprovalAssignment['id']): number {
  if (assignment === 'compliance-review') return 4;
  if (assignment === 'security-approver') return 3;
  if (assignment === 'records-review') return 2;
  return 1;
}

function getStateLabel(
  state: ApprovalSlaState,
  hoursRemaining: number,
): string {
  if (state === 'overdue') {
    return `${Math.abs(hoursRemaining)}h overdue`;
  }

  if (state === 'due-soon') {
    return `${hoursRemaining}h left`;
  }

  return 'On time';
}

function parseDateMs(value: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return Date.now();
  }

  return parsed;
}
