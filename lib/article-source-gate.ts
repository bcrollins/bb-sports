/**
 * Publish-time source integrity gate.
 *
 * Opinion pieces may ship without external links when Brad marks them
 * opinion-only via the approval rationale prefix. Fact-heavy drafts must
 * include at least one https markdown link (or explicit opinion-only stamp).
 */

export type SourceGateInput = {
  body: string;
  title?: string;
  /** Publish rationale from Brad's approval form. */
  rationale?: string;
};

export type SourceGateResult =
  | { ok: true; mode: 'linked' | 'opinion_only' | 'light' }
  | { ok: false; reason: string; code: 'SOURCE_REQUIRED' };

const HTTPS_MARKDOWN_LINK = /\[[^\]]+\]\(https:\/\/[^)\s]+\)/i;
const HTTPS_BARE = /https:\/\/[^\s)>"']+/i;

/** Heuristic: body likely asserts external facts (stats, years as claims, etc.). */
export function looksFactHeavy(body: string): boolean {
  const text = body.trim();
  if (text.length < 80) return false;
  const statLike =
    /\b\d{1,3}(?:\.\d+)?%\b/.test(text) ||
    /\b(?:\$|€|£)\s?\d/.test(text) ||
    /\b(?:wins?|losses?|yards?|goals?|points?|ERA|WAR|DVOA|passer rating)\b/i.test(text) ||
    /\b(?:according to|reports? that|sources? say|league confirmed)\b/i.test(text);
  return statLike;
}

export function hasInlineHttpsCitation(body: string): boolean {
  return HTTPS_MARKDOWN_LINK.test(body) || HTTPS_BARE.test(body);
}

export function isOpinionOnlyRationale(rationale: string | undefined): boolean {
  if (!rationale) return false;
  return /^\s*opinion[- ]only\b/i.test(rationale.trim());
}

/**
 * Gate for the publish transition. Call with the immutable revision body and
 * Brad's approval rationale.
 */
export function evaluatePublishSourceGate(input: SourceGateInput): SourceGateResult {
  if (hasInlineHttpsCitation(input.body)) {
    return { ok: true, mode: 'linked' };
  }
  if (isOpinionOnlyRationale(input.rationale)) {
    return { ok: true, mode: 'opinion_only' };
  }
  if (!looksFactHeavy(input.body)) {
    return { ok: true, mode: 'light' };
  }
  return {
    ok: false,
    code: 'SOURCE_REQUIRED',
    reason:
      'Fact-heavy articles need at least one https citation in the body, or an approval rationale starting with "opinion-only".',
  };
}
