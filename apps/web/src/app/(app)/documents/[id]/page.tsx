'use client';

import { use } from 'react';
import { useDocumentDetail } from '@/lib/hooks/use-document-detail';
import { useWorkflowHistory } from '@/lib/hooks/use-workflow-history';
import { useAcl } from '@/lib/hooks/use-acl';
import { useAuth } from '@/lib/auth/auth-context';
import { DocumentHeader } from '@/components/documents/document-header';
import { DocumentVersionsCard } from '@/components/documents/document-versions-card';
import { DocumentWorkflowTimeline } from '@/components/documents/document-workflow-timeline';
import { DocumentAclCard } from '@/components/documents/document-acl-card';
import { DocumentActionPanel } from '@/components/documents/document-action-panel';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { canDownloadDocument, canManageAcl } from '@/lib/auth/guards';
import { useDownloadDocument } from '@/lib/hooks/use-download-document';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/constants/query-keys';
import { toast } from 'sonner';

interface Props {
  params: Promise<{ id: string }>;
}

export default function DocumentDetailPage({ params }: Props) {
  const { id } = use(params);
  const { session } = useAuth();
  const qc = useQueryClient();

  const { data: doc, isLoading, isError, refetch } = useDocumentDetail(id);
  const { data: history = [] } = useWorkflowHistory(id);
  const { data: acl = [] } = useAcl(id);
  const { download } = useDownloadDocument({ onError: (msg) => toast.error(msg) });

  if (isLoading) return <LoadingState label="Loading document..." />;
  if (isError || !doc) return <ErrorState message="Failed to load document." onRetry={refetch} />;

  const canDl = canDownloadDocument(session, doc);
  const canAcl = canManageAcl(session);

  function handleActionComplete() {
    qc.invalidateQueries({ queryKey: queryKeys.documentDetail(id) });
    qc.invalidateQueries({ queryKey: queryKeys.workflowHistory(id) });
    qc.invalidateQueries({ queryKey: queryKeys.documents });
  }

  return (
    <div>
      <DocumentHeader doc={{ ...doc, aclEntries: acl, versions: doc.versions ?? [] }} />

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left col: versions + timeline */}
        <div className="lg:col-span-2 space-y-5">
          <DocumentVersionsCard
            versions={doc.versions ?? []}
            canDownload={canDl}
            onDownload={(version) => download(id, version)}
          />
          <DocumentWorkflowTimeline history={history} />
        </div>

        {/* Right col: actions + ACL */}
        <div className="space-y-5">
          <DocumentActionPanel
            doc={{ ...doc, aclEntries: acl, versions: doc.versions ?? [] }}
            onActionComplete={handleActionComplete}
          />
          <DocumentAclCard
            docId={id}
            entries={acl}
            canManage={canAcl}
          />
        </div>
      </div>
    </div>
  );
}
