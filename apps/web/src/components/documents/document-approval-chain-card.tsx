'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, Clock, ListOrdered } from 'lucide-react';
import type { DocumentDetail } from '@/features/documents/documents.types';
import { buildApprovalChainModel } from '@/features/documents/approval-chain';
import { useSetApprovalChain } from '@/features/documents/documents.hooks';
import { useOwnerDisplayNames } from '@/features/approvals/approvals.hooks';

interface DocumentApprovalChainCardProps {
  document: DocumentDetail;
  canManage: boolean;
}

export function DocumentApprovalChainCard({
  document,
  canManage,
}: DocumentApprovalChainCardProps) {
  const model = buildApprovalChainModel(document);
  const setChain = useSetApprovalChain(document.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(model.steps.map((s) => s.approverId).join('\n'));

  const approverIds = model.steps.map((s) => s.approverId);
  const { data: displayNames } = useOwnerDisplayNames(approverIds);

  async function handleSave() {
    const approvers = draft
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    await setChain.mutateAsync(approvers);
    setEditing(false);
  }

  return (
    <section
      className="overflow-hidden rounded-lg border bg-[var(--bg-card)]"
      style={{ borderColor: 'var(--border-soft)' }}
      aria-labelledby="approval-chain-heading"
    >
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-soft)' }}>
        <h2
          id="approval-chain-heading"
          className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]"
        >
          <ListOrdered className="h-4 w-4 text-[var(--color-primary)]" />
          Approval chain
        </h2>
        {canManage && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(approverIds.join('\n'));
              setEditing(true);
            }}
            className="text-xs font-medium text-[var(--color-primary)] hover:underline"
          >
            {model.configured ? 'Edit' : 'Configure'}
          </button>
        )}
      </div>

      <div className="p-4">
        {editing ? (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-[var(--text-muted)]">
              Approver user IDs (one per line, in order)
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border bg-[var(--input-bg)] px-3 py-2 font-mono text-xs text-[var(--text-main)]"
                style={{ borderColor: 'var(--border-strong)' }}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={setChain.isPending}
                className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                style={{ background: 'var(--color-primary)' }}
              >
                Save chain
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm text-[var(--text-main)]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : !model.configured ? (
          <p className="text-xs text-[var(--text-faint)]">
            No approval chain configured. Approval follows the default single-approver flow.
          </p>
        ) : (
          <ol className="space-y-2">
            {model.steps.map((step) => {
              const name = displayNames?.[step.approverId]?.displayName ?? step.approverId;
              return (
                <li key={step.approverId} className="flex items-center gap-3">
                  <span className="shrink-0">
                    {step.state === 'approved' ? (
                      <CheckCircle2 className="h-4 w-4 text-[var(--status-published-text)]" />
                    ) : step.state === 'current' ? (
                      <Clock className="h-4 w-4 text-[var(--color-primary)]" />
                    ) : (
                      <Circle className="h-4 w-4 text-[var(--text-faint)]" />
                    )}
                  </span>
                  <span className="text-sm text-[var(--text-main)]">
                    <span className="text-[var(--text-faint)]">{step.position}.</span> {name}
                  </span>
                  {step.state === 'current' && (
                    <span className="ml-auto text-xs font-medium text-[var(--color-primary)]">
                      Awaiting approval
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
