'use client';

import { AuditQueryFilters, AuditResult } from '@/types/audit';
import { X } from 'lucide-react';

interface AuditFiltersProps {
  filters: AuditQueryFilters;
  onChange: (filters: AuditQueryFilters) => void;
}

export function AuditFilters({ filters, onChange }: AuditFiltersProps) {
  function setField<K extends keyof AuditQueryFilters>(key: K, value: AuditQueryFilters[K]) {
    onChange({ ...filters, [key]: value || undefined });
  }

  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== '' && v !== null);

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#0F172A]">Filter Audit Logs</h3>
        {hasFilters && (
          <button
            onClick={() => onChange({})}
            className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#1E293B] transition"
          >
            <X className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <FilterInput
          label="Actor ID"
          value={filters.actorId ?? ''}
          onChange={(v) => setField('actorId', v)}
          placeholder="User ID..."
        />
        <FilterInput
          label="Action"
          value={filters.action ?? ''}
          onChange={(v) => setField('action', v)}
          placeholder="e.g. submit, approve..."
        />
        <FilterInput
          label="Resource Type"
          value={filters.resourceType ?? ''}
          onChange={(v) => setField('resourceType', v)}
          placeholder="e.g. document..."
        />
        <FilterInput
          label="Resource ID"
          value={filters.resourceId ?? ''}
          onChange={(v) => setField('resourceId', v)}
          placeholder="Document ID..."
        />
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">Result</label>
          <select
            value={filters.result ?? ''}
            onChange={(e) => setField('result', (e.target.value as AuditResult) || undefined)}
            className="w-full px-3 py-2 text-sm border border-[#CBD5E1] rounded-xl bg-white text-[#1E293B] outline-none focus:border-[#2563EB] transition"
          >
            <option value="">All Results</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="DENY">DENY</option>
            <option value="CONFLICT">CONFLICT</option>
            <option value="ERROR">ERROR</option>
          </select>
        </div>
        <FilterInput
          label="Limit"
          value={filters.limit?.toString() ?? ''}
          onChange={(v) => setField('limit', v ? parseInt(v) : undefined)}
          placeholder="e.g. 50"
          type="number"
        />
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">From</label>
          <input
            type="datetime-local"
            value={filters.from ?? ''}
            onChange={(e) => setField('from', e.target.value || undefined)}
            className="w-full px-3 py-2 text-sm border border-[#CBD5E1] rounded-xl bg-white text-[#1E293B] outline-none focus:border-[#2563EB] transition"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1.5">To</label>
          <input
            type="datetime-local"
            value={filters.to ?? ''}
            onChange={(e) => setField('to', e.target.value || undefined)}
            className="w-full px-3 py-2 text-sm border border-[#CBD5E1] rounded-xl bg-white text-[#1E293B] outline-none focus:border-[#2563EB] transition"
          />
        </div>
      </div>
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#64748B] mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-[#CBD5E1] rounded-xl bg-white text-[#1E293B] placeholder:text-[#94A3B8] outline-none focus:border-[#2563EB] transition"
      />
    </div>
  );
}
