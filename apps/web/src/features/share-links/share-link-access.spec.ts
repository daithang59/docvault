import { describe, expect, it } from 'vitest';
import { applySharePermissionToDocumentDecision } from './share-link-access';

describe('applySharePermissionToDocumentDecision', () => {
  const denied = {
    allowed: false,
    reason: 'SECRET documents require ownership or explicit READ ACL allow.',
  };

  it('lets a view-only share link unlock preview without unlocking download', () => {
    expect(
      applySharePermissionToDocumentDecision(denied, 'preview', 'VIEW'),
    ).toEqual({ allowed: true });
    expect(
      applySharePermissionToDocumentDecision(denied, 'download', 'VIEW'),
    ).toEqual({
      allowed: false,
      reason: 'This share link allows view only.',
    });
  });

  it('lets a download share link unlock preview and download', () => {
    expect(
      applySharePermissionToDocumentDecision(denied, 'preview', 'DOWNLOAD'),
    ).toEqual({ allowed: true });
    expect(
      applySharePermissionToDocumentDecision(denied, 'download', 'DOWNLOAD'),
    ).toEqual({ allowed: true });
  });

  it('does not remove access that normal policy already allowed', () => {
    const allowed = { allowed: true };

    expect(
      applySharePermissionToDocumentDecision(allowed, 'download', 'VIEW'),
    ).toEqual(allowed);
  });

  it('does not bypass status or file availability denials', () => {
    const statusDenied = {
      allowed: false,
      reason: 'Only published documents can be downloaded.',
    };

    expect(
      applySharePermissionToDocumentDecision(statusDenied, 'download', 'DOWNLOAD'),
    ).toEqual(statusDenied);
  });
});
