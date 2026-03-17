/** App-level constants */

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'DocVault';

export const DEFAULT_PAGE_SIZE = 20;

export const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/gif',
  'application/zip',
];

export const DEBOUNCE_SEARCH_MS = 300;
