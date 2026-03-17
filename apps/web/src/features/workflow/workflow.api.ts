import apiClient from '@/lib/api/client';
import { unwrap } from '@/lib/api/response';
import { apiEndpoints } from '@/lib/api/endpoints';
import type {
  DocumentSummaryDto,
  SubmitDocumentRequest,
  ApproveDocumentRequest,
  RejectDocumentRequest,
  ArchiveDocumentRequest,
} from '@/features/documents/documents.types';

export type WorkflowActionDto =
  | SubmitDocumentRequest
  | ApproveDocumentRequest
  | RejectDocumentRequest
  | ArchiveDocumentRequest;

export async function submitDocument(
  id: string,
  dto?: SubmitDocumentRequest,
): Promise<DocumentSummaryDto> {
  const response = await apiClient.post<DocumentSummaryDto>(
    apiEndpoints.workflow.submit(id),
    dto ?? {},
  );
  return unwrap(response);
}

export async function approveDocument(
  id: string,
  dto?: ApproveDocumentRequest,
): Promise<DocumentSummaryDto> {
  const response = await apiClient.post<DocumentSummaryDto>(
    apiEndpoints.workflow.approve(id),
    dto ?? {},
  );
  return unwrap(response);
}

export async function rejectDocument(
  id: string,
  dto?: RejectDocumentRequest,
): Promise<DocumentSummaryDto> {
  const response = await apiClient.post<DocumentSummaryDto>(
    apiEndpoints.workflow.reject(id),
    dto ?? {},
  );
  return unwrap(response);
}

export async function archiveDocument(
  id: string,
  dto?: ArchiveDocumentRequest,
): Promise<DocumentSummaryDto> {
  const response = await apiClient.post<DocumentSummaryDto>(
    apiEndpoints.workflow.archive(id),
    dto ?? {},
  );
  return unwrap(response);
}
