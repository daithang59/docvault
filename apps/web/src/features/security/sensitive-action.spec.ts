import { describe, expect, it } from 'vitest';
import {
  getSensitiveActionStepUp,
  isStepUpPhraseMatch,
} from './sensitive-action';

describe('sensitive-action step-up policy', () => {
  it('requires typed confirmation for evidence export actions', () => {
    const stepUp = getSensitiveActionStepUp('export-evidence-packet');

    expect(stepUp).toEqual({
      title: 'Step-up verification required',
      actionLabel: 'Export evidence packet',
      challengePhrase: 'EXPORT EVIDENCE',
      description:
        'This export contains metadata-only compliance evidence. Confirm intent before generating the packet.',
      auditHint: 'The export is protected by backend authorization and should be auditable.',
    });
    expect(isStepUpPhraseMatch(' export evidence ', stepUp.challengePhrase)).toBe(true);
    expect(isStepUpPhraseMatch('export', stepUp.challengePhrase)).toBe(false);
  });

  it('uses a separate phrase for retention runs', () => {
    const stepUp = getSensitiveActionStepUp('run-retention');

    expect(stepUp.challengePhrase).toBe('RUN RETENTION');
    expect(stepUp.actionLabel).toBe('Run retention');
    expect(isStepUpPhraseMatch('RUN RETENTION', stepUp.challengePhrase)).toBe(true);
    expect(isStepUpPhraseMatch('run evidence', stepUp.challengePhrase)).toBe(false);
  });
});
