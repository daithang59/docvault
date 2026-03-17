'use client';

import { useState, useCallback } from 'react';
import { authorizeDownload, presignDownload } from '@/features/documents/documents.api';
import { ApiError } from '@/lib/api/errors';
import { triggerBrowserDownload } from '@/lib/utils/download';

interface UseDownloadDocumentOptions {
  onError?: (message: string) => void;
}

export function useDownloadDocument(options?: UseDownloadDocumentOptions) {
  const [isDownloading, setIsDownloading] = useState(false);

  const download = useCallback(
    async (docId: string) => {
      setIsDownloading(true);
      try {
        // Step 1: Authorize download — get a short-lived download token
        const { downloadToken } = await authorizeDownload(docId);

        // Step 2: Exchange token for presigned URL
        const { url, filename } = await presignDownload(docId, downloadToken);

        // Step 3: Trigger browser download
        triggerBrowserDownload(url, filename || `document-${docId}`);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : 'Failed to download document.';
        options?.onError?.(message);
      } finally {
        setIsDownloading(false);
      }
    },
    [options],
  );

  return { download, isDownloading };
}
