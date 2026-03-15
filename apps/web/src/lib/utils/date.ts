import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const date = parseISO(iso);
    return format(date, 'dd MMM yyyy, HH:mm');
  } catch {
    return iso;
  }
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'dd MMM yyyy');
  } catch {
    return iso;
  }
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}
