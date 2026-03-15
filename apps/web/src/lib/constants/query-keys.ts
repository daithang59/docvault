export const queryKeys = {
  documents: ['documents'] as const,
  documentDetail: (id: string) => ['documents', id] as const,
  workflowHistory: (id: string) => ['documents', id, 'workflow-history'] as const,
  acl: (id: string) => ['documents', id, 'acl'] as const,
  audit: (params: Record<string, unknown>) => ['audit', params] as const,
} as const;
