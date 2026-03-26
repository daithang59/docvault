import axios from 'axios';
import { env } from '@/config/env';

/**
 * Singleton axios instance for all API calls.
 * Interceptors are applied separately in interceptors.ts.
 */
export const apiClient = axios.create({
  baseURL: env.API_BASE_URL,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
  },
  timeout: 30_000,
});

export default apiClient;
