'use client';

import { useEffect, useState } from 'react';
import { X, FileText } from 'lucide-react';
import { DocumentVersion } from '@/features/documents/documents.types';
import { useDocumentPreview } from '@/lib/hooks/use-document-preview';
import { toast } from 'sonner';

interface DocumentPreviewDialogProps {
  docId: string;
  version: DocumentVersion | null;
  onClose: () => void;
}

type ViewerState = 'loading' | 'pdf' | 'image' | 'unsupported' | 'error';

const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/bmp',
]);

const PDF_TYPE = 'application/pdf';

function withTimeout<T>(promise: Promise<T>, ms = 20000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Preview request timeout')), ms),
    ),
  ]);
}

export function DocumentPreviewDialog({
  docId,
  version,
  onClose,
}: DocumentPreviewDialogProps) {
  const [viewerState, setViewerState] = useState<ViewerState>('loading');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const { getImageUrl, getPdfData } = useDocumentPreview({
    onError: (msg) => toast.error(msg),
  });

  // Close on Escape
  useEffect(() => {
    if (!version) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [version, onClose]);

  // Cleanup blob URL when preview changes/unmounts
  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!version) return;

    const selectedVersion = version;
    let cancelled = false;

    async function loadPreview() {
      setViewerState('loading');
      setErrorMessage('');

      const contentType = selectedVersion.mimeType ?? selectedVersion.contentType;
      const isPdf = contentType === PDF_TYPE;
      const isImage = contentType ? IMAGE_TYPES.has(contentType) : false;

      try {
        if (isPdf) {
          const { data } = await withTimeout(
            getPdfData(docId, selectedVersion.version),
          );
          if (cancelled) return;

          const blob = new Blob([data], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);
          setPreviewUrl(blobUrl);
          setViewerState('pdf');
          return;
        }

        if (isImage) {
          const url = await withTimeout(
            getImageUrl(docId, selectedVersion.version),
          );
          if (cancelled) return;
          setPreviewUrl(url);
          setViewerState('image');
          return;
        }

        setViewerState('unsupported');
      } catch (err) {
        if (cancelled) return;
        setViewerState('error');
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Không thể tải preview. Vui lòng thử lại.',
        );
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [version, docId, getImageUrl, getPdfData]);

  // IMPORTANT: unmount popup completely when no selected version.
  if (!version) {
    return null;
  }

  const filename = version.filename ?? 'Document';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div
        className="flex flex-col w-[min(1200px,92vw)] h-[90vh]"
        style={{
          background: 'var(--bg-card)',
          borderRadius: '1rem',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0 border-b"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <FileText
              className="h-5 w-5 shrink-0"
              style={{ color: 'var(--color-primary)' }}
            />
            <span
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--text-strong)' }}
              title={filename}
            >
              {filename}
            </span>
            <span
              className="text-xs font-medium text-white px-1.5 py-0.5 rounded shrink-0"
              style={{ background: 'var(--color-primary)' }}
            >
              v{version.versionNumber ?? version.version}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors shrink-0"
            style={{ color: 'var(--text-muted)' }}
            title="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-hidden flex items-center justify-center"
          style={{ background: 'var(--bg-base)' }}
        >
          {viewerState === 'loading' && (
            <div className="flex flex-col items-center gap-3">
              <div
                className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{
                  borderColor: 'var(--color-primary)',
                  borderTopColor: 'transparent',
                }}
              />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Đang tải preview...
              </span>
            </div>
          )}

          {(viewerState === 'error' || viewerState === 'unsupported') && (
            <div className="flex flex-col items-center gap-3 text-center px-8">
              <div
                className="h-14 w-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--state-info-bg)' }}
              >
                <FileText
                  className="h-7 w-7"
                  style={{ color: 'var(--color-primary)' }}
                />
              </div>
              <p className="text-base font-medium" style={{ color: 'var(--text-strong)' }}>
                {viewerState === 'unsupported'
                  ? 'Preview không khả dụng cho loại file này'
                  : errorMessage || 'Đã xảy ra lỗi khi tải preview'}
              </p>
            </div>
          )}

          {viewerState === 'image' && previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- blob URL from internal API, next/image requires domain config
            <img
              src={previewUrl}
              alt={filename}
              className="max-w-full max-h-full object-contain"
            />
          )}

          {viewerState === 'pdf' && previewUrl && (
            <iframe
              src={previewUrl}
              title={filename}
              className="w-full h-full border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}
