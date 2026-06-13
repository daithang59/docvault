import { ROUTES } from '@/lib/constants/routes';
import type { ClassificationLevel, DocumentStatus } from '@/types/enums';
import {
  DEFAULT_DOCUMENT_FILTERS,
  serializeDocumentFiltersToSearchParams,
  type DocumentFiltersState,
} from './document-filter-model';
import type { DocumentSavedViewOption } from './document-saved-views';
import type { DocumentListItem } from './documents.types';

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
}

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

export function buildDocumentCommandCenter(
  documents: DocumentListItem[],
  savedViews: DocumentSavedViewOption[] = [],
  options: DocumentCommandCenterOptions = {},
): DocumentCommandCenter {
  const now = options.now ?? new Date();
  const total = documents.length;
  const pendingReview = documents.filter(
    (document) => document.status === 'PENDING',
  ).length;
  const sensitiveDocuments = documents.filter(isSensitiveDocument).length;
  const retentionDueSoon = documents.filter((document) =>
    isRetentionDueSoon(document, now),
  ).length;

  return {
    controlGauge: buildControlGauge(documents, now),
    metrics: [
      {
        key: 'total-documents',
        label: 'Total documents',
        value: total,
        description: 'Visible documents in the current library.',
        tone: 'info',
        href: ROUTES.DOCUMENTS,
      },
      {
        key: 'pending-review',
        label: 'Pending review',
        value: pendingReview,
        description: 'Documents waiting for approval decisions.',
        tone: pendingReview > 0 ? 'warning' : 'success',
        href: buildDocumentsHref({ view: 'pending-review' }),
      },
      {
        key: 'sensitive-documents',
        label: 'Sensitive',
        value: sensitiveDocuments,
        description: 'Confidential, secret, or DLP-detected documents.',
        tone: sensitiveDocuments > 0 ? 'critical' : 'success',
        href: buildDocumentsHref({ view: 'sensitive' }),
      },
      {
        key: 'retention-due-soon',
        label: 'Retention due soon',
        value: retentionDueSoon,
        description: 'Records approaching their retention deadline.',
        tone: retentionDueSoon > 0 ? 'warning' : 'success',
        href: buildDocumentsHref({ search: 'retention:due-soon' }),
      },
    ],
    lifecycleSegments: buildLifecycleSegments(documents),
    classificationSegments: buildClassificationSegments(documents),
    attentionSegments: buildAttentionSegments(documents, now),
    savedViewSegments: buildSavedViewSegments(savedViews, total),
  };
}

function buildControlGauge(
  documents: DocumentListItem[],
  now: Date,
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
      document.dlpStatus === 'DETECTED' ||
      document.status === 'PENDING' ||
      document.status === 'DRAFT' ||
      document.legalHold === true ||
      isRetentionDueSoon(document, now)
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
    description: `${clearDocuments} of ${total} documents have no active DLP, retention, legal hold, or lifecycle handoff cue.`,
    href: ROUTES.DOCUMENTS,
  };
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

  return [
    {
      key: 'dlp-detected',
      label: 'DLP detected',
      value: dlpDetected,
      percentage: toPercentage(dlpDetected, total),
      tone: dlpDetected > 0 ? 'critical' : 'success',
      href: buildDocumentsHref({ search: 'dlp:detected' }),
    },
    {
      key: 'pending-review',
      label: 'Pending review',
      value: pendingReview,
      percentage: toPercentage(pendingReview, total),
      tone: pendingReview > 0 ? 'warning' : 'success',
      href: buildDocumentsHref({ view: 'pending-review' }),
    },
    {
      key: 'retention-due-soon',
      label: 'Retention due soon',
      value: retentionDueSoon,
      percentage: toPercentage(retentionDueSoon, total),
      tone: retentionDueSoon > 0 ? 'warning' : 'success',
      href: buildDocumentsHref({ search: 'retention:due-soon' }),
    },
    {
      key: 'legal-hold',
      label: 'Legal hold',
      value: legalHold,
      percentage: toPercentage(legalHold, total),
      tone: legalHold > 0 ? 'info' : 'success',
      href: buildDocumentsHref({ search: 'has:legal-hold' }),
    },
    {
      key: 'draft-handoff',
      label: 'Draft handoff',
      value: draftHandoff,
      percentage: toPercentage(draftHandoff, total),
      tone: draftHandoff > 0 ? 'info' : 'success',
      href: buildDocumentsHref({ view: 'drafts' }),
    },
  ];
}

function buildSavedViewSegments(
  savedViews: DocumentSavedViewOption[],
  totalDocuments: number,
): DocumentCommandSegment[] {
  return savedViews
    .map((view, index) => ({ view, index }))
    .filter(({ view }) => view.count > 0)
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
