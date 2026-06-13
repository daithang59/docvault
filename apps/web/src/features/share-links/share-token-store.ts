import type { ShareLinkPermission } from './share-links.types';

function getStorage(): Storage | undefined {
  try {
    const storage = (globalThis as { sessionStorage?: Storage }).sessionStorage;
    return storage ?? undefined;
  } catch {
    return undefined;
  }
}

const STORAGE_PREFIX = 'dv-share-token:';

interface StoredShareGrant {
  token: string;
  permission?: ShareLinkPermission;
}

function isSharePermission(value: unknown): value is ShareLinkPermission {
  return value === 'VIEW' || value === 'DOWNLOAD';
}

function parseStoredGrant(value: string | null): StoredShareGrant | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as Partial<StoredShareGrant>;
    if (typeof parsed.token !== 'string' || !parsed.token) {
      return undefined;
    }
    return {
      token: parsed.token,
      ...(isSharePermission(parsed.permission)
        ? { permission: parsed.permission }
        : {}),
    };
  } catch {
    return { token: value };
  }
}

/**
 * Share tokens redeemed in this browser session, keyed by document id.
 *
 * Kept in sessionStorage (not localStorage) so a redeemed link grant does not
 * outlive the browser session. The raw token is required to re-authorize
 * download/preview for documents the recipient cannot otherwise access.
 */
export function rememberShareToken(
  docId: string,
  token: string,
  permission?: ShareLinkPermission,
): void {
  if (!docId || !token) return;
  const storage = getStorage();
  if (!storage) return;
  try {
    const grant: StoredShareGrant = {
      token,
      ...(permission ? { permission } : {}),
    };
    storage.setItem(STORAGE_PREFIX + docId, JSON.stringify(grant));
  } catch {
    // sessionStorage may be unavailable (private mode); access just falls back to ACL.
  }
}

export function getShareToken(docId: string): string | undefined {
  if (!docId) return undefined;
  const storage = getStorage();
  if (!storage) return undefined;
  try {
    return parseStoredGrant(storage.getItem(STORAGE_PREFIX + docId))?.token;
  } catch {
    return undefined;
  }
}

export function getSharePermission(
  docId: string,
): ShareLinkPermission | undefined {
  if (!docId) return undefined;
  const storage = getStorage();
  if (!storage) return undefined;
  try {
    return parseStoredGrant(storage.getItem(STORAGE_PREFIX + docId))?.permission;
  } catch {
    return undefined;
  }
}

export function clearShareToken(docId: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_PREFIX + docId);
  } catch {
    // ignore
  }
}
