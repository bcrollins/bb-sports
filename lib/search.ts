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

/** Edit distance ≤ 1 for tokens length ≥ 4 (typo tolerance). */
export function fuzzyTokenMatch(haystack: string, token: string): boolean {
  if (!token) return false;
  if (haystack.includes(token)) return true;
  if (token.length < 4) return false;
  const words = haystack.split(/[^a-z0-9]+/i).filter(Boolean);
  for (const word of words) {
    if (Math.abs(word.length - token.length) > 1) continue;
    if (levenshteinAtMostOne(word, token)) return true;
  }
  return false;
}

function levenshteinAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (la > lb) i += 1;
    else if (lb > la) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  if (i < la || j < lb) edits += 1;
  return edits <= 1;
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
          } else if (fuzzyTokenMatch(text, token)) {
            score += field.weight * 0.6;
            matched.add(`${field.name}~`);
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
