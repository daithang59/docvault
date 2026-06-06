'use client';

import { useState } from 'react';
import { Check, Copy, Link2, Loader2, Trash2 } from 'lucide-react';
import type { DocumentDetail } from '@/features/documents/documents.types';
import {
  useCreateShareLink,
  useRevokeShareLink,
  useShareLinks,
} from '@/features/share-links/share-links.hooks';
import { buildShareLinkPresentation, buildShareUrl } from '@/features/share-links/share-links-presentation';
import type {
  CreatedShareLink,
  ShareLinkPermission,
} from '@/features/share-links/share-links.types';
import { formatDateTime } from '@/lib/utils/date';

interface DocumentShareLinksCardProps {
  document: DocumentDetail;
  canManage: boolean;
}

const TONE_STYLES: Record<string, string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  muted: 'border-[var(--border-soft)] bg-[var(--bg-muted)] text-[var(--text-muted)]',
  danger: 'border-red-200 bg-red-50 text-red-700',
};

export function DocumentShareLinksCard({
  document,
  canManage,
}: DocumentShareLinksCardProps) {
  const linksQuery = useShareLinks(document.id, canManage);
  const createLink = useCreateShareLink(document.id);
  const revokeLink = useRevokeShareLink(document.id);

  const [permission, setPermission] = useState<ShareLinkPermission>('VIEW');
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [maxAccessCount, setMaxAccessCount] = useState<string>('');
  const [issued, setIssued] = useState<CreatedShareLink | null>(null);
  const [copied, setCopied] = useState(false);

  if (!canManage) return null;

  async function handleCreate() {
    const created = await createLink.mutateAsync({
      permission,
      expiresInHours,
      ...(maxAccessCount.trim() ? { maxAccessCount: Number(maxAccessCount) } : {}),
    });
    setIssued(created);
    setCopied(false);
  }

  async function handleCopy() {
    if (!issued) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    await navigator.clipboard.writeText(buildShareUrl(origin, issued.token));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const links = linksQuery.data ?? [];

  return (
    <section
      className="overflow-hidden rounded-lg border bg-[var(--bg-card)]"
      style={{ borderColor: 'var(--border-soft)' }}
      aria-labelledby="document-share-links-heading"
    >
      <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border-soft)' }}>
        <h2
          id="document-share-links-heading"
          className="flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]"
        >
          <Link2 className="h-4 w-4 text-[var(--color-primary)]" />
          Share links
        </h2>
        <p className="mt-1 text-xs text-[var(--text-faint)]">
          Time-limited access for signed-in recipients. Tokens are shown once.
        </p>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-xs font-medium text-[var(--text-muted)]">
            Permission
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value as ShareLinkPermission)}
              className="mt-1 w-full rounded-lg border bg-[var(--input-bg)] px-2 py-1.5 text-sm text-[var(--text-main)]"
              style={{ borderColor: 'var(--border-strong)' }}
            >
              <option value="VIEW">View only</option>
              <option value="DOWNLOAD">View + Download</option>
            </select>
          </label>
          <label className="text-xs font-medium text-[var(--text-muted)]">
            Expires in (hours)
            <input
              type="number"
              min={1}
              max={720}
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border bg-[var(--input-bg)] px-2 py-1.5 text-sm text-[var(--text-main)]"
              style={{ borderColor: 'var(--border-strong)' }}
            />
          </label>
          <label className="text-xs font-medium text-[var(--text-muted)]">
            Max opens (optional)
            <input
              type="number"
              min={1}
              max={1000}
              value={maxAccessCount}
              onChange={(e) => setMaxAccessCount(e.target.value)}
              placeholder="Unlimited"
              className="mt-1 w-full rounded-lg border bg-[var(--input-bg)] px-2 py-1.5 text-sm text-[var(--text-main)]"
              style={{ borderColor: 'var(--border-strong)' }}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleCreate}
          disabled={createLink.isPending}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          style={{ background: 'var(--color-primary)' }}
        >
          {createLink.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          Create share link
        </button>

        {issued && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-medium text-emerald-800">
              Copy this link now. The token is not shown again.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-white/70 px-2 py-1 text-xs text-emerald-900">
                {typeof window !== 'undefined'
                  ? buildShareUrl(window.location.origin, issued.token)
                  : issued.token}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-[var(--border-soft)]">
          {links.length === 0 ? (
            <p className="py-3 text-xs text-[var(--text-faint)]">
              No share links yet.
            </p>
          ) : (
            links.map((link) => {
              const p = buildShareLinkPresentation(link);
              return (
                <div key={link.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${TONE_STYLES[p.tone]}`}>
                        {p.statusLabel}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">{p.permissionLabel}</span>
                      <span className="text-xs text-[var(--text-faint)]">{p.usageLabel}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-faint)]">
                      Expires {formatDateTime(link.expiresAt)}
                    </p>
                  </div>
                  {p.isActive && (
                    <button
                      type="button"
                      onClick={() => revokeLink.mutate(link.id)}
                      disabled={revokeLink.isPending}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-soft)] px-2 py-1 text-xs font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-muted)] disabled:opacity-60"
                      title="Revoke link"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Revoke
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
