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

  // Debounce search
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
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-[#CBD5E1] rounded-xl bg-white text-[#1E293B] placeholder:text-[#94A3B8] outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition"
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
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-[#64748B] hover:text-[#1E293B] hover:bg-[#F1F5F9] border border-[#CBD5E1] bg-white transition"
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
          'appearance-none pl-3 pr-8 py-2 text-sm border rounded-xl bg-white outline-none transition cursor-pointer',
          'focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]',
          value ? 'border-[#2563EB] text-[#1D4ED8]' : 'border-[#CBD5E1] text-[#64748B]'
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8] pointer-events-none" />
    </div>
  );
}
