import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsKeys } from '@/features/documents/documents.keys';
import { getDocuments, createDocument, updateDocument } from '@/lib/api/metadata';
import { uploadDocument } from '@/lib/api/documents';
import { submitDocument, approveDocument, rejectDocument, archiveDocument } from '@/lib/api/workflow';
import { CreateDocumentDto, UpdateDocumentDto } from '@/types/document';

export function useDocuments() {
  return useQuery({
    queryKey: documentsKeys.lists(),
    queryFn: () => getDocuments(),
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDocumentDto) => createDocument(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.lists() });
    },
  });
}

export function useUpdateDocument(docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateDocumentDto) => updateDocument(docId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.lists() });
      qc.invalidateQueries({ queryKey: documentsKeys.detail(docId) });
    },
  });
}

export function useUploadDocument(docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadDocument(docId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.detail(docId) });
      qc.invalidateQueries({ queryKey: documentsKeys.lists() });
    },
  });
}

export function useSubmitDocument(docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => submitDocument(docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.detail(docId) });
      qc.invalidateQueries({ queryKey: documentsKeys.lists() });
      qc.invalidateQueries({ queryKey: documentsKeys.workflowHistory(docId) });
    },
  });
}

export function useApproveDocument(docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => approveDocument(docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.detail(docId) });
      qc.invalidateQueries({ queryKey: documentsKeys.lists() });
      qc.invalidateQueries({ queryKey: documentsKeys.workflowHistory(docId) });
    },
  });
}

export function useRejectDocument(docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => rejectDocument(docId, reason ? { reason } : undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.detail(docId) });
      qc.invalidateQueries({ queryKey: documentsKeys.lists() });
      qc.invalidateQueries({ queryKey: documentsKeys.workflowHistory(docId) });
    },
  });
}

export function useArchiveDocument(docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => archiveDocument(docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.detail(docId) });
      qc.invalidateQueries({ queryKey: documentsKeys.lists() });
      qc.invalidateQueries({ queryKey: documentsKeys.workflowHistory(docId) });
    },
  });
}
