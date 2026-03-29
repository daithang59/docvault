/**
 * Standardized API error returned by the backend.
 * Covers both HTTP error responses and network-level failures.
 */
export interface ApiErrorData {
  statusCode: number;
  message: string;
  code?: string;
  details?: unknown;
  error?: string;
  traceId?: string;
  path?: string;
  timestamp?: string;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly traceId?: string;
  readonly path?: string;
  readonly timestamp?: string;

  constructor(data: ApiErrorData) {
    super(data.message);
    this.name = 'ApiError';
    this.statusCode = data.statusCode;
    this.code = data.code;
    this.details = data.details;
    this.traceId = data.traceId;
    this.path = data.path;
    this.timestamp = data.timestamp;
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

function normalizeMessage(message: unknown, fallback: string): string {
  if (Array.isArray(message)) {
    const [firstMessage] = message;
    return typeof firstMessage === 'string' ? firstMessage : fallback;
  }

  return typeof message === 'string' && message.trim().length > 0 ? message : fallback;
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
    const axiosError = error as {
      code?: string;
      response?: { status: number; data?: Partial<ApiErrorData> & { message?: string | string[] } };
    };
    const res = axiosError.response;
    if (res) {
      const message = normalizeMessage(res.data?.message, `HTTP ${res.status}`);
      return new ApiError({
        statusCode: res.status,
        message,
        code: res.data?.code,
        details: res.data,
        error: res.data?.error,
        traceId: res.data?.traceId,
        path: res.data?.path,
        timestamp: res.data?.timestamp,
      });
    }

    if (axiosError.code === 'ERR_NETWORK') {
      return new ApiError({
        statusCode: 0,
        message: 'Unable to connect to the server.',
        code: axiosError.code,
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
  if (error instanceof ApiError) return getUserFriendlyErrorMessage(error);
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

export function isUnauthorizedError(error: unknown): boolean {
  return parseApiError(error).isUnauthorized();
}

export function isForbiddenError(error: unknown): boolean {
  return parseApiError(error).isForbidden();
}

export function getUserFriendlyErrorMessage(error: unknown): string {
  const apiError = parseApiError(error);

  if (apiError.statusCode === 0) {
    return 'Unable to connect to the server.';
  }

  if (apiError.statusCode === 401) {
    return 'Your session has expired.';
  }

  if (apiError.statusCode === 403) {
    const rawMessage = apiError.message.toLowerCase();

    if (rawMessage.includes('published documents')) {
      return 'Document is not available for download in its current state.';
    }

    if (rawMessage.includes('compliance officers')) {
      return 'You do not have permission to download this document.';
    }

    return 'You do not have permission to perform this action.';
  }

  if (apiError.statusCode === 404) {
    return 'The requested data was not found.';
  }

  if (apiError.statusCode === 409) {
    return apiError.message;
  }

  if (apiError.statusCode >= 500) {
    return 'The server encountered an error while processing the request.';
  }

  return apiError.message;
}
