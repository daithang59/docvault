'use client';

import { useState, useEffect } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { DocumentStatus, ClassificationLevel } from '@/types/document';
import { cn } from '@/lib/utils/cn';

export interface DocumentFiltersState {
  search: string;
  status: DocumentStatus | '';
  classification: ClassificationLevel | '';
  sort: 'updatedAt' | 'title' | 'status';
  sortDir: 'asc' | 'desc';
}

interface DocumentFiltersProps {
  filters: DocumentFiltersState;
  onChange: (filters: DocumentFiltersState) => void;
}

const STATUSES: DocumentStatus[] = ['DRAFT', 'PENDING', 'PUBLISHED', 'ARCHIVED'];
const CLASSIFICATIONS: ClassificationLevel[] = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'];

export function DocumentFilters({ filters, onChange }: DocumentFiltersProps) {
  const [search, setSearch] = useState(filters.search);

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange({ ...filters, search });
    }, 300);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line

  function setField<K extends keyof DocumentFiltersState>(key: K, value: DocumentFiltersState[K]) {
    onChange({ ...filters, [key]: value });
  }

  const hasActiveFilters = filters.search || filters.status || filters.classification;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents..."
          className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] py-2 pl-9 pr-3 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] outline-none transition focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--border-focus)]"
        />
      </div>

      {/* Status filter */}
      <SelectFilter
        value={filters.status}
        onChange={(v) => setField('status', v as DocumentStatus | '')}
        options={STATUSES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))}
        placeholder="All Status"
      />

      {/* Classification filter */}
      <SelectFilter
        value={filters.classification}
        onChange={(v) => setField('classification', v as ClassificationLevel | '')}
        options={CLASSIFICATIONS.map((c) => ({ value: c, label: c.charAt(0) + c.slice(1).toLowerCase() }))}
        placeholder="All Classifications"
      />

      {/* Sort */}
      <SelectFilter
        value={`${filters.sort}_${filters.sortDir}`}
        onChange={(v) => {
          const [sort, dir] = v.split('_');
          setField('sort', sort as DocumentFiltersState['sort']);
          setField('sortDir', dir as 'asc' | 'desc');
        }}
        options={[
          { value: 'updatedAt_desc', label: 'Newest first' },
          { value: 'updatedAt_asc', label: 'Oldest first' },
          { value: 'title_asc', label: 'Title A–Z' },
          { value: 'title_desc', label: 'Title Z–A' },
        ]}
        placeholder="Sort by"
      />

      {/* Reset */}
      {hasActiveFilters && (
        <button
          onClick={() => {
            setSearch('');
            onChange({ search: '', status: '', classification: '', sort: 'updatedAt', sortDir: 'desc' });
          }}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text-main)]"
        >
          <X className="h-3.5 w-3.5" />
          Reset
        </button>
      )}
    </div>
  );
}

function SelectFilter({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'cursor-pointer appearance-none rounded-xl border bg-[var(--input-bg)] py-2 pl-3 pr-8 text-sm outline-none transition',
          'focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--border-focus)]',
          value ? 'border-[var(--border-focus)] text-[var(--color-primary)]' : 'border-[var(--input-border)] text-[var(--text-muted)]',
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
