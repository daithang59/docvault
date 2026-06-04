import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('exposes a specific accessible label for stable status assertions', () => {
    const html = renderToStaticMarkup(
      createElement(StatusBadge, { status: 'PENDING' }),
    );

    expect(html).toContain('aria-label="Document status: Pending"');
  });
});
