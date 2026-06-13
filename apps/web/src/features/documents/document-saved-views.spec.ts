import { describe, expect, it } from 'vitest';
import type { DocumentListItem } from './documents.types';
import {
  DEFAULT_DOCUMENT_FILTERS,
  type DocumentFiltersState,
} from './document-filter-model';
import {
  buildDocumentSavedViewOptions,
  createCustomDocumentSavedView,
  findMatchingDocumentSavedViewId,
  parseCustomDocumentSavedViews,
  serializeCustomDocumentSavedViews,
} from './document-saved-views';

const documents: DocumentListItem[] = [
  {
    id: 'doc-1',
    title: 'Board Report',
    status: 'PUBLISHED',
    classification: 'CONFIDENTIAL',
    ownerId: 'owner-1',
    ownerDisplay: 'Nguyen An',
    currentVersion: 2,
    tags: ['finance'],
    createdAt: '2026-05-01T09:00:00.000Z',
    updatedAt: '2026-06-01T09:00:00.000Z',
  },
  {
    id: 'doc-2',
    title: 'Draft Policy',
    status: 'DRAFT',
    classification: 'INTERNAL',
    ownerId: 'owner-2',
    currentVersion: 1,
    tags: ['policy'],
    createdAt: '2026-05-02T09:00:00.000Z',
    updatedAt: '2026-06-02T09:00:00.000Z',
  },
  {
    id: 'doc-3',
    title: 'Incident Export',
    status: 'PENDING',
    classification: 'INTERNAL',
    dlpStatus: 'DETECTED',
    ownerId: 'owner-3',
    currentVersion: 1,
    tags: ['security'],
    createdAt: '2026-05-03T09:00:00.000Z',
    updatedAt: '2026-06-03T09:00:00.000Z',
  },
];

describe('buildDocumentSavedViewOptions', () => {
  it('builds commercial saved views with deterministic counts', () => {
    const options = buildDocumentSavedViewOptions(documents);

    expect(options.map((option) => option.id)).toEqual([
      'saved-pending-review',
      'saved-action-queue',
      'saved-security-triage',
      'saved-sensitive-attention',
      'saved-draft-handoff',
      'saved-recently-published',
      'saved-confidential-library',
    ]);
    expect(options.find((option) => option.id === 'saved-action-queue')).toMatchObject({
      count: 2,
      filters: expect.objectContaining({ view: 'needs-action' }),
    });
    expect(options.find((option) => option.id === 'saved-security-triage')).toMatchObject({
      count: 1,
      filters: expect.objectContaining({
        view: 'pending-review',
        search: 'tag:security',
      }),
    });
    expect(options.find((option) => option.id === 'saved-sensitive-attention')).toMatchObject({
      count: 2,
      filters: expect.objectContaining({ view: 'sensitive' }),
    });
    expect(options.find((option) => option.id === 'saved-draft-handoff')).toMatchObject({
      count: 1,
      filters: expect.objectContaining({ view: 'drafts' }),
    });
  });

  it('includes custom saved views and finds a matching active view', () => {
    const filters: DocumentFiltersState = {
      ...DEFAULT_DOCUMENT_FILTERS,
      search: 'finance',
      classification: 'CONFIDENTIAL',
      folder: 'finance',
      sort: 'title',
      sortDir: 'asc',
    };
    const custom = createCustomDocumentSavedView('Finance confidential', filters, {
      generatedAt: '2026-06-04T03:00:00.000Z',
    });
    const options = buildDocumentSavedViewOptions(documents, [custom]);

    expect(custom).toMatchObject({
      id: 'custom-finance-confidential-20260604030000',
      label: 'Finance confidential',
      source: 'custom',
    });
    expect(options.at(-1)).toMatchObject({
      id: custom.id,
      count: 1,
      filters: expect.objectContaining({ folder: 'finance' }),
    });
    expect(findMatchingDocumentSavedViewId(options, filters)).toBe(custom.id);
  });
});

describe('custom document saved view storage', () => {
  it('serializes and parses valid custom views while dropping invalid entries', () => {
    const custom = createCustomDocumentSavedView(
      'DLP attention',
      {
        ...DEFAULT_DOCUMENT_FILTERS,
        view: 'sensitive',
        folder: 'security',
      },
      { generatedAt: '2026-06-04T04:00:00.000Z' },
    );
    const encoded = serializeCustomDocumentSavedViews([custom]);

    expect(parseCustomDocumentSavedViews(encoded)).toEqual([custom]);
    expect(
      parseCustomDocumentSavedViews(
        JSON.stringify([
          custom,
          { id: 'bad', label: '', filters: { status: 'NOT_REAL' } },
        ]),
      ),
    ).toEqual([custom]);
    expect(parseCustomDocumentSavedViews('not json')).toEqual([]);
  });
});
