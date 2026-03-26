'use client';

import Link from 'next/link';
import { Home, ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-1 text-sm">
        <li>
          <Link
            href="/dashboard"
            className="text-[var(--text-faint)] transition-colors hover:text-[var(--text-muted)]"
            aria-label="Home"
          >
            <Home size={14} />
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={item.href ?? item.label} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-[var(--text-faint)]" />
            {item.href && index < items.length - 1 ? (
              <Link
                href={item.href}
                className="text-[var(--text-muted)] font-medium transition-colors hover:text-[var(--text-main)]"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-[var(--text-strong)]">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
