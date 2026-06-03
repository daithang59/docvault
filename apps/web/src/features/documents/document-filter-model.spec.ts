import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DOCUMENT_FILTERS,
  buildDocumentFilterOptions,
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
];

describe('filterAndSortDocuments', () => {
  it('combines text, owner, tag, status, and classification filters', () => {
    const filters: DocumentFiltersState = {
      search: 'finance',
      ownerId: 'owner-1',
      tag: 'board',
      status: 'PUBLISHED',
      classification: 'CONFIDENTIAL',
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
    ).toEqual(['Board Report', 'Hiring Plan', 'Public Handbook']);

    expect(
      filterAndSortDocuments(documents, DEFAULT_DOCUMENT_FILTERS).map((doc) => doc.id),
    ).toEqual(['doc-3', 'doc-1', 'doc-2']);
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
});

describe('document filter metadata', () => {
  it('builds unique owner/tag options and active chips', () => {
    const options = buildDocumentFilterOptions(documents);

    expect(options.owners).toEqual([
      { value: 'owner-1', label: 'Nguyen An' },
      { value: 'owner-2', label: 'Le Binh' },
    ]);
    expect(options.tags).toEqual(['board', 'finance', 'hr', 'policy']);

    const filters: DocumentFiltersState = {
      ...DEFAULT_DOCUMENT_FILTERS,
      search: 'finance',
      ownerId: 'owner-1',
      tag: 'board',
      status: 'PUBLISHED',
    };

    expect(countActiveDocumentFilters(filters)).toBe(4);
    expect(getActiveDocumentFilterChips(filters, options)).toEqual([
      { key: 'search', label: 'Search: finance' },
      { key: 'status', label: 'Status: Published' },
      { key: 'ownerId', label: 'Owner: Nguyen An' },
      { key: 'tag', label: 'Tag: board' },
    ]);
    expect(describeActiveDocumentFilters(filters, options)).toBe(
      'No documents match Search: finance, Status: Published, Owner: Nguyen An, Tag: board.',
    );
  });

  it('round-trips supported filters through URL search params', () => {
    const filters: DocumentFiltersState = {
      search: 'finance',
      status: 'PUBLISHED',
      classification: 'CONFIDENTIAL',
      ownerId: 'owner-1',
      tag: 'board',
      sort: 'title',
      sortDir: 'asc',
    };

    const params = serializeDocumentFiltersToSearchParams(filters);

    expect(params.toString()).toBe(
      'q=finance&status=PUBLISHED&classification=CONFIDENTIAL&owner=owner-1&tag=board&sort=title&dir=asc',
    );
    expect(parseDocumentFiltersFromSearchParams(params)).toEqual(filters);
  });
});
