import { ROUTES } from '@/lib/constants/routes';
import type { ClassificationLevel, DocumentStatus } from '@/types/enums';
import {
  DEFAULT_DOCUMENT_FILTERS,
  serializeDocumentFiltersToSearchParams,
  type DocumentQuickViewOption,
  type DocumentSearchSuggestion,
  type DocumentFiltersState,
} from './document-filter-model';
import type { DocumentSavedViewOption } from './document-saved-views';
import type { DocumentListItem } from './documents.types';
import type { AnalyticsVisibility } from '@/lib/auth/permissions';

export type DocumentCommandCenterTone =
  | 'info'
  | 'success'
  | 'warning'
  | 'critical';

export interface DocumentControlGauge {
  label: string;
  value: number;
  tone: DocumentCommandCenterTone;
  description: string;
  href: string;
}

export interface DocumentCommandMetric {
  key:
    | 'total-documents'
    | 'pending-review'
    | 'sensitive-documents'
    | 'retention-due-soon';
  label: string;
  value: number;
  description: string;
  tone: DocumentCommandCenterTone;
  href: string;
}

export interface DocumentCommandSegment {
  key: string;
  label: string;
  value: number;
  percentage: number;
  tone: DocumentCommandCenterTone;
  href?: string;
}

export interface DocumentCommandCenter {
  controlGauge: DocumentControlGauge;
  metrics: DocumentCommandMetric[];
  lifecycleSegments: DocumentCommandSegment[];
  classificationSegments: DocumentCommandSegment[];
  attentionSegments: DocumentCommandSegment[];
  savedViewSegments: DocumentCommandSegment[];
}

export interface DocumentCommandCenterOptions {
  now?: Date;
  analyticsVisibility?: AnalyticsVisibility;
}

const DEFAULT_ANALYTICS_VISIBILITY: AnalyticsVisibility = {
  canViewApprovalAggregates: false,
  canViewRetentionAggregates: false,
  canViewSecurityAggregates: false,
  canViewSensitiveDocumentAggregates: false,
};

const STATUSES: Array<{
  key: DocumentStatus;
  label: string;
  tone: DocumentCommandCenterTone;
}> = [
  { key: 'DRAFT', label: 'Draft', tone: 'info' },
  { key: 'PENDING', label: 'Pending', tone: 'warning' },
  { key: 'PUBLISHED', label: 'Published', tone: 'success' },
  { key: 'ARCHIVED', label: 'Archived', tone: 'info' },
  { key: 'DELETED', label: 'Deleted', tone: 'critical' },
];

const CLASSIFICATIONS: Array<{
  key: ClassificationLevel;
  label: string;
  tone: DocumentCommandCenterTone;
}> = [
  { key: 'PUBLIC', label: 'Public', tone: 'success' },
  { key: 'INTERNAL', label: 'Internal', tone: 'info' },
  { key: 'CONFIDENTIAL', label: 'Confidential', tone: 'warning' },
  { key: 'SECRET', label: 'Secret', tone: 'critical' },
];

export function filterDocumentQuickViewsByAnalyticsVisibility(
  quickViews: DocumentQuickViewOption[],
  visibility: AnalyticsVisibility,
): DocumentQuickViewOption[] {
  return quickViews.filter((view) => {
    if (view.value === 'sensitive') {
      return visibility.canViewSensitiveDocumentAggregates;
    }
    if (view.value === 'pending-review' || view.value === 'needs-action') {
      return visibility.canViewApprovalAggregates;
    }
    return true;
  });
}

export function filterDocumentSavedViewsByAnalyticsVisibility(
  savedViews: DocumentSavedViewOption[],
  visibility: AnalyticsVisibility,
): DocumentSavedViewOption[] {
  return savedViews.filter((view) => isDocumentFilterVisible(view.filters, visibility));
}

export function filterDocumentSearchSuggestionsByAnalyticsVisibility(
  suggestions: DocumentSearchSuggestion[],
  visibility: AnalyticsVisibility,
): DocumentSearchSuggestion[] {
  return suggestions.filter((suggestion) =>
    isDocumentSuggestionVisible(suggestion, visibility),
  );
}

