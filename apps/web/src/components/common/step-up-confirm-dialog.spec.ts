import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StepUpConfirmDialog } from './step-up-confirm-dialog';
import { getSensitiveActionStepUp } from '@/features/security/sensitive-action';

describe('StepUpConfirmDialog', () => {
  it('renders the challenge phrase and disables confirmation before typed verification', () => {
    const html = renderToStaticMarkup(
      createElement(StepUpConfirmDialog, {
        open: true,
        onOpenChange: () => undefined,
        stepUp: getSensitiveActionStepUp('export-evidence-packet'),
        onConfirm: () => undefined,
      }),
    );

    expect(html).toContain('Step-up verification required');
    expect(html).toContain('EXPORT EVIDENCE');
    expect(html).toContain('The export is protected by backend authorization');
    expect(html).toContain('disabled=""');
  });
});
