import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth/auth-context';
import type { DocumentDetail } from '@/features/documents/documents.types';
import { DocumentEvidenceLinksCard } from './document-evidence-links-card';
import { DocumentMetadataSummaryCard } from './document-metadata-summary-card';
import { DocumentVersionsCard } from './document-versions-card';

const document: DocumentDetail = {
  id: 'doc-1',
  title: 'Board Report',
  status: 'PUBLISHED',
  classification: 'CONFIDENTIAL',
  dlpStatus: 'DETECTED',
  retentionClass: 'CONFIDENTIAL_180D',
  retentionUntil: '2026-12-01T00:00:00.000Z',
  ownerId: 'owner-1',
  ownerDisplay: 'Nguyen An',
  currentVersion: 2,
  tags: ['finance'],
  createdAt: '2026-05-01T09:00:00.000Z',
  updatedAt: '2026-06-01T10:00:00.000Z',
  publishedAt: '2026-06-01T10:00:00.000Z',
  versions: [
    {
      id: 'version-1',
      version: 2,
      objectKey: 'documents/doc-1/v2',
      checksum: 'sha256:abcdef1234567890',
      size: 2048,
      filename: 'board-report.pdf',
      contentType: 'application/pdf',
      createdAt: '2026-06-01T09:00:00.000Z',
      createdBy: 'editor-1',
    },
  ],
  aclEntries: [],
};

function renderWithQueryClient(element: ReactElement, includeAuth = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const child = includeAuth
    ? createElement(AuthProvider, null, element)
    : element;

  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client }, child),
  );
}

describe('DocumentMetadataSummaryCard', () => {
  it('renders compact metadata for inspection without object keys', () => {
    const html = renderWithQueryClient(
      createElement(DocumentMetadataSummaryCard, { document }),
    );

    expect(html).toContain('Metadata summary');
    expect(html).toContain('Nguyen An');
    expect(html).toContain('CONFIDENTIAL_180D');
    expect(html).toContain('sha256:a…34567890');
    expect(html).not.toContain('documents/doc-1/v2');
  });
});

describe('DocumentEvidenceLinksCard', () => {
  it('renders links to document evidence surfaces', () => {
    const html = renderToStaticMarkup(
      createElement(DocumentEvidenceLinksCard, { document }),
    );

    expect(html).toContain('Evidence links');
    expect(html).toContain('/audit?documentId=doc-1');
    expect(html).toContain('/evidence');
    expect(html).toContain('/retention');
    expect(html).toContain('/security');
  });
});

describe('DocumentVersionsCard', () => {
  it('renders version rows with labeled preview, download, compare, and restore controls', () => {
    const html = renderWithQueryClient(
      createElement(DocumentVersionsCard, {
        docId: 'doc-1',
        versions: [
          {
            ...document.versions[0],
            id: 'version-1',
            version: 1,
            versionNumber: 1,
            filename: 'board-report-v1.pdf',
          },
          {
            ...document.versions[0],
            id: 'version-2',
            version: 2,
            versionNumber: 2,
            filename: 'board-report-v2.pdf',
          },
        ],
        onDownload: () => undefined,
        onPreview: () => undefined,
        canDownload: true,
        canPreview: true,
        canRestore: true,
        currentVersion: 2,
      }),
      true,
    );

    expect(html).toContain('board-report-v1.pdf');
    expect(html).toContain('board-report-v2.pdf');
    expect(html).toContain('Download this version');
    expect(html).toContain('Compare version 1');
    // restore offered only for non-current version (v1), not the current (v2)
    expect(html).toContain('Restore version 1');
    expect(html).not.toContain('Restore version 2');
  });
});

