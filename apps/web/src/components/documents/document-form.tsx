'use client';

import type { ReactNode } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, ShieldAlert } from 'lucide-react';
import { ClassificationLevel } from '@/types/document';
import { cn } from '@/lib/utils/cn';

const documentFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  classification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET']),
  classificationOverrideReason: z.string().trim().max(500).optional().or(z.literal('')),
  tags: z.array(z.string().trim().min(1).max(50)).max(50),
});

export type DocumentFormValues = z.infer<typeof documentFormSchema>;
type DlpStatus = 'NOT_SCANNED' | 'CLEAR' | 'DETECTED';

interface DocumentFormProps {
  defaultValues?: Partial<DocumentFormValues>;
  onSubmit: (values: DocumentFormValues) => void | Promise<void>;
  submitLabel?: string;
  isLoading?: boolean;
  dlpStatus?: DlpStatus;
  isAdmin?: boolean;
  classificationSlot?: (classification: ClassificationLevel) => ReactNode;
  children?: React.ReactNode;
}

const CLASSIFICATIONS: { value: ClassificationLevel; label: string; description: string }[] = [
  { value: 'PUBLIC', label: 'Public', description: 'No sensitivity. Safe to share with anyone.' },
  { value: 'INTERNAL', label: 'Internal', description: 'For organization members only. Do not share externally.' },
  { value: 'CONFIDENTIAL', label: 'Confidential', description: 'Sensitive data. Restricted to authorized personnel.' },
  { value: 'SECRET', label: 'Secret', description: 'Highly sensitive. Only approvers and admins can access.' },
];

export function DocumentForm({
  defaultValues,
  onSubmit,
  submitLabel = 'Save',
  isLoading,
  dlpStatus,
  isAdmin = false,
  classificationSlot,
  children,
}: DocumentFormProps) {
  const { register, control, handleSubmit, setValue, formState: { errors } } = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      title: '',
      description: '',
      classification: 'INTERNAL',
      classificationOverrideReason: '',
      tags: [],
      ...defaultValues,
    },
  });

  const tags = useWatch({ control, name: 'tags' }) ?? [];
  const classification =
    useWatch({ control, name: 'classification' }) ?? 'INTERNAL';
  const showClassificationOverrideReason =
    isAdmin && dlpStatus === 'DETECTED' && (classification === 'PUBLIC' || classification === 'INTERNAL');

  function addTag(e: React.KeyboardEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
      e.preventDefault();
      const newTag = input.value.trim().replace(/,$/, '');
      if (newTag && !tags.includes(newTag) && tags.length < 50) {
        setValue('tags', [...tags, newTag]);
        input.value = '';
      }
    }
  }

  function removeTag(tag: string) {
    setValue('tags', tags.filter((t) => t !== tag));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Title */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-main)]">
          Title <span className="text-[var(--color-destructive)]">*</span>
        </label>
        <input
          {...register('title')}
          placeholder="Enter document title"
          className={cn(
            'w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition',
            'bg-[var(--input-bg)] text-[var(--input-text)] placeholder:text-[var(--input-placeholder)]',
            'focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--border-focus)]',
            errors.title ? 'border-[var(--color-destructive)]' : 'border-[var(--input-border)]',
          )}
        />
        {errors.title && (
          <p className="mt-1 text-xs text-[var(--color-destructive)]">{errors.title.message}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-main)]">Description</label>
        <textarea
          {...register('description')}
          rows={3}
          placeholder="Brief description of this document..."
          className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3.5 py-2.5 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--border-focus)] transition resize-none"
        />
      </div>

      {/* Classification */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-main)]">
          Classification <span className="text-[var(--color-destructive)]">*</span>
        </label>
        <Controller
          control={control}
          name="classification"
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2">
              {CLASSIFICATIONS.map(({ value, label, description }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => field.onChange(value)}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-left transition-all',
                    field.value === value
                      ? 'text-white border-[var(--color-primary)] bg-[var(--color-primary)]'
                      : 'bg-[var(--input-bg)] text-[var(--text-muted)] border-[var(--input-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
                  )}
                >
                  <span className="block text-sm font-medium">{label}</span>
                  <span className={cn(
                    'block text-[11px] leading-tight mt-0.5',
                    field.value === value ? 'text-white/70' : 'text-[var(--text-muted)]',
                  )}>
                    {description}
                  </span>
                </button>
              ))}
            </div>
          )}
        />

        {classification === 'SECRET' && (
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              <strong>Secret classification:</strong> Only admins can download this document.
              As the owner, you can preview the content but cannot download it.
              Approvers need explicit ACL grants to access.
            </p>
          </div>
        )}
      </div>

      {classificationSlot?.(classification)}

      {showClassificationOverrideReason && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-main)]">
            Classification override reason <span className="text-[var(--color-destructive)]">*</span>
          </label>
          <textarea
            {...register('classificationOverrideReason')}
            rows={3}
            required
            placeholder="Explain why this DLP-detected document can use this classification..."
            className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3.5 py-2.5 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--border-focus)] transition resize-none"
          />
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Required for admin DLP downgrade override.
          </p>
        </div>
      )}

      {/* Tags */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-[var(--text-main)]">Tags</label>
        <div className="min-h-[42px] flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 transition focus-within:ring-2 focus-within:ring-[var(--focus-ring)] focus-within:border-[var(--border-focus)]">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary-light)] px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]"
            >
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="hover:text-[var(--color-destructive)]">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            placeholder={tags.length === 0 ? 'Type and press Enter to add tags...' : ''}
            onKeyDown={addTag}
            className="min-w-[120px] flex-1 bg-transparent text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] outline-none"
          />
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{tags.length}/50 tags</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : submitLabel}
        </button>
        {children}
      </div>
    </form>
  );
}
