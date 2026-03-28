import { ClassificationLevel } from '../../generated/prisma';

/** Số ngày giữ lại sau khi publish, theo classification */
export const CLASSIFICATION_RETENTION_DAYS: Record<
  ClassificationLevel,
  number
> = {
  PUBLIC: 730, // 2 năm
  INTERNAL: 365, // 1 năm
  CONFIDENTIAL: 180, // 6 tháng
  SECRET: 30, // 1 tháng
};

/** Classification nào cần watermark khi download */
export const CLASSIFICATION_WATERMARK_LEVELS: Record<
  ClassificationLevel,
  boolean
> = {
  PUBLIC: false,
  INTERNAL: false,
  CONFIDENTIAL: true,
  SECRET: true,
};
