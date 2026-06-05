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

export type DocumentQuickView =
  | 'all'
  | 'needs-action'
  | 'drafts'
  | 'pending-review'
  | 'published'
  | 'sensitive';

export interface DocumentFiltersState {
  view: DocumentQuickView;
  search: string;
  status: DocumentStatus | '';
  classification: ClassificationLevel | '';
  folder: string;
  ownerId: string;
  tag: string;
  sort: DocumentSortField;
  sortDir: DocumentSortDirection;
}

export interface DocumentFilterOptions {
  owners: Array<{ value: string; label: string }>;
  tags: string[];
  folders: Array<{ value: string; label: string; count: number }>;
}

export interface DocumentFilterChip {
  key: keyof DocumentFiltersState;
  label: string;
}

export interface DocumentQuickViewOption {
  value: DocumentQuickView;
  label: string;
  description: string;
  count: number;
}

export type DocumentSearchSuggestionKind =
  | 'status'
  | 'classification'
  | 'tag'
  | 'file'
  | 'owner'
  | 'presence'
  | 'dlp'
  | 'retention';

export interface DocumentSearchSuggestion {
  token: string;
  label: string;
  description: string;
  kind: DocumentSearchSuggestionKind;
}

export const DEFAULT_DOCUMENT_FILTERS: DocumentFiltersState = {
  view: 'all',
  search: '',
  status: '',
  classification: '',
  folder: '',
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

const QUICK_VIEW_DEFINITIONS: Array<Omit<DocumentQuickViewOption, 'count'>> = [
  {
    value: 'all',
    label: 'All',
    description: 'All visible documents.',
  },
  {
    value: 'needs-action',
    label: 'Needs action',
    description: 'Drafts and pending review items.',
  },
  {
    value: 'drafts',
    label: 'Drafts',
    description: 'Documents still being prepared.',
  },
  {
    value: 'pending-review',
    label: 'Pending review',
    description: 'Documents waiting for approval.',
  },
  {
    value: 'published',
    label: 'Published',
    description: 'Approved documents available by policy.',
  },
  {
    value: 'sensitive',
    label: 'Sensitive',
    description: 'Confidential, secret, or DLP-detected documents.',
  },
];

export function filterAndSortDocuments(
  documents: DocumentListItem[],
  filters: DocumentFiltersState,
): DocumentListItem[] {
  const query = parseAdvancedDocumentQuery(filters.search);

  return documents
    .filter((document) => {
      if (!documentMatchesQuickView(document, filters.view)) return false;
      if (!documentMatchesAdvancedQuery(document, query)) return false;
      if (filters.status && document.status !== filters.status) return false;
      if (
        filters.classification &&
        document.classification !== filters.classification
      ) {
        return false;
      }
      if (filters.folder && !document.tags.includes(filters.folder)) return false;
      if (filters.ownerId && document.ownerId !== filters.ownerId) return false;
      if (filters.tag && !document.tags.includes(filters.tag)) return false;
      return true;
    })
    .sort((left, right) => compareDocuments(left, right, filters));
}

export function buildDocumentQuickViewOptions(
  documents: DocumentListItem[],
): DocumentQuickViewOption[] {
  return QUICK_VIEW_DEFINITIONS.map((view) => ({
    ...view,
    count: documents.filter((document) =>
      documentMatchesQuickView(document, view.value),
    ).length,
  }));
}

export function buildDocumentFilterOptions(
  documents: DocumentListItem[],
): DocumentFilterOptions {
  const ownersById = new Map<string, string>();
  const tags = new Set<string>();
  const folderCounts = new Map<string, number>();

  for (const document of documents) {
    if (document.ownerId && !ownersById.has(document.ownerId)) {
      ownersById.set(document.ownerId, document.ownerDisplay ?? document.ownerId);
    }
    for (const tag of document.tags) {
      const normalizedTag = tag.trim();
      if (!normalizedTag) continue;
      tags.add(normalizedTag);
      folderCounts.set(normalizedTag, (folderCounts.get(normalizedTag) ?? 0) + 1);
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
    folders: Array.from(folderCounts.entries())
      .map(([value, count]) => ({
        value,
        label: formatEnum(value),
        count,
      }))
      .sort((left, right) =>
        left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }),
      ),
  };
}

