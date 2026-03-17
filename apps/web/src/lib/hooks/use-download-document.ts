'use client';

import { useState } from 'react';
import { authorizeDownload, presignDownload } from '@/features/documents/documents.api';
import { getErrorMessage } from '@/lib/api/errors';
import { triggerBrowserDownload } from '@/lib/utils/download';

interface UseDownloadDocumentOptions {
  onError?: (message: string) => void;
}

export function useDownloadDocument(options?: UseDownloadDocumentOptions) {
  const [isDownloading, setIsDownloading] = useState(false);

  async function download(docId: string) {
    setIsDownloading(true);
    try {
      const authorization = await authorizeDownload(docId);
      const { url, filename } = await presignDownload(docId, authorization.version);

      triggerBrowserDownload(url, filename || authorization.filename || `document-${docId}`);
    } catch (err) {
      options?.onError?.(getErrorMessage(err));
    } finally {
      setIsDownloading(false);
    }
  }

  return { download, isDownloading };
}
