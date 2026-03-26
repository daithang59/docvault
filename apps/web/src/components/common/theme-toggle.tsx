'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils/cn';
import { useMounted } from '@/lib/hooks/use-mounted';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const isDark = mounted && theme === 'dark';
  const nextTheme = isDark ? 'light' : 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={() => mounted && setTheme(nextTheme)}
      className={cn(
        'h-8 w-8 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)]',
        'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-main)]',
        'transition-colors active:scale-95',
        className,
      )}
      aria-label={label}
      title={label}
    >
      <span className="sr-only">{label}</span>
      <span className="flex h-full w-full items-center justify-center">
        {mounted ? (
          isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
        ) : (
          <span className="h-4 w-4" aria-hidden="true" />
        )}
      </span>
    </button>
  );
}
