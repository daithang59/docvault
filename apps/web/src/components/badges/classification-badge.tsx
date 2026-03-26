'use client';

import { ClassificationLevel } from '@/types/document';
import { cn } from '@/lib/utils/cn';

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
  const key = classification.toLowerCase(); // public | internal | confidential | secret
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold border transition-all',
        className
      )}
      style={{
        backgroundColor: `var(--class-${key}-bg)`,
        color: `var(--class-${key}-text)`,
        borderColor: `var(--class-${key}-border)`,
        boxShadow: `0 1px 2px rgba(0,0,0,0.06)`,
      }}
    >
      {/* Dot indicator */}
      <span
        className="h-1 w-1 rounded-full shrink-0"
        style={{
          backgroundColor: `var(--class-${key}-text)`,
          boxShadow: `0 0 4px var(--class-${key}-text)`,
        }}
      />
      {classificationLabels[classification]}
    </span>
  );
}
