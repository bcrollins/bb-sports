import type { NewsEvidence } from './db/schema';

export type VerificationEvidence = Pick<
  NewsEvidence,
  | 'stance'
  | 'evidenceClass'
  | 'ownerKey'
  | 'sourceTier'
  | 'credible'
  | 'sourceId'
  | 'signalId'
  | 'url'
  | 'excerpt'
  | 'notes'
> & {
  id?: string;
  supersedesEvidenceId?: string | null;
};

export type NewsVerificationReason =
  | 'contradiction_present'
  | 'primary_or_official_support'
  | 'independent_credible_support'
  | 'insufficient_support';

export interface NewsVerificationAssessment {
  passes: boolean;
  reason: NewsVerificationReason;
  supportingCount: number;
  contradictionCount: number;
  qualifyingPrimaryOrOfficialCount: number;
  independentCredibleOwnerKeys: string[];
}

const CREDIBLE_SOURCE_TIERS = new Set(['primary', 'official', 'tier_1', 'tier_2']);

function normalizedOwnerKey(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

function hasSubstantiveProvenance(item: VerificationEvidence): boolean {
  return Boolean(
    item.url ||
      item.sourceId ||
      item.signalId ||
      item.excerpt.trim().length >= 20 ||
      item.notes.trim().length >= 20,
  );
}

/**
 * Deterministic verification gate:
 *   1. Any contradiction blocks.
 *   2. One supporting primary/official item passes.
 *   3. Otherwise two distinct credible source owners must support.
 * Context-only evidence never counts as support.
 */
export function assessNewsVerification(
  evidence: readonly VerificationEvidence[],
): NewsVerificationAssessment {
  const supersededIds = new Set(
    evidence
      .map((item) => item.supersedesEvidenceId)
      .filter((id): id is string => Boolean(id)),
  );
  const activeEvidence = evidence.filter((item) => !item.id || !supersededIds.has(item.id));
  const supporting = activeEvidence.filter((item) => item.stance === 'supporting');
  const substantiveSupporting = supporting.filter(hasSubstantiveProvenance);
  const contradictions = activeEvidence.filter((item) => item.stance === 'contradicting');
  const primaryOrOfficial = substantiveSupporting.filter(
    (item) =>
      item.credible &&
      (item.evidenceClass === 'primary' ||
        item.evidenceClass === 'official' ||
        item.sourceTier === 'primary' ||
        item.sourceTier === 'official'),
  );
  const credibleOwners = new Set(
    substantiveSupporting
      .filter(
        (item) =>
          item.credible &&
          CREDIBLE_SOURCE_TIERS.has(item.sourceTier) &&
          normalizedOwnerKey(item.ownerKey).length > 0,
      )
      .map((item) => normalizedOwnerKey(item.ownerKey)),
  );

  const base = {
    supportingCount: supporting.length,
    contradictionCount: contradictions.length,
    qualifyingPrimaryOrOfficialCount: primaryOrOfficial.length,
    independentCredibleOwnerKeys: [...credibleOwners].sort(),
  };

  if (contradictions.length > 0) {
    return { passes: false, reason: 'contradiction_present', ...base };
  }
  if (primaryOrOfficial.length > 0) {
    return { passes: true, reason: 'primary_or_official_support', ...base };
  }
  if (credibleOwners.size >= 2) {
    return { passes: true, reason: 'independent_credible_support', ...base };
  }
  return { passes: false, reason: 'insufficient_support', ...base };
}
