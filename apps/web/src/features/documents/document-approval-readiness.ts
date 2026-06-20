import type { DocumentDetail, DocumentListItem } from './documents.types';

export type ApprovalReadinessStatus = 'ready' | 'needs-attention' | 'blocked';
export type ApprovalReadinessItemState = 'complete' | 'warning' | 'blocked';

export type ApprovalReadinessItemKey =
  | 'file'
  | 'metadata'
  | 'classification'
  | 'tags'
  | 'dlp'
  | 'retention'
  | 'submission';

export interface ApprovalReadinessItem {
  key: ApprovalReadinessItemKey;
  label: string;
  state: ApprovalReadinessItemState;
  detail: string;
}

export interface ApprovalReadiness {
  status: ApprovalReadinessStatus;
  label: string;
  summary: string;
  items: ApprovalReadinessItem[];
}

type ReadinessDocument = DocumentListItem | DocumentDetail;

export function buildDocumentApprovalReadiness(
  document: ReadinessDocument,
): ApprovalReadiness {
  const items: ApprovalReadinessItem[] = [
    buildFileItem(document),
    buildMetadataItem(document),
    buildClassificationItem(document),
    buildTagsItem(document),
    buildDlpItem(document),
    buildRetentionItem(document),
    buildSubmissionItem(document),
  ];

  const status = items.some((item) => item.state === 'blocked')
    ? 'blocked'
    : items.some((item) => item.state === 'warning')
      ? 'needs-attention'
      : 'ready';

  return {
    status,
    label:
      status === 'ready'
        ? 'Ready'
        : status === 'blocked'
          ? 'Blocked'
          : 'Needs attention',
    summary:
      status === 'ready'
        ? 'Ready for approval review.'
        : status === 'blocked'
          ? 'Resolve blocked items before relying on this approval review.'
          : 'Review attention items before approving.',
    items,
  };
}

function buildFileItem(document: ReadinessDocument): ApprovalReadinessItem {
  const hasVersion =
    document.currentVersion > 0 ||
    Boolean(document.filename) ||
    ('versions' in document && (document.versions ?? []).length > 0);

  return {
    key: 'file',
    label: 'File version',
    state: hasVersion ? 'complete' : 'blocked',
    detail: hasVersion
      ? `Current version v${document.currentVersion || 1} is available for review.`
      : 'No uploaded file version is available.',
  };
}

function buildMetadataItem(document: ReadinessDocument): ApprovalReadinessItem {
  const hasTitle = Boolean(document.title.trim());
  const hasDescription = Boolean(document.description?.trim());
  const state = hasTitle && hasDescription ? 'complete' : hasTitle ? 'warning' : 'blocked';

  return {
    key: 'metadata',
    label: 'Metadata',
    state,
    detail:
      state === 'complete'
        ? 'Title and description are present.'
        : hasTitle
          ? 'Description is missing; add context for approvers if needed.'
          : 'Title is missing.',
  };
}

function buildClassificationItem(document: ReadinessDocument): ApprovalReadinessItem {
  return {
    key: 'classification',
    label: 'Classification',
    state: document.classification ? 'complete' : 'blocked',
    detail: document.classification
      ? `${formatEnum(document.classification)} policy will apply.`
      : 'Classification is required before approval.',
  };
}

function buildTagsItem(document: ReadinessDocument): ApprovalReadinessItem {
  const count = document.tags.filter((tag) => tag.trim()).length;

  return {
    key: 'tags',
    label: 'Tags',
    state: count > 0 ? 'complete' : 'warning',
    detail:
      count > 0
        ? `${count} tag${count === 1 ? '' : 's'} help search and evidence grouping.`
        : 'No tags are set; search and evidence grouping will be weaker.',
  };
}

function buildDlpItem(document: ReadinessDocument): ApprovalReadinessItem {
  if (document.dlpStatus === 'DETECTED') {
    return {
      key: 'dlp',
      label: 'DLP',
      state: 'warning',
      detail: 'DLP findings detected; verify classification and handling before approval.',
    };
  }

  return {
    key: 'dlp',
    label: 'DLP',
    state: document.dlpStatus === 'CLEAR' ? 'complete' : 'warning',
    detail:
      document.dlpStatus === 'CLEAR'
        ? 'No DLP findings are currently recorded.'
        : 'DLP scan status is not confirmed in metadata.',
  };
}

function buildRetentionItem(document: ReadinessDocument): ApprovalReadinessItem {
  const hasRetention = Boolean(document.retentionClass || document.retentionUntil);

  return {
    key: 'retention',
    label: 'Retention',
    state: hasRetention ? 'complete' : 'warning',
    detail: hasRetention
      ? document.retentionUntil
        ? `Retention is tracked until ${document.retentionUntil}.`
        : `${document.retentionClass} retention policy is set.`
      : 'No retention class/deadline is visible yet.',
  };
}

function buildSubmissionItem(document: ReadinessDocument): ApprovalReadinessItem {
  if (document.status === 'PENDING') {
    return {
      key: 'submission',
      label: 'Workflow',
      state: 'complete',
      detail: 'Document is submitted and waiting for approval.',
    };
  }

  if (document.status === 'PUBLISHED') {
    return {
      key: 'submission',
      label: 'Workflow',
      state: 'complete',
      detail: 'Document has already been approved and published.',
    };
  }

  return {
    key: 'submission',
    label: 'Workflow',
    state: document.status === 'DRAFT' ? 'warning' : 'complete',
    detail:
      document.status === 'DRAFT'
        ? 'Document is still a draft and has not entered approval.'
        : `${formatEnum(document.status)} workflow state is recorded.`,
  };
}

function formatEnum(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
