'use client';

import { useMemo, useState } from 'react';
import { Search, Check, ChevronDown, X } from 'lucide-react';
import { useOrgMembersForPicker } from '@/features/org/org.hooks';
import { useOwnerDisplayNames } from '@/features/approvals/approvals.hooks';
import { cn } from '@/lib/utils/cn';

interface UserComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Show a clear button to reset the selection (useful for optional filters). */
  allowClear?: boolean;
  /** Placeholder for the manual-entry fallback when the directory is unavailable. */
  fallbackPlaceholder?: string;
}

/**
 * Org-member picker with type-ahead search over display name / username / id.
 * Resolves Keycloak display names so admins can confirm an id maps to a real
 * person. Falls back to a free-text input when the directory is unavailable
 * (e.g. no permission or not configured), so a value can still be entered.
 */
export function UserCombobox({
  value,
  onChange,
  placeholder = 'Select a user…',
  searchPlaceholder = 'Search name or username…',
  allowClear = false,
  fallbackPlaceholder = 'Keycloak user id (sub)',
}: UserComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const membersQuery = useOrgMembersForPicker(true);
  const memberIds = useMemo(
    () => (membersQuery.data ?? []).map((m) => m.userId),
    [membersQuery.data],
  );
  const { data: displayNames } = useOwnerDisplayNames(memberIds);

  const options = useMemo(() => {
    const rows = (membersQuery.data ?? []).map((m) => {
      const info = displayNames?.[m.userId];
      return {
        userId: m.userId,
        displayName: info?.displayName ?? m.userId,
        username: info?.username ?? m.userId,
      };
    });
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.displayName.toLowerCase().includes(q) ||
        r.username.toLowerCase().includes(q) ||
        r.userId.toLowerCase().includes(q),
    );
  }, [membersQuery.data, displayNames, query]);

  const selected = useMemo(
    () =>
      options.find((o) => o.userId === value) ??
      (value
        ? {
            userId: value,
            displayName: displayNames?.[value]?.displayName ?? value,
            username: displayNames?.[value]?.username ?? value,
          }
        : null),
    [options, value, displayNames],
  );

  const unavailable = !membersQuery.isLoading && (membersQuery.data?.length ?? 0) === 0;

  if (unavailable) {
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={fallbackPlaceholder}
        className="w-full px-3 py-1.5 text-sm rounded-lg outline-none transition"
        style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--input-text)' }}
      />
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm rounded-lg outline-none transition text-left"
        style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--input-text)' }}
      >
        <span className={cn('truncate', !selected && 'opacity-60')}>
          {selected ? selected.displayName : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {allowClear && value && (
            <X
              className="h-3.5 w-3.5 opacity-60 transition hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setQuery('');
              }}
            />
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </span>
      </button>
      {open && (
        <div
          className="relative z-20 mt-1 w-full rounded-lg border shadow-lg overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
        >
          <div className="flex items-center gap-2 px-2.5 py-2 border-b" style={{ borderColor: 'var(--border-soft)' }}>
            <Search className="h-3.5 w-3.5 opacity-60" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none"
              style={{ color: 'var(--input-text)' }}
            />
          </div>
          <div className="max-h-48 overflow-auto py-1">
            {membersQuery.isLoading ? (
              <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-faint)' }}>Loading users…</p>
            ) : options.length === 0 ? (
              <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-faint)' }}>No matching users.</p>
            ) : (
              options.map((o) => (
                <button
                  key={o.userId}
                  type="button"
                  onClick={() => {
                    onChange(o.userId);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-card-hover)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate" style={{ color: 'var(--text-main)' }}>{o.displayName}</span>
                    <span className="block truncate text-[11px] font-mono" style={{ color: 'var(--text-faint)' }}>{o.username}</span>
                  </span>
                  {o.userId === value && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
