'use client';

import { ClassificationLevel } from '@/types/document';
import { cn } from '@/lib/utils/cn';

const classificationStyles: Record<ClassificationLevel, { bg: string; text: string; border: string; shadow: string; icon: string }> = {
  PUBLIC: { bg: '#F0FDF4', text: '#15803D', border: '#86EFAC', shadow: 'rgba(22,163,74,0.15)', icon: '#22C55E' },
  INTERNAL: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', shadow: 'rgba(29,78,216,0.12)', icon: '#3B82F6' },
  CONFIDENTIAL: { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', shadow: 'rgba(180,83,9,0.12)', icon: '#F59E0B' },
  SECRET: { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA', shadow: 'rgba(185,28,28,0.12)', icon: '#EF4444' },
};

const classificationLabels: Record<ClassificationLevel, string> = {
  PUBLIC: 'Public',
  INTERNAL: 'Internal',
  CONFIDENTIAL: 'Confidential',
  SECRET: 'Secret',
};

interface ClassificationBadgeProps {
  classification?: ClassificationLevel;
  className?: string;
}

export function ClassificationBadge({ classification = 'PUBLIC', className }: ClassificationBadgeProps) {
  const style = classificationStyles[classification];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold border transition-all',
        className
      )}
      style={{
        backgroundColor: style.bg,
        color: style.text,
        borderColor: `${style.icon}25`,
        boxShadow: `0 1px 2px ${style.shadow}`,
      }}
    >
      {/* Lock icon indicator */}
      <span
        className="h-1 w-1 rounded-full shrink-0"
        style={{
          backgroundColor: style.icon,
          boxShadow: `0 0 4px ${style.icon}`,
        }}
      />
      {classificationLabels[classification]}
    </span>
  );
}
