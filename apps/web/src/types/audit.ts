export type AuditResult = 'SUCCESS' | 'DENY';

export interface AuditLogEntry {
  eventId: string;
  timestamp: string;
  actorId: string;
  actorRoles: string[];
  action: string;
  resourceType: string;
  resourceId: string;
  result: AuditResult;
  reason: string | null;
  ip: string | null;
  traceId: string | null;
  prevHash: string | null;
  hash: string;
}

export interface AuditQueryFilters {
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  result?: AuditResult;
  from?: string;
  to?: string;
  limit?: number;
}
