'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { submitDocument, approveDocument, rejectDocument, archiveDocument } from './workflow.api';
import type { WorkflowActionDto } from './workflow.api';
import { documentsKeys } from '@/features/documents/documents.keys';
import { getErrorMessage } from '@/lib/api/errors';

function useWorkflowMutation(
  docId: string,
  action: (id: string, dto?: WorkflowActionDto) => Promise<void>,
  successMessage: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto?: WorkflowActionDto) => action(docId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.detail(docId) });
      qc.invalidateQueries({ queryKey: documentsKeys.lists() });
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
