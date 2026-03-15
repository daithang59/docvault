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
    const maxSize = 100 * 1024 * 1024; // 100 MB
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
        onDragOver={(e) => { e.preventDefault(); !disabled && setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center transition-all',
          isDragging
            ? 'border-[#2563EB] bg-[#EFF6FF]'
            : 'border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#2563EB] hover:bg-[#EFF6FF]',
          disabled && 'opacity-50 pointer-events-none'
        )}
      >
        <Upload className="h-8 w-8 mx-auto mb-3 text-[#94A3B8]" />
        <p className="text-sm font-medium text-[#1E293B] mb-1">
          Drop file here or{' '}
          <label className="text-[#2563EB] cursor-pointer hover:underline">
            browse
            <input
              type="file"
              className="sr-only"
              onChange={onInputChange}
              disabled={disabled}
            />
          </label>
        </p>
        <p className="text-xs text-[#94A3B8]">Any file type, max 100 MB</p>
      </div>

      {/* Selected file preview */}
      {selectedFile && (
        <div className="flex items-center gap-3 p-3 bg-white border border-[#E2E8F0] rounded-xl">
          <div className="h-9 w-9 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
            <File className="h-4 w-4 text-[#2563EB]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1E293B] truncate">{selectedFile.name}</p>
            <p className="text-xs text-[#94A3B8]">{formatBytes(selectedFile.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => { onFileSelect(null); setError(null); }}
            className="text-[#94A3B8] hover:text-[#1E293B] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-[#DC2626]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
