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
      <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 z-10">
        <div className="flex gap-4 mb-4">
          {variant === 'destructive' && (
            <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-[#FEF2F2]">
              <AlertTriangle className="h-5 w-5 text-[#DC2626]" />
            </div>
          )}
          <div>
            <h2 className="text-base font-semibold text-[#0F172A]">{title}</h2>
            {description && (
              <p className="text-sm text-[#64748B] mt-1">{description}</p>
            )}
          </div>
        </div>
        {children && <div className="mb-4">{children}</div>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-white border border-[#CBD5E1] text-sm font-medium text-[#1E293B] hover:bg-[#F8FAFC] transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 ${
              variant === 'destructive'
                ? 'bg-[#DC2626] hover:bg-[#B91C1C]'
                : 'bg-[#2563EB] hover:bg-[#1D4ED8]'
            }`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
