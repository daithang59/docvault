import { describe, expect, it } from 'vitest';
import { buildLegalHoldStatus } from './legal-hold-presentation';

describe('buildLegalHoldStatus', () => {
  it('describes an active hold and its retention consequence', () => {
    const status = buildLegalHoldStatus({
      legalHold: true,
      legalHoldReason: '  Litigation 2026-CV-01  ',
      legalHoldBy: 'admin-1',
      legalHoldAt: '2026-06-06T00:00:00.000Z',
    });

    expect(status.active).toBe(true);
    expect(status.tone).toBe('held');
    expect(status.title).toBe('Legal hold active');
    expect(status.description).toContain('auto-archive is suspended');
    expect(status.reason).toBe('Litigation 2026-CV-01');
    expect(status.placedBy).toBe('admin-1');
    expect(status.placedAt).toBe('2026-06-06T00:00:00.000Z');
  });

  it('describes a document with no hold and hides stale hold metadata', () => {
    const status = buildLegalHoldStatus({
      legalHold: false,
      legalHoldReason: 'old reason',
      legalHoldBy: 'admin-9',
      legalHoldAt: '2025-01-01T00:00:00.000Z',
    });

    expect(status.active).toBe(false);
    expect(status.tone).toBe('clear');
    expect(status.title).toBe('No legal hold');
    expect(status.reason).toBeNull();
    expect(status.placedBy).toBeNull();
    expect(status.placedAt).toBeNull();
  });
});
