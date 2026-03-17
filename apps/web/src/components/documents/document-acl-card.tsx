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
  ALLOW: 'text-[#166534] bg-[#DCFCE7]',
  DENY: 'text-[#B91C1C] bg-[#FEF2F2]',
};

export function DocumentAclCard({ docId, entries, canManage }: DocumentAclCardProps) {
  const [showForm, setShowForm] = useState(false);
  const addEntry = useAddAclEntry(docId);

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
        <div>
          <h3 className="text-sm font-semibold text-[#0F172A]">Access Control</h3>
          <p className="text-xs text-[#94A3B8] mt-0.5">{entries.length} rule{entries.length !== 1 ? 's' : ''}</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EFF6FF] text-[#2563EB] text-xs font-medium hover:bg-[#DBEAFE] transition-colors"
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
        <div className="divide-y divide-[#F8FAFC]">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F8FAFC] transition-colors">
              <Shield className="h-4 w-4 text-[#94A3B8] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-[#1E293B]">{entry.subjectType}</span>
                  {entry.subjectId && (
                    <span className="text-xs font-mono text-[#64748B]">{entry.subjectId.slice(0, 12)}…</span>
                  )}
                  <span className="text-xs text-[#94A3B8]">{entry.permission}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', EFFECT_STYLES[entry.effect])}>
                    {entry.effect}
                  </span>
                </div>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">{formatDateTime(entry.createdAt)}</p>
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
    <div className="px-5 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC]">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Select label="Subject Type" value={form.subjectType} options={['USER', 'ROLE', 'GROUP', 'ALL']} onChange={(v) => setForm({ ...form, subjectType: v as SubjectType })} />
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1">Subject ID</label>
          <input
            value={form.subjectId ?? ''}
            onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
            placeholder={form.subjectType === 'ALL' ? 'Not required for ALL' : 'User/Role/Group ID'}
            disabled={form.subjectType === 'ALL'}
            className="w-full px-3 py-1.5 text-sm border border-[#CBD5E1] rounded-lg bg-white text-[#1E293B] placeholder:text-[#94A3B8] outline-none focus:border-[#2563EB] transition"
          />
        </div>
        <Select label="Permission" value={form.permission} options={['READ', 'DOWNLOAD', 'WRITE', 'APPROVE']} onChange={(v) => setForm({ ...form, permission: v as Permission })} />
        <Select label="Effect" value={form.effect} options={['ALLOW', 'DENY']} onChange={(v) => setForm({ ...form, effect: v as Effect })} />
      </div>
      {error && (
        <p className="mb-3 text-xs text-[#B91C1C]">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="px-4 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-medium hover:bg-[#1D4ED8] transition disabled:opacity-50"
        >
          {isLoading ? 'Adding...' : 'Add Rule'}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 rounded-lg text-[#64748B] text-xs font-medium hover:bg-[#F1F5F9] transition">
          Cancel
        </button>
      </div>
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#64748B] mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 text-sm border border-[#CBD5E1] rounded-lg bg-white text-[#1E293B] outline-none focus:border-[#2563EB] transition"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
