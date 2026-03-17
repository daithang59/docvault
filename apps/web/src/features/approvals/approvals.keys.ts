import type { ApprovalQueueFilters } from './approvals.types';

export const approvalsKeys = {
  all: ['approvals'] as const,
  queues: () => [...approvalsKeys.all, 'queue'] as const,
  queue: (filters?: ApprovalQueueFilters) => [...approvalsKeys.queues(), filters] as const,
};
