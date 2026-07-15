/**
 * Privacy-safe share helpers — canonical URLs only, no third-party scripts.
 * Brand-account auto-post remains explicitly off (separate commercial path).
 */

export const CANONICAL_SITE_ORIGIN = 'https://bbsports.fans';

export function buildCanonicalArticleUrl(
  slug: string,
  origin: string = CANONICAL_SITE_ORIGIN,
): string {
  const raw = String(slug ?? '').trim().toLowerCase();
  // Only exact safe slugs — never strip path junk into a plausible id.
  if (!raw || !/^[a-z0-9-]+$/.test(raw)) {
    return `${origin.replace(/\/$/, '')}/articles`;
  }
  const base = origin.replace(/\/$/, '');
  return `${base}/articles/${raw}`;
}

export function buildSharePayload(input: {
  title: string;
  slug: string;
  text?: string;
  origin?: string;
}): { title: string; text: string; url: string } {
  const url = buildCanonicalArticleUrl(input.slug, input.origin ?? CANONICAL_SITE_ORIGIN);
  const title = String(input.title ?? '').trim() || 'BB Sports';
  const text = String(input.text ?? title).trim() || title;
  return { title, text, url };
}

export function buildXIntentUrl(payload: { title: string; url: string }): string {
  const params = new URLSearchParams({
    text: payload.title,
    url: payload.url,
  });
  return `https://x.com/intent/tweet?${params.toString()}`;
}

export function buildFacebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

export function buildMailtoShareUrl(payload: { title: string; url: string }): string {
  const params = new URLSearchParams({
    subject: payload.title,
    body: payload.url,
  });
  return `mailto:?${params.toString()}`;
}
