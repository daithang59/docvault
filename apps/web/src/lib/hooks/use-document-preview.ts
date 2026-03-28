'use client';

import { useState } from 'react';
import apiClient from '@/lib/api/client';
import { apiEndpoints } from '@/lib/api/endpoints';
import { getErrorMessage } from '@/lib/api/errors';

interface UseDocumentPreviewOptions {
  onError?: (message: string) => void;
}

export function useDocumentPreview(options?: UseDocumentPreviewOptions) {
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Returns the preview URL for a document version.
   * The backend validates JWT + ACL internally via the gateway.
   * URL is used for image preview (img tag handles auth via browser cookies).
   */
  async function getImageUrl(
    docId: string,
    version?: number,
  ): Promise<string> {
    setIsLoading(true);
    try {
      const endpoint = apiEndpoints.documents.preview(docId);
      const base = apiClient.getUri().replace(/\/$/, '');
      const url = new URL(
        `${base}${endpoint}${version !== undefined ? `?version=${version}` : ''}`,
      );
      return url.toString();
    } catch (err) {
      options?.onError?.(
        err instanceof Error ? err.message : 'Failed to build preview URL',
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Fetches PDF data via axios (with auth token) and returns ArrayBuffer for pdfjs.
   * pdfjs is passed ArrayBuffer directly to avoid auth issues with its internal fetch.
   */
  async function getPdfData(
    docId: string,
    version?: number,
  ): Promise<{ data: ArrayBuffer; filename: string }> {
    setIsLoading(true);
    try {
      const endpoint = apiEndpoints.documents.preview(docId);
      const base = apiClient.getUri().replace(/\/$/, '');
      const url = `${base}${endpoint}${version !== undefined ? `?version=${version}` : ''}`;

      const response = await apiClient.get(url, {
        responseType: 'arraybuffer',
      }).catch((err: unknown) => {
        let bodyStr = '';
        const e = err as { details?: { data?: Uint8Array }; statusCode?: number; message?: string };
        if (e.details?.data) {
          try {
            bodyStr = new TextDecoder().decode(e.details.data);
          } catch { bodyStr = 'cannot decode'; }
        }
        console.error('[Preview] API error:', e.statusCode, e.message, 'BODY:', bodyStr);
        throw err;
      });

      // Extract filename from Content-Disposition header if present
      const disposition = response.headers['content-disposition'];
      let filename = 'document.pdf';
      if (disposition) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match) filename = decodeURIComponent(match[1]);
      }

      return { data: response.data as ArrayBuffer, filename };
    } catch (err) {
      options?.onError?.(getErrorMessage(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  return { getImageUrl, getPdfData, isLoading };
}
