import { AxiosResponse } from 'axios';
import type { PaginatedResponse } from '@/types/pagination';

interface ListEnvelopeMeta {
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

type ListEnvelope<T> =
  | T[]
  | {
      data?: T[];
      items?: T[];
      meta?: ListEnvelopeMeta;
      total?: number;
      page?: number;
      pageSize?: number;
      totalPages?: number;
    };

/**
 * Unwrap the data from an axios response.
 * Use when the API returns data directly (not wrapped in a meta object).
 */
export function unwrap<T>(response: AxiosResponse<T>): T {
  return response.data;
}

/**
 * Unwrap the data field from a wrapped API response
 * e.g. { data: T, total: number, ... }
 */
export function unwrapData<T>(response: AxiosResponse<{ data: T }>): T {
  return response.data.data;
}

export function normalizeListResponse<T>(payload: ListEnvelope<T>): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

export function normalizePaginatedResponse<T>(
  payload: ListEnvelope<T>,
): PaginatedResponse<T> {
  const data = normalizeListResponse(payload);

  if (Array.isArray(payload)) {
    return {
      data,
      total: data.length,
      page: 1,
      pageSize: data.length,
      totalPages: data.length > 0 ? 1 : 0,
    };
  }

  const meta = payload.meta ?? {};
  const total = payload.total ?? meta.total ?? data.length;
  const pageSize = payload.pageSize ?? meta.pageSize ?? data.length;
  const page = payload.page ?? meta.page ?? 1;
  const totalPages = payload.totalPages ?? meta.totalPages ?? (pageSize > 0 ? Math.ceil(total / pageSize) : 0);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
  };
}
