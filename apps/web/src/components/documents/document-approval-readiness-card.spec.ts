import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DocumentDetail } from '@/features/documents/documents.types';
import { DocumentApprovalReadinessCard } from './document-approval-readiness-card';

const document: DocumentDetail = {
  id: 'doc-1',
  title: 'Incident Export',
  description: '',
  status: 'PENDING',
  classification: 'INTERNAL',
  dlpStatus: 'DETECTED',
  retentionClass: null,
  retentionUntil: null,
  ownerId: 'owner-1',
  currentVersion: 1,
  filename: 'incident-export.csv',
  tags: [],
  createdAt: '2026-05-01T09:00:00.000Z',
  updatedAt: '2026-06-01T10:00:00.000Z',
  versions: [],
  aclEntries: [],
};

describe('DocumentApprovalReadinessCard', () => {
  it('renders approval checklist and attention reasons', () => {
    const html = renderToStaticMarkup(
      createElement(DocumentApprovalReadinessCard, { document }),
    );

    expect(html).toContain('Approval readiness');
    expect(html).toContain('Needs attention');
    expect(html).toContain('Description is missing');
    expect(html).toContain('DLP findings detected');
    expect(html).toContain('No retention class/deadline is visible yet');
  });
});
