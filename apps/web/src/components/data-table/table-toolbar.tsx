import { cn } from '@/lib/utils/cn';

interface TableToolbarProps {
  search?: React.ReactNode;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function TableToolbar({ search, filters, actions, className }: TableToolbarProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4', className)}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {search && <div className="w-full max-w-sm">{search}</div>}
        {filters && <div className="flex items-center gap-2 flex-wrap">{filters}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
