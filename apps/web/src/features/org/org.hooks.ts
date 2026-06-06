'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import {
  fetchMyOrg,
  fetchOrgMembers,
  type OrganizationInfo,
} from './org.api';

/**
 * Loads the current user's organization once a session is present.
 * The first call auto-provisions an organization server-side.
 */
export function useMyOrg() {
  const { session } = useAuth();
  const [org, setOrg] = useState<OrganizationInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session) {
      setOrg(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchMyOrg()
      .then((data) => {
        if (!cancelled) setOrg(data);
      })
      .catch(() => {
        if (!cancelled) setOrg(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  return { org, loading };
}

/** Loads the member list of the current user's organization (admin only). */
export function useOrgMembers(enabled = true) {
  return useQuery({
    queryKey: ['org', 'members'] as const,
    queryFn: fetchOrgMembers,
    enabled,
    staleTime: 60 * 1000,
  });
}
