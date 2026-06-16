import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

function renderWithQueryClient(element: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client }, element),
  );
}

describe('DocumentFilters', () => {
  it('renders quick views, saved views, and filter controls', () => {
    const html = renderWithQueryClient(
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

    expect(html).toContain('Document views');
    expect(html).toContain('All');
    expect(html).toContain('Needs action');
    expect(html).toContain('Pending review');
    expect(html).toContain('Sensitive attention');
    expect(html).toContain('Action queue');
    expect(html).toContain('Search documents');
    expect(html).toContain('Filter');
    expect(html).toContain('Save view');
    expect(html).toContain('Search syntax: status:pending');
    expect(html).toContain('class:confidential');
    expect(html).toContain('file:report.pdf');
    expect(html).toContain('Recently updated');
    expect(html).toContain('Reset all filters');
  });
});
