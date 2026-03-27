'use client';

import { DocumentDetail } from '@/types/document';
import { StatusBadge } from '@/components/badges/status-badge';
import { ClassificationBadge } from '@/components/badges/classification-badge';
import { formatDateTime } from '@/lib/utils/date';
import { useAuth } from '@/lib/auth/auth-context';
import { User, Calendar, Tag } from 'lucide-react';

interface DocumentHeaderProps {
  doc: DocumentDetail;
}

/** Derive display name for an owner. Priority:
 * 1. ownerDisplay from backend (Keycloak name)
 * 2. Current user's own displayName (if owner === current user)
 * 3. ownerId (username) as-is
 */
function resolveOwnerDisplay(doc: DocumentDetail, currentUser: { sub?: string; username?: string; preferred_username?: string; displayName?: string; firstName?: string; lastName?: string } | null): string {
  if (doc.ownerDisplay) return doc.ownerDisplay;

  // ownerId is stored as username (see buildActorId: username ?? sub)
  const currentUsername = currentUser?.username ?? currentUser?.preferred_username;
  if (currentUsername && doc.ownerId === currentUsername) {
    const ownName =
      currentUser?.displayName ??
      [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ') ??
      currentUsername;
    return ownName;
  }

  return doc.ownerId;
}

export function DocumentHeader({ doc }: DocumentHeaderProps) {
  const { session } = useAuth();

  const ownerDisplay = resolveOwnerDisplay(doc, session?.user ?? null);

  return (
    <div className="mb-6 rounded-2xl border bg-[var(--bg-card)] p-6" style={{ borderColor: 'var(--border-soft)' }}>
      <div className="mb-3 flex flex-wrap items-start gap-3">
        <StatusBadge status={doc.status} />
        <ClassificationBadge classification={doc.classification} />
        <span className="rounded bg-[var(--bg-muted)] px-2 py-0.5 font-mono text-xs text-[var(--text-muted)]">
          v{doc.currentVersion}
        </span>
      </div>

      <h1 className="mb-2 text-2xl font-semibold leading-tight text-[var(--text-strong)]">
        {doc.title}
      </h1>
      {doc.description && (
        <p className="mb-4 text-sm leading-relaxed text-[var(--text-muted)]">{doc.description}</p>
      )}

      {doc.tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {doc.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary-light)] px-2 py-0.5 text-xs text-[var(--color-primary)]"
            >
              <Tag className="h-3 w-3" />
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4" style={{ borderColor: 'var(--border-soft)' }}>
        <MetaItem label="Owner" icon={User} value={ownerDisplay} mono={false} truncate={false} />
        <MetaItem label="Created" icon={Calendar} value={formatDateTime(doc.createdAt)} />
        <MetaItem label="Updated" icon={Calendar} value={formatDateTime(doc.updatedAt)} />
        {doc.publishedAt && (
          <MetaItem label="Published" icon={Calendar} value={formatDateTime(doc.publishedAt)} />
        )}
        {doc.archivedAt && (
          <MetaItem label="Archived" icon={Calendar} value={formatDateTime(doc.archivedAt)} />
        )}
      </div>
    </div>
  );
}

function MetaItem({
  label,
  value,
  icon: Icon,
  mono,
  truncate,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-[var(--text-faint)]" />
        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
          {label}
        </span>
      </div>
      <p className={`${truncate ? 'truncate' : ''} text-[var(--text-main)] ${mono ? 'font-mono text-xs' : 'text-sm'}`}>
        {value}
      </p>
    </div>
  );
}
