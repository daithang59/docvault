'use client';

import { DocumentDetail } from '@/types/document';
import { StatusBadge } from '@/components/badges/status-badge';
import { ClassificationBadge } from '@/components/badges/classification-badge';
import { formatDateTime } from '@/lib/utils/date';
import { User, Calendar, Tag } from 'lucide-react';

interface DocumentHeaderProps {
  doc: DocumentDetail;
}

export function DocumentHeader({ doc }: DocumentHeaderProps) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 mb-6">
      <div className="flex flex-wrap items-start gap-3 mb-3">
        <StatusBadge status={doc.status} />
        <ClassificationBadge classification={doc.classification} />
        <span className="text-xs font-mono text-[#94A3B8] bg-[#F1F5F9] px-2 py-0.5 rounded">
          v{doc.currentVersion}
        </span>
      </div>

      <h1 className="text-2xl font-semibold text-[#0F172A] mb-2 leading-tight">
        {doc.title}
      </h1>
      {doc.description && (
        <p className="text-sm text-[#64748B] mb-4 leading-relaxed">{doc.description}</p>
      )}

      {/* Tags */}
      {doc.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {doc.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-[#EFF6FF] text-[#1D4ED8] rounded-lg"
            >
              <Tag className="h-3 w-3" />
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Metadata grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#F1F5F9]">
        <MetaItem label="Owner" icon={User} value={doc.ownerDisplay ?? `${doc.ownerId.slice(0, 8)}…`} mono={!doc.ownerDisplay} />
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
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="h-3 w-3 text-[#94A3B8]" />
        <span className="text-[11px] text-[#94A3B8] uppercase tracking-wide font-medium">
          {label}
        </span>
      </div>
      <p className={`text-sm text-[#1E293B] truncate ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </p>
    </div>
  );
}
