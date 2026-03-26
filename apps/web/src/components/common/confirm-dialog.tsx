'use client';

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  loading,
  children,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = loading || internalLoading;

  async function handleConfirm() {
    setInternalLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setInternalLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => !isLoading && onOpenChange(false)}
      />
      <div
        className="relative z-10 mx-4 w-full max-w-md rounded-2xl border p-6"
        style={{
          background: 'var(--surface-overlay-strong)',
          borderColor: 'var(--surface-border)',
          boxShadow: 'var(--surface-shadow-lg)',
        }}
      >
        <div className="mb-4 flex gap-4">
          {variant === 'destructive' && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--state-error-bg)' }}>
              <AlertTriangle className="h-5 w-5" style={{ color: 'var(--state-error-text)' }} />
            </div>
          )}
          <div>
            <h2 className="text-base font-semibold text-[var(--text-strong)]">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
            )}
          </div>
        </div>
        {children && <div className="mb-4">{children}</div>}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="rounded-xl border bg-[var(--input-bg)] px-4 py-2 text-sm font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-muted)] disabled:opacity-50"
            style={{ borderColor: 'var(--border-strong)' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
              variant === 'destructive'
                ? 'bg-[var(--color-destructive)] hover:brightness-95'
                : 'btn-primary'
            }`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
