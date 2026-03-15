'use client';

import { DocumentStatus } from '@/types/document';
import { cn } from '@/lib/utils/cn';

const statusStyles: Record<DocumentStatus, string> = {
  DRAFT: 'bg-[#F1F5F9] text-[#334155] border-[#CBD5E1]',
  PENDING: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]',
  PUBLISHED: 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]',
  ARCHIVED: 'bg-[#E5E7EB] text-[#4B5563] border-[#D1D5DB]',
};

const statusLabels: Record<DocumentStatus, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

interface StatusBadgeProps {
  status: DocumentStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        statusStyles[status],
        className
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
