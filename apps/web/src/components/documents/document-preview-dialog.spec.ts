import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DocumentVersion } from '@/features/documents/documents.types';
import { DocumentPreviewDialog } from './document-preview-dialog';

const version: DocumentVersion = {
  id: 'version-1',
  docId: 'doc-1',
  version: 1,
  objectKey: 'documents/doc-1/v1',
  checksum: 'sha256:test',
  size: 1024,
  filename: 'secret-plan.pdf',
  contentType: 'application/pdf',
  createdAt: '2026-05-30T00:00:00.000Z',
  createdBy: 'user-1',
};

describe('DocumentPreviewDialog', () => {
  it('surfaces download policy denial while preview remains open', () => {
    const Dialog = DocumentPreviewDialog as unknown as ComponentType<{
      docId: string;
      version: DocumentVersion;
      onClose: () => void;
      canDownload: boolean;
      downloadDeniedReason: string;
    }>;

    const html = renderToStaticMarkup(
      createElement(Dialog, {
        docId: 'doc-1',
        version,
        onClose: () => undefined,
        canDownload: false,
        downloadDeniedReason: 'SECRET documents require ownership or explicit DOWNLOAD ACL allow.',
      }),
    );

    expect(html).toContain('Download unavailable');
    expect(html).toContain('SECRET documents require ownership or explicit DOWNLOAD ACL allow.');
  });
});
