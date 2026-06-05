export type SensitiveActionKey =
  | 'export-evidence-packet'
  | 'run-retention';

export const SENSITIVE_ACTION_PROOF_HEADER = 'x-docvault-step-up-proof';

export interface SensitiveActionStepUp {
  title: string;
  actionLabel: string;
  challengePhrase: string;
  description: string;
  auditHint: string;
}

export interface SensitiveActionProofRequest {
  action: SensitiveActionKey;
  challengePhrase: string;
}

export interface SensitiveActionProofResponse {
  proof: string;
  expiresAt: string;
}

const STEP_UP_BY_ACTION: Record<SensitiveActionKey, SensitiveActionStepUp> = {
  'export-evidence-packet': {
    title: 'Step-up verification required',
    actionLabel: 'Export evidence packet',
    challengePhrase: 'EXPORT EVIDENCE',
    description:
      'This export contains metadata-only compliance evidence. Confirm intent before generating the packet.',
    auditHint: 'The export is protected by backend authorization and should be auditable.',
  },
  'run-retention': {
    title: 'Step-up verification required',
    actionLabel: 'Run retention',
    challengePhrase: 'RUN RETENTION',
    description:
      'This action can archive records according to retention policy. Confirm intent before running lifecycle automation.',
    auditHint: 'Retention runs emit workflow and audit evidence for archived records.',
  },
};

export function getSensitiveActionStepUp(
  action: SensitiveActionKey,
): SensitiveActionStepUp {
  return STEP_UP_BY_ACTION[action];
}

export function isStepUpPhraseMatch(
  value: string,
  challengePhrase: string,
): boolean {
  return normalizePhrase(value) === normalizePhrase(challengePhrase);
}

function normalizePhrase(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}
