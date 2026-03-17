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
        <label htmlFor={name} className="text-sm font-medium text-slate-700">
          {label}
          {rest.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <input
        id={name}
        {...register(name)}
        className={cn(
          'w-full rounded-md border border-slate-200 bg-white px-3 py-2',
          'text-sm text-slate-900 placeholder:text-slate-400',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400',
          'disabled:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400',
          'transition-colors',
          error && 'border-red-400 focus:ring-red-500/20 focus:border-red-400',
          className,
        )}
        {...rest}
      />
      {helperText && !error && (
        <p className="text-xs text-slate-500">{helperText}</p>
      )}
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error.message as string}
        </p>
      )}
    </div>
  );
}
