import type { DocumentStatus, ClassificationLevel } from '@/types/enums';

/** Color config for a status/classification badge */
export interface ColorConfig {
  bg: string;
  text: string;
  border: string;
}

export const STATUS_COLORS: Record<DocumentStatus, ColorConfig> = {
  DRAFT: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
  },
  PENDING: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
  },
  PUBLISHED: {
    bg: 'bg-green-50',
    text: 'text-green-800',
    border: 'border-green-200',
  },
  ARCHIVED: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-200',
  },
};

export const CLASSIFICATION_COLORS: Record<ClassificationLevel, ColorConfig> = {
  PUBLIC: {
    bg: 'bg-green-50',
    text: 'text-green-800',
    border: 'border-green-200',
  },
  INTERNAL: {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
  },
  CONFIDENTIAL: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
  },
  SECRET: {
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-200',
  },
};
