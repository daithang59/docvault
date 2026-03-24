'use client';

import { DocumentStatus } from '@/types/document';
import { cn } from '@/lib/utils/cn';

const statusStyles: Record<DocumentStatus, { bg: string; text: string; dot: string; shadow: string }> = {
  DRAFT: { bg: '#F1F5F9', text: '#475569', dot: '#94A3B8', shadow: 'rgba(0,0,0,0.06)' },
  PENDING: { bg: '#FFFBEB', text: '#92400E', dot: '#F59E0B', shadow: 'rgba(245,158,11,0.2)' },
  PUBLISHED: { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E', shadow: 'rgba(34,197,94,0.2)' },
  ARCHIVED: { bg: '#F9FAFB', text: '#6B7280', dot: '#9CA3AF', shadow: 'rgba(0,0,0,0.06)' },
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
  const style = statusStyles[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all',
        className
      )}
      style={{
        backgroundColor: style.bg,
        color: style.text,
        borderColor: `${style.dot}30`,
        boxShadow: `0 1px 2px ${style.shadow}`,
      }}
    >
      {/* Glowing dot */}
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{
          backgroundColor: style.dot,
          boxShadow: `0 0 4px ${style.dot}`,
        }}
      />
      {statusLabels[status]}
    </span>
  );
}
