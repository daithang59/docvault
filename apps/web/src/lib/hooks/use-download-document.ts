'use client';

import { useState, useCallback } from 'react';
import { downloadAuthorize } from '@/lib/api/metadata';
import { presignDownload } from '@/lib/api/documents';
import { ApiError } from '@/types/api';

interface UseDownloadDocumentOptions {
  onError?: (message: string) => void;
}

export function useDownloadDocument(options?: UseDownloadDocumentOptions) {
  const [isDownloading, setIsDownloading] = useState(false);

  const download = useCallback(
    async (docId: string, version?: number) => {
      setIsDownloading(true);
      try {
        // Step 1: Authorize download
        const auth = await downloadAuthorize(docId, version ? { version } : {});

        // Step 2: Get presigned URL
        const presign = await presignDownload(docId, {
          grantToken: auth.grantToken,
          version: auth.version,
        });

        // Step 3: Trigger download
        const a = document.createElement('a');
        a.href = presign.url;
        a.download = auth.filename;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
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
    [options]
  );

  return { download, isDownloading };
}
