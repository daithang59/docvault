'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { documentsKeys } from './documents.keys';
import {
  getDocuments,
  getDocument,
  createDocument,
  updateDocument,
  uploadDocumentFile,
  getWorkflowHistory,
  getDocumentAcl,
  addAclEntry,
  authorizeDownload,
  presignDownload,
} from './documents.api';
import type { DocumentListFilters, CreateDocumentDto, UpdateDocumentDto, AddAclEntryDto } from './documents.types';
import { triggerBrowserDownload } from '@/lib/utils/download';
import { getErrorMessage } from '@/lib/api/errors';

// ── Queries ──────────────────────────────────────────────────────────────────

export function useDocumentsList(filters?: DocumentListFilters) {
  return useQuery({
    queryKey: documentsKeys.list(filters),
    queryFn: () => getDocuments(filters),
  });
}

export function useDocumentDetail(id: string) {
  return useQuery({
    queryKey: documentsKeys.detail(id),
    queryFn: () => getDocument(id),
    enabled: Boolean(id),
  });
}

export function useWorkflowHistory(id: string) {
  return useQuery({
    queryKey: documentsKeys.workflowHistory(id),
    queryFn: () => getWorkflowHistory(id),
    enabled: Boolean(id),
  });
}

export function useDocumentAcl(id: string) {
  return useQuery({
    queryKey: documentsKeys.acl(id),
    queryFn: () => getDocumentAcl(id),
    enabled: Boolean(id),
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateDocumentDto) => createDocument(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.lists() });
      toast.success('Document created successfully');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}

export function useUpdateDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateDocumentDto) => updateDocument(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.detail(id) });
      qc.invalidateQueries({ queryKey: documentsKeys.lists() });
      toast.success('Document updated successfully');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}

export function useUploadDocumentFile(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadDocumentFile(id, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.detail(id) });
      toast.success('File uploaded successfully');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}

export function useAddAclEntry(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: AddAclEntryDto) => addAclEntry(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.acl(id) });
      toast.success('ACL entry added');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}

export function useDownloadDocument() {
  return useMutation({
    mutationFn: async ({ id, filename }: { id: string; filename?: string }) => {
      const { downloadToken } = await authorizeDownload(id);
      const { url, filename: serverFilename } = await presignDownload(id, downloadToken);
      triggerBrowserDownload(url, filename ?? serverFilename ?? `document-${id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
