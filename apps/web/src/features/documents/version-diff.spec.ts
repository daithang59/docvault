import { describe, expect, it } from 'vitest';
import { buildVersionDiff } from './version-diff';
import type { DocumentVersion } from './documents.types';

function makeVersion(overrides: Partial<DocumentVersion> = {}): DocumentVersion {
  return {
    id: 'v1',
    docId: 'doc-1',
    version: 1,
    objectKey: 'doc/doc-1/v1/file.pdf',
    checksum: 'sha256:aaa',
    size: 1000,
    filename: 'file.pdf',
    contentType: 'application/pdf',
    dlpStatus: 'CLEAR',
    createdAt: '2026-06-01T00:00:00.000Z',
    createdBy: 'editor-1',
    ...overrides,
  };
}

describe('buildVersionDiff', () => {
  it('normalizes ordering so the lower version is always from', () => {
    const v1 = makeVersion({ version: 1 });
    const v3 = makeVersion({ version: 3 });

    const diff = buildVersionDiff(v3, v1);

    expect(diff.fromVersion).toBe(1);
    expect(diff.toVersion).toBe(3);
  });

  it('flags only the fields that changed', () => {
    const v1 = makeVersion({
      version: 1,
      filename: 'old.pdf',
      size: 1000,
      checksum: 'sha256:aaa',
    });
    const v2 = makeVersion({
      version: 2,
      filename: 'new.pdf',
      size: 2048,
      checksum: 'sha256:bbb',
    });

    const diff = buildVersionDiff(v1, v2);

    const filename = diff.fields.find((f) => f.label === 'Filename');
    const size = diff.fields.find((f) => f.label === 'File size');
    const contentType = diff.fields.find((f) => f.label === 'Content type');

    expect(filename?.changed).toBe(true);
    expect(filename?.from).toBe('old.pdf');
    expect(filename?.to).toBe('new.pdf');
    expect(size?.changed).toBe(true);
    expect(contentType?.changed).toBe(false);
    expect(diff.changedCount).toBe(3);
  });

  it('uses normalized aliases (versionNumber, fileSize, mimeType)', () => {
    const a = makeVersion({
      version: 0,
      versionNumber: 2,
      size: 0,
      fileSize: 500,
      contentType: undefined,
      mimeType: 'text/plain',
    });
    const b = makeVersion({
      version: 0,
      versionNumber: 1,
      size: 0,
      fileSize: 500,
      contentType: undefined,
      mimeType: 'text/plain',
    });

    const diff = buildVersionDiff(a, b);

    expect(diff.fromVersion).toBe(1);
    expect(diff.toVersion).toBe(2);
    const size = diff.fields.find((f) => f.label === 'File size');
    expect(size?.changed).toBe(false);
  });

  it('renders dashes for missing values', () => {
    const a = makeVersion({ version: 1, checksum: '' });
    const b = makeVersion({ version: 2, checksum: '' });

    const diff = buildVersionDiff(a, b);
    const checksum = diff.fields.find((f) => f.label === 'Checksum');
    expect(checksum?.from).toBe('—');
    expect(checksum?.changed).toBe(false);
  });
});
