export const queryKeys = {
  documents: ['documents'] as const,
  documentLists: () => [...queryKeys.documents, 'list'] as const,
  documentDetail: (id: string) => ['documents', id] as const,
  workflowHistory: (id: string) => ['documents', id, 'workflow-history'] as const,
  acl: (id: string) => ['documents', id, 'acl'] as const,
  approvals: ['approvals'] as const,
  approvalsQueue: () => [...queryKeys.approvals, 'queue'] as const,
  auditAll: ['audit'] as const,
  auditQueries: () => [...queryKeys.auditAll, 'query'] as const,
  audit: (params: Record<string, unknown>) => ['audit', params] as const,
  auth: ['auth'] as const,
  currentUser: () => [...queryKeys.auth, 'current-user'] as const,
} as const;
