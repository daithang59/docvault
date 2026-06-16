'use client';

import { Search, X } from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className,
  debounceMs = 300,
}: SearchInputProps) {
  const [draftValue, setDraftValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayedValue = isEditing ? draftValue : value;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setIsEditing(true);
      setDraftValue(v);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onChange(v);
        setIsEditing(false);
      }, debounceMs);
    },
    [onChange, debounceMs],
  );

  const handleClear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDraftValue('');
    setIsEditing(false);
    onChange('');
  }, [onChange]);

  return (
    <div className={cn('relative flex items-center', className)}>
      <Search
        size={16}
        className="absolute left-3 text-[var(--text-muted)] pointer-events-none"
      />
      <input
        type="text"
        value={displayedValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-xl border py-2 pl-9 pr-8 text-sm',
          'bg-[var(--input-bg)] text-[var(--input-text)] placeholder:text-[var(--input-placeholder)]',
          'border-[var(--input-border)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--border-focus)]',
          'transition-all duration-200',
        )}
        style={{ backdropFilter: 'blur(8px)' }}
      />
      {displayedValue && (
        <button
          onClick={handleClear}
          className="absolute right-2.5 flex items-center justify-center p-1 rounded-lg text-[var(--text-muted)] transition-all active:scale-90 hover:bg-[var(--bg-muted)]"
          aria-label="Clear search"
          type="button"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
