import { ROUTES } from '@/lib/constants/routes';
import { formatDateTime } from '@/lib/utils/date';
import { formatBytes } from '@/lib/utils/file';
import { truncateMiddle } from '@/lib/utils/format';
import type { DocumentAccessDecision } from '@/lib/auth/permissions';
import type { DocumentDetail, DocumentVersion } from './documents.types';

export type DocumentMetadataKind =
  | 'identity'
  | 'status'
  | 'classification'
  | 'retention'
  | 'version'
  | 'checksum'
  | 'file'
  | 'date';

export interface DocumentMetadataSummaryItem {
  label: string;
  value: string;
  detail?: string;
  kind: DocumentMetadataKind;
}

export interface DocumentEvidenceLink {
  label: string;
  href: string;
  description: string;
}

export type VersionPreviewPostureState =
  | 'supported'
  | 'unsupported-format'
  | 'policy-denied';

export interface VersionPreviewPosture {
  state: VersionPreviewPostureState;
  label: string;
  reason: string;
}

const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/bmp',
]);

const BROWSER_PREVIEW_TYPES = new Set([
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'application/javascript',
  'application/json',
  'application/xml',
  'text/xml',
  'image/svg+xml',
]);

const DOCX_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

const MARKDOWN_TYPES = new Set(['text/markdown', 'text/x-markdown']);

const PDF_TYPE = 'application/pdf';

export function buildDocumentMetadataSummary(
  document: DocumentDetail,
): DocumentMetadataSummaryItem[] {
  const currentVersion = getLatestDocumentVersion(document.versions ?? []);
  const contentType =
    currentVersion?.contentType ?? currentVersion?.mimeType ?? document.mimeType;
  const fileSize = currentVersion?.size ?? currentVersion?.fileSize ?? document.fileSize;

  return [
    {
      label: 'Owner',
      value: document.ownerDisplay ?? document.ownerId,
      kind: 'identity',
    },
    {
      label: 'Status',
      value: formatEnum(document.status),
      kind: 'status',
    },
    {
      label: 'Classification',
      value: formatEnum(document.classification),
      kind: 'classification',
    },
    {
      label: 'Retention',
      value: document.retentionClass ?? 'Unset',
      detail: document.retentionUntil
        ? `Retain until ${formatDateTime(document.retentionUntil)}`
        : document.retentionReason ?? undefined,
      kind: 'retention',
    },
    {
      label: 'Current Version',
      value: `v${document.currentVersion}`,
      detail: fileSize != null ? formatBytes(fileSize) : undefined,
      kind: 'version',
    },
    {
      label: 'Checksum',
      value: currentVersion?.checksum
        ? truncateMiddle(currentVersion.checksum, 16)
        : 'Not available',
      kind: 'checksum',
    },
    {
      label: 'Content Type',
      value: contentType ?? 'Unknown',
      kind: 'file',
    },
    {
      label: document.publishedAt ? 'Published' : 'Updated',
      value: formatDateTime(document.publishedAt ?? document.updatedAt),
      kind: 'date',
    },
  ];
}

export function buildDocumentEvidenceLinks(
  document: DocumentDetail,
): DocumentEvidenceLink[] {
  const auditParams = new URLSearchParams({
    documentId: document.id,
    resourceType: 'DOCUMENT',
    resourceId: document.id,
  });

  const links: DocumentEvidenceLink[] = [
    {
      label: 'Audit events',
      href: `${ROUTES.AUDIT}?${auditParams.toString()}`,
      description: 'Open audit trail filtered to this document.',
    },
    {
      label: 'Evidence Center',
      href: ROUTES.EVIDENCE,
      description: 'Build metadata-only compliance packets and reports.',
    },
  ];

  if (document.retentionClass || document.retentionUntil) {
    links.push({
      label: 'Retention records',
      href: ROUTES.RETENTION,
      description: 'Review lifecycle policy and retention evidence.',
    });
  }

  if (document.dlpStatus === 'DETECTED') {
    links.push({
      label: 'Security posture',
      href: ROUTES.SECURITY,
      description: 'Inspect DLP/security recommendations related to this document.',
    });
  }

  return links;
}

export function getVersionPreviewPosture(
  version: DocumentVersion,
  previewDecision: DocumentAccessDecision,
): VersionPreviewPosture {
  if (!previewDecision.allowed) {
    return {
      state: 'policy-denied',
      label: 'Preview blocked by policy',
      reason: previewDecision.reason ?? 'Preview is not allowed for this user.',
    };
  }

  const contentType = resolveContentType(
    version.filename,
    version.mimeType ?? version.contentType,
  );

  if (isPreviewSupported(version, contentType)) {
    return {
      state: 'supported',
      label: 'Preview supported',
      reason: `${formatContentTypeLabel(contentType)} preview is available.`,
    };
  }

  return {
    state: 'unsupported-format',
    label: 'Preview unsupported',
    reason: `${contentType || 'Unknown format'} is not directly previewable.`,
  };
}

export function getLatestDocumentVersion(
  versions: DocumentVersion[],
): DocumentVersion | undefined {
  return [...versions].sort(
    (left, right) => getDocumentVersionNumber(right) - getDocumentVersionNumber(left),
  )[0];
}

export function resolveContentType(
  filename: string | undefined,
  mimeType: string | null | undefined,
): string {
  const ext = (filename?.split('.').pop() ?? '').toLowerCase();
  const extensionMap: Record<string, string> = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    md: 'text/markdown',
  };

  if (ext && extensionMap[ext]) return extensionMap[ext];
  if (!mimeType || mimeType === 'application/octet-stream') return '';
  return mimeType;
}

function isPreviewSupported(
  version: DocumentVersion,
  contentType: string,
): boolean {
  const filename = (version.filename ?? '').toLowerCase();

  return (
    contentType === PDF_TYPE ||
    IMAGE_TYPES.has(contentType) ||
    BROWSER_PREVIEW_TYPES.has(contentType) ||
    DOCX_TYPES.has(contentType) ||
    MARKDOWN_TYPES.has(contentType) ||
    filename.endsWith('.docx') ||
    filename.endsWith('.doc') ||
    filename.endsWith('.md')
  );
}

function getDocumentVersionNumber(version: DocumentVersion): number {
  return version.versionNumber ?? version.version ?? 0;
}

function formatContentTypeLabel(contentType: string): string {
  if (contentType === PDF_TYPE) return 'PDF';
  if (IMAGE_TYPES.has(contentType)) return 'Image';
  if (DOCX_TYPES.has(contentType)) return 'Word document';
  if (MARKDOWN_TYPES.has(contentType)) return 'Markdown';
  if (BROWSER_PREVIEW_TYPES.has(contentType)) return 'Browser';
  return contentType || 'File';
}

function formatEnum(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
