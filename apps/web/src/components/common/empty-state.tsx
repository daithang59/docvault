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
      {/* Icon with radial glow + float animation */}
      <div className="relative mx-auto mb-5">
        {/* Radial glow */}
        <div
          className="absolute inset-0 scale-[2] rounded-full blur-2xl opacity-40"
          style={{ background: 'var(--color-primary-light)' }}
        />
        <div
          className="empty-float relative flex h-16 w-16 items-center justify-center rounded-2xl border"
          style={{
            background: 'var(--state-info-bg)',
            borderColor: 'var(--state-info-border)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
          }}
        >
          <Icon className="h-7 w-7" style={{ color: 'var(--color-primary)' }} />
        </div>
      </div>
      <h3 className="mb-1 text-base font-semibold text-[var(--text-main)]">{title}</h3>
      {description && (
        <p className="mb-5 max-w-xs text-sm" style={{ color: 'var(--text-muted)' }}>{description}</p>
      )}
      {action}
    </div>
  );
}
