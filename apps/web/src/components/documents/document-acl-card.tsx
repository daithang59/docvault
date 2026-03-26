'use client';

import { useState } from 'react';
import { AclEntry, AddAclEntryDto, SubjectType, Permission, Effect } from '@/types/document';
import { formatDateTime } from '@/lib/utils/date';
import { Plus, Shield } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { useAddAclEntry } from '@/lib/hooks/use-acl';
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

      {/* Add form */}
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

      {/* Entries */}
      {entries.length === 0 && !showForm ? (
        <EmptyState
          title="No access rules"
          description="Add rules to control who can access this document."
          icon="document"
          className="py-8"
        />
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--bg-card-hover)]">
              <Shield className="h-4 w-4 shrink-0" style={{ color: 'var(--text-faint)' }} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-main)' }}>{entry.subjectType}</span>
                  {entry.subjectId && (
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{entry.subjectId.slice(0, 12)}…</span>
                  )}
                  <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{entry.permission}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', EFFECT_STYLES[entry.effect])}>
                    {entry.effect}
                  </span>
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>{formatDateTime(entry.createdAt)}</p>
              </div>
            </div>
          ))}
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

  async function handleSubmit() {
    const normalizedSubjectId =
      form.subjectType === 'ALL' ? undefined : form.subjectId?.trim();

    if (form.subjectType !== 'ALL' && !normalizedSubjectId) {
      setError('Subject ID is required unless subject type is ALL.');
      return;
    }

    setError(null);
    await onSubmit({
      ...form,
      subjectId: normalizedSubjectId,
    });
  }

  return (
    <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-subtle)' }}>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Select label="Subject Type" value={form.subjectType} options={['USER', 'ROLE', 'ALL']} onChange={(v) => setForm({ ...form, subjectType: v as SubjectType })} />
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Subject ID</label>
          <input
            value={form.subjectId ?? ''}
            onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
            placeholder={form.subjectType === 'ALL' ? 'Not required for ALL' : 'User/Role/Group ID'}
            disabled={form.subjectType === 'ALL'}
            className="w-full px-3 py-1.5 text-sm rounded-lg outline-none transition"
            style={{
              border: '1px solid var(--input-border)',
              background: 'var(--input-bg)',
              color: 'var(--input-text)',
            }}
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
