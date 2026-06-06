function getStorage(): Storage | undefined {
  try {
    const storage = (globalThis as { sessionStorage?: Storage }).sessionStorage;
    return storage ?? undefined;
  } catch {
    return undefined;
  }
}

const STORAGE_PREFIX = 'dv-share-token:';

/**
 * Share tokens redeemed in this browser session, keyed by document id.
 *
 * Kept in sessionStorage (not localStorage) so a redeemed link grant does not
 * outlive the browser session. The raw token is required to re-authorize
 * download/preview for documents the recipient cannot otherwise access.
 */
export function rememberShareToken(docId: string, token: string): void {
  if (!docId || !token) return;
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_PREFIX + docId, token);
  } catch {
    // sessionStorage may be unavailable (private mode); access just falls back to ACL.
  }
}

export function getShareToken(docId: string): string | undefined {
  if (!docId) return undefined;
  const storage = getStorage();
  if (!storage) return undefined;
  try {
    return storage.getItem(STORAGE_PREFIX + docId) ?? undefined;
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
