export type ShareLinkPermission = 'VIEW' | 'DOWNLOAD';
export type ShareLinkStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'EXHAUSTED';

export interface ShareLink {
  id: string;
  docId: string;
  permission: ShareLinkPermission;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  maxAccessCount: number | null;
  accessCount: number;
  lastAccessedAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  status: ShareLinkStatus;
}

export interface CreatedShareLink extends ShareLink {
  /** Raw token, returned exactly once at creation time. */
  token: string;
}

export interface CreateShareLinkInput {
  permission: ShareLinkPermission;
  expiresInHours: number;
  maxAccessCount?: number;
}

export interface ShareLinkRedeemResult {
  docId: string;
  permission: ShareLinkPermission;
  documentTitle: string;
  currentVersion: number;
  expiresAt: string;
}
