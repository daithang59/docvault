import { PresignDownloadRequest, PresignDownloadResponse, UploadDocumentResponse } from '@/types/document';
import { apiPost, apiUpload } from './client';

export function uploadDocument(
  docId: string,
  file: File
): Promise<UploadDocumentResponse> {
  return apiUpload<UploadDocumentResponse>(`/documents/${docId}/upload`, file);
}

export function presignDownload(
  docId: string,
  data: PresignDownloadRequest
): Promise<PresignDownloadResponse> {
  return apiPost<PresignDownloadResponse>(
    `/documents/${docId}/presign-download`,
    data
  );
}

export function getStreamDownloadUrl(docId: string, version: number): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';
  return `${base}/documents/${docId}/versions/${version}/stream`;
}
