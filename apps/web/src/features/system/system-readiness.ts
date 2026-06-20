import type { UserInfo } from '@/features/auth/auth.types';
import type { UserRole } from '@/types/enums';

export type SystemReadinessState = 'ready' | 'attention' | 'blocked';

export interface SystemReadinessCard {
  key: 'session' | 'role-coverage' | 'gateway' | 'evidence-export';
  label: string;
  value: string;
  description: string;
  state: SystemReadinessState;
}

export interface SystemCapability {
  key: 'documents' | 'approvals' | 'evidence' | 'admin';
  label: string;
  description: string;
  available: boolean;
}

export interface SystemReadinessModel {
  score: number;
  cards: SystemReadinessCard[];
  capabilities: SystemCapability[];
}

export function buildSystemReadinessModel({
  user,
  appName,
  apiBaseUrl,
}: {
  user: Pick<UserInfo, 'username' | 'sub' | 'displayName' | 'roles'> | null | undefined;
  appName: string;
  apiBaseUrl: string;
}): SystemReadinessModel {
  const roles = new Set<UserRole>(user?.roles ?? []);
  const isAuthenticated = Boolean(user);
  const hasGateway = Boolean(apiBaseUrl.trim());
  const canExportEvidence = roles.has('compliance_officer') || roles.has('admin');

  const cards: SystemReadinessCard[] = [
    {
      key: 'session',
      label: 'Session',
      value: isAuthenticated ? 'Authenticated' : 'Not signed in',
      description: isAuthenticated
        ? `Signed in to ${appName} as ${user?.displayName ?? user?.username ?? user?.sub}.`
        : 'Sign in through Keycloak before running role-specific workflows.',
      state: isAuthenticated ? 'ready' : 'blocked',
    },
    {
      key: 'role-coverage',
      label: 'Role coverage',
      value: `${roles.size} role${roles.size === 1 ? '' : 's'}`,
      description:
        roles.size > 0
          ? 'Role badges drive visible navigation, actions, and evidence access.'
          : 'No application roles are present in the current session.',
      state: roles.size > 0 ? 'ready' : 'blocked',
    },
    {
      key: 'gateway',
      label: 'API gateway',
      value: hasGateway ? 'Configured' : 'Missing URL',
      description: hasGateway
        ? `Frontend API proxy is configured through ${apiBaseUrl}.`
        : 'Set the API base URL before running live workflow demos.',
      state: hasGateway ? 'ready' : 'attention',
    },
    {
      key: 'evidence-export',
      label: 'Evidence export',
      value: canExportEvidence ? 'Available' : 'Role required',
      description: canExportEvidence
        ? 'Metadata-only audit, retention, and document packets can be exported.'
        : 'Compliance Officer or Admin role is required for evidence exports.',
      state: canExportEvidence ? 'ready' : 'blocked',
    },
  ];

  const readyCards = cards.filter((card) => card.state === 'ready').length;

  return {
    score: Math.round((readyCards / cards.length) * 100),
    cards,
    capabilities: buildCapabilities(roles),
  };
}

function buildCapabilities(roles: Set<UserRole>): SystemCapability[] {
  const isAdmin = roles.has('admin');

  const capabilities: SystemCapability[] = [
    {
      key: 'documents',
      label: 'Create, upload, and submit documents',
      description: 'Editor or Admin can create metadata, upload versions, and submit review.',
      available: isAdmin || roles.has('editor'),
    },
    {
      key: 'approvals',
      label: 'Approve or reject review items',
      description: 'Approver or Admin can make lifecycle decisions.',
      available: isAdmin || roles.has('approver'),
    },
    {
      key: 'evidence',
      label: 'Export metadata-only evidence packets',
      description: 'Compliance Officer or Admin can export audit-safe evidence.',
      available: isAdmin || roles.has('compliance_officer'),
    },
    {
      key: 'admin',
      label: 'Manage ACLs and application readiness',
      description: 'Admin can inspect role coverage and manage sensitive access.',
      available: isAdmin,
    },
  ];

  return capabilities.filter((capability) => capability.available);
}