export function buildDocumentCommandCenter(
  documents: DocumentListItem[],
  savedViews: DocumentSavedViewOption[] = [],
  options: DocumentCommandCenterOptions = {},
): DocumentCommandCenter {
  const now = options.now ?? new Date();
  const visibility = options.analyticsVisibility ?? DEFAULT_ANALYTICS_VISIBILITY;
  const total = documents.length;
  const pendingReview = documents.filter(
    (document) => document.status === 'PENDING',
  ).length;
  const sensitiveDocuments = documents.filter(isSensitiveDocument).length;
  const retentionDueSoon = documents.filter((document) =>
    isRetentionDueSoon(document, now),
  ).length;

  return {
    controlGauge: buildControlGauge(documents, now, visibility),
    metrics: [
      {
        key: 'total-documents',
        label: 'Total documents',
        value: total,
        description: 'Visible documents in the current library.',
        tone: 'info',
        href: ROUTES.DOCUMENTS,
      },
      ...(visibility.canViewApprovalAggregates
        ? ([
            {
              key: 'pending-review',
              label: 'Pending review',
              value: pendingReview,
              description: 'Documents waiting for approval decisions.',
              tone: pendingReview > 0 ? 'warning' : 'success',
              href: buildDocumentsHref({ view: 'pending-review' }),
            },
          ] satisfies DocumentCommandMetric[])
        : []),
      ...(visibility.canViewSensitiveDocumentAggregates
        ? ([
            {
              key: 'sensitive-documents',
              label: 'Sensitive',
              value: sensitiveDocuments,
              description: 'Confidential, secret, or DLP-detected documents.',
              tone: sensitiveDocuments > 0 ? 'critical' : 'success',
              href: buildDocumentsHref({ view: 'sensitive' }),
            },
          ] satisfies DocumentCommandMetric[])
        : []),
      ...(visibility.canViewRetentionAggregates
        ? ([
            {
              key: 'retention-due-soon',
              label: 'Retention due soon',
              value: retentionDueSoon,
              description: 'Records approaching their retention deadline.',
              tone: retentionDueSoon > 0 ? 'warning' : 'success',
              href: buildDocumentsHref({ search: 'retention:due-soon' }),
            },
          ] satisfies DocumentCommandMetric[])
        : []),
    ],
    lifecycleSegments: buildLifecycleSegments(documents),
    classificationSegments: visibility.canViewSensitiveDocumentAggregates
      ? buildClassificationSegments(documents)
      : [],
    attentionSegments: buildAttentionSegments(documents, now, visibility),
    savedViewSegments: buildSavedViewSegments(savedViews, total, visibility),
  };
}

function buildControlGauge(
  documents: DocumentListItem[],
  now: Date,
  visibility: AnalyticsVisibility,
): DocumentControlGauge {
  const total = documents.length;

  if (total === 0) {
    return {
      label: 'Control queue clear',
      value: 0,
      tone: 'info',
      description: 'No documents are available for control-center measurement.',
      href: ROUTES.DOCUMENTS,
    };
  }

  const attentionDocumentIds = new Set<string>();
  for (const document of documents) {
    if (
      document.status === 'DRAFT' ||
      (visibility.canViewApprovalAggregates && document.status === 'PENDING') ||
      (visibility.canViewSecurityAggregates && document.dlpStatus === 'DETECTED') ||
      (visibility.canViewSensitiveDocumentAggregates && document.legalHold === true) ||
      (visibility.canViewRetentionAggregates && isRetentionDueSoon(document, now))
    ) {
      attentionDocumentIds.add(document.id);
    }
  }

  const clearDocuments = Math.max(0, total - attentionDocumentIds.size);
  const value = toPercentage(clearDocuments, total);

  return {
    label: 'Control queue clear',
    value,
    tone: value >= 80 ? 'success' : value >= 50 ? 'warning' : 'critical',
    description: buildControlGaugeDescription(clearDocuments, total, visibility),
    href: ROUTES.DOCUMENTS,
  };
}

function buildControlGaugeDescription(
  clearDocuments: number,
  totalDocuments: number,
  visibility: AnalyticsVisibility,
): string {
  if (
    visibility.canViewApprovalAggregates &&
    visibility.canViewRetentionAggregates &&
    visibility.canViewSecurityAggregates &&
    visibility.canViewSensitiveDocumentAggregates
  ) {
    return `${clearDocuments} of ${totalDocuments} documents have no active DLP, retention, legal hold, or lifecycle handoff cue.`;
  }

  const cues = ['draft handoff'];
  if (visibility.canViewApprovalAggregates) cues.unshift('approval');
  if (visibility.canViewSecurityAggregates) cues.unshift('DLP');
  if (visibility.canViewRetentionAggregates) cues.unshift('retention');
  if (visibility.canViewSensitiveDocumentAggregates) cues.unshift('legal hold');

  return `${clearDocuments} of ${totalDocuments} visible documents have no ${formatCueList(cues)} cue.`;
}

