import { ClassificationLevel } from '../../generated/prisma';

/** Number of days to retain after publish, by classification */
export const CLASSIFICATION_RETENTION_DAYS: Record<
  ClassificationLevel,
  number
> = {
  PUBLIC: 730, // 2 years
  INTERNAL: 365, // 1 year
  CONFIDENTIAL: 180, // 6 months
  SECRET: 30, // 1 month
};

export interface RetentionPolicy {
  days: number;
  retentionClass: string;
  reason: string;
}

export const RETENTION_POLICY_BY_CLASSIFICATION: Record<
  ClassificationLevel,
  RetentionPolicy
> = {
  PUBLIC: {
    days: CLASSIFICATION_RETENTION_DAYS.PUBLIC,
    retentionClass: 'PUBLIC_730D',
    reason: 'PUBLIC records are retained for 730 days after publication',
  },
  INTERNAL: {
    days: CLASSIFICATION_RETENTION_DAYS.INTERNAL,
    retentionClass: 'INTERNAL_365D',
    reason: 'INTERNAL records are retained for 365 days after publication',
  },
  CONFIDENTIAL: {
    days: CLASSIFICATION_RETENTION_DAYS.CONFIDENTIAL,
    retentionClass: 'CONFIDENTIAL_180D',
    reason: 'CONFIDENTIAL records are retained for 180 days after publication',
  },
  SECRET: {
    days: CLASSIFICATION_RETENTION_DAYS.SECRET,
    retentionClass: 'SECRET_30D',
    reason: 'SECRET records are retained for 30 days after publication',
  },
};

export function buildRetentionEvidence(
  classification: ClassificationLevel,
  publishedAt: Date,
) {
  const policy = RETENTION_POLICY_BY_CLASSIFICATION[classification];
  return {
    retentionClass: policy.retentionClass,
    retentionUntil: new Date(
      publishedAt.getTime() + policy.days * 24 * 60 * 60 * 1000,
    ),
    retentionReason: policy.reason,
  };
}

/** Which classification levels require watermark on download */
export const CLASSIFICATION_WATERMARK_LEVELS: Record<
  ClassificationLevel,
  boolean
> = {
  PUBLIC: false,
  INTERNAL: false,
  CONFIDENTIAL: true,
  SECRET: true,
};
