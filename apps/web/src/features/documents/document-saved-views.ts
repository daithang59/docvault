import {
  DEFAULT_DOCUMENT_FILTERS,
  filterAndSortDocuments,
  parseDocumentFiltersFromSearchParams,
  serializeDocumentFiltersToSearchParams,
  type DocumentFiltersState,
} from './document-filter-model';
import type { DocumentListItem } from './documents.types';

export type DocumentSavedViewSource = 'built-in' | 'custom';

export interface DocumentSavedView {
  id: string;
  label: string;
  description: string;
  source: DocumentSavedViewSource;
  filters: DocumentFiltersState;
}

export interface DocumentSavedViewOption extends DocumentSavedView {
  count: number;
}

export const DOCUMENT_SAVED_VIEWS_STORAGE_KEY =
  'docvault.documents.savedViews';

export const BUILT_IN_DOCUMENT_SAVED_VIEWS: DocumentSavedView[] = [
  {
    id: 'saved-pending-review',
    label: 'Pending review',
    description: 'Documents waiting for approval, sorted by latest activity.',
    source: 'built-in',
    filters: {
      ...DEFAULT_DOCUMENT_FILTERS,
      view: 'pending-review',
    },
  },
  {
    id: 'saved-action-queue',
    label: 'Action queue',
    description: 'Drafts and pending items that need the next lifecycle action.',
    source: 'built-in',
    filters: {
      ...DEFAULT_DOCUMENT_FILTERS,
      view: 'needs-action',
    },
  },
  {
    id: 'saved-security-triage',
    label: 'Security triage',
    description: 'Pending security-tagged documents needing focused review.',
    source: 'built-in',
    filters: {
      ...DEFAULT_DOCUMENT_FILTERS,
      view: 'pending-review',
      search: 'tag:security',
    },
  },
  {
    id: 'saved-sensitive-attention',
    label: 'Sensitive attention',
    description: 'Confidential, secret, or DLP-detected documents.',
    source: 'built-in',
    filters: {
      ...DEFAULT_DOCUMENT_FILTERS,
      view: 'sensitive',
    },
  },
  {
    id: 'saved-draft-handoff',
    label: 'Draft handoff',
    description: 'Drafts that still need preparation before submission.',
    source: 'built-in',
    filters: {
      ...DEFAULT_DOCUMENT_FILTERS,
      view: 'drafts',
    },
  },
  {
    id: 'saved-recently-published',
    label: 'Recently published',
    description: 'Approved documents ordered by latest publish activity.',
    source: 'built-in',
    filters: {
      ...DEFAULT_DOCUMENT_FILTERS,
      view: 'published',
    },
  },
  {
    id: 'saved-confidential-library',
    label: 'Confidential library',
    description: 'Confidential documents grouped for policy inspection.',
    source: 'built-in',
    filters: {
      ...DEFAULT_DOCUMENT_FILTERS,
      classification: 'CONFIDENTIAL',
      sort: 'title',
      sortDir: 'asc',
    },
  },
];

export function buildDocumentSavedViewOptions(
  documents: DocumentListItem[],
  customViews: DocumentSavedView[] = [],
): DocumentSavedViewOption[] {
  return [...BUILT_IN_DOCUMENT_SAVED_VIEWS, ...customViews].map((view) => ({
    ...view,
    count: filterAndSortDocuments(documents, view.filters).length,
  }));
}

export function createCustomDocumentSavedView(
  label: string,
  filters: DocumentFiltersState,
  {
    generatedAt = new Date().toISOString(),
  }: {
    generatedAt?: string;
  } = {},
): DocumentSavedView {
  const normalizedLabel = normalizeLabel(label);
  const timestamp = timestampSlug(generatedAt);

  return {
    id: `custom-${slugify(normalizedLabel)}-${timestamp}`,
    label: normalizedLabel,
    description: 'Saved from the current document workbench filters.',
    source: 'custom',
    filters: normalizeFilters(filters),
  };
}

export function serializeCustomDocumentSavedViews(
  views: DocumentSavedView[],
): string {
  return JSON.stringify(
    views
      .filter((view) => view.source === 'custom')
      .map((view) => ({
        id: view.id,
        label: view.label,
        description: view.description,
        source: view.source,
        filters: view.filters,
      })),
  );
}

export function parseCustomDocumentSavedViews(
  value: string | null | undefined,
): DocumentSavedView[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item) => {
      const view = parseCustomView(item);
      return view ? [view] : [];
    });
  } catch {
    return [];
  }
}

export function findMatchingDocumentSavedViewId(
  views: DocumentSavedView[],
  filters: DocumentFiltersState,
): string | null {
  const serializedFilters = stableFilterKey(filters);
  return (
    views.find((view) => stableFilterKey(view.filters) === serializedFilters)
      ?.id ?? null
  );
}

function parseCustomView(value: unknown): DocumentSavedView | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<DocumentSavedView>;

  if (
    typeof item.id !== 'string' ||
    !item.id.startsWith('custom-') ||
    typeof item.label !== 'string' ||
    !item.label.trim() ||
    item.source !== 'custom' ||
    !item.filters
  ) {
    return null;
  }

  const filters = parseFilters(item.filters);
  if (!filters) return null;

  return {
    id: item.id,
    label: normalizeLabel(item.label),
    description:
      typeof item.description === 'string' && item.description.trim()
        ? item.description.trim()
        : 'Saved from the current document workbench filters.',
    source: 'custom',
    filters,
  };
}

function parseFilters(value: unknown): DocumentFiltersState | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<DocumentFiltersState>;
  const params = serializeDocumentFiltersToSearchParams({
    ...DEFAULT_DOCUMENT_FILTERS,
    view: candidate.view ?? DEFAULT_DOCUMENT_FILTERS.view,
    search: candidate.search ?? '',
    status: candidate.status ?? '',
    classification: candidate.classification ?? '',
    folder: candidate.folder ?? '',
    ownerId: candidate.ownerId ?? '',
    tag: candidate.tag ?? '',
    sort: candidate.sort ?? DEFAULT_DOCUMENT_FILTERS.sort,
    sortDir: candidate.sortDir ?? DEFAULT_DOCUMENT_FILTERS.sortDir,
  });
  const parsed = parseDocumentFiltersFromSearchParams(params);

  const invalidStatus =
    candidate.status &&
    candidate.status !== parsed.status;
  const invalidClassification =
    candidate.classification &&
    candidate.classification !== parsed.classification;
  const invalidView =
    candidate.view &&
    candidate.view !== parsed.view;

  if (invalidStatus || invalidClassification || invalidView) {
    return null;
  }

  return parsed;
}

function normalizeFilters(filters: DocumentFiltersState): DocumentFiltersState {
  return parseDocumentFiltersFromSearchParams(
    serializeDocumentFiltersToSearchParams(filters),
  );
}

function stableFilterKey(filters: DocumentFiltersState): string {
  return serializeDocumentFiltersToSearchParams(normalizeFilters(filters)).toString();
}

function normalizeLabel(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ').slice(0, 48);
  return normalized || 'Saved view';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'view';
}

function timestampSlug(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return slugify(value) || 'manual';
  }

  return date.toISOString().replace(/\D/g, '').slice(0, 14);
}
