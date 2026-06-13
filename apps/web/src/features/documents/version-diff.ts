import type { DocumentVersion } from './documents.types';
import { formatBytes } from '@/lib/utils/file';

export interface VersionDiffField {
  label: string;
  from: string;
  to: string;
  changed: boolean;
}

export interface VersionDiff {
  fromVersion: number;
  toVersion: number;
  fields: VersionDiffField[];
  changedCount: number;
}

function versionNumber(version: DocumentVersion): number {
  return version.versionNumber ?? version.version ?? 0;
}

function sizeOf(version: DocumentVersion): number {
  return version.fileSize ?? version.size ?? 0;
}

function valueOrDash(value: string | null | undefined): string {
  const trimmed = (value ?? '').toString().trim();
  return trimmed.length > 0 ? trimmed : '—';
}

/**
 * Compare two document versions field by field for a metadata-only diff.
 *
 * Ordering is normalized so the lower version number is always `from` and the
 * higher is `to`, which keeps the rendered diff stable regardless of which row
 * the user clicked first.
 */
export function buildVersionDiff(
  a: DocumentVersion,
  b: DocumentVersion,
): VersionDiff {
  const [from, to] =
    versionNumber(a) <= versionNumber(b) ? [a, b] : [b, a];

  const fields: VersionDiffField[] = [
    {
      label: 'Filename',
      from: valueOrDash(from.filename),
      to: valueOrDash(to.filename),
      changed: from.filename !== to.filename,
    },
    {
      label: 'File size',
      from: formatBytes(sizeOf(from)),
      to: formatBytes(sizeOf(to)),
      changed: sizeOf(from) !== sizeOf(to),
    },
    {
      label: 'Content type',
      from: valueOrDash(from.contentType ?? from.mimeType),
      to: valueOrDash(to.contentType ?? to.mimeType),
      changed:
        (from.contentType ?? from.mimeType ?? '') !==
        (to.contentType ?? to.mimeType ?? ''),
    },
    {
      label: 'Checksum',
      from: valueOrDash(from.checksum),
      to: valueOrDash(to.checksum),
      changed: from.checksum !== to.checksum,
    },
    {
      label: 'DLP status',
      from: valueOrDash(from.dlpStatus),
      to: valueOrDash(to.dlpStatus),
      changed: (from.dlpStatus ?? '') !== (to.dlpStatus ?? ''),
    },
    {
      label: 'Uploaded by',
      from: valueOrDash(from.uploadedById ?? from.createdBy),
      to: valueOrDash(to.uploadedById ?? to.createdBy),
      changed:
        (from.uploadedById ?? from.createdBy ?? '') !==
        (to.uploadedById ?? to.createdBy ?? ''),
    },
  ];

  return {
    fromVersion: versionNumber(from),
    toVersion: versionNumber(to),
    fields,
    changedCount: fields.filter((field) => field.changed).length,
  };
}
