/**
 * @deprecated Use `@/features/documents/documents.api` instead.
 * Kept for backward compatibility with Phase 1 components.
 * Updated to use new axios client.
 */
export {
  getDocuments,
  getDocument as getDocumentDetail,
  createDocument,
  updateDocument,
  getWorkflowHistory,
  getDocumentAcl as getAcl,
  addAclEntry,
  authorizeDownload as downloadAuthorize,
} from '@/features/documents/documents.api';
