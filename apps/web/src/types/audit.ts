/**
 * Compatibility shim for types/audit.ts.
 * Re-exports canonical audit types from features/audit.
 * @deprecated Import from @/features/audit/audit.types directly.
 */
export type {
  AuditLogEntry,
  AuditQueryFilters,
} from '@/features/audit/audit.types';

export type { AuditResult } from '@/types/enums';
