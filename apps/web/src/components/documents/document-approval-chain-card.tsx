'use client';

import { type ReactNode, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Circle,
  Clock,
  ListOrdered,
  Plus,
  Trash2,
} from 'lucide-react';
import type { DocumentDetail } from '@/features/documents/documents.types';
import {
  buildApprovalChainModel,
  canEditApprovalChain,
  createApprovalChainDraft,
  hasDuplicateApprovalChainApprovers,
  moveApprovalChainApprover,
  normalizeApprovalChainApprovers,
  removeApprovalChainApprover,
  updateApprovalChainApprover,
} from '@/features/documents/approval-chain';
import {
  useDocumentApprovers,
  useSetApprovalChain,
} from '@/features/documents/documents.hooks';
import { useOwnerDisplayNames } from '@/features/approvals/approvals.hooks';
import { UserCombobox } from '@/components/common/user-combobox';

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
  const [draftApprovers, setDraftApprovers] = useState(() =>
    createApprovalChainDraft(model.steps.map((s) => s.approverId)),
  );
  const canEditChain = canEditApprovalChain(document, canManage);

  const approverIds = model.steps.map((s) => s.approverId);
  const { data: displayNames } = useOwnerDisplayNames(approverIds);
  const approverDirectory = useDocumentApprovers(document.id, canEditChain && editing);
  const pickerUserIds = useMemo(
    () => (approverDirectory.isError ? undefined : (approverDirectory.data ?? [])),
    [approverDirectory.data, approverDirectory.isError],
  );
  const normalizedDraftApprovers = useMemo(
    () => normalizeApprovalChainApprovers(draftApprovers),
    [draftApprovers],
  );
  const hasDuplicateDraftApprovers = useMemo(
    () => hasDuplicateApprovalChainApprovers(draftApprovers),
    [draftApprovers],
  );
  const canSaveDraft =
    normalizedDraftApprovers.length > 0 &&
    !hasDuplicateDraftApprovers &&
    !setChain.isPending;

  async function handleSave() {
    if (!canSaveDraft) return;

    await setChain.mutateAsync(normalizedDraftApprovers);
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
        {canEditChain && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraftApprovers(createApprovalChainDraft(approverIds));
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
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-[var(--text-muted)]">
                  Approvers
                </p>
                <button
                  type="button"
                  onClick={() => setDraftApprovers((current) => [...current, ''])}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-card-hover)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add approver
                </button>
              </div>

              {draftApprovers.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--border-soft)] px-3 py-3 text-xs text-[var(--text-faint)]">
                  No approvers selected.
                </p>
              ) : (
                <div className="space-y-2">
                  {draftApprovers.map((approverId, index) => (
                    <div
                      key={`${index}-${approverId}`}
                      className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2"
                    >
                      <span className="text-right text-xs text-[var(--text-faint)]">
                        {index + 1}.
                      </span>
                      <UserCombobox
                        value={approverId}
                        onChange={(value) =>
                          setDraftApprovers((current) =>
                            updateApprovalChainApprover(current, index, value),
                          )
                        }
                        placeholder="Select approver…"
                        searchPlaceholder="Search approver…"
                        fallbackPlaceholder="Approver user ID..."
                        allowClear
                        userIds={pickerUserIds}
                        usersLoading={approverDirectory.isLoading}
                      />
                      <div className="flex items-center gap-1">
                        <IconButton
                          label="Move approver up"
                          onClick={() =>
                            setDraftApprovers((current) =>
                              moveApprovalChainApprover(current, index, -1),
                            )
                          }
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton
                          label="Move approver down"
                          onClick={() =>
                            setDraftApprovers((current) =>
                              moveApprovalChainApprover(current, index, 1),
                            )
                          }
                          disabled={index === draftApprovers.length - 1}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton
                          label="Remove approver"
                          onClick={() =>
                            setDraftApprovers((current) =>
                              removeApprovalChainApprover(current, index),
                            )
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {normalizedDraftApprovers.length === 0 && (
              <p className="text-xs text-[var(--state-error-text)]">
                Select at least one approver.
              </p>
            )}
            {hasDuplicateDraftApprovers && (
              <p className="text-xs text-[var(--state-error-text)]">
                Each approver can appear only once.
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSaveDraft}
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

function IconButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-soft)] text-[var(--text-muted)] transition hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
