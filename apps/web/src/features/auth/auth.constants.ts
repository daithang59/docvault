import type { UserRole } from '@/types/enums';
import type { Session } from './auth.types';

/** Demo user presets for development — remove or gate behind env flag in production */
export interface DemoUser {
  username: string;
  role: UserRole;
  label: string;
  description: string;
}

export const DEMO_USERS: DemoUser[] = [
  { username: 'alice', role: 'admin', label: 'Alice (Admin)', description: 'Full access' },
  { username: 'bob', role: 'editor', label: 'Bob (Editor)', description: 'Create & edit documents' },
  { username: 'carol', role: 'approver', label: 'Carol (Approver)', description: 'Approve/reject documents' },
  { username: 'dave', role: 'compliance_officer', label: 'Dave (Compliance)', description: 'View audit logs' },
  { username: 'eve', role: 'viewer', label: 'Eve (Viewer)', description: 'View documents only' },
];

/** Creates a demo session for a given role — for dev only */
export function createDemoSession(user: DemoUser): Session {
  return {
    accessToken: `demo-token-${user.username}`,
    user: {
      sub: `demo-${user.username}`,
      username: user.username,
      email: `${user.username}@docvault.demo`,
      roles: [user.role],
    },
  };
}