function buildLifecycleSegments(
  documents: DocumentListItem[],
): DocumentCommandSegment[] {
  const total = documents.length;

  return STATUSES.map((status) => {
    const value = documents.filter(
      (document) => document.status === status.key,
    ).length;

    return {
      key: status.key,
      label: status.label,
      value,
      percentage: toPercentage(value, total),
      tone: status.tone,
      href: buildDocumentsHref({ status: status.key }),
    };
  });
}

function buildClassificationSegments(
  documents: DocumentListItem[],
): DocumentCommandSegment[] {
  const total = documents.length;

  return CLASSIFICATIONS.map((classification) => {
    const value = documents.filter(
      (document) => document.classification === classification.key,
    ).length;

    return {
      key: classification.key,
      label: classification.label,
      value,
      percentage: toPercentage(value, total),
      tone: classification.tone,
      href: buildDocumentsHref({ classification: classification.key }),
    };
  });
}

function buildAttentionSegments(
  documents: DocumentListItem[],
  now: Date,
  visibility: AnalyticsVisibility,
): DocumentCommandSegment[] {
  const total = documents.length;
  const dlpDetected = documents.filter(
    (document) => document.dlpStatus === 'DETECTED',
  ).length;
  const pendingReview = documents.filter(
    (document) => document.status === 'PENDING',
  ).length;
  const retentionDueSoon = documents.filter((document) =>
    isRetentionDueSoon(document, now),
  ).length;
  const legalHold = documents.filter(
    (document) => document.legalHold === true,
  ).length;
  const draftHandoff = documents.filter(
    (document) => document.status === 'DRAFT',
  ).length;

  const segments: DocumentCommandSegment[] = [];

  if (visibility.canViewSecurityAggregates) {
    segments.push({
      key: 'dlp-detected',
      label: 'DLP detected',
      value: dlpDetected,
      percentage: toPercentage(dlpDetected, total),
      tone: dlpDetected > 0 ? 'critical' : 'success',
      href: buildDocumentsHref({ search: 'dlp:detected' }),
    });
  }

  if (visibility.canViewApprovalAggregates) {
    segments.push({
      key: 'pending-review',
      label: 'Pending review',
      value: pendingReview,
      percentage: toPercentage(pendingReview, total),
      tone: pendingReview > 0 ? 'warning' : 'success',
      href: buildDocumentsHref({ view: 'pending-review' }),
    });
  }

  if (visibility.canViewRetentionAggregates) {
    segments.push({
      key: 'retention-due-soon',
      label: 'Retention due soon',
      value: retentionDueSoon,
      percentage: toPercentage(retentionDueSoon, total),
      tone: retentionDueSoon > 0 ? 'warning' : 'success',
      href: buildDocumentsHref({ search: 'retention:due-soon' }),
    });
  }

  if (visibility.canViewSensitiveDocumentAggregates) {
    segments.push({
      key: 'legal-hold',
      label: 'Legal hold',
      value: legalHold,
      percentage: toPercentage(legalHold, total),
      tone: legalHold > 0 ? 'info' : 'success',
      href: buildDocumentsHref({ search: 'has:legal-hold' }),
    });
  }

  segments.push({
    key: 'draft-handoff',
    label: 'Draft handoff',
    value: draftHandoff,
    percentage: toPercentage(draftHandoff, total),
    tone: draftHandoff > 0 ? 'info' : 'success',
    href: buildDocumentsHref({ view: 'drafts' }),
  });

  return segments;
}

function buildSavedViewSegments(
  savedViews: DocumentSavedViewOption[],
  totalDocuments: number,
  visibility: AnalyticsVisibility,
): DocumentCommandSegment[] {
  return savedViews
    .map((view, index) => ({ view, index }))
    .filter(({ view }) => view.count > 0 && isSavedViewVisible(view, visibility))
    .sort((left, right) => {
      const countDiff = right.view.count - left.view.count;
      return countDiff === 0 ? left.index - right.index : countDiff;
    })
    .slice(0, 4)
    .map(({ view }) => ({
      key: view.id,
      label: view.label,
      value: view.count,
      percentage: toPercentage(view.count, totalDocuments),
      tone: getSavedViewTone(view),
      href: buildDocumentsHref(view.filters),
    }));
}

