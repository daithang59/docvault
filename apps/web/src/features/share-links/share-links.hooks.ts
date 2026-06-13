'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api/errors';
import {
  createShareLink,
  listShareLinks,
  revokeShareLink,
} from './share-links.api';
import type { CreateShareLinkInput } from './share-links.types';

export const shareLinksKeys = {
  all: ['share-links'] as const,
  list: (docId: string) => [...shareLinksKeys.all, docId] as const,
};

export function useShareLinks(docId: string, enabled = true) {
  return useQuery({
    queryKey: shareLinksKeys.list(docId),
    queryFn: () => listShareLinks(docId),
    enabled: Boolean(docId) && enabled,
  });
}

export function useCreateShareLink(docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShareLinkInput) => createShareLink(docId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shareLinksKeys.list(docId) });
      toast.success('Share link created');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}

export function useRevokeShareLink(docId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => revokeShareLink(docId, linkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shareLinksKeys.list(docId) });
      toast.success('Share link revoked');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
}
