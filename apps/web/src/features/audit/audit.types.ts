import type { AuditResult } from '@/types/enums';
import type { PaginationParams } from '@/types/pagination';

export interface AuditLogEntry {
  id: string;
  eventId?: string;              // Phase 1 alias for id
  action: string;
  actorId: string;
  actorDisplay?: string;
  actorRoles?: string[];         // Phase 1 field
  result: AuditResult;
  targetType?: string;
  targetId?: string;
  resourceType?: string;         // Phase 1 alias for targetType
  resourceId?: string;           // Phase 1 alias for targetId
  timestamp: string;
  reason?: string;               // Phase 1 field (rejection/deny reason)
  ip?: string | null;            // Phase 1 field
  traceId?: string | null;       // Phase 1 field
  prevHash?: string | null;      // Phase 1 field
  hash?: string;                 // Phase 1 field
  metadata?: Record<string, unknown>;
}

export interface AuditQueryFilters extends PaginationParams {
  actorId?: string;
  action?: string;
  result?: AuditResult;
  targetId?: string;
  targetType?: string;
  resourceId?: string;
  resourceType?: string;
  from?: string;
  to?: string;
  limit?: number;    // Phase 1 backward compat alias for pageSize
}
