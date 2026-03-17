import type { AuditResult } from '@/types/enums';
import type { PaginationParams } from '@/types/pagination';

export interface AuditLogItemDto {
  eventId: string;
  action: string;
  actorId: string;
  actorRoles: string[];
  result: AuditResult;
  resourceType: string;
  resourceId?: string | null;
  timestamp: string;
  reason?: string | null;
  ip?: string | null;
  traceId?: string | null;
  prevHash?: string | null;
  hash?: string;
  id?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export type AuditLogEntry = AuditLogItemDto;

export interface AuditQueryFilters extends PaginationParams {
  actorId?: string;
  action?: string;
  result?: AuditResult;
  resourceId?: string;
  resourceType?: string;
  from?: string;
  to?: string;
  limit?: number;
  targetId?: string;
  targetType?: string;
}
