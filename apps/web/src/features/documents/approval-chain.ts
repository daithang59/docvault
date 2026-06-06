import type { DocumentDetail } from './documents.types';

export interface ApprovalChainStep {
  approverId: string;
  position: number;
  state: 'approved' | 'current' | 'pending';
}

export interface ApprovalChainModel {
  configured: boolean;
  steps: ApprovalChainStep[];
  currentApproverId: string | null;
  totalSteps: number;
  approvedCount: number;
}

/**
 * Build a presentation model for a document's sequential approval chain.
 * Steps before the current step are approved, the step at the current index is
 * pending the current approver, and later steps are not yet reachable.
 */
export function buildApprovalChainModel(
  document: Pick<DocumentDetail, 'approvalChain' | 'approvalStep' | 'status'>,
): ApprovalChainModel {
  const chain = document.approvalChain ?? [];
  const step = document.approvalStep ?? 0;
  const published = document.status === 'PUBLISHED';

  const steps: ApprovalChainStep[] = chain.map((approverId, index) => {
    let state: ApprovalChainStep['state'];
    if (published || index < step) {
      state = 'approved';
    } else if (index === step) {
      state = 'current';
    } else {
      state = 'pending';
    }
    return { approverId, position: index + 1, state };
  });

  return {
    configured: chain.length > 0,
    steps,
    currentApproverId: published ? null : (chain[step] ?? null),
    totalSteps: chain.length,
    approvedCount: published ? chain.length : Math.min(step, chain.length),
  };
}
