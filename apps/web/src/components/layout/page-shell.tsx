import { cn } from '@/lib/utils/cn';

interface PageShellProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Unified page wrapper that provides consistent title/description/actions header
 * and padded content area. Use on every route inside (app)/.
 */
export function PageShell({
  title,
  description,
  actions,
  children,
  className,
}: PageShellProps) {
  return (
    <div className={cn('flex flex-col gap-6 h-full', className)}>
      {(title || description || actions) && (
        <div className="flex items-start justify-between gap-4">
          <div>
            {title && (
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
            )}
            {description && (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
          )}
        </div>
      )}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
