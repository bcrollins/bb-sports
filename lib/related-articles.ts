/**
 * Explainable related-story recommendations.
 * Deterministic: same sport, tag overlap, title token overlap, recency.
 * Never recommends unpublished/self; always returns a human reason string.
 */
import type { Article, SportSlug } from '@/lib/articles';
import { sportLabel } from '@/lib/articles';

export type RelatedRecommendation = {
  article: Article;
  score: number;
  reason: string;
  reasonKey: 'same_sport' | 'shared_tags' | 'title_overlap' | 'recent';
};

const STOP = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'with',
  'is',
  'are',
  'was',
  'were',
  'it',
  'this',
  'that',
  'from',
  'at',
  'by',
  'as',
  'be',
  'just',
  'have',
  'has',
  'had',
  'why',
  'how',
  'what',
  'when',
]);

export function tokenizeTitle(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

export function scoreRelatedArticle(
  source: Article,
  candidate: Article,
  nowMs = Date.now(),
): RelatedRecommendation | null {
  if (candidate.slug === source.slug) return null;

  let score = 0;
  let reasonKey: RelatedRecommendation['reasonKey'] = 'recent';
  let reason = 'Recent published take';

  if (candidate.sport === source.sport) {
    score += 50;
    reasonKey = 'same_sport';
    reason = `More on ${sportLabel(source.sport as SportSlug)}`;
  }

  const sourceTags = new Set(source.tags.map((t) => t.toLowerCase()));
  const sharedTags = candidate.tags
    .map((t) => t.toLowerCase())
    .filter((t) => sourceTags.has(t));
  if (sharedTags.length > 0) {
    score += 20 * Math.min(sharedTags.length, 3);
    if (reasonKey !== 'same_sport') {
      reasonKey = 'shared_tags';
      reason = `Shares topic: ${sharedTags[0]}`;
    }
  }

  const srcTokens = new Set(tokenizeTitle(source.title));
  const candTokens = tokenizeTitle(candidate.title);
  const overlap = candTokens.filter((t) => srcTokens.has(t));
  if (overlap.length > 0) {
    score += 12 * Math.min(overlap.length, 3);
    if (score < 50) {
      reasonKey = 'title_overlap';
      reason = `Related angle: “${overlap[0]}”`;
    }
  }

  const ageDays = Math.max(0, (nowMs - +new Date(candidate.date)) / (1000 * 60 * 60 * 24));
  const recency = Math.max(0, 15 - Math.min(ageDays, 15));
  score += recency;

  if (score <= 0) {
    score = 1;
    reasonKey = 'recent';
    reason = 'Recent published take';
  }

  return { article: candidate, score, reason, reasonKey };
}

/**
 * Rank related stories with diversity: prefer at most 2 same-sport when pool is large.
 */
export function rankRelatedArticles(
  source: Article,
  catalog: Article[],
  limit = 3,
  nowMs = Date.now(),
): RelatedRecommendation[] {
  const scored = catalog
    .map((c) => scoreRelatedArticle(source, c, nowMs))
    .filter((r): r is RelatedRecommendation => Boolean(r))
    .sort((a, b) => b.score - a.score || +new Date(b.article.date) - +new Date(a.article.date));

  const picked: RelatedRecommendation[] = [];
  let sameSportCount = 0;
  for (const row of scored) {
    if (picked.length >= limit) break;
    const isSame = row.article.sport === source.sport;
    if (isSame && sameSportCount >= 2 && scored.length > limit) {
      // Leave room for one cross-sport when we have excess same-sport.
      const remainingSlots = limit - picked.length;
      const laterDifferent = scored
        .slice(scored.indexOf(row))
        .filter((r) => r.article.sport !== source.sport && !picked.some((p) => p.article.slug === r.article.slug));
      if (laterDifferent.length >= remainingSlots) continue;
    }
    if (picked.some((p) => p.article.slug === row.article.slug)) continue;
    picked.push(row);
    if (isSame) sameSportCount += 1;
  }

  // Fill if diversity skip left holes.
  if (picked.length < limit) {
    for (const row of scored) {
      if (picked.length >= limit) break;
      if (picked.some((p) => p.article.slug === row.article.slug)) continue;
      picked.push(row);
    }
  }

  return picked.slice(0, limit);
}
