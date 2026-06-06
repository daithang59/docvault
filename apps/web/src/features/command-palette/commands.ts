import type { ComponentType } from 'react';
import { NAV_ITEMS } from '@/lib/constants/nav';
import { ROUTES } from '@/lib/constants/routes';
import type { UserRole } from '@/types/auth';

export interface CommandItem {
  id: string;
  title: string;
  group: 'Navigation' | 'Actions';
  href: string;
  keywords: string;
  icon?: ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const ACTION_COMMANDS: CommandItem[] = [
  {
    id: 'action-new-document',
    title: 'Create new document',
    group: 'Actions',
    href: ROUTES.DOCUMENTS_NEW,
    keywords: 'new create document upload add',
    roles: ['editor', 'admin'],
  },
  {
    id: 'action-run-retention',
    title: 'Open retention',
    group: 'Actions',
    href: ROUTES.RETENTION,
    keywords: 'retention archive policy run',
    roles: ['compliance_officer', 'admin'],
  },
  {
    id: 'action-access-review',
    title: 'Open access review',
    group: 'Actions',
    href: ROUTES.ACCESS_REVIEW,
    keywords: 'access review recertify permissions acl',
    roles: ['compliance_officer', 'admin'],
  },
];

/**
 * Build the full command set scoped to the user's roles. Navigation commands
 * are derived from the same NAV_ITEMS the sidebar uses, so the palette stays in
 * sync with role-based navigation.
 */
export function buildCommandItems(roles: string[]): CommandItem[] {
  const navCommands: CommandItem[] = NAV_ITEMS.map((item) => ({
    id: `nav-${item.href}`,
    title: item.label,
    group: 'Navigation',
    href: item.href,
    keywords: item.label.toLowerCase(),
    icon: item.icon,
    roles: item.roles,
  }));

  return [...navCommands, ...ACTION_COMMANDS].filter((command) =>
    command.roles.some((role) => roles.includes(role)),
  );
}

/**
 * Rank commands against a query. Empty query returns all commands in order.
 * Matching is case-insensitive over title + keywords, with title-prefix matches
 * ranked highest so the most likely target surfaces first.
 */
export function filterCommands(
  commands: CommandItem[],
  query: string,
): CommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;

  const scored = commands
    .map((command) => {
      const title = command.title.toLowerCase();
      const haystack = `${title} ${command.keywords}`;
      let score = -1;
      if (title.startsWith(q)) score = 3;
      else if (title.includes(q)) score = 2;
      else if (haystack.includes(q)) score = 1;
      return { command, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((entry) => entry.command);
}
