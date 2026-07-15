/**
 * Rights/credit gate for publishable media — expired/unapproved cannot ship.
 */

export type MediaRightsInput = {
  credit?: string | null;
  altText?: string | null;
  license?: string | null;
  approved?: boolean | null;
  /** ISO expiry; if past, unpublishable. */
  rightsExpiresAt?: string | null;
  /** Remote/external URL if any. */
  sourceUrl?: string | null;
};

export type MediaRightsResult =
  | { ok: true; credit: string; altText: string; license: string }
  | { ok: false; reason: string };

const ALLOWED_LICENSES = new Set([
  'all-rights-reserved',
  'bb-sports-original',
  'ai-generated-xai-approved',
  'licensed-editorial',
  'public-domain',
  'cc0',
  'cc-by',
]);

export function validateMediaRights(
  input: MediaRightsInput,
  now: Date = new Date(),
): MediaRightsResult {
  const credit = String(input.credit ?? '').trim();
  const altText = String(input.altText ?? '').trim();
  const license = String(input.license ?? 'bb-sports-original')
    .trim()
    .toLowerCase();

  if (!credit || credit.length < 3) {
    return { ok: false, reason: 'credit required' };
  }
  if (!altText || altText.length < 3) {
    return { ok: false, reason: 'alt text required' };
  }
  if (!ALLOWED_LICENSES.has(license)) {
    return { ok: false, reason: `license not allowed: ${license}` };
  }
  if (input.approved !== true) {
    return { ok: false, reason: 'media not approved' };
  }
  if (input.rightsExpiresAt) {
    const exp = Date.parse(input.rightsExpiresAt);
    if (!Number.isNaN(exp) && exp <= now.getTime()) {
      return { ok: false, reason: 'rights expired' };
    }
  }
  if (input.sourceUrl) {
    try {
      const u = new URL(input.sourceUrl);
      if (u.protocol !== 'https:') {
        return { ok: false, reason: 'source URL must be https' };
      }
    } catch {
      return { ok: false, reason: 'invalid source URL' };
    }
  }
  return { ok: true, credit, altText, license };
}

export function canPublishHero(input: {
  hero?: string | null;
  heroAlt?: string | null;
  heroCredit?: string | null;
}): { ok: true } | { ok: false; reason: string } {
  const hero = String(input.hero ?? '').trim();
  if (!hero) return { ok: true };
  if (!String(input.heroAlt ?? '').trim()) return { ok: false, reason: 'hero alt required' };
  if (!String(input.heroCredit ?? '').trim()) return { ok: false, reason: 'hero credit required' };
  return { ok: true };
}
