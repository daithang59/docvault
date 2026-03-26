'use client';

import { useFormContext, Controller } from 'react-hook-form';
import { X } from 'lucide-react';
import { useState, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils/cn';

interface RhfMultiSelectProps {
  name: string;
  label?: string;
  placeholder?: string;
  helperText?: string;
  suggestions?: string[];
}

export function RhfMultiSelect({
  name,
  label,
  placeholder = 'Type and press Enter...',
  helperText,
  suggestions = [],
}: RhfMultiSelectProps) {
  const { control, formState: { errors } } = useFormContext();
  const [inputValue, setInputValue] = useState('');
  const error = errors[name];

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const values: string[] = Array.isArray(field.value) ? field.value : [];

        const addTag = (tag: string) => {
          const trimmed = tag.trim();
          if (trimmed && !values.includes(trimmed)) {
            field.onChange([...values, trimmed]);
          }
          setInputValue('');
        };

        const removeTag = (tag: string) => {
          field.onChange(values.filter((v) => v !== tag));
        };

        const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(inputValue);
          } else if (e.key === 'Backspace' && !inputValue && values.length > 0) {
            removeTag(values[values.length - 1]);
          }
        };

        return (
          <div className="flex flex-col gap-1.5">
            {label && (
              <label className="text-sm font-medium text-[var(--text-main)]">{label}</label>
            )}
            <div
              className={cn(
                'min-h-[40px] flex flex-wrap gap-1.5 rounded-xl border px-3 py-2',
                'bg-[var(--input-bg)] border-[var(--input-border)]',
                'focus-within:ring-2 focus-within:ring-[var(--focus-ring)] focus-within:border-[var(--border-focus)]',
                error && 'border-[var(--color-destructive)]/60',
              )}
            >
              {values.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded border border-[var(--color-primary)]/20 bg-[var(--color-primary-light)] px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-[var(--color-primary)]/80 transition-colors hover:text-[var(--color-destructive)]"
                    aria-label={`Remove ${tag}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => inputValue && addTag(inputValue)}
                placeholder={values.length === 0 ? placeholder : ''}
                className="min-w-[120px] flex-1 bg-transparent text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] focus:outline-none"
                list={`${name}-suggestions`}
              />
              {suggestions.length > 0 && (
                <datalist id={`${name}-suggestions`}>
                  {suggestions.map((s) => <option key={s} value={s} />)}
                </datalist>
              )}
            </div>
            {helperText && !error && <p className="text-xs text-[var(--text-muted)]">{helperText}</p>}
            {error && <p className="text-xs text-[var(--color-destructive)]" role="alert">{error.message as string}</p>}
          </div>
        );
      }}
    />
  );
}
