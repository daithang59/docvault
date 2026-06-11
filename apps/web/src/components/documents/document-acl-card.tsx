'use client';

import { useMemo, useState } from 'react';
import { AclEntry, AddAclEntryDto, SubjectType, Permission, Effect } from '@/types/document';
import { formatDateTime } from '@/lib/utils/date';
import { Plus, Shield, Search, Check, ChevronDown } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { useAddAclEntry } from '@/lib/hooks/use-acl';
import { useOrgMembersForPicker, useOrgGroups } from '@/features/org/org.hooks';
import { useOwnerDisplayNames } from '@/features/approvals/approvals.hooks';
import { ALL_ROLES } from '@/lib/auth/roles';
import { cn } from '@/lib/utils/cn';

interface DocumentAclCardProps {
  docId: string;
  entries: AclEntry[];
  canManage: boolean;
}

const EFFECT_STYLES: Record<Effect, string> = {
  ALLOW: 'text-[var(--status-published-text)] bg-[var(--stat-published-bg)]',
  DENY: 'text-[var(--state-error-text)] bg-[var(--state-error-bg)]',
};

export function DocumentAclCard({ docId, entries, canManage }: DocumentAclCardProps) {
  const [showForm, setShowForm] = useState(false);
  const addEntry = useAddAclEntry(docId);

  // Resolve display names for USER subjects so admins can confirm an id
  // actually maps to a real person (answers "is this username/UUID valid?").
  const userSubjectIds = useMemo(
    () =>
      entries
        .filter((e) => e.subjectType === 'USER' && e.subjectId)
        .map((e) => e.subjectId as string),
    [entries],
  );
  const { data: displayNames } = useOwnerDisplayNames(userSubjectIds);

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>Access Control</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{entries.length} rule{entries.length !== 1 ? 's' : ''}</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
            style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Rule
          </button>
        )}
      </div>

      {showForm && (
        <AclAddForm
          onSubmit={async (data) => {
            await addEntry.mutateAsync(data);
            setShowForm(false);
          }}
          isLoading={addEntry.isPending}
          onCancel={() => setShowForm(false)}
        />
      )}

      {entries.length === 0 && !showForm ? (
        <EmptyState
          title="No access rules"
          description="Add rules to control who can access this document."
          icon="document"
          className="py-8"
        />
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
          {entries.map((entry) => {
            const display =
              entry.subjectType === 'USER' && entry.subjectId
                ? displayNames?.[entry.subjectId]
                : undefined;
            const subjectLabel = display?.displayName ?? entry.subjectId ?? '';
            return (
              <div key={entry.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--bg-card-hover)]">
                <Shield className="h-4 w-4 shrink-0" style={{ color: 'var(--text-faint)' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-main)' }}>{entry.subjectType}</span>
                    {entry.subjectId && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }} title={entry.subjectId}>
                        {subjectLabel}
                      </span>
                    )}
                    {display?.username && display.username !== subjectLabel && (
                      <span className="text-[11px] font-mono" style={{ color: 'var(--text-faint)' }}>{display.username}</span>
                    )}
                    <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{entry.permission}</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', EFFECT_STYLES[entry.effect])}>
                      {entry.effect}
                    </span>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{formatDateTime(entry.createdAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AclAddForm({
  onSubmit,
  isLoading,
  onCancel,
}: {
  onSubmit: (data: AddAclEntryDto) => Promise<void>;
  isLoading: boolean;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AddAclEntryDto>({
    subjectType: 'USER',
    subjectId: '',
    permission: 'READ',
    effect: 'ALLOW',
  });
  const [error, setError] = useState<string | null>(null);

  function setSubjectType(subjectType: SubjectType) {
    // Reset the subject id whenever the type changes — its meaning differs per type.
    setForm((f) => ({ ...f, subjectType, subjectId: '' }));
    setError(null);
  }

  async function handleSubmit() {
    const normalizedSubjectId = normalizeSubjectId(form.subjectType, form.subjectId);

    if (form.subjectType !== 'ALL' && !normalizedSubjectId) {
      setError('Select or enter a subject for this rule.');
      return;
    }

    setError(null);
    await onSubmit({ ...form, subjectId: normalizedSubjectId });
  }

  return (
    <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-subtle)' }}>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Select label="Subject Type" value={form.subjectType} options={['USER', 'ROLE', 'GROUP', 'ALL']} onChange={(v) => setSubjectType(v as SubjectType)} />
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Subject</label>
          <SubjectPicker
            subjectType={form.subjectType}
            value={form.subjectId ?? ''}
            onChange={(v) => setForm((f) => ({ ...f, subjectId: v }))}
          />
        </div>
        <Select label="Permission" value={form.permission} options={['READ', 'DOWNLOAD', 'WRITE', 'APPROVE']} onChange={(v) => setForm({ ...form, permission: v as Permission })} />
        <Select label="Effect" value={form.effect} options={['ALLOW', 'DENY']} onChange={(v) => setForm({ ...form, effect: v as Effect })} />
      </div>
      {error && (
        <p className="mb-3 text-xs" style={{ color: 'var(--state-error-text)' }}>{error}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="px-4 py-1.5 rounded-lg text-white text-xs font-medium transition disabled:opacity-50 btn-primary"
        >
          {isLoading ? 'Adding...' : 'Add Rule'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SubjectPicker({
  subjectType,
  value,
  onChange,
}: {
  subjectType: SubjectType;
  value: string;
  onChange: (value: string) => void;
}) {
  if (subjectType === 'ALL') {
    return (
      <input
        value=""
        disabled
        placeholder="Applies to everyone"
        className="w-full px-3 py-1.5 text-sm rounded-lg outline-none transition opacity-60"
        style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--input-text)' }}
      />
    );
  }

  if (subjectType === 'ROLE') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 text-sm rounded-lg outline-none transition"
        style={{ border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--input-text)' }}
      >
        <option value="">Select a role…</option>
        {ALL_ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
    );
  }

  if (subjectType === 'USER') {
    return <UserCombobox value={value} onChange={onChange} />;
  }

  return <GroupCombobox value={value} onChange={onChange} />;
}

function UserCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
    () => options.find((o) => o.userId === value) ?? (value ? { userId: value, displayName: displayNames?.[value]?.displayName ?? value, username: displayNames?.[value]?.username ?? value } : null),
    [options, value, displayNames],
  );

  const unavailable = !membersQuery.isLoading && (membersQuery.data?.length ?? 0) === 0;

  if (unavailable) {
    // Directory unavailable (e.g. no permission / not configured) — fall back to
    // manual entry but make the expected value explicit.
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Keycloak user id (sub)"
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
          {selected ? selected.displayName : 'Select a user…'}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 w-full rounded-lg border shadow-lg overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
        >
          <div className="flex items-center gap-2 px-2.5 py-2 border-b" style={{ borderColor: 'var(--border-soft)' }}>
            <Search className="h-3.5 w-3.5 opacity-60" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or username…"
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

function GroupCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const groupsQuery = useOrgGroups(true);

  const options = useMemo(() => {
    const rows = groupsQuery.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (g) => g.name.toLowerCase().includes(q) || g.path.toLowerCase().includes(q),
    );
  }, [groupsQuery.data, query]);

  const unavailable = !groupsQuery.isLoading && (groupsQuery.data?.length ?? 0) === 0;

  if (unavailable) {
    // No group directory available — fall back to manual entry (validated server-side).
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Keycloak group name"
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
        <span className={cn('truncate', !value && 'opacity-60')}>{value || 'Select a group…'}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 w-full rounded-lg border shadow-lg overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
        >
          <div className="flex items-center gap-2 px-2.5 py-2 border-b" style={{ borderColor: 'var(--border-soft)' }}>
            <Search className="h-3.5 w-3.5 opacity-60" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search groups…"
              className="w-full bg-transparent text-sm outline-none"
              style={{ color: 'var(--input-text)' }}
            />
          </div>
          <div className="max-h-48 overflow-auto py-1">
            {groupsQuery.isLoading ? (
              <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-faint)' }}>Loading groups…</p>
            ) : options.length === 0 ? (
              <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-faint)' }}>No matching groups.</p>
            ) : (
              options.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    onChange(g.name);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-card-hover)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate" style={{ color: 'var(--text-main)' }}>{g.name}</span>
                    {g.path !== '/' + g.name && (
                      <span className="block truncate text-[11px] font-mono" style={{ color: 'var(--text-faint)' }}>{g.path}</span>
                    )}
                  </span>
                  {g.name === value && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeSubjectId(subjectType: SubjectType, subjectId?: string): string | undefined {
  if (subjectType === 'ALL') {
    return undefined;
  }

  const trimmed = subjectId?.trim();
  if (!trimmed) {
    return undefined;
  }

  return subjectType === 'GROUP' ? trimmed.replace(/^\/+/, '') : trimmed;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 text-sm rounded-lg outline-none transition"
        style={{
          border: '1px solid var(--input-border)',
          background: 'var(--input-bg)',
          color: 'var(--input-text)',
        }}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}