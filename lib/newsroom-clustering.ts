import { createHash } from 'node:crypto';

const TOKEN_PATTERN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
const LOW_INFORMATION_TOKENS = new Set([
  'a',
  'an',
  'and',
  'at',
  'for',
  'from',
  'in',
  'is',
  'of',
  'on',
  'the',
  'to',
  'with',
]);

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Canonicalizes only URL syntax that cannot change the represented document.
 * It intentionally preserves path, query order, and tracking parameters so
 * the resulting hash remains an exact-dedupe key rather than a fuzzy match.
 */
export function normalizeExactNewsUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  return url.toString();
}

export function createExactUrlHash(value?: string | null): string | null {
  return value ? sha256Hex(normalizeExactNewsUrl(value)) : null;
}

/** Hashes the accepted, trimmed signal fields without fuzzy normalization. */
export function createExactContentHash(headline: string, summary = ''): string {
  return sha256Hex(JSON.stringify([headline.normalize('NFC'), summary.normalize('NFC')]));
}

export function newsroomClusterTokens(value: string): ReadonlySet<string> {
  const tokens = value.toLocaleLowerCase('en-US').match(TOKEN_PATTERN) ?? [];
  return new Set(tokens.filter((token) => token.length > 1 && !LOW_INFORMATION_TOKENS.has(token)));
}

export function tokenJaccardSimilarity(left: string, right: string): number {
  const leftTokens = newsroomClusterTokens(left);
  const rightTokens = newsroomClusterTokens(right);
  if (leftTokens.size === 0 && rightTokens.size === 0) return 1;
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  const union = leftTokens.size + rightTokens.size - intersection;
  return intersection / union;
}

/**
 * A deliberately conservative suggestion helper. It never mutates or links
 * events: callers must still make and audit the clustering decision.
 */
export function isConservativeClusterCandidate(
  left: string,
  right: string,
  threshold = 0.72,
): boolean {
  const leftTokens = newsroomClusterTokens(left);
  const rightTokens = newsroomClusterTokens(right);
  if (leftTokens.size < 5 || rightTokens.size < 5) return false;
  return tokenJaccardSimilarity(left, right) >= threshold;
}
