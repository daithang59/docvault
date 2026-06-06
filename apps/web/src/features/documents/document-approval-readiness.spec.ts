import { describe, expect, it } from 'vitest';
import { buildDocumentApprovalReadiness } from './document-approval-readiness';
import type { DocumentDetail } from './documents.types';

const baseDocument: DocumentDetail = {
  id: 'doc-1',
  title: 'Board Report',
  description: 'Quarterly board package',
  status: 'PENDING',
  classification: 'CONFIDENTIAL',
  dlpStatus: 'CLEAR',
  retentionClass: 'CONFIDENTIAL_180D',
  retentionUntil: '2026-12-01T00:00:00.000Z',
  ownerId: 'owner-1',
  ownerDisplay: 'Nguyen An',
  currentVersion: 2,
  filename: 'board-report.pdf',
  mimeType: 'application/pdf',
  fileSize: 2048,
  tags: ['finance', 'board'],
  createdAt: '2026-05-01T09:00:00.000Z',
  updatedAt: '2026-06-01T10:00:00.000Z',
  versions: [
    {
      id: 'version-2',
      version: 2,
      objectKey: 'documents/doc-1/v2',
      checksum: 'sha256:test',
      size: 2048,
      filename: 'board-report.pdf',
      contentType: 'application/pdf',
      createdAt: '2026-06-01T09:00:00.000Z',
      createdBy: 'editor-1',
    },
  ],
  aclEntries: [],
};

describe('buildDocumentApprovalReadiness', () => {
  it('marks a pending document with metadata, file, tags, DLP and retention as ready', () => {
    const readiness = buildDocumentApprovalReadiness(baseDocument);

    expect(readiness.status).toBe('ready');
    expect(readiness.summary).toBe('Ready for approval review.');
    expect(readiness.items.every((item) => item.state === 'complete')).toBe(true);
  });

  it('blocks approval readiness when no file version exists', () => {
    const readiness = buildDocumentApprovalReadiness({
      ...baseDocument,
      currentVersion: 0,
      filename: undefined,
      fileSize: undefined,
      versions: [],
    });

    expect(readiness.status).toBe('blocked');
    expect(readiness.items).toContainEqual(
      expect.objectContaining({
        key: 'file',
        state: 'blocked',
      }),
    );
  });

  it('surfaces missing optional metadata and DLP detections as attention items', () => {
    const readiness = buildDocumentApprovalReadiness({
      ...baseDocument,
      description: '',
      tags: [],
      dlpStatus: 'DETECTED',
      retentionClass: null,
      retentionUntil: null,
    });

    expect(readiness.status).toBe('needs-attention');
    expect(readiness.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'metadata', state: 'warning' }),
        expect.objectContaining({ key: 'tags', state: 'warning' }),
        expect.objectContaining({ key: 'dlp', state: 'warning' }),
        expect.objectContaining({ key: 'retention', state: 'warning' }),
      ]),
    );
  });
});
