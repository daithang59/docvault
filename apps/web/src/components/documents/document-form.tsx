'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { ClassificationLevel } from '@/types/document';
import { cn } from '@/lib/utils/cn';

const documentFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  classification: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET']),
  tags: z.array(z.string().trim().min(1).max(50)).max(50),
});

export type DocumentFormValues = z.infer<typeof documentFormSchema>;

interface DocumentFormProps {
  defaultValues?: Partial<DocumentFormValues>;
  onSubmit: (values: DocumentFormValues) => void | Promise<void>;
  submitLabel?: string;
  isLoading?: boolean;
  children?: React.ReactNode; // extra action slot
}

const CLASSIFICATIONS: { value: ClassificationLevel; label: string }[] = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'INTERNAL', label: 'Internal' },
  { value: 'CONFIDENTIAL', label: 'Confidential' },
  { value: 'SECRET', label: 'Secret' },
];

export function DocumentForm({
  defaultValues,
  onSubmit,
  submitLabel = 'Save',
  isLoading,
  children,
}: DocumentFormProps) {
  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      title: '',
      description: '',
      classification: 'INTERNAL',
      tags: [],
      ...defaultValues,
    },
  });

  const tags = watch('tags');

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
        <label className="block text-sm font-medium text-[#1E293B] mb-1.5">
          Title <span className="text-[#DC2626]">*</span>
        </label>
        <input
          {...register('title')}
          placeholder="Enter document title"
          className={cn(
            'w-full px-3.5 py-2.5 text-sm rounded-xl border bg-white text-[#1E293B] placeholder:text-[#94A3B8] outline-none transition',
            'focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]',
            errors.title ? 'border-[#DC2626]' : 'border-[#CBD5E1]'
          )}
        />
        {errors.title && (
          <p className="text-xs text-[#DC2626] mt-1">{errors.title.message}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-[#1E293B] mb-1.5">Description</label>
        <textarea
          {...register('description')}
          rows={3}
          placeholder="Brief description of this document..."
          className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#CBD5E1] bg-white text-[#1E293B] placeholder:text-[#94A3B8] outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition resize-none"
        />
      </div>

      {/* Classification */}
      <div>
        <label className="block text-sm font-medium text-[#1E293B] mb-1.5">
          Classification <span className="text-[#DC2626]">*</span>
        </label>
        <Controller
          control={control}
          name="classification"
          render={({ field }) => (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CLASSIFICATIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => field.onChange(value)}
                  className={cn(
                    'px-3 py-2 rounded-xl text-sm font-medium border transition-all',
                    field.value === value
                      ? 'bg-[#2563EB] text-white border-[#2563EB]'
                      : 'bg-white text-[#64748B] border-[#CBD5E1] hover:border-[#2563EB] hover:text-[#2563EB]'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-[#1E293B] mb-1.5">Tags</label>
        <div className="min-h-[42px] flex flex-wrap gap-1.5 items-center px-3 py-2 border border-[#CBD5E1] rounded-xl bg-white focus-within:ring-2 focus-within:ring-[#2563EB]/20 focus-within:border-[#2563EB] transition">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-[#EFF6FF] text-[#1D4ED8]"
            >
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="hover:text-[#DC2626]">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            placeholder={tags.length === 0 ? 'Type and press Enter to add tags...' : ''}
            onKeyDown={addTag}
            className="flex-1 min-w-[120px] text-sm text-[#1E293B] placeholder:text-[#94A3B8] outline-none bg-transparent"
          />
        </div>
        <p className="text-xs text-[#94A3B8] mt-1">{tags.length}/50 tags</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium transition disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : submitLabel}
        </button>
        {children}
      </div>
    </form>
  );
}
