import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DOCUMENT_FILTERS,
  buildDocumentFilterOptions,
  buildDocumentQuickViewOptions,
  buildDocumentSearchSuggestions,
  countActiveDocumentFilters,
  describeActiveDocumentFilters,
  filterAndSortDocuments,
  getActiveDocumentFilterChips,
  parseDocumentFiltersFromSearchParams,
  serializeDocumentFiltersToSearchParams,
  type DocumentFiltersState,
} from './document-filter-model';
import type { DocumentListItem } from './documents.types';

const documents: DocumentListItem[] = [
  {
    id: 'doc-1',
    title: 'Board Report',
    description: 'Quarterly finance package',
    status: 'PUBLISHED',
    classification: 'CONFIDENTIAL',
    ownerId: 'owner-1',
    ownerDisplay: 'Nguyen An',
    currentVersion: 2,
    filename: 'board-report.pdf',
    tags: ['finance', 'board'],
    createdAt: '2026-05-01T09:00:00.000Z',
    updatedAt: '2026-06-01T09:00:00.000Z',
  },
  {
    id: 'doc-2',
    title: 'Hiring Plan',
    description: 'People operations',
    status: 'DRAFT',
    classification: 'INTERNAL',
    ownerId: 'owner-2',
    ownerDisplay: 'Le Binh',
    currentVersion: 1,
    filename: 'hiring-plan.docx',
    tags: ['hr'],
    createdAt: '2026-05-02T09:00:00.000Z',
    updatedAt: '2026-05-20T09:00:00.000Z',
  },
  {
    id: 'doc-3',
    title: 'Public Handbook',
    description: 'Company policies',
    status: 'PENDING',
    classification: 'PUBLIC',
    ownerId: 'owner-1',
    ownerDisplay: 'Nguyen An',
    currentVersion: 3,
    filename: 'handbook.pdf',
    tags: ['policy', 'hr'],
    createdAt: '2026-05-03T09:00:00.000Z',
    updatedAt: '2026-06-02T09:00:00.000Z',
  },
  {
    id: 'doc-4',
    title: 'Incident Export',
    description: 'Investigation export with detected sensitive fields',
    status: 'PUBLISHED',
    classification: 'INTERNAL',
    dlpStatus: 'DETECTED',
    ownerId: 'owner-3',
    ownerDisplay: 'Tran Chi',
    currentVersion: 1,
    filename: 'incident-export.csv',
    tags: ['security'],
    createdAt: '2026-05-04T09:00:00.000Z',
    updatedAt: '2026-06-03T09:00:00.000Z',
  },
  {
    id: 'doc-5',
    title: 'Retention Package',
    description: 'Lifecycle evidence due soon',
    status: 'PUBLISHED',
    classification: 'INTERNAL',
    dlpStatus: 'CLEAR',
    retentionClass: 'INTERNAL_365D',
    retentionUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    ownerId: 'owner-4',
    ownerDisplay: 'Pham Dung',
    currentVersion: 0,
    tags: ['records'],
    createdAt: '2026-05-05T09:00:00.000Z',
    updatedAt: '2026-06-04T09:00:00.000Z',
  },
];

