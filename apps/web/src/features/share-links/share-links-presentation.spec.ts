import { describe, expect, it } from 'vitest';
import {
  buildShareLinkPresentation,
  buildShareUrl,
} from './share-links-presentation';
import type { ShareLink } from './share-links.types';

function makeLink(overrides: Partial<ShareLink> = {}): ShareLink {
  return {
    id: 'link-1',
    docId: 'doc-1',
    permission: 'VIEW',
    createdBy: 'owner-1',
    createdAt: '2026-06-06T00:00:00.000Z',
    expiresAt: '2026-06-07T00:00:00.000Z',
    maxAccessCount: null,
    accessCount: 0,
    lastAccessedAt: null,
    revokedAt: null,
    revokedBy: null,
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('buildShareLinkPresentation', () => {
  it('labels an active view-only link with unbounded usage', () => {
    const p = buildShareLinkPresentation(makeLink());
    expect(p.permissionLabel).toBe('View only');
    expect(p.statusLabel).toBe('Active');
    expect(p.tone).toBe('active');
    expect(p.usageLabel).toBe('0 opens');
    expect(p.isActive).toBe(true);
  });

  it('shows capped usage and download permission', () => {
    const p = buildShareLinkPresentation(
      makeLink({ permission: 'DOWNLOAD', maxAccessCount: 5, accessCount: 2 }),
    );
    expect(p.permissionLabel).toBe('View + Download');
    expect(p.usageLabel).toBe('2 / 5 opens');
  });

  it('marks revoked links as danger and inactive', () => {
    const p = buildShareLinkPresentation(makeLink({ status: 'REVOKED' }));
    expect(p.tone).toBe('danger');
    expect(p.isActive).toBe(false);
    expect(p.statusLabel).toBe('Revoked');
  });

  it('marks exhausted links as limit reached', () => {
    const p = buildShareLinkPresentation(makeLink({ status: 'EXHAUSTED' }));
    expect(p.statusLabel).toBe('Limit reached');
    expect(p.isActive).toBe(false);
  });
});

describe('buildShareUrl', () => {
  it('builds a shared URL and trims trailing slashes', () => {
    expect(buildShareUrl('https://vault.example/', 'abc')).toBe(
      'https://vault.example/shared?token=abc',
    );
  });

  it('encodes the token', () => {
    expect(buildShareUrl('https://vault.example', 'a b/c')).toBe(
      'https://vault.example/shared?token=a%20b%2Fc',
    );
  });
});