export function buildDocumentSearchSuggestions(
  documents: DocumentListItem[],
): DocumentSearchSuggestion[] {
  const suggestions: DocumentSearchSuggestion[] = [];

  if (documents.some((document) => document.status === 'PENDING')) {
    suggestions.push({
      token: 'status:pending',
      label: 'status:pending',
      description: 'Pending review queue',
      kind: 'status',
    });
  }

  if (documents.some((document) => document.classification === 'CONFIDENTIAL')) {
    suggestions.push({
      token: 'class:confidential',
      label: 'class:confidential',
      description: 'Confidential library',
      kind: 'classification',
    });
  }

  const preferredTag =
    findFirstTag(documents, 'security') ?? findFirstTag(documents);
  if (preferredTag) {
    suggestions.push({
      token: `tag:${quoteQueryTokenValue(preferredTag)}`,
      label: `tag:${quoteQueryTokenValue(preferredTag)}`,
      description: `${formatEnum(preferredTag)} folder`,
      kind: 'tag',
    });
  }

  const fileDocument = documents.find((document) => document.filename);
  if (fileDocument?.filename) {
    suggestions.push({
      token: `file:${quoteQueryTokenValue(fileDocument.filename)}`,
      label: `file:${quoteQueryTokenValue(fileDocument.filename)}`,
      description: 'Latest file lookup',
      kind: 'file',
    });
  }

  if (documents.some(documentHasFile)) {
    suggestions.push({
      token: 'has:file',
      label: 'has:file',
      description: 'Documents with uploaded files',
      kind: 'presence',
    });
  }

  if (documents.some((document) => document.dlpStatus === 'DETECTED')) {
    suggestions.push({
      token: 'dlp:detected',
      label: 'dlp:detected',
      description: 'DLP-detected documents',
      kind: 'dlp',
    });
  }

  if (documents.some((document) => matchesRetentionOperator(document, 'due-soon'))) {
    suggestions.push({
      token: 'retention:due-soon',
      label: 'retention:due-soon',
      description: 'Retention deadlines due soon',
      kind: 'retention',
    });
  }

  const ownerDocument = documents.find(
    (document) => document.ownerDisplay || document.ownerId,
  );
  const ownerLabel = ownerDocument?.ownerDisplay ?? ownerDocument?.ownerId;
  if (ownerLabel) {
    suggestions.push({
      token: `owner:${quoteQueryTokenValue(ownerLabel)}`,
      label: `owner:${quoteQueryTokenValue(ownerLabel)}`,
      description: 'Owner handoff',
      kind: 'owner',
    });
  }

  return uniqueSearchSuggestions(suggestions).slice(0, 8);
}

export function countActiveDocumentFilters(
  filters: DocumentFiltersState,
): number {
  return getActiveDocumentFilterChips(filters, {
    owners: [],
    tags: [],
    folders: [],
  }).length;
}

