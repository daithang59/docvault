'use client';

import { useState } from 'react';
import { Lock, LockOpen, ShieldAlert } from 'lucide-react';
import type { DocumentDetail } from '@/features/documents/documents.types';
import { buildLegalHoldStatus } from '@/features/documents/legal-hold-presentation';
import { useSetLegalHold } from '@/features/documents/documents.hooks';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { formatDateTime } from '@/lib/utils/date';

interface DocumentLegalHoldCardProps {
  document: DocumentDetail;
  canManage: boolean;
}

export function DocumentLegalHoldCard({
  document,
  canManage,
}: DocumentLegalHoldCardProps) {
  const status = buildLegalHoldStatus(document);
  const setLegalHold = useSetLegalHold(document.id);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [reason, setReason] = useState('');

  const tone = status.active
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : 'border-[var(--border-soft)] bg-[var(--bg-muted)] text-[var(--text-muted)]';

  async function handlePlace() {
    await setLegalHold.mutateAsync({ hold: true, reason: reason.trim() });
    setReason('');
  }

  async function handleRelease() {
    await setLegalHold.mutateAsync({ hold: false });
  }

  return (
    <section
      className="overflow-hidden rounded-lg border bg-[var(--bg-card)]"
      style={{ borderColor: 'var(--border-soft)' }}
      aria-labelledby="document-legal-hold-heading"
    >
      <div
        className="border-b px-4 py-3"
        style={{ borderColor: 'var(--border-soft)' }}
      >
        <h2
          id="document-legal-hold-heading"
          className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]"
        >
          <ShieldAlert className="h-4 w-4 text-[var(--color-primary)]" />
          Legal hold
        </h2>
        <p className="mt-1 text-xs text-[var(--text-faint)]">
          Suspend retention auto-archive for litigation or investigation.
        </p>
      </div>

      <div className="space-y-3 p-4">
        <div className={`flex items-start gap-3 rounded-lg border p-3 ${tone}`}>
          <span className="mt-0.5 shrink-0">
            {status.active ? (
              <Lock className="h-4 w-4" />
            ) : (
              <LockOpen className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{status.title}</p>
            <p className="mt-0.5 text-xs leading-snug">{status.description}</p>
            {status.active && status.reason && (
              <p className="mt-2 text-xs">
                <span className="font-medium">Reason:</span> {status.reason}
              </p>
            )}
            {status.active && (status.placedBy || status.placedAt) && (
              <p className="mt-1 text-xs text-amber-700">
                {status.placedBy ? `Placed by ${status.placedBy}` : 'Placed'}
                {status.placedAt
                  ? ` on ${formatDateTime(status.placedAt)}`
                  : ''}
              </p>
            )}
          </div>
        </div>

        {canManage ? (
          status.active ? (
            <button
              type="button"
              onClick={() => setReleaseOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-muted)]"
            >
              <LockOpen className="h-4 w-4" />
              Release hold
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPlaceOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition hover:brightness-110"
              style={{ background: 'var(--color-primary)' }}
            >
              <Lock className="h-4 w-4" />
              Place hold
            </button>
          )
        ) : (
          <p className="text-xs text-[var(--text-faint)]">
            Only admins can change legal hold.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={placeOpen}
        onOpenChange={(open) => {
          setPlaceOpen(open);
          if (!open) setReason('');
        }}
        title="Place legal hold"
        description="The document will be exempt from retention auto-archive until the hold is released."
        confirmLabel="Place hold"
        loading={setLegalHold.isPending}
        confirmDisabled={reason.trim().length === 0}
        onConfirm={handlePlace}
      >
        <label className="block text-sm font-medium text-[var(--text-main)]">
          Reason
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. Litigation hold for case 2026-CV-01"
            className="mt-1 w-full rounded-lg border bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-main)]"
            style={{ borderColor: 'var(--border-strong)' }}
          />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={releaseOpen}
        onOpenChange={setReleaseOpen}
        title="Release legal hold"
        description="Retention auto-archive will resume for this document."
        confirmLabel="Release hold"
        variant="destructive"
        loading={setLegalHold.isPending}
        onConfirm={handleRelease}
      />
    </section>
  );
}
