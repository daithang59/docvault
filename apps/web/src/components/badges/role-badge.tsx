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

const roleStyles: Record<UserRole, { bg: string; text: string; border: string; shadow: string }> = {
  viewer: { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0', shadow: 'rgba(0,0,0,0.04)' },
  editor: { bg: '#EFF6FF', text: '#3B82F6', border: '#BFDBFE', shadow: 'rgba(59,130,246,0.12)' },
  approver: { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE', shadow: 'rgba(124,58,237,0.12)' },
  compliance_officer: { bg: '#FFF7F7', text: '#E11D48', border: '#FECDD3', shadow: 'rgba(225,29,72,0.12)' },
  admin: { bg: '#0F172A', text: '#F8FAFC', border: '#334155', shadow: 'rgba(0,0,0,0.15)' },
};

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
  const style = roleStyles[role];
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all hover:-translate-y-0.5',
        className
      )}
      style={{
        backgroundColor: style.bg,
        color: style.text,
        borderColor: style.border,
        boxShadow: `0 1px 2px ${style.shadow}`,
      }}
    >
      {roleLabels[role]}
    </span>
  );
}
