/**
 * Standardized API error returned by the backend.
 * Covers both HTTP error responses and network-level failures.
 */
export interface ApiErrorData {
  statusCode: number;
  message: string;
  code?: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(data: ApiErrorData) {
    super(data.message);
    this.name = 'ApiError';
    this.statusCode = data.statusCode;
    this.code = data.code;
    this.details = data.details;
  }

  /** Returns true if this is a client auth error */
  isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  /** Returns true if the server denied access */
  isForbidden(): boolean {
    return this.statusCode === 403;
  }

  /** Returns true if the resource was not found */
  isNotFound(): boolean {
    return this.statusCode === 404;
  }
}

/**
 * Map an unknown error (axios error body, network error, etc.)
 * into a normalized ApiError.
 */
export function parseApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  // Axios error with response
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const axiosError = error as { response?: { status: number; data?: ApiErrorData } };
    const res = axiosError.response;
    if (res) {
      return new ApiError({
        statusCode: res.status,
        message: res.data?.message ?? `HTTP ${res.status}`,
        code: res.data?.code,
        details: res.data?.details,
      });
    }
  }

  // Generic / network error
  if (error instanceof Error) {
    return new ApiError({ statusCode: 0, message: error.message });
  }

  return new ApiError({ statusCode: 0, message: 'An unexpected error occurred' });
}

/** Get a user-facing error message from any error type */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}
