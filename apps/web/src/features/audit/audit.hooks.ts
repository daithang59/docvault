'use client';

import { useQuery } from '@tanstack/react-query';
import { auditKeys } from './audit.keys';
import { queryAuditLog } from './audit.api';
import type { AuditQueryFilters } from './audit.types';

export function useAuditQuery(filters?: AuditQueryFilters) {
  return useQuery({
    queryKey: auditKeys.query(filters),
    queryFn: () => queryAuditLog(filters),
  });
}
