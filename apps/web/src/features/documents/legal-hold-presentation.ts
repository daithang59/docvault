import type { DocumentDetail, DocumentListItem } from './documents.types';

export type LegalHoldStatus = {
  active: boolean;
  title: string;
  description: string;
  reason: string | null;
  placedBy: string | null;
  placedAt: string | null;
  tone: 'held' | 'clear';
};

type LegalHoldSource = Pick<
  DocumentDetail | DocumentListItem,
  'legalHold' | 'legalHoldReason' | 'legalHoldBy' | 'legalHoldAt'
>;

/**
 * Derive a presentation model for a document's legal hold state.
 *
 * A held document is exempt from retention auto-archive, so the copy makes the
 * operational consequence explicit rather than just showing a flag.
 */
export function buildLegalHoldStatus(document: LegalHoldSource): LegalHoldStatus {
  const active = document.legalHold === true;
  const reason = active ? document.legalHoldReason?.trim() || null : null;

  return {
    active,
    tone: active ? 'held' : 'clear',
    title: active ? 'Legal hold active' : 'No legal hold',
    description: active
      ? 'Retention auto-archive is suspended while this hold is active.'
      : 'This document follows the normal retention schedule.',
    reason,
    placedBy: active ? document.legalHoldBy?.trim() || null : null,
    placedAt: active ? document.legalHoldAt ?? null : null,
  };
}
