/**
 * Core Web Vitals + payload budgets for BB Sports (mobile-first soft launch).
 * Measured by Lighthouse / RUM later; enforced as documented floors in CI contracts.
 */
export const CWV_BUDGETS = {
  /** Largest Contentful Paint (ms) — mobile p75 */
  lcpMs: 2500,
  /** Interaction to Next Paint (ms) — mobile p75 */
  inpMs: 200,
  /** Cumulative Layout Shift — mobile p75 */
  cls: 0.1,
  /** First Contentful Paint (ms) advisory */
  fcpMs: 1800,
} as const;

/** Soft payload budgets for primary public routes (uncompressed transfer estimate). */
export const ROUTE_PAYLOAD_BUDGETS = {
  homepageJsKb: 220,
  articleJsKb: 180,
  totalImageKbPerViewport: 400,
  fontKb: 120,
} as const;

export type BudgetViolation = {
  metric: string;
  budget: number;
  actual: number;
};

export function checkNumericBudget(
  metric: string,
  actual: number,
  budget: number,
): BudgetViolation | null {
  if (actual <= budget) return null;
  return { metric, budget, actual };
}

/** True when all provided samples are within budget. */
export function budgetsSatisfied(
  samples: Array<{ metric: string; actual: number; budget: number }>,
): boolean {
  return samples.every((s) => s.actual <= s.budget);
}
