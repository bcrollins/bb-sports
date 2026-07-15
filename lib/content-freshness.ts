/**
 * Content freshness risk — surface aging takes before readers notice.
 * Advisory only: never unpublish or rewrite without Brad.
 */
import type { Article } from '@/lib/articles';

export type FreshnessBand = 'fresh' | 'aging' | 'stale' | 'archive';

export type FreshnessAssessment = {
  band: FreshnessBand;
  ageDays: number;
  summary: string;
  /** Higher = more urgent for desk review */
  priority: 0 | 1 | 2 | 3;
};

const MS_DAY = 1000 * 60 * 60 * 24;

export function assessContentFreshness(
  publishedAt: string | Date,
  nowMs = Date.now(),
): FreshnessAssessment {
  const ts = typeof publishedAt === 'string' ? +new Date(publishedAt) : publishedAt.getTime();
  const ageDays = Math.max(0, Math.floor((nowMs - ts) / MS_DAY));

  if (ageDays <= 7) {
    return {
      band: 'fresh',
      ageDays,
      summary: 'Published within the last week.',
      priority: 0,
    };
  }
  if (ageDays <= 30) {
    return {
      band: 'aging',
      ageDays,
      summary: 'Aging take — skim for scoreboard or roster drift before promoting.',
      priority: 1,
    };
  }
  if (ageDays <= 120) {
    return {
      band: 'stale',
      ageDays,
      summary: 'Stale risk — factual claims may need a Brad-approved correction check.',
      priority: 2,
    };
  }
  return {
    band: 'archive',
    ageDays,
    summary: 'Archive depth — keep as history; flag if still featured as current.',
    priority: 3,
  };
}

export function listFreshnessRisks(
  articles: Article[],
  nowMs = Date.now(),
  minPriority: FreshnessAssessment['priority'] = 1,
): Array<{ article: Article; freshness: FreshnessAssessment }> {
  return articles
    .map((article) => ({
      article,
      freshness: assessContentFreshness(article.date, nowMs),
    }))
    .filter((row) => row.freshness.priority >= minPriority)
    .sort(
      (a, b) =>
        b.freshness.priority - a.freshness.priority ||
        b.freshness.ageDays - a.freshness.ageDays,
    );
}
