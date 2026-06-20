import type { ShareLink, ShareLinkStatus } from './share-links.types';

export interface ShareLinkPresentation {
  id: string;
  permissionLabel: string;
  statusLabel: string;
  status: ShareLinkStatus;
  tone: 'active' | 'muted' | 'danger';
  usageLabel: string;
  isActive: boolean;
}

const STATUS_LABELS: Record<ShareLinkStatus, string> = {
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  REVOKED: 'Revoked',
  EXHAUSTED: 'Limit reached',
};

const STATUS_TONES: Record<ShareLinkStatus, ShareLinkPresentation['tone']> = {
  ACTIVE: 'active',
  EXPIRED: 'muted',
  REVOKED: 'danger',
  EXHAUSTED: 'muted',
};

export function buildShareLinkPresentation(link: ShareLink): ShareLinkPresentation {
  const usageLabel =
    link.maxAccessCount == null
      ? `${link.accessCount} open${link.accessCount === 1 ? '' : 's'}`
      : `${link.accessCount} / ${link.maxAccessCount} opens`;

  return {
    id: link.id,
    permissionLabel: link.permission === 'DOWNLOAD' ? 'View + Download' : 'View only',
    statusLabel: STATUS_LABELS[link.status],
    status: link.status,
    tone: STATUS_TONES[link.status],
    usageLabel,
    isActive: link.status === 'ACTIVE',
  };
}

export function buildShareUrl(origin: string, token: string): string {
  const trimmed = origin.replace(/\/+$/, '');
  return `${trimmed}/shared?token=${encodeURIComponent(token)}`;
}
