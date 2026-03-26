'use client';

import { useFormContext } from 'react-hook-form';
import { cn } from '@/lib/utils/cn';

interface RhfTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  name: string;
  label?: string;
  helperText?: string;
}

export function RhfTextarea({ name, label, helperText, className, ...rest }: RhfTextareaProps) {
  const { register, formState: { errors } } = useFormContext();
  const error = errors[name];

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={name} className="text-sm font-medium text-[var(--text-main)]">
          {label}
          {rest.required && <span className="text-[var(--color-destructive)] ml-0.5">*</span>}
        </label>
      )}
      <textarea
        id={name}
        {...register(name)}
        rows={3}
        className={cn(
          'w-full rounded-xl border px-3 py-2 text-sm resize-y',
          'bg-[var(--input-bg)] text-[var(--input-text)] placeholder:text-[var(--input-placeholder)]',
          'border-[var(--input-border)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--border-focus)]',
          'disabled:bg-[var(--input-disabled-bg)] disabled:cursor-not-allowed',
          'transition-colors',
          error && 'border-[var(--color-destructive)]/60 focus:ring-[var(--color-destructive)]/25',
          className,
        )}
        {...rest}
      />
      {helperText && !error && <p className="text-xs text-[var(--text-muted)]">{helperText}</p>}
      {error && <p className="text-xs text-[var(--color-destructive)]" role="alert">{error.message as string}</p>}
    </div>
  );
}
