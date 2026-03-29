'use client';

import { useCallback, useState } from 'react';
import { Upload, File, X, AlertCircle } from 'lucide-react';
import { formatBytes } from '@/lib/utils/file';
import { cn } from '@/lib/utils/cn';

interface UploadDropzoneProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  className?: string;
  disabled?: boolean;
}

export function UploadDropzone({
  onFileSelect,
  selectedFile,
  className,
  disabled,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (file: File) => {
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File exceeds the 100 MB limit.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleFile = useCallback(
    (file: File) => {
      if (validate(file)) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) {
            setIsDragging(true);
          }
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          'rounded-xl border-2 border-dashed p-5 text-center transition-all',
          isDragging
            ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
            : 'border-[var(--input-border)] bg-[var(--bg-subtle)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]',
          disabled && 'pointer-events-none opacity-50'
        )}
      >
        <Upload className="mx-auto mb-2 h-6 w-6 text-[var(--text-muted)]" />
        <p className="mb-1 text-sm font-medium text-[var(--text-main)]">
          Drop file here or{' '}
          <label className="cursor-pointer text-[var(--color-primary)] hover:underline">
            browse
            <input
              type="file"
              className="sr-only"
              onChange={onInputChange}
              disabled={disabled}
            />
          </label>
        </p>
        <p className="text-xs text-[var(--text-muted)]">Any file type, max 100 MB</p>
      </div>

      {/* Selected file preview */}
      {selectedFile && (
        <div className="flex items-center gap-3 rounded-xl border p-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-light)]">
            <File className="h-4 w-4 text-[var(--color-primary)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--text-main)]">{selectedFile.name}</p>
            <p className="text-xs text-[var(--text-muted)]">{formatBytes(selectedFile.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => { onFileSelect(null); setError(null); }}
            className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-destructive)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
