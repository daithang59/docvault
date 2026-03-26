'use client';

import { FolderOpen, Search, FileText, ClipboardList, AudioWaveform } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: 'document' | 'folder' | 'search' | 'audit' | 'list';
  action?: React.ReactNode;
  className?: string;
}

const icons = {
  document: FileText,
  folder: FolderOpen,
  search: Search,
  audit: AudioWaveform,
  list: ClipboardList,
};

export function EmptyState({
  title,
  description,
  icon = 'folder',
  action,
  className,
}: EmptyStateProps) {
  const Icon = icons[icon];
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border"
        style={{
          background: 'var(--state-info-bg)',
          borderColor: 'var(--state-info-border)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <Icon className="h-7 w-7" style={{ color: 'var(--state-info-text)' }} />
      </div>
      <h3 className="mb-1 text-base font-semibold text-[var(--text-main)]">{title}</h3>
      {description && (
        <p className="mb-4 max-w-xs text-sm" style={{ color: 'var(--state-info-text)' }}>{description}</p>
      )}
      {action}
    </div>
  );
}
