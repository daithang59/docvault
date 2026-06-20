import { ROUTES } from '@/lib/constants/routes';
import type {
  DocumentAclEntryDto,
  DocumentDetail,
} from '@/features/documents/documents.types';
import type { ClassificationLevel } from '@/types/enums';

export type AccessReviewSeverity = 'critical' | 'warning';
export type AccessReviewType =
  | 'broad-access'
  | 'sensitive-download'
  | 'stale-permission';
export type AccessReviewPostureLevel = 'healthy' | 'warning' | 'critical';

export interface AccessReviewItem {
  id: string;
  type: AccessReviewType;
  documentId: string;
  title: string;
  classification: ClassificationLevel;
  status: DocumentDetail['status'];
  severity: AccessReviewSeverity;
  subjectType: DocumentAclEntryDto['subjectType'];
  subjectId?: string | null;
  subject: string;
  permission: DocumentAclEntryDto['permission'];
  reason: string;
  recommendedAction: string;
  evidence: string[];
  nextActionLabel: string;
  href: string;
  auditHref: string;
}

export interface AccessReviewModel {
  posture: {
    level: AccessReviewPostureLevel;
    label: string;
    description: string;
  };
  summary: {
    reviewedDocuments: number;
    openReviews: number;
    criticalReviews: number;
    stalePermissions: number;
    broadAccessGrants: number;
  };
  reviews: AccessReviewItem[];
}

export interface AccessReviewModelOptions {
  now?: string | Date;
  staleAfterDays?: number;
}

export type AccessReviewUserDisplayMap = Record<
  string,
  { displayName?: string | null; username?: string | null }
>;

const DEFAULT_STALE_AFTER_DAYS = 365;

export function buildAccessReviewModel(
  documents: DocumentDetail[],
  options: AccessReviewModelOptions = {},
): AccessReviewModel {
  const now = normalizeDate(options.now);
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const sensitiveDocuments = documents.filter((document) =>
    isSensitiveClassification(document.classification),
  );
  const broadAccessGrants = sensitiveDocuments.reduce(
    (total, document) =>
      total + getBroadAccessAllows(document.aclEntries ?? []).length,
    0,
  );
  const reviews = documents.flatMap((document) =>
    buildDocumentAccessReviews(document, now, staleAfterDays),
  );
  const criticalReviews = reviews.filter(
    (review) => review.severity === 'critical',
  ).length;
  const stalePermissions = reviews.filter(
    (review) => review.type === 'stale-permission',
  ).length;

  return {
    posture: buildPosture(reviews),
    summary: {
      reviewedDocuments: documents.length,
      openReviews: reviews.length,
      criticalReviews,
      stalePermissions,
      broadAccessGrants,
    },
    reviews,
  };
}

function buildDocumentAccessReviews(
  document: DocumentDetail,
  now: Date,
  staleAfterDays: number,
): AccessReviewItem[] {
  if (!isSensitiveClassification(document.classification)) {
    return [];
  }

  const aclEntries = document.aclEntries ?? [];
  const broadAllows = getBroadAccessAllows(aclEntries);
  const downloadAllows = aclEntries.filter(
    (entry) => entry.effect === 'ALLOW' && entry.permission === 'DOWNLOAD',
  );
  const staleAllows = aclEntries.filter(
    (entry) =>
      entry.effect === 'ALLOW' &&
      isAclStale(entry.createdAt, now, staleAfterDays),
  );
  const reviews: AccessReviewItem[] = [];

  for (const grant of broadAllows) {
    reviews.push(
      toReviewItem({
        document,
        type: 'broad-access',
        severity: getBroadAccessSeverity(document, grant),
        grant,
        reason: 'Sensitive document has broad ACL grants that expand metadata or file access.',
        recommendedAction:
          'Revalidate business need, replace broad subjects with named users or groups, and keep DENY overrides where needed.',
        evidence: buildEvidence(document, grant),
      }),
    );
  }

  for (const grant of downloadAllows) {
    reviews.push(
      toReviewItem({
        document,
        type: 'sensitive-download',
        severity: 'critical',
        grant,
        reason: 'Sensitive document has an explicit download grant.',
        recommendedAction:
          'Confirm the recipient still needs file-content access and prefer watermark-required streaming for sensitive content.',
        evidence: buildEvidence(document, grant),
      }),
    );
  }

  for (const grant of staleAllows) {
    reviews.push(
      toReviewItem({
        document,
        type: 'stale-permission',
        severity: 'warning',
        grant,
        reason: `An ALLOW grant is older than ${staleAfterDays} days.`,
        recommendedAction:
          'Ask the owner to recertify the permission or revoke it before the next evidence export.',
        evidence: [
          `${document.classification} document`,
          `ALLOW ${grant.permission} for ${formatSubject(grant)}`,
          `Grant created ${grant.createdAt}`,
        ],
      }),
    );
  }

  return reviews;
}

