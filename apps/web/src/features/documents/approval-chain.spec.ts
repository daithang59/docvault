import { describe, expect, it } from 'vitest';
import {
  buildApprovalChainModel,
  createApprovalChainDraft,
  hasDuplicateApprovalChainApprovers,
  moveApprovalChainApprover,
  normalizeApprovalChainApprovers,
  removeApprovalChainApprover,
  updateApprovalChainApprover,
} from './approval-chain';

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

describe('approval chain draft editing', () => {
  it('starts with one empty picker when no chain exists', () => {
    expect(createApprovalChainDraft([])).toEqual(['']);
  });

  it('normalizes selected approvers before saving while preserving order', () => {
    expect(normalizeApprovalChainApprovers([' approver-1 ', '', 'admin-1']))
      .toEqual(['approver-1', 'admin-1']);
  });

  it('flags duplicate approvers after trimming', () => {
    expect(hasDuplicateApprovalChainApprovers(['approver-1', ' approver-1 ']))
      .toBe(true);
    expect(hasDuplicateApprovalChainApprovers(['approver-1', 'admin-1']))
      .toBe(false);
  });

  it('updates, removes, and reorders approvers without mutating the draft', () => {
    const draft = ['approver-1', 'admin-1', 'approver-2'];

    expect(updateApprovalChainApprover(draft, 1, 'admin-2')).toEqual([
      'approver-1',
      'admin-2',
      'approver-2',
    ]);
    expect(removeApprovalChainApprover(draft, 0)).toEqual([
      'admin-1',
      'approver-2',
    ]);
    expect(moveApprovalChainApprover(draft, 2, -1)).toEqual([
      'approver-1',
      'approver-2',
      'admin-1',
    ]);
    expect(draft).toEqual(['approver-1', 'admin-1', 'approver-2']);
  });
});
