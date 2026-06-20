import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DocumentForm } from './document-form';

describe('DocumentForm DLP override controls', () => {
  it('shows override reason for admin downgrading a DLP-detected document', () => {
    const html = renderToStaticMarkup(
      createElement(DocumentForm, {
        defaultValues: {
          title: 'DLP doc',
          description: '',
          classification: 'PUBLIC',
          tags: [],
        },
        dlpStatus: 'DETECTED',
        isAdmin: true,
        onSubmit: () => undefined,
      }),
    );

    expect(html).toContain('Classification override reason');
    expect(html).toContain('Required for admin DLP downgrade override');
  });

  it('hides override reason for non-admin DLP downgrade attempts', () => {
    const html = renderToStaticMarkup(
      createElement(DocumentForm, {
        defaultValues: {
          title: 'DLP doc',
          description: '',
          classification: 'PUBLIC',
          tags: [],
        },
        dlpStatus: 'DETECTED',
        isAdmin: false,
        onSubmit: () => undefined,
      }),
    );

    expect(html).not.toContain('Classification override reason');
  });
});
