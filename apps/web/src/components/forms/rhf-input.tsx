'use client';

import { useFormContext } from 'react-hook-form';
import { cn } from '@/lib/utils/cn';

interface RhfInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label?: string;
  helperText?: string;
}

export function RhfInput({ name, label, helperText, className, ...rest }: RhfInputProps) {
  const { register, formState: { errors } } = useFormContext();
  const error = errors[name];

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={name} className="text-sm font-semibold text-[var(--text-main)]">
          {label}
          {rest.required && <span className="text-[var(--color-destructive)] ml-0.5">*</span>}
        </label>
      )}
      <input
        id={name}
        {...register(name)}
        className={cn(
          'w-full rounded-xl border px-3.5 py-2.5 text-sm',
          'bg-[var(--input-bg)] text-[var(--input-text)] placeholder:text-[var(--input-placeholder)]',
          'border-[var(--input-border)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--border-focus)]',
          'disabled:bg-[var(--input-disabled-bg)] disabled:cursor-not-allowed disabled:text-[var(--input-disabled-text)]',
          'transition-all duration-200',
          error && 'border-[var(--color-destructive)]/60 focus:ring-[var(--color-destructive)]/25 focus:border-[var(--color-destructive)] bg-[var(--color-destructive)]/5',
          className,
        )}
        {...rest}
      />
      {helperText && !error && (
        <p className="text-xs text-[var(--text-muted)]">{helperText}</p>
      )}
      {error && (
        <p className="text-xs text-[var(--color-destructive)]" role="alert">
          {error.message as string}
        </p>
      )}
    </div>
  );
}
