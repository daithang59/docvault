export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  DOCUMENTS: '/documents',
  DOCUMENTS_NEW: '/documents/new',
  DOCUMENT_DETAIL: (id: string) => `/documents/${id}`,
  DOCUMENT_EDIT: (id: string) => `/documents/${id}/edit`,
  APPROVALS: '/approvals',
  AUDIT: '/audit',
} as const;
