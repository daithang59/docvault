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
        <label htmlFor={name} className="text-sm font-medium text-slate-700">
          {label}
          {rest.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        id={name}
        {...register(name)}
        className={cn(
          'w-full rounded-md border border-slate-200 bg-white px-3 py-2',
          'text-sm text-slate-900',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400',
          'disabled:bg-slate-50 disabled:cursor-not-allowed',
          'transition-colors appearance-none',
          error && 'border-red-400',
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
      {helperText && !error && <p className="text-xs text-slate-500">{helperText}</p>}
      {error && <p className="text-xs text-red-600" role="alert">{error.message as string}</p>}
    </div>
  );
}
