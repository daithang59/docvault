export const retentionKeys = {
  all: ['retention'] as const,
  evidence: () => [...retentionKeys.all, 'evidence'] as const,
};
