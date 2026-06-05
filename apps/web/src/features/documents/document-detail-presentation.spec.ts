import { describe, expect, it } from 'vitest';
import {
  buildDocumentLifecycleTimeline,
  buildDocumentEvidenceLinks,
  buildDocumentMetadataSummary,
  getLatestDocumentVersion,
  getVersionPreviewPosture,
} from './document-detail-presentation';
import type { DocumentDetail, DocumentVersion } from './documents.types';

const version: DocumentVersion = {
  id: 'version-1',
  docId: 'doc-1',
  version: 2,
  objectKey: 'documents/doc-1/v2',
  checksum: 'sha256:abcdef1234567890',
  size: 2048,
  filename: 'board-report.pdf',
  contentType: 'application/pdf',
  createdAt: '2026-06-01T09:00:00.000Z',
  createdBy: 'editor-1',
};

const document: DocumentDetail = {
  id: 'doc-1',
  title: 'Board Report',
  description: 'Quarterly board package',
  status: 'PUBLISHED',
  classification: 'CONFIDENTIAL',
  dlpStatus: 'DETECTED',
  retentionClass: 'CONFIDENTIAL_180D',
  retentionUntil: '2026-12-01T00:00:00.000Z',
  retentionReason: 'Confidential published document policy',
  ownerId: 'owner-1',
  ownerDisplay: 'Nguyen An',
  currentVersion: 2,
  filename: 'board-report.pdf',
  mimeType: 'application/pdf',
  fileSize: 2048,
  tags: ['finance'],
  publishedAt: '2026-06-01T10:00:00.000Z',
  createdAt: '2026-05-01T09:00:00.000Z',
  updatedAt: '2026-06-01T10:00:00.000Z',
  versions: [version],
  aclEntries: [],
};

describe('buildDocumentMetadataSummary', () => {
  it('builds compact operational metadata without content-bearing fields', () => {
    const summary = buildDocumentMetadataSummary(document);

    expect(summary.map((item) => item.label)).toEqual([
      'Owner',
      'Status',
      'Classification',
      'Retention',
      'Current Version',
      'Checksum',
      'Content Type',
      'Published',
    ]);
    expect(summary.find((item) => item.label === 'Owner')?.value).toBe('Nguyen An');
    expect(summary.find((item) => item.label === 'Checksum')?.value).toBe('sha256:a…34567890');
    expect(summary.map((item) => item.value).join(' ')).not.toContain('documents/doc-1/v2');
  });
});

describe('buildDocumentEvidenceLinks', () => {
  it('links detail context to audit, evidence, retention, and security when applicable', () => {
    expect(buildDocumentEvidenceLinks(document)).toEqual([
      expect.objectContaining({
        label: 'Audit events',
        href: '/audit?documentId=doc-1&resourceType=DOCUMENT&resourceId=doc-1',
      }),
      expect.objectContaining({ label: 'Evidence Center', href: '/evidence' }),
      expect.objectContaining({ label: 'Retention records', href: '/retention' }),
      expect.objectContaining({ label: 'Security posture', href: '/security' }),
    ]);
  });
});

describe('getVersionPreviewPosture', () => {
  it('distinguishes policy denial, supported previews, and unsupported formats', () => {
    expect(
      getVersionPreviewPosture(version, {
        allowed: false,
        reason: 'Compliance officers cannot preview file content.',
      }),
    ).toEqual({
      state: 'policy-denied',
      label: 'Preview blocked by policy',
      reason: 'Compliance officers cannot preview file content.',
    });

    expect(getVersionPreviewPosture(version, { allowed: true })).toEqual({
      state: 'supported',
      label: 'Preview supported',
      reason: 'PDF preview is available.',
    });

    expect(
      getVersionPreviewPosture(
        {
          ...version,
          filename: 'archive.zip',
          contentType: 'application/zip',
        },
        { allowed: true },
      ),
    ).toEqual({
      state: 'unsupported-format',
      label: 'Preview unsupported',
      reason: 'application/zip is not directly previewable.',
    });
  });
});

describe('getLatestDocumentVersion', () => {
  it('selects the highest version regardless of API ordering', () => {
    expect(
      getLatestDocumentVersion([
        { ...version, id: 'version-1', version: 1, versionNumber: 1 },
        { ...version, id: 'version-3', version: 3, versionNumber: 3 },
        { ...version, id: 'version-2', version: 2, versionNumber: 2 },
      ])?.id,
    ).toBe('version-3');
  });
});

describe('buildDocumentLifecycleTimeline', () => {
  it('builds stage posture, evidence timestamps, and the next best action', () => {
    const timeline = buildDocumentLifecycleTimeline(
      {
        ...document,
        status: 'PENDING',
        publishedAt: null,
        archivedAt: null,
      },
      [
        {
          id: 'history-submit',
          docId: 'doc-1',
          action: 'SUBMIT',
          actorId: 'editor-1',
          actorDisplay: 'Editor One',
          fromStatus: 'DRAFT',
          toStatus: 'PENDING',
          createdAt: '2026-06-01T09:30:00.000Z',
        },
      ],
    );

    expect(timeline.nextAction).toEqual({
      label: 'Approve or reject',
      description: 'Approver action is the next lifecycle decision.',
      href: '/approvals',
      tone: 'warning',
    });
    expect(timeline.stages).toEqual([
      expect.objectContaining({
        id: 'DRAFT',
        label: 'Draft',
        state: 'complete',
      }),
      expect.objectContaining({
        id: 'PENDING',
        label: 'In review',
        state: 'current',
        timestamp: '2026-06-01T09:30:00.000Z',
        actorLabel: 'Editor One',
      }),
      expect.objectContaining({
        id: 'PUBLISHED',
        label: 'Published',
        state: 'upcoming',
      }),
      expect.objectContaining({
        id: 'ARCHIVED',
        label: 'Archived',
        state: 'upcoming',
      }),
    ]);
  });

  it('uses delete workflow evidence for archived lifecycle posture', () => {
    const timeline = buildDocumentLifecycleTimeline(
      {
        ...document,
        status: 'DELETED',
        archivedAt: null,
      },
      [
        {
          id: 'history-delete',
          docId: 'doc-1',
          action: 'DELETE',
          actorId: 'admin-1',
          actorDisplay: 'Admin One',
          fromStatus: 'DRAFT',
          toStatus: 'DELETED',
          createdAt: '2026-06-03T08:00:00.000Z',
        },
      ],
    );

    expect(timeline.currentStage).toBe('ARCHIVED');
    expect(timeline.stages.find((stage) => stage.id === 'ARCHIVED')).toMatchObject({
      state: 'current',
      timestamp: '2026-06-03T08:00:00.000Z',
      actorLabel: 'Admin One',
    });
  });
});
