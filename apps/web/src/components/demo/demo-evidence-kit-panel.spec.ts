import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildDemoEvidenceKit } from '@/features/demo/demo-evidence-kit';
import { DemoEvidenceKitPanel } from './demo-evidence-kit-panel';

describe('DemoEvidenceKitPanel', () => {
  it('renders presenter checklist, quick links, and export controls', () => {
    const html = renderToStaticMarkup(
      createElement(DemoEvidenceKitPanel, {
        model: buildDemoEvidenceKit({
          generatedAt: '2026-06-04T09:00:00.000Z',
        }),
      }),
    );

    expect(html).toContain('Web runtime evidence');
    expect(html).toContain('Document smart workbench');
    expect(html).toContain('Approval readiness');
    expect(html).toContain('Reject reason presets');
    expect(html).toContain('/security');
    expect(html).toContain('Copy checklist');
    expect(html).toContain('Download markdown');
  });
});
