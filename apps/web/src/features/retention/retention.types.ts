import type { ClassificationLevel, DocumentStatus } from '@/types/enums';

export type RetentionStatus =
  | 'ACTIVE'
  | 'DUE_SOON'
  | 'OVERDUE'
  | 'ARCHIVED'
  | 'UNSET';

export interface RetentionEvidenceRecord {
  docId: string;
  title: string;
  status: DocumentStatus;
  classification: ClassificationLevel;
  publishedAt: string | null;
  archivedAt: string | null;
  retentionClass: string | null;
  retentionUntil: string | null;
  retentionReason: string | null;
  retentionStatus: RetentionStatus;
  daysRemaining: number | null;
}

export interface RetentionEvidenceResult {
  checkedAt: string;
  summary: {
    tracked: number;
    active: number;
    dueSoon: number;
    overdue: number;
    archived: number;
  };
  records: RetentionEvidenceRecord[];
}

export interface RetentionRunResult {
  archived: number;
  skipped: number;
  checkedAt: string;
}
