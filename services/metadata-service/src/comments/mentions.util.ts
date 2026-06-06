/**
 * Extract @mentions from comment text.
 *
 * A mention is an @ followed by a username token (letters, digits, dot, dash,
 * underscore). Returns a de-duplicated, order-preserving list of usernames
 * without the leading @. Email-like "a@b" is ignored (the @ must start a token).
 */
export function parseMentions(content: string): string[] {
  if (typeof content !== 'string' || content.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];
  // (^|\s|[(\[]) ensures @ starts a token, not mid-word like an email.
  const pattern = /(?:^|[\s([])@([a-zA-Z0-9._-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const username = match[1].replace(/[.\-_]+$/, '');
    if (username.length === 0) continue;
    if (!seen.has(username)) {
      seen.add(username);
      result.push(username);
    }
  }
  return result;
}
