import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
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

describe('DocumentMetadataSummaryCard', () => {
  it('renders compact metadata for inspection without object keys', () => {
    const html = renderToStaticMarkup(
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
  it('downloads the selected historical version and labels icon actions', () => {
    const onDownload = vi.fn();
    const element = (DocumentVersionsCard as unknown as (props: {
      docId: string;
      versions: DocumentDetail['versions'];
      onDownload: (docId: string, version: DocumentDetail['versions'][number]) => void;
      onPreview: (docId: string, version: DocumentDetail['versions'][number]) => void;
      canDownload: boolean;
      canPreview: boolean;
    }) => ReactElement)({
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
      onDownload,
      onPreview: () => undefined,
      canDownload: true,
      canPreview: true,
    });

    const buttons = collectElements(
      element,
      (node) => node.type === 'button',
    );
    const previewButtons = buttons.filter(
      (button) => button.props.title === 'Preview this version',
    );
    const downloadButtons = buttons.filter(
      (button) => button.props.title === 'Download this version',
    );

    expect(previewButtons.every((button) => button.props['aria-label'] === 'Preview this version')).toBe(true);
    expect(downloadButtons.every((button) => button.props['aria-label'] === 'Download this version')).toBe(true);

    downloadButtons[1].props.onClick?.();

    expect(onDownload).toHaveBeenCalledWith(
      'doc-1',
      expect.objectContaining({ id: 'version-1', version: 1 }),
    );
  });
});

function collectElements(
  node: ReactNode,
  predicate: (node: TestElement) => boolean,
): TestElement[] {
  if (node == null || typeof node === 'boolean') return [];
  if (Array.isArray(node)) {
    return node.flatMap((child) => collectElements(child, predicate));
  }
  if (!isValidElement(node)) return [];

  const element = node as TestElement;
  const current = predicate(element) ? [element] : [];

  return [
    ...current,
    ...collectElements(element.props.children, predicate),
  ];
}

type TestElement = ReactElement<{
  children?: ReactNode;
  onClick?: () => void;
  title?: string;
  'aria-label'?: string;
}>;
