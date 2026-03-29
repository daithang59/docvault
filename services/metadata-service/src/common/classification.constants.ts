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
