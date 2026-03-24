'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, badge, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-6', className)}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-semibold text-slate-800 truncate tracking-tight">{title}</h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-sm text-slate-500">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
