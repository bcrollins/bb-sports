import { sportLabel, type Article, type SportSlug } from './articles';

export const SEARCH_MIN_QUERY_LENGTH = 2;
export const SEARCH_MAX_QUERY_LENGTH = 80;

export type SearchResult = {
  article: Article;
  score: number;
  matchedFields: string[];
};

export function normalizeSearchQuery(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, SEARCH_MAX_QUERY_LENGTH);
}

export function searchArticles(articles: Article[], rawQuery: unknown, sport?: SportSlug | 'all'): SearchResult[] {
  const query = normalizeSearchQuery(rawQuery).toLowerCase();
  if (query.length < SEARCH_MIN_QUERY_LENGTH) return [];
  const tokens = query.split(' ').filter(Boolean);

  return articles
    .map((article) => {
      if (sport && sport !== 'all' && article.sport !== sport) return null;
      const fields = [
        { name: 'title', text: article.title, weight: 12 },
        { name: 'dek', text: article.dek ?? '', weight: 7 },
        { name: 'excerpt', text: article.excerpt, weight: 4 },
        { name: 'sport', text: sportLabel(article.sport), weight: 5 },
        { name: 'tags', text: article.tags.join(' '), weight: 6 },
        { name: 'author', text: article.authorName ?? 'Brad Benson', weight: 2 },
      ];

      let score = 0;
      const matched = new Set<string>();
      for (const field of fields) {
        const text = field.text.toLowerCase();
        if (!text) continue;
        if (text.includes(query)) {
          score += field.weight * 4;
          matched.add(field.name);
        }
        for (const token of tokens) {
          if (text.includes(token)) {
            score += field.weight;
            matched.add(field.name);
          }
        }
      }

      if (score === 0) return null;
      const recencyBoost = Math.max(0, 7 - daysOld(article.date)) / 7;
      return {
        article,
        score: Math.round((score + recencyBoost) * 100) / 100,
        matchedFields: Array.from(matched),
      };
    })
    .filter((result): result is SearchResult => Boolean(result))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return +new Date(b.article.date) - +new Date(a.article.date);
    });
}

function daysOld(iso: string): number {
  const value = new Date(iso).getTime();
  if (Number.isNaN(value)) return 999;
  return Math.floor((Date.now() - value) / 86_400_000);
}
