export const apiEndpoints = {
  auth: {
    currentUser: '/me',
  },
  metadata: {
    documents: {
      list: '/metadata/documents',
      create: '/metadata/documents',
      detail: (docId: string) => `/metadata/documents/${docId}`,
      update: (docId: string) => `/metadata/documents/${docId}`,
      workflowHistory: (docId: string) => `/metadata/documents/${docId}/workflow-history`,
      acl: (docId: string) => `/metadata/documents/${docId}/acl`,
      downloadAuthorize: (docId: string) => `/metadata/documents/${docId}/download-authorize`,
    },
  },
  documents: {
    upload: (docId: string) => `/documents/${docId}/upload`,
    presignDownload: (docId: string) => `/documents/${docId}/presign-download`,
    streamDownload: (docId: string, version: number) => `/documents/${docId}/versions/${version}/stream`,
  },
  workflow: {
    submit: (docId: string) => `/workflow/${docId}/submit`,
    approve: (docId: string) => `/workflow/${docId}/approve`,
    reject: (docId: string) => `/workflow/${docId}/reject`,
    archive: (docId: string) => `/workflow/${docId}/archive`,
  },
  audit: {
    query: '/audit/query',
  },
} as const;

export type ApiEndpoints = typeof apiEndpoints;
