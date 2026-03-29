import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { apiEndpoints } from '@/lib/api/endpoints';

interface PendingCountResponse {
  total: number;
  byStatus: Record<string, number>;
}

async function fetchPendingCount(): Promise<number> {
  const res = await apiClient.get<PendingCountResponse>(
    apiEndpoints.metadata.documents.list,
  );
  const data = res.data;
  // The response is an array; count PENDING items
  if (Array.isArray(data)) {
    return (data as Array<{ status: string }>).filter((d) => d.status === 'PENDING').length;
  }
  // Fallback: treat as PaginatedResponse
  const items = (data as unknown as { data?: Array<{ status: string }> }).data;
  if (Array.isArray(items)) {
    return items.filter((d) => d.status === 'PENDING').length;
  }
  // Fallback: count from byStatus
  return data.byStatus?.PENDING ?? 0;
}

export function usePendingCount() {
  return useQuery({
    queryKey: ['pending-count'],
    queryFn: fetchPendingCount,
    // Refresh every 30 seconds so the badge stays up-to-date
    refetchInterval: 30_000,
    // Keep stale data while refetching in background
    staleTime: 20_000,
    retry: 1,
  });
}