export function getActiveDocumentFilterChips(
  filters: DocumentFiltersState,
  options: DocumentFilterOptions,
): DocumentFilterChip[] {
  const chips: DocumentFilterChip[] = [];

  if (filters.view !== 'all') {
    chips.push({
      key: 'view',
      label: `View: ${findQuickViewLabel(filters.view)}`,
    });
  }
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
  if (filters.folder) {
    chips.push({
      key: 'folder',
      label: `Folder: ${findFolderLabel(filters.folder, options)}`,
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
  const view = params.get('view');

  return {
    view: isQuickView(view) ? view : DEFAULT_DOCUMENT_FILTERS.view,
    search: params.get('q') ?? '',
    status: isDocumentStatus(status) ? status : '',
    classification: isClassification(classification) ? classification : '',
    folder: params.get('folder') ?? '',
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
  if (filters.view !== DEFAULT_DOCUMENT_FILTERS.view) {
    params.set('view', filters.view);
  }
  if (filters.status) params.set('status', filters.status);
  if (filters.classification) {
    params.set('classification', filters.classification);
  }
  if (filters.folder) params.set('folder', filters.folder);
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

function documentMatchesQuickView(
  document: DocumentListItem,
  view: DocumentQuickView,
): boolean {
  if (view === 'all') return true;
  if (view === 'needs-action') {
    return document.status === 'DRAFT' || document.status === 'PENDING';
  }
  if (view === 'drafts') return document.status === 'DRAFT';
  if (view === 'pending-review') return document.status === 'PENDING';
  if (view === 'published') return document.status === 'PUBLISHED';
  if (view === 'sensitive') {
    return (
      document.classification === 'CONFIDENTIAL' ||
      document.classification === 'SECRET' ||
      document.dlpStatus === 'DETECTED'
    );
  }
  return true;
}

interface AdvancedDocumentQuery {
  freeText: string[];
  status: string[];
  classification: string[];
  owner: string[];
  tag: string[];
  folder: string[];
  file: string[];
  presence: string[];
  dlp: string[];
  retention: string[];
  dateRanges: DocumentDateRangeQuery[];
}

interface DocumentDateRangeQuery {
  field: 'createdAt' | 'updatedAt' | 'retentionUntil';
  from?: number;
  to?: number;
}

function parseAdvancedDocumentQuery(search: string): AdvancedDocumentQuery {
  const query: AdvancedDocumentQuery = {
    freeText: [],
    status: [],
    classification: [],
    owner: [],
    tag: [],
    folder: [],
    file: [],
    presence: [],
    dlp: [],
    retention: [],
    dateRanges: [],
  };
  const tokenPattern = /(\w+):"([^"]+)"|(\w+):(\S+)|"([^"]+)"|(\S+)/g;
  const matches = search.matchAll(tokenPattern);

  for (const match of matches) {
    const rawKey = match[1] ?? match[3];
    const rawValue = match[2] ?? match[4] ?? match[5] ?? match[6] ?? '';
    const value = normalizeText(rawValue);
    if (!value) continue;

    const key = normalizeText(rawKey);
    if (key === 'status') {
      query.status.push(value);
    } else if (key === 'class' || key === 'classification') {
      query.classification.push(value);
    } else if (key === 'owner') {
      query.owner.push(value);
    } else if (key === 'tag') {
      query.tag.push(value);
    } else if (key === 'folder') {
      query.folder.push(value);
    } else if (key === 'file' || key === 'filename') {
      query.file.push(value);
    } else if (key === 'has') {
      query.presence.push(value);
    } else if (key === 'dlp') {
      query.dlp.push(value);
    } else if (key === 'retention') {
      query.retention.push(value);
    } else if (
      key === 'created' ||
      key === 'updated' ||
      key === 'retentionuntil'
    ) {
      const dateRange = parseDateRangeQuery(key, rawValue);
      if (dateRange) {
        query.dateRanges.push(dateRange);
      }
    } else {
      query.freeText.push(value);
    }
  }

  return query;
}

function documentMatchesAdvancedQuery(
  document: DocumentListItem,
  query: AdvancedDocumentQuery,
): boolean {
  return (
    allQueryTermsMatch(query.freeText, (term) =>
      documentMatchesFreeText(document, term),
    ) &&
    allQueryTermsMatch(query.status, (term) =>
      normalizeEnumText(document.status).includes(normalizeEnumText(term)),
    ) &&
    allQueryTermsMatch(query.classification, (term) =>
      normalizeEnumText(document.classification).includes(normalizeEnumText(term)),
    ) &&
    allQueryTermsMatch(query.owner, (term) =>
      [document.ownerId, document.ownerDisplay].some((value) =>
        normalizeText(value).includes(term),
      ),
    ) &&
    allQueryTermsMatch(query.tag, (term) =>
      document.tags.some((tag) => normalizeText(tag).includes(term)),
    ) &&
    allQueryTermsMatch(query.folder, (term) =>
      document.tags.some((tag) => normalizeText(tag).includes(term)),
    ) &&
    allQueryTermsMatch(query.file, (term) =>
      normalizeText(document.filename).includes(term),
    ) &&
    allQueryTermsMatch(query.presence, (term) =>
      matchesPresenceOperator(document, term),
    ) &&
    allQueryTermsMatch(query.dlp, (term) => matchesDlpOperator(document, term)) &&
    allQueryTermsMatch(query.retention, (term) =>
      matchesRetentionOperator(document, term),
    ) &&
    query.dateRanges.every((range) =>
      matchesDateRange(document[range.field], range),
    )
  );
}

function allQueryTermsMatch(
  terms: string[],
  predicate: (term: string) => boolean,
): boolean {
  return terms.every(predicate);
}

function documentMatchesFreeText(
  document: DocumentListItem,
  query: string,
): boolean {
  return [
    document.title,
    document.description,
    document.filename,
    document.ownerId,
    document.ownerDisplay,
    document.status,
    document.classification,
    ...document.tags,
  ].some((value) => normalizeText(value).includes(query));
}

function documentHasFile(document: DocumentListItem): boolean {
  return Boolean(
    document.filename ||
      document.mimeType ||
      document.fileSize != null ||
      document.currentVersion > 0,
  );
}

function matchesPresenceOperator(
  document: DocumentListItem,
  operator: string,
): boolean {
  const normalized = normalizeEnumText(operator);
  if (normalized === 'file' || normalized === 'files') {
    return documentHasFile(document);
  }
  if (normalized === 'retention') {
    return Boolean(document.retentionClass || document.retentionUntil);
  }
  if (normalized === 'dlp') {
    return document.dlpStatus === 'DETECTED';
  }
  return false;
}

function matchesDlpOperator(
  document: DocumentListItem,
  operator: string,
): boolean {
  const normalized = normalizeEnumText(operator);
  if (normalized === 'detected') return document.dlpStatus === 'DETECTED';
  if (normalized === 'clear') return document.dlpStatus === 'CLEAR';
  if (normalized === 'notscanned') {
    return !document.dlpStatus || document.dlpStatus === 'NOT_SCANNED';
  }
  return normalizeEnumText(document.dlpStatus).includes(normalized);
}

function matchesRetentionOperator(
  document: DocumentListItem,
  operator: string,
): boolean {
  const normalized = normalizeEnumText(operator);
  const retentionTime = document.retentionUntil
    ? new Date(document.retentionUntil).getTime()
    : Number.NaN;
  const hasDeadline = Number.isFinite(retentionTime);
  const now = Date.now();
  const dueSoonLimit = now + 30 * 24 * 60 * 60 * 1000;

  if (normalized === 'unset') {
    return !document.retentionClass && !document.retentionUntil;
  }
  if (normalized === 'overdue') {
    return hasDeadline && retentionTime < now;
  }
  if (normalized === 'duesoon') {
    return hasDeadline && retentionTime >= now && retentionTime <= dueSoonLimit;
  }
  if (normalized === 'active') {
    return hasDeadline && retentionTime > dueSoonLimit;
  }
  if (normalized === 'archived') {
    return document.status === 'ARCHIVED';
  }

  return [document.retentionClass, document.retentionReason].some((value) =>
    normalizeText(value).includes(normalizeText(operator)),
  );
}

function parseDateRangeQuery(
  key: string,
  value: string,
): DocumentDateRangeQuery | null {
  const field =
    key === 'created'
      ? 'createdAt'
      : key === 'updated'
        ? 'updatedAt'
        : 'retentionUntil';
  const trimmed = value.trim();
  if (!trimmed) return null;

  const [rawFrom, rawTo] = trimmed.includes('..')
    ? trimmed.split('..', 2)
    : [trimmed, trimmed];
  const from = rawFrom ? parseDateBound(rawFrom, false) : undefined;
  const to = rawTo ? parseDateBound(rawTo, true) : undefined;

  if (from == null && to == null) return null;
  return {
    field,
    ...(from != null && { from }),
    ...(to != null && { to }),
  };
}

function parseDateBound(value: string, endOfDay: boolean): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
    : trimmed;
  const time = new Date(normalized).getTime();
  return Number.isFinite(time) ? time : null;
}

function matchesDateRange(
  value: string | null | undefined,
  range: DocumentDateRangeQuery,
): boolean {
  const time = value ? new Date(value).getTime() : Number.NaN;
  if (!Number.isFinite(time)) return false;
  if (range.from != null && time < range.from) return false;
  if (range.to != null && time > range.to) return false;
  return true;
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

function findFolderLabel(
  folder: string,
  options: DocumentFilterOptions,
): string {
  return (
    options.folders.find((option) => option.value === folder)?.label ??
    formatEnum(folder)
  );
}

function findQuickViewLabel(view: DocumentQuickView): string {
  return (
    QUICK_VIEW_DEFINITIONS.find((definition) => definition.value === view)
      ?.label ?? formatEnum(view)
  );
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizeEnumText(value: string | null | undefined): string {
  return normalizeText(value).replace(/[_\s-]+/g, '');
}

function formatEnum(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function findFirstTag(
  documents: DocumentListItem[],
  preferred?: string,
): string | null {
  for (const document of documents) {
    for (const tag of document.tags) {
      const normalizedTag = tag.trim();
      if (!normalizedTag) continue;
      if (!preferred || normalizedTag.toLowerCase() === preferred) {
        return normalizedTag;
      }
    }
  }

  return null;
}

function quoteQueryTokenValue(value: string): string {
  return /\s/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

function uniqueSearchSuggestions(
  suggestions: DocumentSearchSuggestion[],
): DocumentSearchSuggestion[] {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = suggestion.token.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function isQuickView(value: string | null): value is DocumentQuickView {
  return QUICK_VIEW_DEFINITIONS.some((view) => view.value === value);
}
