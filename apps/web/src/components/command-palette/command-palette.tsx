'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import {
  buildCommandItems,
  filterCommands,
} from '@/features/command-palette/commands';

export function CommandPalette() {
  const router = useRouter();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const roles = useMemo(
    () => (session?.user?.roles as string[] | undefined) ?? [],
    [session],
  );
  const commands = useMemo(() => buildCommandItems(roles), [roles]);
  const results = useMemo(
    () => filterCommands(commands, query),
    [commands, query],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((prev) => {
          const next = !prev;
          if (next) {
            setQuery('');
            setActiveIndex(0);
          }
          return next;
        });
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!session) return null;
  if (!open) return null;

  function go(index: number) {
    const target = results[index];
    if (!target) return;
    setOpen(false);
    router.push(target.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(activeIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 mx-4 w-full max-w-xl overflow-hidden rounded-xl border"
        style={{
          background: 'var(--surface-overlay-strong)',
          borderColor: 'var(--surface-border)',
          boxShadow: 'var(--surface-shadow-lg)',
        }}
      >
        <div
          className="flex items-center gap-2 border-b px-4 py-3"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <Search className="h-4 w-4 text-[var(--text-faint)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search pages and actions..."
            className="w-full bg-transparent text-sm text-[var(--text-main)] outline-none"
            aria-label="Search pages and actions"
          />
          <kbd className="rounded border px-1.5 py-0.5 text-[10px] text-[var(--text-faint)]" style={{ borderColor: 'var(--border-soft)' }}>
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[var(--text-faint)]">
              No matching commands
            </p>
          ) : (
            results.map((command, index) => {
              const Icon = command.icon;
              const active = index === activeIndex;
              return (
                <button
                  key={command.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => go(index)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors"
                  style={{
                    background: active ? 'var(--bg-muted)' : 'transparent',
                    color: 'var(--text-main)',
                  }}
                >
                  {Icon ? (
                    <Icon className="h-4 w-4 text-[var(--text-faint)]" />
                  ) : (
                    <span className="h-4 w-4" />
                  )}
                  <span className="flex-1 truncate">{command.title}</span>
                  <span className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                    {command.group}
                  </span>
                  {active && (
                    <CornerDownLeft className="h-3.5 w-3.5 text-[var(--text-faint)]" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
