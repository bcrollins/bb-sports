/**
 * Claim-level fact-check checklist for Brad before publish / correction.
 * Advisory only — never auto-rewrites prose.
 */
export type FactCheckItem = {
  id: string;
  label: string;
  detail: string;
  required: boolean;
};

export const FACT_CHECK_CHECKLIST: readonly FactCheckItem[] = Object.freeze([
  {
    id: 'source_url',
    label: 'Primary source linked',
    detail: 'Fact-heavy claims need an https citation or an explicit opinion-only rationale.',
    required: true,
  },
  {
    id: 'names_spelling',
    label: 'Names and titles spelled correctly',
    detail: 'Player, coach, executive, and team names match official spelling.',
    required: true,
  },
  {
    id: 'numbers_fresh',
    label: 'Numbers and records still true today',
    detail: 'Records, win totals, contract figures, and drought lengths match the publish date.',
    required: true,
  },
  {
    id: 'quotes_attributed',
    label: 'Quotes attributed',
    detail: 'Direct quotes name the speaker and venue; no invented dialogue.',
    required: true,
  },
  {
    id: 'bias_disclosed',
    label: 'Bias disclosed where material',
    detail: "Brad's teams and personal stakes are disclosed, not hidden.",
    required: true,
  },
  {
    id: 'ai_labeled',
    label: 'AI assistance labeled',
    detail: 'If AI-assisted, the public AI badge and Brad take are present.',
    required: true,
  },
  {
    id: 'correction_ready',
    label: 'Correction path ready',
    detail: 'If a finding exists, it is queued — not silently rewritten.',
    required: false,
  },
  {
    id: 'rankings_directive',
    label: 'Rankings directives valid',
    detail: 'Any bb:trash directive uses known league/team and bounded drop.',
    required: false,
  },
]);

export function factCheckRequiredIds(): string[] {
  return FACT_CHECK_CHECKLIST.filter((i) => i.required).map((i) => i.id);
}

export function isFactCheckComplete(checkedIds: Iterable<string>): boolean {
  const set = new Set(checkedIds);
  return factCheckRequiredIds().every((id) => set.has(id));
}
