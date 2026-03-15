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
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F1F5F9]">
        <Icon className="h-7 w-7 text-[#94A3B8]" />
      </div>
      <h3 className="text-base font-semibold text-[#1E293B] mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[#64748B] max-w-xs mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}
