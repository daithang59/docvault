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

export function canEditApprovalChain(
  document: Pick<DocumentDetail, 'status'>,
  canManage: boolean,
): boolean {
  return canManage && document.status === 'PENDING';
}

export function createApprovalChainDraft(approverIds: string[]): string[] {
  const normalized = normalizeApprovalChainApprovers(approverIds);
  return normalized.length > 0 ? normalized : [''];
}

export function normalizeApprovalChainApprovers(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

export function hasDuplicateApprovalChainApprovers(values: string[]): boolean {
  const normalized = normalizeApprovalChainApprovers(values);
  return new Set(normalized).size !== normalized.length;
}

export function updateApprovalChainApprover(
  values: string[],
  index: number,
  approverId: string,
): string[] {
  return values.map((value, currentIndex) =>
    currentIndex === index ? approverId : value,
  );
}

export function removeApprovalChainApprover(
  values: string[],
  index: number,
): string[] {
  return values.filter((_, currentIndex) => currentIndex !== index);
}

export function moveApprovalChainApprover(
  values: string[],
  index: number,
  direction: -1 | 1,
): string[] {
  const targetIndex = index + direction;
  if (index < 0 || index >= values.length || targetIndex < 0 || targetIndex >= values.length) {
    return values;
  }

  const next = [...values];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}
