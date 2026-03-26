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
    <div className="mb-5 rounded-2xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-strong)]">Filter Audit Logs</h3>
        {hasFilters && (
          <button
            onClick={() => onChange({})}
            className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] transition hover:text-[var(--text-main)]"
          >
            <X className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Result</label>
          <select
            value={filters.result ?? ''}
            onChange={(e) => setField('result', (e.target.value as AuditResult) || undefined)}
            className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] outline-none transition focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--border-focus)]"
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
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">From</label>
          <input
            type="datetime-local"
            value={filters.from ?? ''}
            onChange={(e) => setField('from', e.target.value || undefined)}
            className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] outline-none transition focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--border-focus)]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">To</label>
          <input
            type="datetime-local"
            value={filters.to ?? ''}
            onChange={(e) => setField('to', e.target.value || undefined)}
            className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] outline-none transition focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--border-focus)]"
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
      <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] placeholder:text-[var(--input-placeholder)] outline-none transition focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--border-focus)]"
      />
    </div>
  );
}
