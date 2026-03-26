import { cn } from '@/lib/utils/cn';

interface SectionHeaderProps {
  title: string;
  description?: string;
  className?: string;
  actions?: React.ReactNode;
}

export function SectionHeader({ title, description, className, actions }: SectionHeaderProps) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)}>
      <div>
        <h2 className="text-base font-semibold leading-none text-[var(--text-strong)]">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
