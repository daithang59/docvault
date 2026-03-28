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

type BadgeSize = 'sm' | 'md';

interface RoleBadgeProps {
  role: UserRole;
  size?: BadgeSize;
  className?: string;
}

export function RoleBadge({ role, size = 'sm', className }: RoleBadgeProps) {
  if (!VALID_ROLES.has(role)) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold border transition-all',
        size === 'sm' && 'px-2.5 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
        className
      )}
      style={{
        backgroundColor: `var(--role-${role}-bg)`,
        color: `var(--role-${role}-text)`,
        borderColor: `var(--role-${role}-border)`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      {roleLabels[role]}
    </span>
  );
}
