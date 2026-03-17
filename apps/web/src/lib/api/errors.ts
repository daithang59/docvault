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
        message: 'Không thể kết nối máy chủ.',
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
    return 'Không thể kết nối máy chủ.';
  }

  if (apiError.statusCode === 401) {
    return 'Phiên đăng nhập đã hết hạn.';
  }

  if (apiError.statusCode === 403) {
    const rawMessage = apiError.message.toLowerCase();

    if (rawMessage.includes('published documents')) {
      return 'Tài liệu chưa ở trạng thái cho phép tải xuống.';
    }

    if (rawMessage.includes('compliance officers')) {
      return 'Bạn không có quyền tải tài liệu này.';
    }

    return 'Bạn không có quyền thực hiện thao tác này.';
  }

  if (apiError.statusCode === 404) {
    return 'Không tìm thấy dữ liệu được yêu cầu.';
  }

  if (apiError.statusCode === 409) {
    return apiError.message;
  }

  if (apiError.statusCode >= 500) {
    return 'Máy chủ gặp lỗi khi xử lý yêu cầu.';
  }

  return apiError.message;
}
