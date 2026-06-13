import { describe, expect, it } from 'vitest';
import { buildApprovalChainModel } from './approval-chain';

describe('buildApprovalChainModel', () => {
  it('reports not configured when there is no chain', () => {
    const m = buildApprovalChainModel({ approvalChain: [], approvalStep: 0, status: 'PENDING' });
    expect(m.configured).toBe(false);
    expect(m.steps).toHaveLength(0);
    expect(m.currentApproverId).toBeNull();
  });

  it('marks earlier steps approved and the current step pending', () => {
    const m = buildApprovalChainModel({
      approvalChain: ['a', 'b', 'c'],
      approvalStep: 1,
      status: 'PENDING',
    });
    expect(m.steps.map((s) => s.state)).toEqual(['approved', 'current', 'pending']);
    expect(m.currentApproverId).toBe('b');
    expect(m.approvedCount).toBe(1);
    expect(m.totalSteps).toBe(3);
  });

  it('treats a published document as fully approved', () => {
    const m = buildApprovalChainModel({
      approvalChain: ['a', 'b'],
      approvalStep: 1,
      status: 'PUBLISHED',
    });
    expect(m.steps.every((s) => s.state === 'approved')).toBe(true);
    expect(m.currentApproverId).toBeNull();
    expect(m.approvedCount).toBe(2);
  });
});
