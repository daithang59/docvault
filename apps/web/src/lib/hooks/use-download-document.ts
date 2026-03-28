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
      // 1. Authorize — metadata-service checks ACL/classification/role
      const authorization = await authorizeDownload(docId);
      const filename = authorization.filename || `document-${docId}`;

      // 2. Presign URL — pass grantToken so document-service skips re-authorization
      const result = await presignDownload(docId, authorization.version, authorization.grantToken);

      if (result.url) {
        // Non-watermark files: download directly from MinIO via presigned URL
        triggerBrowserDownload(result.url, result.filename || filename);
      } else {
        // Watermark required: stream via grant token through gateway
        const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace('/api', '') || 'http://localhost:3000';
        const token = encodeURIComponent(authorization.grantToken);
        const url = `${base}/documents/${docId}/versions/${authorization.version}/stream?token=${token}`;
        triggerBrowserDownload(url, result.filename || filename);
      }
    } catch (err) {
      options?.onError?.(getErrorMessage(err));
    } finally {
      setIsDownloading(false);
    }
  }

  return { download, isDownloading };
}
