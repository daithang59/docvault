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

/**
 * Format a Keycloak username into a readable display name.
 * "editor1" → "Editor 1"
 * "admin1"  → "Admin 1"
 * "co1"     → "CO 1"
 * "viewer2" → "Viewer 2"
 */
export function formatOwnerName(ownerId: string): string {
  // Already looks human-readable (has space or title-case letters)
  if (/[A-Z]/.test(ownerId) || /\s/.test(ownerId)) return ownerId;

  return ownerId
    // Split trailing digits: "editor1" → ["editor", "1"]
    .replace(/(\d+)$/, ' $1')
    // Title-case the leading part: "editor" → "Editor"
    .replace(/^[a-z]+/, (match) => match.charAt(0).toUpperCase() + match.slice(1));
}
