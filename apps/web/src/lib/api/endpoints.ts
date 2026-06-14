export const apiEndpoints = {
  auth: {
    currentUser: '/me',
  },
  orgs: {
    me: '/orgs/me',
    members: '/orgs/members',
    groups: '/orgs/groups',
    member: (userId: string) => `/orgs/members/${userId}`,
  },
  users: {
    profile: '/users/profile',
    batch: '/users/batch',
  },
  metadata: {
    documents: {
      list: '/metadata/documents',
      trash: '/metadata/documents/trash',
      restore: (docId: string) => `/metadata/documents/${docId}/restore`,
      approvers: (docId: string) => `/metadata/documents/${docId}/approvers`,
      approvalChain: (docId: string) => `/metadata/documents/${docId}/approval-chain`,
      create: '/metadata/documents',
      detail: (docId: string) => `/metadata/documents/${docId}`,
      evidencePacket: (docId: string) => `/metadata/documents/${docId}/evidence-packet`,
      aiGuardrails: (docId: string) => `/metadata/documents/${docId}/ai-guardrails`,
      accessImpact: (docId: string) => `/metadata/documents/${docId}/access-impact`,
      update: (docId: string) => `/metadata/documents/${docId}`,
      workflowHistory: (docId: string) => `/metadata/documents/${docId}/workflow-history`,
      acl: (docId: string) => `/metadata/documents/${docId}/acl`,
      downloadAuthorize: (docId: string) => `/metadata/documents/${docId}/download-authorize`,
      comments: (docId: string) => `/metadata/documents/${docId}/comments`,
      legalHold: (docId: string) => `/metadata/documents/${docId}/legal-hold`,
      shareLinks: (docId: string) => `/metadata/documents/${docId}/share-links`,
      shareLink: (docId: string, linkId: string) =>
        `/metadata/documents/${docId}/share-links/${linkId}`,
      restoreVersion: (docId: string, version: number) =>
        `/metadata/documents/${docId}/versions/${version}/restore`,
    },
    savedViews: {
      list: '/metadata/document-saved-views',
      create: '/metadata/document-saved-views',
      delete: (id: string) => `/metadata/document-saved-views/${id}`,
    },
    retention: {
      documents: '/metadata/retention/documents',
      run: '/metadata/retention/run',
    },
    accessReview: {
      documents: '/metadata/access-review/documents',
    },
    sensitiveActions: {
      proof: '/metadata/sensitive-actions/proof',
    },
    shareLinks: {
      redeem: '/metadata/share-links/redeem',
    },
  },
  documents: {
    upload: (docId: string) => `/documents/${docId}/upload`,
    presignDownload: (docId: string) => `/documents/${docId}/presign-download`,
    streamDownload: (docId: string, version: number) => `/documents/${docId}/versions/${version}/stream`,
    preview: (docId: string) => `/documents/${docId}/preview`,
    previewAuthorize: (docId: string) => `/metadata/documents/${docId}/preview-authorize`,
  },
  workflow: {
    submit: (docId: string) => `/workflow/${docId}/submit`,
    approve: (docId: string) => `/workflow/${docId}/approve`,
    reject: (docId: string) => `/workflow/${docId}/reject`,
    archive: (docId: string) => `/workflow/${docId}/archive`,
    delete: (docId: string) => `/workflow/${docId}`,
  },
  audit: {
    query: '/audit/query',
    verifyChain: '/audit/verify-chain',
    sealChainAndStartEpoch: '/audit/chain/seal-and-start-epoch',
    securitySummary: '/audit/security-summary',
    securityRecommendationWorkflow: (id: string) =>
      `/audit/security-recommendations/${encodeURIComponent(id)}/workflow`,
    securityRecommendationWorkflowHistory: (id: string) =>
      `/audit/security-recommendations/${encodeURIComponent(id)}/workflow-history`,
  },
} as const;

export type ApiEndpoints = typeof apiEndpoints;
