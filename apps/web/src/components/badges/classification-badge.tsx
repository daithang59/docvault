'use client';

import { ClassificationLevel } from '@/types/document';
import { cn } from '@/lib/utils/cn';

const classificationStyles: Record<ClassificationLevel, string> = {
  PUBLIC: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
  INTERNAL: 'bg-[#E0F2FE] text-[#0369A1] border-[#7DD3FC]',
  CONFIDENTIAL: 'bg-[#FFF7ED] text-[#C2410C] border-[#FDBA74]',
  SECRET: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]',
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
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
        classificationStyles[classification],
        className
      )}
    >
      {classificationLabels[classification]}
    </span>
  );
}
