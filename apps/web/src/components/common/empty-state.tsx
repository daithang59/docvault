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
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(241,245,249,0.9), rgba(226,232,240,0.6))',
          border: '1px solid rgba(226,232,240,0.8)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <Icon className="h-7 w-7 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-400 max-w-xs mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}
