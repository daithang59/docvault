'use client';

import { useEffect, useRef, useState } from 'react';
import { X, FileText, ZoomIn, ZoomOut, Download, AlertCircle } from 'lucide-react';
import { DocumentVersion } from '@/features/documents/documents.types';
import { useDocumentPreview } from '@/lib/hooks/use-document-preview';
import { useDownloadDocument } from '@/lib/hooks/use-download-document';
import { toast } from 'sonner';

interface DocumentPreviewDialogProps {
  docId: string;
  version: DocumentVersion | null;
  onClose: () => void;
}

type ViewerState = 'loading' | 'pdf' | 'image' | 'text' | 'unsupported' | 'error';

const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/bmp',
]);

const PDF_TYPE = 'application/pdf';

// File types that can be displayed natively by the browser
const BROWSER_PREVIEW_TYPES = new Set([
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'application/javascript',
  'application/json',
  'application/xml',
  'text/xml',
  'image/svg+xml',
]);

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
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [zoom, setZoom] = useState(100);

  // Track the current blob URL so we can revoke it on cleanup
  const blobUrlRef = useRef<string | null>(null);

  const ZOOM_MIN = 25;
  const ZOOM_MAX = 300;
  const ZOOM_STEP = 25;

  function zoomIn() { setZoom((z) => Math.min(z + ZOOM_STEP, ZOOM_MAX)); }
  function zoomOut() { setZoom((z) => Math.max(z - ZOOM_STEP, ZOOM_MIN)); }
  function zoomReset() { setZoom(100); }

  const { getImageUrl, getPdfData } = useDocumentPreview({
    onError: (msg) => toast.error(msg),
  });
  const download = useDownloadDocument();

  function handleDownload() {
    if (!version) return;
    download.download(docId);
  }

  // Close on Escape
  useEffect(() => {
    if (!version) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [version, onClose]);

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!version) return;

    const selectedVersion = version;
    let cancelled = false;

    async function loadPreview() {
      setViewerState('loading');
      setErrorMessage('');
      setPdfPages([]);
      setZoom(100);

      // Revoke previous blob URL if any
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setPreviewUrl(null);

      const contentType = selectedVersion.mimeType ?? selectedVersion.contentType;
      const isPdf = contentType === PDF_TYPE;
      const isImage = contentType ? IMAGE_TYPES.has(contentType) : false;
      const isBrowserPreviewable = contentType ? BROWSER_PREVIEW_TYPES.has(contentType) : false;

      try {
        if (isBrowserPreviewable) {
          const { data } = await withTimeout(
            getPdfData(docId, selectedVersion.version),
          );
          if (cancelled) return;

          const blob = new Blob([data], { type: contentType ?? undefined });
          const url = URL.createObjectURL(blob);
          if (cancelled) { URL.revokeObjectURL(url); return; }

          blobUrlRef.current = url;
          setPreviewUrl(url);
          setViewerState('text');
          return;
        }

        if (isPdf) {
          const { data } = await withTimeout(
            getPdfData(docId, selectedVersion.version),
          );
          if (cancelled) return;

          const pdfjs = await import('pdfjs-dist');
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

          const pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
          if (cancelled) return;

          const pages: string[] = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const scale = 2;
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d')!;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdf.js RenderParameters type strictness
            await page.render({ canvasContext: ctx, viewport } as any).promise;
            pages.push(canvas.toDataURL('image/png'));

            if (cancelled) return;
          }

          setPdfPages(pages);
          setViewerState('pdf');
          return;
        }

        if (isImage) {
          const url = await withTimeout(
            getImageUrl(docId, selectedVersion.version),
          );
          if (cancelled) return;

          blobUrlRef.current = url;
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
    // NOTE: intentionally exclude hook function identities to avoid refetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, docId]);

  // IMPORTANT: unmount popup completely when no selected version.
  if (!version) return null;

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

          {/* Zoom controls */}
          {(viewerState === 'pdf' || viewerState === 'image' || viewerState === 'text') && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={zoomOut}
                disabled={zoom <= ZOOM_MIN}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                style={{ color: 'var(--text-muted)' }}
                title="Thu nhỏ"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                onClick={zoomReset}
                className="min-w-[3.5rem] px-2 py-1 rounded-lg text-xs font-medium transition-colors"
                style={{ color: 'var(--text-main)' }}
                title="Đặt lại"
              >
                {zoom}%
              </button>
              <button
                onClick={zoomIn}
                disabled={zoom >= ZOOM_MAX}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                style={{ color: 'var(--text-muted)' }}
                title="Phóng to"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors shrink-0"
            style={{ color: 'var(--text-muted)' }}
            title="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content area */}
        <div
          className="flex-1 overflow-auto flex items-start justify-center"
          style={{ background: 'var(--bg-base)' }}
          onContextMenu={(e) => e.preventDefault()}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              if (e.deltaY < 0) zoomIn();
              else zoomOut();
            }
          }}
        >
          {viewerState === 'loading' && (
            <div className="flex flex-col items-center gap-3 mt-[30vh]">
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

          {viewerState === 'error' && (
            <div className="flex flex-col items-center gap-4 text-center px-8 py-6 mt-[20vh]">
              <div
                className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--state-error-bg)' }}
              >
                <AlertCircle className="h-7 w-7" style={{ color: 'var(--state-error-text)' }} />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold" style={{ color: 'var(--text-strong)' }}>
                  Đã xảy ra lỗi khi tải preview
                </p>
                <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>
                  {errorMessage || 'Vui lòng thử lại hoặc tải file về máy.'}
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 rounded-xl border border-[var(--input-border)] px-4 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-muted)]"
                >
                  Đóng
                </button>
                <button
                  onClick={handleDownload}
                  disabled={download.isDownloading}
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
                  style={{ background: 'var(--color-primary)' }}
                >
                  <Download className="h-4 w-4" />
                  {download.isDownloading ? 'Đang tải...' : 'Tải file về'}
                </button>
              </div>
            </div>
          )}

          {viewerState === 'unsupported' && (
            <div className="flex flex-col items-center gap-4 text-center px-8 py-6 mt-[20vh]">
              <div
                className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--state-info-bg)' }}
              >
                <FileText className="h-7 w-7" style={{ color: 'var(--color-primary)' }} />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold" style={{ color: 'var(--text-strong)' }}>
                  Không thể xem trước file này
                </p>
                <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>
                  Định dạng <code className="text-xs bg-[var(--bg-muted)] px-1 py-0.5 rounded">{version?.contentType ?? version?.mimeType ?? 'không xác định'}</code> không được hỗ trợ xem trực tiếp.
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 rounded-xl border border-[var(--input-border)] px-4 py-2 text-sm font-medium text-[var(--text-main)] transition hover:bg-[var(--bg-muted)]"
                >
                  Đóng
                </button>
                <button
                  onClick={handleDownload}
                  disabled={download.isDownloading}
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
                  style={{ background: 'var(--color-primary)' }}
                >
                  <Download className="h-4 w-4" />
                  {download.isDownloading ? 'Đang tải...' : 'Tải file về'}
                </button>
              </div>
            </div>
          )}

          {/* Image viewer — width drives zoom, no max-w/max-h to override it */}
          {viewerState === 'image' && previewUrl && (
            <div className="flex items-center justify-center min-h-full py-6 px-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- blob URL from internal API */}
              <img
                src={previewUrl}
                alt={filename}
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  width: `${zoom}%`,
                  transition: 'width 0.15s ease',
                  display: 'block',
                }}
                draggable={false}
              />
            </div>
          )}

          {/* Text/HTML/JSON/... viewer — iframe fills container */}
          {viewerState === 'text' && previewUrl && (
            <div className="w-full h-full min-h-0 flex">
              <iframe
                src={previewUrl}
                title={filename}
                className="border-0 flex-1"
                style={{ minHeight: '500px' }}
                sandbox="allow-same-origin"
              />
            </div>
          )}

          {/* PDF viewer */}
          {viewerState === 'pdf' && pdfPages.length > 0 && (
            <div
              className="w-full flex flex-col items-center gap-4 py-6 px-4"
              style={{ userSelect: 'none' }}
            >
              {pdfPages.map((dataUrl, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- canvas data URL
                <img
                  key={i}
                  src={dataUrl}
                  alt={`Trang ${i + 1}`}
                  className="shadow-lg rounded"
                  style={{
                    background: 'white',
                    width: `${zoom}%`,
                    maxWidth: 'none',
                    transition: 'width 0.15s ease',
                  }}
                  draggable={false}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
