import { AxiosResponse } from 'axios';

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
