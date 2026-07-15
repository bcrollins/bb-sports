/**
 * Editorial findings — disputed/stale claims queued for Brad-approved correction.
 * Findings never auto-rewrite published prose.
 */

export const EDITORIAL_FINDING_TYPES = [
  'stale_fact',
  'missing_source',
  'misattribution',
  'voice_drift',
  'other',
] as const;
export type EditorialFindingType = (typeof EDITORIAL_FINDING_TYPES)[number];

export const EDITORIAL_FINDING_STATES = [
  'open',
  'approved_for_edit',
  'rejected',
  'corrected',
] as const;
export type EditorialFindingState = (typeof EDITORIAL_FINDING_STATES)[number];

export type EditorialFindingSeed = {
  findingKey: string;
  articleSlug: string;
  quotedClaim: string;
  findingType: EditorialFindingType;
  severity: 'P0' | 'P1' | 'P2';
  evidenceNote: string;
  proposedCorrection: string;
};

/**
 * Seed findings known from audit — not auto-applied to live articles.
 */
export const SEED_EDITORIAL_FINDINGS: readonly EditorialFindingSeed[] = Object.freeze([
  {
    findingKey: 'cowboys-28-years-stale',
    articleSlug: 'cowboys-are-a-brand-not-a-contender',
    quotedClaim: 'Twenty-eight years',
    findingType: 'stale_fact',
    severity: 'P0',
    evidenceNote:
      'Championship drought framing may be stale relative to calendar year; requires Brad-approved wording and public correction log if changed.',
    proposedCorrection:
      'Update the drought year count to the accurate figure for the publish date, with a dated correction note.',
  },
]);