function getSavedViewTone(
  view: DocumentSavedViewOption,
): DocumentCommandCenterTone {
  if (view.filters.view === 'sensitive') return 'critical';
  if (view.filters.view === 'pending-review') return 'warning';
  if (view.filters.view === 'needs-action') return 'warning';
  if (view.filters.view === 'published') return 'success';
  return 'info';
}

function isSavedViewVisible(
  view: DocumentSavedViewOption,
  visibility: AnalyticsVisibility,
): boolean {
  return isDocumentFilterVisible(view.filters, visibility);
}

function isDocumentFilterVisible(
  filters: DocumentFiltersState,
  visibility: AnalyticsVisibility,
): boolean {
  const search = filters.search.toLowerCase();
  const sensitiveView =
    filters.view === 'sensitive' ||
    filters.classification === 'CONFIDENTIAL' ||
    filters.classification === 'SECRET' ||
    search.includes('dlp:') ||
    search.includes('tag:security') ||
    search.includes('has:legal-hold') ||
    search.includes('class:confidential') ||
    search.includes('class:secret') ||
    search.includes('classification:confidential') ||
    search.includes('classification:secret');
  const approvalView =
    filters.view === 'pending-review' ||
    filters.view === 'needs-action' ||
    filters.status === 'PENDING' ||
    search.includes('status:pending');
  const retentionView = search.includes('retention:');

  if (sensitiveView && !visibility.canViewSensitiveDocumentAggregates) return false;
  if (approvalView && !visibility.canViewApprovalAggregates) return false;
  if (retentionView && !visibility.canViewRetentionAggregates) return false;

  return true;
}

function isDocumentSuggestionVisible(
  suggestion: DocumentSearchSuggestion,
  visibility: AnalyticsVisibility,
): boolean {
  const token = suggestion.token.toLowerCase();

  if (suggestion.kind === 'dlp') return visibility.canViewSecurityAggregates;
  if (suggestion.kind === 'retention') return visibility.canViewRetentionAggregates;
  if (suggestion.kind === 'classification') {
    return visibility.canViewSensitiveDocumentAggregates;
  }
  if (suggestion.kind === 'status' && token.includes('status:pending')) {
    return visibility.canViewApprovalAggregates;
  }
  if (suggestion.kind === 'presence' && token.includes('legal-hold')) {
    return visibility.canViewSensitiveDocumentAggregates;
  }
  if (suggestion.kind === 'tag' && token.includes('security')) {
    return visibility.canViewSensitiveDocumentAggregates;
  }

  return true;
}

function formatCueList(cues: string[]): string {
  if (cues.length <= 1) return cues[0] ?? 'visible';
  if (cues.length === 2) return `${cues[0]} or ${cues[1]}`;
  return `${cues.slice(0, -1).join(', ')}, or ${cues[cues.length - 1]}`;
}

function isSensitiveDocument(document: DocumentListItem): boolean {
  return (
    document.classification === 'CONFIDENTIAL' ||
    document.classification === 'SECRET' ||
    document.dlpStatus === 'DETECTED'
  );
}

function isRetentionDueSoon(document: DocumentListItem, now: Date): boolean {
  if (
    !document.retentionUntil ||
    document.status === 'ARCHIVED' ||
    document.status === 'DELETED'
  ) {
    return false;
  }

  const retentionTime = new Date(document.retentionUntil).getTime();
  if (!Number.isFinite(retentionTime)) return false;

  const nowTime = now.getTime();
  const dueSoonLimit = nowTime + 30 * 24 * 60 * 60 * 1000;
  return retentionTime >= nowTime && retentionTime <= dueSoonLimit;
}

function buildDocumentsHref(filters: Partial<DocumentFiltersState> = {}): string {
  const params = serializeDocumentFiltersToSearchParams({
    ...DEFAULT_DOCUMENT_FILTERS,
    ...filters,
  });
  const query = params.toString();
  return query ? `${ROUTES.DOCUMENTS}?${query}` : ROUTES.DOCUMENTS;
}

function toPercentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}
