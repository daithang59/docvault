export function truncateMiddle(str: string, maxLen = 16): string {
  if (str.length <= maxLen) return str;
  const half = Math.floor(maxLen / 2);
  return `${str.slice(0, half)}…${str.slice(-half)}`;
}

export function truncateEnd(str: string, maxLen = 50): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen)}…`;
}

export function titleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}
