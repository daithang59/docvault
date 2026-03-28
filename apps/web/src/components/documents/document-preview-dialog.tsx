'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileText } from 'lucide-react';
import { DocumentVersion } from '@/features/documents/documents.types';
import { useDocumentPreview } from '@/lib/hooks/use-document-preview';
import { toast } from 'sonner';

// PDF.js must be configured before first import
import '@/lib/pdfjs-config';
import * as pdfjsLib from 'pdfjs-dist';

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

export function DocumentPreviewDialog({ docId, version, onClose }: DocumentPreviewDialogProps) {
  const [viewerState, setViewerState] = useState<ViewerState>('loading');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // PDF viewer state
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const { getImageUrl, getPdfData, isLoading } = useDocumentPreview({
    onError: (msg) => toast.error(msg),
  });

  const contentType = version?.mimeType ?? version?.contentType;
  const isPdf = contentType === PDF_TYPE;
  const isImage = contentType ? IMAGE_TYPES.has(contentType) : false;

  // Open the native <dialog> when version prop becomes non-null
  useEffect(() => {
    if (version === null) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.addEventListener('close', handleDialogClose);
    dialog.showModal();
    loadPreview(version);

    return () => {
      dialog.removeEventListener('close', handleDialogClose);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  function handleDialogClose() {
    setPreviewUrl(null);
    setPdfDoc(null);
    setCurrentPage(1);
    setTotalPages(0);
    setViewerState('loading');
    setErrorMessage('');
    onClose();
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      dialogRef.current?.close();
    }
  }

  async function loadPreview(v: DocumentVersion) {
    try {
      if (isPdf) {
        const { data } = await getPdfData(docId, v.version);
        const loadingTask = pdfjsLib.getDocument({ data });
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        setViewerState('pdf');
      } else if (isImage) {
        const url = await getImageUrl(docId, v.version);
        setPreviewUrl(url);
        setViewerState('image');
      } else {
        setViewerState('unsupported');
      }
    } catch {
      setViewerState('error');
      setErrorMessage('Không thể tải preview. Vui lòng thử lại.');
    }
  }

  // Render PDF page when pdfDoc or currentPage changes
  useEffect(() => {
    if (!pdfDoc || viewerState !== 'pdf') return;

    let cancelled = false;

    async function render() {
      const doc = pdfDoc;
      if (!doc) return;
      const page = await doc.getPage(currentPage);
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;

      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    }

    render();
    return () => { cancelled = true; };
  }, [pdfDoc, currentPage, scale, viewerState]);

  const goToPrev = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const zoomIn = useCallback(() => setScale((s) => Math.min(3, s + 0.2)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(0.3, s - 0.2)), []);

  const filename = version?.filename ?? 'Document';

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') dialogRef.current?.close();
      }}
      className="fixed inset-0 z-50 m-0 max-w-full max-h-full bg-transparent"
      style={{ width: '100vw', height: '100vh', padding: 0 }}
    >
      <div
        className="flex flex-col w-full h-full max-w-5xl mx-auto"
        style={{
          height: '90vh',
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
            <FileText className="h-5 w-5 shrink-0" style={{ color: 'var(--color-primary)' }} />
            <span
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--text-strong)' }}
              title={filename}
            >
              {filename}
            </span>
            {version && (
              <span
                className="text-xs font-medium text-white px-1.5 py-0.5 rounded shrink-0"
                style={{ background: 'var(--color-primary)' }}
              >
                v{version.versionNumber ?? version.version}
              </span>
            )}
          </div>
          <button
            onClick={() => dialogRef.current?.close()}
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
          {/* Loading */}
          {(viewerState === 'loading' || isLoading) && (
            <div className="flex flex-col items-center gap-3">
              <div
                className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
              />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Đang tải preview...
              </span>
            </div>
          )}

          {/* Error */}
          {(viewerState === 'error' || viewerState === 'unsupported') && (
            <div className="flex flex-col items-center gap-3 text-center px-8">
              <div
                className="h-14 w-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--state-info-bg)' }}
              >
                <FileText className="h-7 w-7" style={{ color: 'var(--color-primary)' }} />
              </div>
              <p className="text-base font-medium" style={{ color: 'var(--text-strong)' }}>
                {viewerState === 'unsupported'
                  ? 'Preview không khả dụng cho loại file này'
                  : errorMessage || 'Đã xảy ra lỗi khi tải preview'}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {viewerState === 'unsupported'
                  ? 'Vui lòng tải về để xem nội dung đầy đủ.'
                  : 'Hãy thử tải lại trang.'}
              </p>
            </div>
          )}

          {/* Image viewer */}
          {viewerState === 'image' && previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={filename}
              className="max-w-full max-h-full object-contain"
            />
          )}

          {/* PDF viewer */}
          {viewerState === 'pdf' && (
            <div className="flex flex-col items-center w-full h-full overflow-auto p-4 gap-2">
              <canvas ref={canvasRef} className="shadow-lg" />
            </div>
          )}
        </div>

        {/* Footer toolbar — only shown for PDF */}
        {viewerState === 'pdf' && (
          <div
            className="flex items-center justify-center gap-4 px-5 py-3 border-t shrink-0"
            style={{ borderColor: 'var(--border-soft)' }}
          >
            <button
              onClick={goToPrev}
              disabled={currentPage <= 1}
              className="p-2 rounded-lg transition-colors disabled:opacity-40"
              style={{ color: 'var(--text-muted)' }}
              title="Trang trước"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <span className="text-sm tabular-nums" style={{ color: 'var(--text-main)' }}>
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={goToNext}
              disabled={currentPage >= totalPages}
              className="p-2 rounded-lg transition-colors disabled:opacity-40"
              style={{ color: 'var(--text-muted)' }}
              title="Trang sau"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div className="w-px h-5 mx-1" style={{ background: 'var(--border-soft)' }} />

            <button
              onClick={zoomOut}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              title="Thu nhỏ"
            >
              <ZoomOut className="h-5 w-5" />
            </button>

            <span className="text-xs w-12 text-center" style={{ color: 'var(--text-muted)' }}>
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={zoomIn}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              title="Phóng to"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
