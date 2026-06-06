'use client';

import { use } from 'react';
import { useState } from 'react';
import { useDocumentDetail } from '@/lib/hooks/use-document-detail';
import { useWorkflowHistory } from '@/lib/hooks/use-workflow-history';
import { useAuth } from '@/lib/auth/auth-context';
import { DocumentHeader } from '@/components/documents/document-header';
import { DocumentDlpFindingsCard } from '@/components/documents/document-dlp-findings-card';
import { DocumentAiGuardrailsCard } from '@/components/documents/document-ai-guardrails-card';
import { DocumentApprovalReadinessCard } from '@/components/documents/document-approval-readiness-card';
import { DocumentEvidenceLinksCard } from '@/components/documents/document-evidence-links-card';
import { DocumentLegalHoldCard } from '@/components/documents/document-legal-hold-card';
import { DocumentMetadataSummaryCard } from '@/components/documents/document-metadata-summary-card';
import { DocumentVersionsCard } from '@/components/documents/document-versions-card';
import { DocumentWorkflowTimeline } from '@/components/documents/document-workflow-timeline';
import { DocumentAclCard } from '@/components/documents/document-acl-card';
import { DocumentCommentsCard } from '@/components/documents/document-comments-card';
import { DocumentActionPanel } from '@/components/documents/document-action-panel';
import { DocumentPreviewDialog } from '@/components/documents/document-preview-dialog';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import {
  canManageAcl,
  canManageLegalHold,
  canReadAcl,
  canViewAudit,
  canViewComplianceEvidencePacket,
  getDocumentAccessDecision,
} from '@/lib/auth/permissions';
import { useDownloadDocument } from '@/lib/hooks/use-download-document';
import { useQueryClient } from '@tanstack/react-query';
import { documentsKeys } from '@/features/documents/documents.keys';
import { useDocumentAiGuardrails } from '@/features/documents/documents.hooks';
import {
  getLatestDocumentVersion,
  getVersionPreviewPosture,
} from '@/features/documents/document-detail-presentation';
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
  const {
    data: aiGuardrails,
    isLoading: isAiGuardrailsLoading,
    isError: isAiGuardrailsError,
  } = useDocumentAiGuardrails(id);
  const { download } = useDownloadDocument({ onError: (msg) => toast.error(msg) });

  const [previewVersion, setPreviewVersion] = useState<DocumentVersion | null>(null);

  if (isLoading) return <LoadingState label="Loading document..." />;
  if (isError || !doc) return <ErrorState message="Failed to load document." onRetry={refetch} />;

  const downloadDecision = getDocumentAccessDecision(session, doc, 'download');
  const previewDecision = getDocumentAccessDecision(session, doc, 'preview');
  const latestVersion = getLatestDocumentVersion(doc.versions ?? []);
  const latestPreviewPosture = latestVersion
    ? getVersionPreviewPosture(latestVersion, previewDecision)
    : null;
  const latestPreviewSupported = latestPreviewPosture?.state === 'supported';
  const previewUnavailableReason =
    latestPreviewPosture && latestPreviewPosture.state !== 'supported'
      ? latestPreviewPosture.reason
      : undefined;
  const canAcl = canManageAcl(session, doc);
  const canHold = canManageLegalHold(session);
  const showLegalHold = canHold || doc.legalHold === true;
  const canShowAcl = canReadAcl(session) || canAcl;
  const canShowEvidenceLinks =
    canViewAudit(session) || canViewComplianceEvidencePacket(session);
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

      <div className="animate-in delay-2 mb-5">
        <DocumentMetadataSummaryCard
          document={{ ...doc, aclEntries, versions: doc.versions ?? [] }}
        />
      </div>

      <div className="animate-in delay-2 mb-5">
        <DocumentApprovalReadinessCard
          document={{ ...doc, aclEntries, versions: doc.versions ?? [] }}
        />
      </div>

      <div className="animate-in delay-2 mb-5">
        <DocumentDlpFindingsCard doc={{ ...doc, aclEntries, versions: doc.versions ?? [] }} />
      </div>

      <div className="animate-in delay-2 mb-5">
        <DocumentAiGuardrailsCard
          guardrails={aiGuardrails}
          isLoading={isAiGuardrailsLoading}
          isError={isAiGuardrailsError}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left col: versions + timeline */}
        <div className="lg:col-span-2 space-y-5">
          <div className="animate-in delay-2">
            <DocumentVersionsCard
              docId={id}
              versions={doc.versions ?? []}
              canDownload={downloadDecision.allowed}
              onDownload={(docId, version) =>
                download(docId, version.versionNumber ?? version.version)
              }
              downloadDeniedReason={downloadDecision.reason}
              canPreview={previewDecision.allowed}
              previewDeniedReason={previewDecision.reason}
              onPreview={(_docId, v) => setPreviewVersion(v)}
            />
          </div>
          <div className="animate-in delay-3">
            <DocumentWorkflowTimeline
              history={history}
              document={{ ...doc, aclEntries, versions: doc.versions ?? [] }}
            />
          </div>
        </div>

        {/* Right col: actions + ACL */}
        <div className="space-y-5">
          <div className="animate-in delay-2">
            <DocumentActionPanel
              doc={{ ...doc, aclEntries, versions: doc.versions ?? [] }}
              onActionComplete={handleActionComplete}
              onPreview={
                latestVersion && latestPreviewSupported
                  ? () => setPreviewVersion(latestVersion)
                  : undefined
              }
              previewUnavailableReason={previewUnavailableReason}
            />
          </div>
          {showLegalHold && (
            <div className="animate-in delay-3">
              <DocumentLegalHoldCard
                document={{ ...doc, aclEntries, versions: doc.versions ?? [] }}
                canManage={canHold}
              />
            </div>
          )}
          {canShowEvidenceLinks && (
            <div className="animate-in delay-3">
              <DocumentEvidenceLinksCard
                document={{ ...doc, aclEntries, versions: doc.versions ?? [] }}
              />
            </div>
          )}
          {canShowAcl && (
            <div className="animate-in delay-3">
              <DocumentAclCard
                docId={id}
                entries={aclEntries}
                canManage={canAcl}
              />
            </div>
          )}
          <div className="animate-in delay-4">
            <DocumentCommentsCard docId={id} />
          </div>
        </div>
      </div>

      <DocumentPreviewDialog
        docId={id}
        version={previewVersion}
        onClose={() => setPreviewVersion(null)}
        canDownload={downloadDecision.allowed}
        downloadDeniedReason={downloadDecision.reason}
      />
    </div>
  );
}