function toReviewItem({
  document,
  type,
  severity,
  grant,
  reason,
  recommendedAction,
  evidence,
}: {
  document: DocumentDetail;
  type: AccessReviewType;
  severity: AccessReviewSeverity;
  grant: DocumentAclEntryDto;
  reason: string;
  recommendedAction: string;
  evidence: string[];
}): AccessReviewItem {
  return {
    id: `${type}:${document.id}:${grant.id}`,
    type,
    documentId: document.id,
    title: document.title,
    classification: document.classification,
    status: document.status,
    severity,
    subjectType: grant.subjectType,
    subjectId: grant.subjectId,
    subject: formatSubject(grant),
    permission: grant.permission,
    reason,
    recommendedAction,
    evidence,
    nextActionLabel: 'Review ACL',
    href: ROUTES.DOCUMENT_DETAIL(document.id),
    auditHref: `${ROUTES.AUDIT}?documentId=${encodeURIComponent(document.id)}&aclId=${encodeURIComponent(grant.id)}`,
  };
}

export function getAccessReviewUserSubjectIds(
  reviews: AccessReviewItem[],
): string[] {
  return [
    ...new Set(
      reviews
        .filter(
          (review) => review.subjectType === 'USER' && Boolean(review.subjectId),
        )
        .map((review) => review.subjectId as string),
    ),
  ];
}

export function getResolvedAccessReviewSubject(
  review: AccessReviewItem,
  displayNames?: AccessReviewUserDisplayMap,
): string {
  if (review.subjectType !== 'USER' || !review.subjectId) {
    return review.subject;
  }

  const display = displayNames?.[review.subjectId];
  const username = display?.username?.trim();
  if (username) {
    return username;
  }

  const displayName = display?.displayName?.trim();
  if (displayName && displayName !== 'Unknown User') {
    return displayName;
  }

  return review.subject;
}

export function getResolvedAccessReviewEvidence(
  review: AccessReviewItem,
  displayNames?: AccessReviewUserDisplayMap,
): string[] {
  const resolvedSubject = getResolvedAccessReviewSubject(review, displayNames);
  if (resolvedSubject === review.subject) {
    return review.evidence;
  }

  return review.evidence.map((item) =>
    item.replace(` for ${review.subject}`, ` for ${resolvedSubject}`),
  );
}

function getBroadAccessAllows(
  entries: DocumentAclEntryDto[],
): DocumentAclEntryDto[] {
  return entries.filter(
    (entry) =>
      entry.effect === 'ALLOW' &&
      (entry.subjectType === 'ALL' ||
        (entry.subjectType === 'ROLE' &&
          ['viewer', 'editor', 'approver'].includes(
            String(entry.subjectId ?? '').toLowerCase(),
          ))),
  );
}

function getBroadAccessSeverity(
  document: DocumentDetail,
  grant: DocumentAclEntryDto,
): AccessReviewSeverity {
  if (document.classification === 'SECRET' || grant.permission === 'DOWNLOAD') {
    return 'critical';
  }

  return 'warning';
}

function buildEvidence(
  document: DocumentDetail,
  grant: DocumentAclEntryDto,
): string[] {
  const evidence = [
    `${document.classification} document`,
    `ALLOW ${grant.permission} for ${formatSubject(grant)}`,
  ];

  if (document.dlpStatus === 'DETECTED') {
    evidence.push('DLP detected');
  }

  return evidence;
}

function formatSubject(entry: DocumentAclEntryDto): string {
  if (entry.subjectDisplay) return entry.subjectDisplay;
  if (entry.subjectType === 'ALL') return 'Everyone';
  return entry.subjectId ?? entry.subjectType;
}

function isSensitiveClassification(classification: ClassificationLevel): boolean {
  return classification === 'CONFIDENTIAL' || classification === 'SECRET';
}

function isAclStale(
  createdAt: string,
  now: Date,
  staleAfterDays: number,
): boolean {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  const ageMs = now.getTime() - created.getTime();
  return ageMs >= staleAfterDays * 24 * 60 * 60 * 1000;
}

function normalizeDate(now?: string | Date): Date {
  const date = now ? new Date(now) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function buildPosture(
  reviews: AccessReviewItem[],
): AccessReviewModel['posture'] {
  if (reviews.some((review) => review.severity === 'critical')) {
    return {
      level: 'critical',
      label: 'Access review required',
      description:
        'Critical broad-access grants exist on sensitive documents and should be recertified.',
    };
  }

  if (reviews.length > 0) {
    return {
      level: 'warning',
      label: 'Permission recertification due',
      description:
        'Sensitive-document permissions need owner or compliance recertification.',
    };
  }

  return {
    level: 'healthy',
    label: 'Access posture reviewed',
    description:
      'No broad or stale sensitive-document permissions were found in the current review set.',
  };
}
