import type { ClassificationLevel, DocumentStatus } from '@/types/enums';
import type { DocumentListItem } from './documents.types';

export type DocumentSortField =
  | 'updatedAt'
  | 'createdAt'
  | 'title'
  | 'status'
  | 'classification'
  | 'ownerId';

export type DocumentSortDirection = 'asc' | 'desc';

export interface DocumentFiltersState {
  search: string;
  status: DocumentStatus | '';
  classification: ClassificationLevel | '';
  ownerId: string;
  tag: string;
  sort: DocumentSortField;
  sortDir: DocumentSortDirection;
}

export interface DocumentFilterOptions {
  owners: Array<{ value: string; label: string }>;
  tags: string[];
}

export interface DocumentFilterChip {
  key: keyof DocumentFiltersState;
  label: string;
}

export const DEFAULT_DOCUMENT_FILTERS: DocumentFiltersState = {
  search: '',
  status: '',
  classification: '',
  ownerId: '',
  tag: '',
  sort: 'updatedAt',
  sortDir: 'desc',
};

const DOCUMENT_STATUSES: DocumentStatus[] = [
  'DRAFT',
  'PENDING',
  'PUBLISHED',
  'ARCHIVED',
  'DELETED',
];

const CLASSIFICATIONS: ClassificationLevel[] = [
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'SECRET',
];

const SORT_FIELDS: DocumentSortField[] = [
  'updatedAt',
  'createdAt',
  'title',
  'status',
  'classification',
  'ownerId',
];

export function filterAndSortDocuments(
  documents: DocumentListItem[],
  filters: DocumentFiltersState,
): DocumentListItem[] {
  const query = normalizeText(filters.search);

  return documents
    .filter((document) => {
      if (query && !documentMatchesQuery(document, query)) return false;
      if (filters.status && document.status !== filters.status) return false;
      if (
        filters.classification &&
        document.classification !== filters.classification
      ) {
        return false;
      }
      if (filters.ownerId && document.ownerId !== filters.ownerId) return false;
      if (filters.tag && !document.tags.includes(filters.tag)) return false;
      return true;
    })
    .sort((left, right) => compareDocuments(left, right, filters));
}

export function buildDocumentFilterOptions(
  documents: DocumentListItem[],
): DocumentFilterOptions {
  const ownersById = new Map<string, string>();
  const tags = new Set<string>();

  for (const document of documents) {
    if (document.ownerId && !ownersById.has(document.ownerId)) {
      ownersById.set(document.ownerId, document.ownerDisplay ?? document.ownerId);
    }
    for (const tag of document.tags) {
      if (tag.trim()) tags.add(tag);
    }
  }

  return {
    owners: Array.from(ownersById.entries()).map(([value, label]) => ({
      value,
      label,
    })),
    tags: Array.from(tags).sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: 'base' }),
    ),
  };
}

export function countActiveDocumentFilters(
  filters: DocumentFiltersState,
): number {
  return getActiveDocumentFilterChips(filters, {
    owners: [],
    tags: [],
  }).length;
}

export function getActiveDocumentFilterChips(
  filters: DocumentFiltersState,
  options: DocumentFilterOptions,
): DocumentFilterChip[] {
  const chips: DocumentFilterChip[] = [];

  if (filters.search.trim()) {
    chips.push({ key: 'search', label: `Search: ${filters.search.trim()}` });
  }
  if (filters.status) {
    chips.push({ key: 'status', label: `Status: ${formatEnum(filters.status)}` });
  }
  if (filters.classification) {
    chips.push({
      key: 'classification',
      label: `Classification: ${formatEnum(filters.classification)}`,
    });
  }
  if (filters.ownerId) {
    chips.push({
      key: 'ownerId',
      label: `Owner: ${findOwnerLabel(filters.ownerId, options)}`,
    });
  }
  if (filters.tag) {
    chips.push({ key: 'tag', label: `Tag: ${filters.tag}` });
  }

  return chips;
}

