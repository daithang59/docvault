import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DocumentAccessImpactCard } from './document-access-impact-card';

describe('DocumentAccessImpactCard', () => {
  it('renders access expansion and watermark reduction warnings', () => {
    const html = renderToStaticMarkup(
      createElement(DocumentAccessImpactCard, {
        impact: {
          documentId: 'doc-1',
          current: {
            classification: 'CONFIDENTIAL',
            status: 'PUBLISHED',
            watermarkRequired: true,
          },
          proposed: {
            classification: 'PUBLIC',
            status: 'PUBLISHED',
            watermarkRequired: false,
          },
          changes: {
            accessExpanded: true,
            accessReduced: false,
            watermarkReduced: true,
            dlpOverrideRequired: true,
            warnings: [
              'Proposed classification expands baseline access.',
              'Watermarking would no longer be required.',
            ],
          },
          roleImpacts: [
            {
              role: 'viewer',
              metadata: { current: false, proposed: true },
              download: { current: false, proposed: true },
              notes: ['Download becomes allowed for baseline viewer role.'],
            },
          ],
          guardrails: [
            'This is a policy simulation only; backend authorization remains authoritative.',
          ],
        },
      }),
    );

    expect(html).toContain('Access impact preview');
    expect(html).toContain('CONFIDENTIAL');
    expect(html).toContain('PUBLIC');
    expect(html).toContain('Access expands');
    expect(html).toContain('Watermark reduced');
    expect(html).toContain('viewer');
    expect(html).toContain('Download becomes allowed');
  });
});
