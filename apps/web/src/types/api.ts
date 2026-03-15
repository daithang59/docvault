export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export class ApiError extends Error {
  statusCode: number;
  raw: ApiErrorResponse;

  constructor(response: ApiErrorResponse) {
    const message = Array.isArray(response.message)
      ? response.message.join(', ')
      : response.message;
    super(message);
    this.name = 'ApiError';
    this.statusCode = response.statusCode;
    this.raw = response;
  }
}