export function describeActiveDocumentFilters(
  filters: DocumentFiltersState,
  options: DocumentFilterOptions,
): string {
  const chips = getActiveDocumentFilterChips(filters, options);
  if (chips.length === 0) {
    return 'No documents are available yet.';
  }
  return `No documents match ${chips.map((chip) => chip.label).join(', ')}.`;
}

export function clearDocumentFilter(
  filters: DocumentFiltersState,
  key: keyof DocumentFiltersState,
): DocumentFiltersState {
  if (key === 'sort') {
    return { ...filters, sort: DEFAULT_DOCUMENT_FILTERS.sort };
  }
  if (key === 'sortDir') {
    return { ...filters, sortDir: DEFAULT_DOCUMENT_FILTERS.sortDir };
  }
  return { ...filters, [key]: DEFAULT_DOCUMENT_FILTERS[key] };
}

export function parseDocumentFiltersFromSearchParams(
  params: URLSearchParams,
): DocumentFiltersState {
  const status = params.get('status');
  const classification = params.get('classification');
  const sort = params.get('sort');
  const sortDir = params.get('dir');

  return {
    search: params.get('q') ?? '',
    status: isDocumentStatus(status) ? status : '',
    classification: isClassification(classification) ? classification : '',
    ownerId: params.get('owner') ?? '',
    tag: params.get('tag') ?? '',
    sort: isSortField(sort) ? sort : DEFAULT_DOCUMENT_FILTERS.sort,
    sortDir: sortDir === 'asc' || sortDir === 'desc' ? sortDir : 'desc',
  };
}

export function serializeDocumentFiltersToSearchParams(
  filters: DocumentFiltersState,
): URLSearchParams {
  const params = new URLSearchParams();
  const search = filters.search.trim();

  if (search) params.set('q', search);
  if (filters.status) params.set('status', filters.status);
  if (filters.classification) {
    params.set('classification', filters.classification);
  }
  if (filters.ownerId) params.set('owner', filters.ownerId);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.sort !== DEFAULT_DOCUMENT_FILTERS.sort) {
    params.set('sort', filters.sort);
  }
  if (filters.sortDir !== DEFAULT_DOCUMENT_FILTERS.sortDir) {
    params.set('dir', filters.sortDir);
  }

  return params;
}

function documentMatchesQuery(
  document: DocumentListItem,
  query: string,
): boolean {
  return [
    document.title,
    document.description,
    document.filename,
    document.ownerId,
    document.ownerDisplay,
    ...document.tags,
  ].some((value) => normalizeText(value).includes(query));
}

function compareDocuments(
  left: DocumentListItem,
  right: DocumentListItem,
  filters: DocumentFiltersState,
): number {
  const direction = filters.sortDir === 'asc' ? 1 : -1;
  const primary = compareField(left, right, filters.sort) * direction;
  if (primary !== 0) return primary;
  return left.title.localeCompare(right.title, undefined, {
    sensitivity: 'base',
  });
}

function compareField(
  left: DocumentListItem,
  right: DocumentListItem,
  field: DocumentSortField,
): number {
  if (field === 'updatedAt' || field === 'createdAt') {
    return (
      new Date(left[field]).getTime() - new Date(right[field]).getTime()
    );
  }

  if (field === 'ownerId') {
    return (left.ownerDisplay ?? left.ownerId).localeCompare(
      right.ownerDisplay ?? right.ownerId,
      undefined,
      { sensitivity: 'base' },
    );
  }

  return String(left[field] ?? '').localeCompare(String(right[field] ?? ''), undefined, {
    sensitivity: 'base',
  });
}

function findOwnerLabel(
  ownerId: string,
  options: DocumentFilterOptions,
): string {
  return options.owners.find((owner) => owner.value === ownerId)?.label ?? ownerId;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function formatEnum(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function isDocumentStatus(value: string | null): value is DocumentStatus {
  return DOCUMENT_STATUSES.includes(value as DocumentStatus);
}

function isClassification(value: string | null): value is ClassificationLevel {
  return CLASSIFICATIONS.includes(value as ClassificationLevel);
}

function isSortField(value: string | null): value is DocumentSortField {
  return SORT_FIELDS.includes(value as DocumentSortField);
}
