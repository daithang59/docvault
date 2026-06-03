'use client';

import type { ComponentType } from 'react';
import {
  ChevronDown,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Tag,
  User,
  X,
} from 'lucide-react';
import { DocumentStatus, ClassificationLevel } from '@/types/document';
import {
  DEFAULT_DOCUMENT_FILTERS,
  clearDocumentFilter,
  getActiveDocumentFilterChips,
  type DocumentFilterOptions,
  type DocumentFiltersState,
  type DocumentQuickViewOption,
} from '@/features/documents/document-filter-model';
import { cn } from '@/lib/utils/cn';

interface DocumentFiltersProps {
  filters: DocumentFiltersState;
  options: DocumentFilterOptions;
  quickViews: DocumentQuickViewOption[];
  resultCount: number;
  totalCount: number;
  onChange: (filters: DocumentFiltersState) => void;
}

const STATUSES: DocumentStatus[] = ['DRAFT', 'PENDING', 'PUBLISHED', 'ARCHIVED', 'DELETED'];
const CLASSIFICATIONS: ClassificationLevel[] = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'];

const SORT_OPTIONS = [
  { value: 'updatedAt:desc', label: 'Recently updated' },
  { value: 'updatedAt:asc', label: 'Oldest updated' },
  { value: 'createdAt:desc', label: 'Newest created' },
  { value: 'title:asc', label: 'Title A-Z' },
  { value: 'title:desc', label: 'Title Z-A' },
  { value: 'status:asc', label: 'Status A-Z' },
  { value: 'classification:asc', label: 'Classification A-Z' },
  { value: 'ownerId:asc', label: 'Owner A-Z' },
];

export function DocumentFilters({
  filters,
  options,
  quickViews,
  resultCount,
  totalCount,
  onChange,
}: DocumentFiltersProps) {
  function setField<K extends keyof DocumentFiltersState>(key: K, value: DocumentFiltersState[K]) {
    onChange({ ...filters, [key]: value });
  }

  function clearFilter(key: keyof DocumentFiltersState) {
    onChange(clearDocumentFilter(filters, key));
  }

  function resetFilters() {
    onChange(DEFAULT_DOCUMENT_FILTERS);
  }

  const activeChips = getActiveDocumentFilterChips(filters, options);
  const hasActiveFilters = activeChips.length > 0;

  return (
    <div
      className="mb-4 rounded-lg border p-3"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-soft)',
      }}
    >
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[var(--text-faint)]" />
          <p className="text-sm font-semibold text-[var(--text-strong)]">
            Document filters
          </p>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Showing {resultCount} of {totalCount} documents
        </p>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Document quick views">
        {quickViews.map((view) => {
          const active = filters.view === view.value;

          return (
            <button
              key={view.value}
              type="button"
              role="tab"
              aria-selected={active}
              title={view.description}
              onClick={() => setField('view', view.value)}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition',
                active
                  ? 'border-[var(--border-focus)] bg-[var(--color-primary)] text-white'
                  : 'border-[var(--border-soft)] bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--text-main)]',
              )}
            >
              <span>{view.label}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px]',
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--bg-card)] text-[var(--text-faint)]',
                )}
              >
                {view.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_repeat(5,minmax(150px,auto))_auto]">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={filters.search}
            onChange={(event) => setField('search', event.target.value)}
            placeholder="Search title, tag, owner, filename..."
            aria-label="Search documents"
            className="h-10 w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] py-2 pl-9 pr-3 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] outline-none transition focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </div>

        <SelectFilter
          value={filters.status}
          onChange={(value) => setField('status', value as DocumentStatus | '')}
        options={STATUSES.map((status) => ({ value: status, label: formatEnum(status) }))}
        placeholder="All Status"
        ariaLabel="Filter by status"
      />

        <SelectFilter
          value={filters.classification}
          onChange={(value) =>
            setField('classification', value as ClassificationLevel | '')
          }
          options={CLASSIFICATIONS.map((classification) => ({
            value: classification,
            label: formatEnum(classification),
          }))}
          placeholder="All Classifications"
          ariaLabel="Filter by classification"
        />

        <SelectFilter
          value={filters.ownerId}
          onChange={(value) => setField('ownerId', value)}
          options={options.owners}
          placeholder="All Owners"
          icon={User}
          ariaLabel="Filter by owner"
        />

        <SelectFilter
          value={filters.tag}
          onChange={(value) => setField('tag', value)}
          options={options.tags.map((tag) => ({ value: tag, label: tag }))}
          placeholder="All Tags"
          icon={Tag}
          ariaLabel="Filter by tag"
        />

        <SelectFilter
          value={`${filters.sort}:${filters.sortDir}`}
          onChange={(value) => {
            const [sort, sortDir] = value.split(':');
            onChange({
              ...filters,
              sort: sort as DocumentFiltersState['sort'],
              sortDir: sortDir as DocumentFiltersState['sortDir'],
            });
          }}
          options={SORT_OPTIONS}
          placeholder="Sort by"
          ariaLabel="Sort documents"
        />

        <button
          type="button"
          onClick={resetFilters}
          disabled={!hasActiveFilters && filters.sort === DEFAULT_DOCUMENT_FILTERS.sort && filters.sortDir === DEFAULT_DOCUMENT_FILTERS.sortDir}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      {activeChips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => clearFilter(chip.key)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--bg-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-main)] transition hover:border-[var(--border-focus)]"
            >
              {chip.label}
              <X className="h-3 w-3 text-[var(--text-muted)]" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SelectFilter({
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  icon?: ComponentType<{ className?: string }>;
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      {Icon ? (
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
      ) : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className={cn(
          'h-10 w-full cursor-pointer appearance-none rounded-xl border bg-[var(--input-bg)] py-2 pr-8 text-sm outline-none transition',
          'focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--border-focus)]',
          value ? 'border-[var(--border-focus)] text-[var(--color-primary)]' : 'border-[var(--input-border)] text-[var(--text-muted)]',
          Icon ? 'pl-8' : 'pl-3',
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
    </div>
  );
}

function formatEnum(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
