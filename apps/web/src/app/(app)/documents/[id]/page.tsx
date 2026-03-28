'use client';

import { use } from 'react';
import { useState } from 'react';
import { useDocumentDetail } from '@/lib/hooks/use-document-detail';
import { useWorkflowHistory } from '@/lib/hooks/use-workflow-history';
import { useAuth } from '@/lib/auth/auth-context';
import { DocumentHeader } from '@/components/documents/document-header';
import { DocumentVersionsCard } from '@/components/documents/document-versions-card';
import { DocumentWorkflowTimeline } from '@/components/documents/document-workflow-timeline';
import { DocumentAclCard } from '@/components/documents/document-acl-card';
import { DocumentActionPanel } from '@/components/documents/document-action-panel';
import { DocumentPreviewDialog } from '@/components/documents/document-preview-dialog';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { canDownloadDocument, canManageAcl, canPreviewDocument, canReadAcl } from '@/lib/auth/guards';
import { useDownloadDocument } from '@/lib/hooks/use-download-document';
import { useQueryClient } from '@tanstack/react-query';
import { documentsKeys } from '@/features/documents/documents.keys';
import { toast } from 'sonner';
import type { DocumentVersion } from '@/features/documents/documents.types';

interface Props {
  params: Promise<{ id: string }>;
}

export default function DocumentDetailPage({ params }: Props) {
  const { id } = use(params);
  const { session } = useAuth();
  const qc = useQueryClient();

  const { data: doc, isLoading, isError, refetch } = useDocumentDetail(id);
  const { data: history = [] } = useWorkflowHistory(id);
  const { download } = useDownloadDocument({ onError: (msg) => toast.error(msg) });

  const [previewVersion, setPreviewVersion] = useState<DocumentVersion | null>(null);

  if (isLoading) return <LoadingState label="Loading document..." />;
  if (isError || !doc) return <ErrorState message="Failed to load document." onRetry={refetch} />;

  const canDl = canDownloadDocument(session, doc);
  const canPrev = canPreviewDocument(session, doc);
  const canAcl = canManageAcl(session, doc);
  const canShowAcl = canReadAcl(session) || canAcl;
  const aclEntries = canShowAcl ? (doc.aclEntries ?? doc.acl ?? []) : [];

  function handleActionComplete() {
    qc.invalidateQueries({ queryKey: documentsKeys.detail(id) });
    qc.invalidateQueries({ queryKey: documentsKeys.workflowHistory(id) });
    qc.invalidateQueries({ queryKey: documentsKeys.lists() });
  }

  return (
    <div>
      <div className="animate-in delay-1">
        <DocumentHeader doc={{ ...doc, aclEntries, versions: doc.versions ?? [] }} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left col: versions + timeline */}
        <div className="lg:col-span-2 space-y-5">
          <div className="animate-in delay-2">
            <DocumentVersionsCard
              docId={id}
              versions={doc.versions ?? []}
              canDownload={canDl}
              onDownload={() => download(id)}
              canPreview={canPrev}
              onPreview={(_docId, v) => setPreviewVersion(v)}
            />
          </div>
          <div className="animate-in delay-3">
            <DocumentWorkflowTimeline history={history} />
          </div>
        </div>

        {/* Right col: actions + ACL */}
        <div className="space-y-5">
          <div className="animate-in delay-2">
            <DocumentActionPanel
              doc={{ ...doc, aclEntries, versions: doc.versions ?? [] }}
              onActionComplete={handleActionComplete}
              onPreview={() => {
                const versions = doc.versions ?? [];
                const latest = versions.length > 0 ? versions[0] : null;
                if (latest) setPreviewVersion(latest);
              }}
            />
          </div>
          {canShowAcl && (
            <div className="animate-in delay-3">
              <DocumentAclCard
                docId={id}
                entries={aclEntries}
                canManage={canAcl}
              />
            </div>
          )}
        </div>
      </div>

      <DocumentPreviewDialog
        docId={id}
        version={previewVersion}
        onClose={() => setPreviewVersion(null)}
      />
    </div>
  );
}
