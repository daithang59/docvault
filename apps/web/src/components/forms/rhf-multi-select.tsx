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
              <label className="text-sm font-medium text-slate-700">{label}</label>
            )}
            <div
              className={cn(
                'flex flex-wrap gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 min-h-[40px]',
                'focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400',
                error && 'border-red-400',
              )}
            >
              {values.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-100"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-blue-400 hover:text-blue-700 transition-colors"
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
                className="flex-1 min-w-[120px] text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
                list={`${name}-suggestions`}
              />
              {suggestions.length > 0 && (
                <datalist id={`${name}-suggestions`}>
                  {suggestions.map((s) => <option key={s} value={s} />)}
                </datalist>
              )}
            </div>
            {helperText && !error && <p className="text-xs text-slate-500">{helperText}</p>}
            {error && <p className="text-xs text-red-600" role="alert">{error.message as string}</p>}
          </div>
        );
      }}
    />
  );
}
