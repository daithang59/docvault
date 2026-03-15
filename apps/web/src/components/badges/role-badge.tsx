'use client';

import { UserRole } from '@/types/auth';
import { cn } from '@/lib/utils/cn';

const roleStyles: Record<UserRole, string> = {
  viewer: 'bg-[#F8FAFC] text-[#475569]',
  editor: 'bg-[#EFF6FF] text-[#1D4ED8]',
  approver: 'bg-[#F5F3FF] text-[#6D28D9]',
  compliance_officer: 'bg-[#FFF1F2] text-[#BE123C]',
  admin: 'bg-[#E2E8F0] text-[#0F172A]',
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
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        roleStyles[role],
        className
      )}
    >
      {roleLabels[role]}
    </span>
  );
}
