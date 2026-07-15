/**
 * SSRF-safe RSS URL policy and pure validation helpers.
 *
 * No network I/O. A future fetch transport must enforce these rules again at
 * connect time (DNS revalidation on every redirect). Default-off activation
 * remains in env gates + commercial approval.
 */

import { z } from 'zod';

export const RSS_FETCH_CONTRACT = Object.freeze({
  allowedProtocols: Object.freeze(['https:'] as const),
  maxRedirects: 3,
  connectTimeoutMs: 5_000,
  totalTimeoutMs: 10_000,
  maxResponseBytes: 2 * 1_024 * 1_024,
  maxDecompressionRatio: 10,
  acceptedContentTypes: Object.freeze([
    'application/rss+xml',
    'application/atom+xml',
    'application/xml',
    'text/xml',
  ] as const),
  xmlHardening: Object.freeze({
    dtd: false,
    externalEntities: false,
    networkEntityResolution: false,
  }),
});

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
]);

export type RssUrlRejectionReason =
  | 'not_https'
  | 'userinfo_forbidden'
  | 'nonstandard_port'
  | 'hostname_blocked'
  | 'ip_literal_blocked'
  | 'malformed_url';

export type RssUrlPolicyResult =
  | Readonly<{ ok: true; canonicalUrl: string; hostname: string }>
  | Readonly<{ ok: false; reason: RssUrlRejectionReason }>;

function isIpv4Literal(hostname: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

function isIpv6Literal(hostname: string): boolean {
  return hostname.includes(':');
}

/** Reject private, loopback, link-local, CGNAT, and metadata-ish IPv4 literals. */
export function isBlockedIpv4(address: string): boolean {
  const parts = address.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true; // multicast/reserved
  return false;
}

export function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA
  if (normalized.startsWith('fe80')) return true; // link-local
  if (normalized.startsWith('ff')) return true; // multicast
  // IPv4-mapped IPv6 (::ffff:a.b.c.d)
  const mapped = normalized.match(/(?:^|:)ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped?.[1] && isBlockedIpv4(mapped[1])) return true;
  return false;
}

/**
 * Validate an RSS feed URL before any DNS lookup. Callers must still
 * re-resolve DNS and re-run IP policy on every hop.
 */
export function evaluateRssFeedUrl(raw: string): RssUrlPolicyResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return Object.freeze({ ok: false, reason: 'malformed_url' });
  }

  if (url.protocol !== 'https:') {
    return Object.freeze({ ok: false, reason: 'not_https' });
  }
  if (url.username || url.password) {
    return Object.freeze({ ok: false, reason: 'userinfo_forbidden' });
  }
  if (url.port && url.port !== '443') {
    return Object.freeze({ ok: false, reason: 'nonstandard_port' });
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')) {
    return Object.freeze({ ok: false, reason: 'hostname_blocked' });
  }
  if (isIpv4Literal(hostname) && isBlockedIpv4(hostname)) {
    return Object.freeze({ ok: false, reason: 'ip_literal_blocked' });
  }
  if (isIpv6Literal(hostname) && isBlockedIpv6(hostname)) {
    return Object.freeze({ ok: false, reason: 'ip_literal_blocked' });
  }

  url.hash = '';
  return Object.freeze({
    ok: true,
    canonicalUrl: url.toString(),
    hostname,
  });
}

export function readRssStaticPreflight(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Readonly<
  | { passed: false; connectionAllowed: false; reason: string }
  | { passed: true; connectionAllowed: false; activationBlocker: 'per_feed_approval_schema_incomplete' | 'runtime_transport_not_implemented'; fetchContract: typeof RSS_FETCH_CONTRACT }
> {
  if (environment.BBSPORTS_REALTIME_NEWSROOM_ENABLED === 'false') {
    return Object.freeze({ passed: false, connectionAllowed: false, reason: 'global_disabled' });
  }
  if (environment.BBSPORTS_NEWSROOM_RSS_ENABLED !== 'true') {
    return Object.freeze({ passed: false, connectionAllowed: false, reason: 'connector_disabled' });
  }
  if (environment.BBSPORTS_APPROVED_NEWS_RSS !== 'true') {
    return Object.freeze({ passed: false, connectionAllowed: false, reason: 'approval_missing' });
  }
  // Per-feed GREEN schema is still incomplete in the foundation.
  return Object.freeze({
    passed: true,
    connectionAllowed: false as const,
    activationBlocker: 'per_feed_approval_schema_incomplete' as const,
    fetchContract: RSS_FETCH_CONTRACT,
  });
}

export const rssItemCandidateSchema = z.object({
  guid: z.string().trim().min(1).max(320),
  title: z.string().trim().min(1).max(320),
  link: z.string().url().max(2_048).optional(),
  publishedAt: z.coerce.date().optional(),
});

export type RssItemCandidate = z.infer<typeof rssItemCandidateSchema>;
