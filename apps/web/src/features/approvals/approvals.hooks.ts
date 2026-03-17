'use client';

import { useQuery } from '@tanstack/react-query';
import { approvalsKeys } from './approvals.keys';
import { getApprovalQueue } from './approvals.api';
import type { ApprovalQueueFilters } from './approvals.types';

export function useApprovalQueue(filters?: ApprovalQueueFilters) {
  return useQuery({
    queryKey: approvalsKeys.queue(filters),
    queryFn: () => getApprovalQueue(filters),
  });
}