describe('filterAndSortDocuments', () => {
  it('combines text, owner, tag, status, and classification filters', () => {
    const filters: DocumentFiltersState = {
      view: 'all',
      search: 'finance',
      ownerId: 'owner-1',
      tag: 'board',
      status: 'PUBLISHED',
      classification: 'CONFIDENTIAL',
      folder: '',
      sort: 'updatedAt',
      sortDir: 'desc',
    };

    expect(filterAndSortDocuments(documents, filters).map((doc) => doc.id)).toEqual([
      'doc-1',
    ]);
  });

  it('searches across title, description, filename, tags, and owner display', () => {
    expect(
      filterAndSortDocuments(documents, {
        ...DEFAULT_DOCUMENT_FILTERS,
        search: 'le binh',
      }).map((doc) => doc.id),
    ).toEqual(['doc-2']);

    expect(
      filterAndSortDocuments(documents, {
        ...DEFAULT_DOCUMENT_FILTERS,
        search: 'handbook.pdf',
      }).map((doc) => doc.id),
    ).toEqual(['doc-3']);
  });

  it('sorts by title and updated time deterministically', () => {
    expect(
      filterAndSortDocuments(documents, {
        ...DEFAULT_DOCUMENT_FILTERS,
        sort: 'title',
        sortDir: 'asc',
      }).map((doc) => doc.title),
    ).toEqual([
      'Board Report',
      'Hiring Plan',
      'Incident Export',
      'Public Handbook',
      'Retention Package',
    ]);

    expect(
      filterAndSortDocuments(documents, DEFAULT_DOCUMENT_FILTERS).map((doc) => doc.id),
    ).toEqual(['doc-5', 'doc-4', 'doc-3', 'doc-1', 'doc-2']);
  });

  it('sorts owners by displayed owner label instead of raw owner id', () => {
    const ownerDocuments: DocumentListItem[] = [
      {
        ...documents[0],
        id: 'doc-z',
        ownerId: '111',
        ownerDisplay: 'Zed Owner',
      },
      {
        ...documents[1],
        id: 'doc-a',
        ownerId: '999',
        ownerDisplay: 'An Owner',
      },
    ];

    expect(
      filterAndSortDocuments(ownerDocuments, {
        ...DEFAULT_DOCUMENT_FILTERS,
        sort: 'ownerId',
        sortDir: 'asc',
      }).map((doc) => doc.id),
    ).toEqual(['doc-a', 'doc-z']);
  });

  it('applies commercial quick views before regular filters and sorting', () => {
    expect(
      filterAndSortDocuments(documents, {
        ...DEFAULT_DOCUMENT_FILTERS,
        view: 'needs-action',
      }).map((doc) => doc.id),
    ).toEqual(['doc-3', 'doc-2']);

    expect(
      filterAndSortDocuments(documents, {
        ...DEFAULT_DOCUMENT_FILTERS,
        view: 'sensitive',
      }).map((doc) => doc.id),
    ).toEqual(['doc-4', 'doc-1']);

    expect(
      filterAndSortDocuments(documents, {
        ...DEFAULT_DOCUMENT_FILTERS,
        view: 'sensitive',
        tag: 'finance',
      }).map((doc) => doc.id),
    ).toEqual(['doc-1']);
  });

  it('supports advanced field search tokens and smart folder filtering', () => {
    expect(
      filterAndSortDocuments(documents, {
        ...DEFAULT_DOCUMENT_FILTERS,
        search: 'status:published class:confidential tag:finance board',
      }).map((doc) => doc.id),
    ).toEqual(['doc-1']);

    expect(
      filterAndSortDocuments(documents, {
        ...DEFAULT_DOCUMENT_FILTERS,
        search: 'owner:"nguyen an" file:handbook.pdf',
      }).map((doc) => doc.id),
    ).toEqual(['doc-3']);

    expect(
      filterAndSortDocuments(documents, {
        ...DEFAULT_DOCUMENT_FILTERS,
        folder: 'security',
      }).map((doc) => doc.id),
    ).toEqual(['doc-4']);
  });

  it('supports commercial query operators for file presence, DLP, retention, and date ranges', () => {
    expect(
      filterAndSortDocuments(documents, {
        ...DEFAULT_DOCUMENT_FILTERS,
        search: 'has:file',
      }).map((doc) => doc.id),
    ).toEqual(['doc-4', 'doc-3', 'doc-1', 'doc-2']);

    expect(
      filterAndSortDocuments(documents, {
        ...DEFAULT_DOCUMENT_FILTERS,
        search: 'dlp:detected',
      }).map((doc) => doc.id),
    ).toEqual(['doc-4']);

    expect(
      filterAndSortDocuments(documents, {
        ...DEFAULT_DOCUMENT_FILTERS,
        search: 'retention:due-soon',
      }).map((doc) => doc.id),
    ).toEqual(['doc-5']);

    expect(
      filterAndSortDocuments(documents, {
        ...DEFAULT_DOCUMENT_FILTERS,
        search: 'created:2026-05-02..2026-05-04 updated:..2026-06-02',
      }).map((doc) => doc.id),
    ).toEqual(['doc-3', 'doc-2']);
  });
});

