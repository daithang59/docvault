'use client';

import { DocumentStatus } from '@/types/document';
import { cn } from '@/lib/utils/cn';

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
  const key = status.toLowerCase(); // draft | pending | published | archived
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all',
        className
      )}
      style={{
        backgroundColor: `var(--status-${key}-bg)`,
        color: `var(--status-${key}-text)`,
        borderColor: `var(--status-${key}-border)`,
        boxShadow: `0 1px 3px rgba(0,0,0,0.08)`,
      }}
    >
      {/* Glowing dot */}
      <span
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{
          backgroundColor: `var(--status-${key}-text)`,
          boxShadow: `0 0 6px var(--status-${key}-text)`,
        }}
      />
      {statusLabels[status]}
    </span>
  );
}
