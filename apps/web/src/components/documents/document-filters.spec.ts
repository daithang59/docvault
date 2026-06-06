import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DOCUMENT_FILTERS,
  buildDocumentFilterOptions,
  buildDocumentQuickViewOptions,
  buildDocumentSearchSuggestions,
} from '@/features/documents/document-filter-model';
import { buildDocumentSavedViewOptions } from '@/features/documents/document-saved-views';
import type { DocumentListItem } from '@/features/documents/documents.types';
import { DocumentFilters } from './document-filters';

const documents: DocumentListItem[] = [
  {
    id: 'doc-1',
    title: 'Board Report',
    status: 'PENDING',
    classification: 'CONFIDENTIAL',
    ownerId: 'owner-1',
    currentVersion: 1,
    tags: ['finance'],
    filename: 'board-report.pdf',
    createdAt: '2026-06-01T09:00:00.000Z',
    updatedAt: '2026-06-03T09:00:00.000Z',
  },
];

describe('DocumentFilters', () => {
  it('renders saved views alongside quick views and save controls', () => {
    const html = renderToStaticMarkup(
      createElement(DocumentFilters, {
        filters: DEFAULT_DOCUMENT_FILTERS,
        options: buildDocumentFilterOptions(documents),
        quickViews: buildDocumentQuickViewOptions(documents),
        searchSuggestions: buildDocumentSearchSuggestions(documents),
        savedViews: buildDocumentSavedViewOptions(documents),
        activeSavedViewId: null,
        resultCount: documents.length,
        totalCount: documents.length,
        onChange: () => undefined,
        onApplySavedView: () => undefined,
        onSaveCurrentView: () => undefined,
        onDeleteSavedView: () => undefined,
      }),
    );

    expect(html).toContain('Saved views');
    expect(html).toContain('Pending review');
    expect(html).toContain('Sensitive attention');
    expect(html).toContain('Name current view');
    expect(html).toContain('Document quick views');
    expect(html).toContain('Smart folders');
    expect(html).toContain('Query chips');
    expect(html).toContain('status:pending');
    expect(html).toContain('class:confidential');
    expect(html).toContain('file:board-report.pdf');
    expect(html).toContain('Folder: finance');
  });
});
