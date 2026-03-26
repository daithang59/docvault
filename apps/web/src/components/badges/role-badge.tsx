'use client';

import { UserRole } from '@/types/auth';
import { cn } from '@/lib/utils/cn';

const VALID_ROLES = new Set<UserRole>([
  'viewer',
  'editor',
  'approver',
  'compliance_officer',
  'admin',
]);

const roleLabels: Record<UserRole, string> = {
  viewer: 'Viewer',
  editor: 'Editor',
  approver: 'Approver',
  compliance_officer: 'Compliance',
  admin: 'Admin',
};

interface RoleBadgeProps {
  role: UserRole;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  if (!VALID_ROLES.has(role)) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all hover:-translate-y-0.5',
        className
      )}
      style={{
        backgroundColor: `var(--role-${role}-bg)`,
        color: `var(--role-${role}-text)`,
        borderColor: `var(--role-${role}-border)`,
        boxShadow: `0 1px 2px rgba(0,0,0,0.06)`,
      }}
    >
      {roleLabels[role]}
    </span>
  );
}
