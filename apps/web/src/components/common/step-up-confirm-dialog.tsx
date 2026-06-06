'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { ConfirmDialog } from './confirm-dialog';
import {
  isStepUpPhraseMatch,
  type SensitiveActionStepUp,
} from '@/features/security/sensitive-action';

interface StepUpConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stepUp: SensitiveActionStepUp;
  onConfirm: (typedPhrase: string) => void | Promise<void>;
  loading?: boolean;
}

export function StepUpConfirmDialog({
  open,
  onOpenChange,
  stepUp,
  onConfirm,
  loading,
}: StepUpConfirmDialogProps) {
  const [typedPhrase, setTypedPhrase] = useState('');
  const inputId = useId();
  const phraseMatches = isStepUpPhraseMatch(
    typedPhrase,
    stepUp.challengePhrase,
  );

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setTypedPhrase('');
    }
    onOpenChange(nextOpen);
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={stepUp.title}
      description={stepUp.description}
      confirmLabel={stepUp.actionLabel}
      onConfirm={() => onConfirm(typedPhrase)}
      loading={loading}
      confirmDisabled={!phraseMatches}
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-muted)] p-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
            <p className="text-xs leading-5 text-[var(--text-muted)]">
              {stepUp.auditHint}
            </p>
          </div>
          <Link
            href="/api/auth/login?reauth=1"
            className="mt-2 inline-flex text-xs font-semibold text-[var(--color-primary)] hover:underline"
          >
            Refresh sign-in
          </Link>
        </div>
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
        >
          Type {stepUp.challengePhrase} to continue
        </label>
        <input
          id={inputId}
          value={typedPhrase}
          onChange={(event) => setTypedPhrase(event.target.value)}
          autoComplete="off"
          className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] outline-none transition focus:border-[var(--border-focus)]"
        />
      </div>
    </ConfirmDialog>
  );
}
