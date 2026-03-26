'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { submitDocument, approveDocument, rejectDocument, archiveDocument } from './workflow.api';
import type { WorkflowActionDto } from './workflow.api';
import { documentsKeys } from '@/features/documents/documents.keys';
import { approvalsKeys } from '@/features/approvals/approvals.keys';
import { auditKeys } from '@/features/audit/audit.keys';
import { getErrorMessage } from '@/lib/api/errors';

function useWorkflowMutation<TDto extends WorkflowActionDto | undefined>(
  docId: string,
  action: (id: string, dto?: TDto) => Promise<unknown>,
  successMessage: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto?: TDto) => action(docId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.detail(docId) });
      qc.invalidateQueries({ queryKey: documentsKeys.lists() });
      qc.invalidateQueries({ queryKey: documentsKeys.workflowHistory(docId) });
      qc.invalidateQueries({ queryKey: approvalsKeys.all });
      qc.invalidateQueries({ queryKey: auditKeys.queries() });
      toast.success(successMessage);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}

export function useSubmitDocument(docId: string) {
  return useWorkflowMutation(docId, submitDocument, 'Document submitted for approval');
}

export function useApproveDocument(docId: string) {
  return useWorkflowMutation(docId, approveDocument, 'Document approved and published');
}

export function useRejectDocument(docId: string) {
  return useWorkflowMutation(docId, rejectDocument, 'Document rejected — returned to draft');
}

export function useArchiveDocument(docId: string) {
  return useWorkflowMutation(docId, archiveDocument, 'Document archived');
}
