import { describe, expect, it } from 'vitest';
import { NAV_ITEMS } from './nav';

describe('NAV_ITEMS', () => {
  it('does not expose Demo Kit in customer-facing navigation', () => {
    expect(NAV_ITEMS.map((item) => item.label)).not.toContain('Demo Kit');
    expect(NAV_ITEMS.map((item) => item.href)).not.toContain('/demo-kit');
  });
});
