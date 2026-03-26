'use client';

import { useFormContext } from 'react-hook-form';
import { cn } from '@/lib/utils/cn';
import type { LabeledValue } from '@/types/common';

interface RhfSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  name: string;
  label?: string;
  options: LabeledValue[];
  placeholder?: string;
  helperText?: string;
}

export function RhfSelect({
  name,
  label,
  options,
  placeholder,
  helperText,
  className,
  ...rest
}: RhfSelectProps) {
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
      <select
        id={name}
        {...register(name)}
        className={cn(
          'w-full rounded-xl border px-3 py-2 text-sm',
          'bg-[var(--input-bg)] text-[var(--input-text)]',
          'border-[var(--input-border)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--border-focus)]',
          'disabled:bg-[var(--input-disabled-bg)] disabled:cursor-not-allowed',
          'transition-colors appearance-none',
          error && 'border-[var(--color-destructive)]/60 focus:ring-[var(--color-destructive)]/25',
          className,
        )}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {helperText && !error && <p className="text-xs text-[var(--text-muted)]">{helperText}</p>}
      {error && <p className="text-xs text-[var(--color-destructive)]" role="alert">{error.message as string}</p>}
    </div>
  );
}