describe('document filter metadata', () => {
  it('builds query token suggestions from the current document set', () => {
    expect(buildDocumentSearchSuggestions(documents)).toEqual([
      {
        token: 'status:pending',
        label: 'status:pending',
        description: 'Pending review queue',
        kind: 'status',
      },
      {
        token: 'class:confidential',
        label: 'class:confidential',
        description: 'Confidential library',
        kind: 'classification',
      },
      {
        token: 'tag:security',
        label: 'tag:security',
        description: 'Security folder',
        kind: 'tag',
      },
      {
        token: 'file:board-report.pdf',
        label: 'file:board-report.pdf',
        description: 'Latest file lookup',
        kind: 'file',
      },
      {
        token: 'has:file',
        label: 'has:file',
        description: 'Documents with uploaded files',
        kind: 'presence',
      },
      {
        token: 'dlp:detected',
        label: 'dlp:detected',
        description: 'DLP-detected documents',
        kind: 'dlp',
      },
      {
        token: 'retention:due-soon',
        label: 'retention:due-soon',
        description: 'Retention deadlines due soon',
        kind: 'retention',
      },
      {
        token: 'owner:"Nguyen An"',
        label: 'owner:"Nguyen An"',
        description: 'Owner handoff',
        kind: 'owner',
      },
    ]);
  });

  it('builds unique owner/tag options and active chips', () => {
    const options = buildDocumentFilterOptions(documents);

    expect(options.owners).toEqual([
      { value: 'owner-1', label: 'Nguyen An' },
      { value: 'owner-2', label: 'Le Binh' },
      { value: 'owner-3', label: 'Tran Chi' },
      { value: 'owner-4', label: 'Pham Dung' },
    ]);
    expect(options.tags).toEqual([
      'board',
      'finance',
      'hr',
      'policy',
      'records',
      'security',
    ]);
    expect(options.folders).toEqual([
      { value: 'board', label: 'Board', count: 1 },
      { value: 'finance', label: 'Finance', count: 1 },
      { value: 'hr', label: 'Hr', count: 2 },
      { value: 'policy', label: 'Policy', count: 1 },
      { value: 'records', label: 'Records', count: 1 },
      { value: 'security', label: 'Security', count: 1 },
    ]);

    const filters: DocumentFiltersState = {
      ...DEFAULT_DOCUMENT_FILTERS,
      search: 'finance',
      folder: 'finance',
      ownerId: 'owner-1',
      tag: 'board',
      status: 'PUBLISHED',
    };

    expect(countActiveDocumentFilters(filters)).toBe(5);
    expect(getActiveDocumentFilterChips(filters, options)).toEqual([
      { key: 'search', label: 'Search: finance' },
      { key: 'status', label: 'Status: Published' },
      { key: 'folder', label: 'Folder: Finance' },
      { key: 'ownerId', label: 'Owner: Nguyen An' },
      { key: 'tag', label: 'Tag: board' },
    ]);
    expect(describeActiveDocumentFilters(filters, options)).toBe(
      'No documents match Search: finance, Status: Published, Folder: Finance, Owner: Nguyen An, Tag: board.',
    );
  });

  it('builds quick view counts and active view chips', () => {
    expect(buildDocumentQuickViewOptions(documents)).toEqual([
      expect.objectContaining({ value: 'all', count: 5 }),
      expect.objectContaining({ value: 'needs-action', count: 2 }),
      expect.objectContaining({ value: 'drafts', count: 1 }),
      expect.objectContaining({ value: 'pending-review', count: 1 }),
      expect.objectContaining({ value: 'published', count: 3 }),
      expect.objectContaining({ value: 'sensitive', count: 2 }),
    ]);

    const filters: DocumentFiltersState = {
      ...DEFAULT_DOCUMENT_FILTERS,
      view: 'needs-action',
      search: 'handbook',
    };

    expect(countActiveDocumentFilters(filters)).toBe(2);
    expect(getActiveDocumentFilterChips(filters, buildDocumentFilterOptions(documents))).toEqual([
      { key: 'view', label: 'View: Needs action' },
      { key: 'search', label: 'Search: handbook' },
    ]);
  });

  it('round-trips supported filters through URL search params', () => {
    const filters: DocumentFiltersState = {
      search: 'finance',
      view: 'sensitive',
      status: 'PUBLISHED',
      classification: 'CONFIDENTIAL',
      folder: 'finance',
      ownerId: 'owner-1',
      tag: 'board',
      sort: 'title',
      sortDir: 'asc',
    };

    const params = serializeDocumentFiltersToSearchParams(filters);

    expect(params.toString()).toBe(
      'q=finance&view=sensitive&status=PUBLISHED&classification=CONFIDENTIAL&folder=finance&owner=owner-1&tag=board&sort=title&dir=asc',
    );
    expect(parseDocumentFiltersFromSearchParams(params)).toEqual(filters);
  });
});
