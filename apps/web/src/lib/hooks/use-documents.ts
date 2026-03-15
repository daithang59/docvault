import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/constants/query-keys';
import { getDocuments, createDocument, updateDocument } from '@/lib/api/metadata';
import { uploadDocument } from '@/lib/api/documents';
import { submitDocument, approveDocument, rejectDocument, archiveDocument } from '@/lib/api/workflow';
import { CreateDocumentDto, UpdateDocumentDto } from '@/types/document';

export function useDocuments() {
  return useQuery({
    queryKey: queryKeys.documents,
    queryFn: getDocuments,
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDocumentDto) => createDocument(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documents });
    },
  });
}

export function useUpdateDocument(docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateDocumentDto) => updateDocument(docId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documents });
      qc.invalidateQueries({ queryKey: queryKeys.documentDetail(docId) });
    },
  });
}

export function useUploadDocument(docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadDocument(docId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documentDetail(docId) });
      qc.invalidateQueries({ queryKey: queryKeys.documents });
    },
  });
}

export function useSubmitDocument(docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => submitDocument(docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documentDetail(docId) });
      qc.invalidateQueries({ queryKey: queryKeys.documents });
      qc.invalidateQueries({ queryKey: queryKeys.workflowHistory(docId) });
    },
  });
}

export function useApproveDocument(docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => approveDocument(docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documentDetail(docId) });
      qc.invalidateQueries({ queryKey: queryKeys.documents });
      qc.invalidateQueries({ queryKey: queryKeys.workflowHistory(docId) });
    },
  });
}

export function useRejectDocument(docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => rejectDocument(docId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documentDetail(docId) });
      qc.invalidateQueries({ queryKey: queryKeys.documents });
      qc.invalidateQueries({ queryKey: queryKeys.workflowHistory(docId) });
    },
  });
}

export function useArchiveDocument(docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => archiveDocument(docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documentDetail(docId) });
      qc.invalidateQueries({ queryKey: queryKeys.documents });
      qc.invalidateQueries({ queryKey: queryKeys.workflowHistory(docId) });
    },
  });
}
