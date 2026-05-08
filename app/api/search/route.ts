import { NextRequest, NextResponse } from 'next/server';
import { getAllArticles } from '@/lib/articles';
import { normalizeSearchQuery, searchArticles, SEARCH_MIN_QUERY_LENGTH } from '@/lib/search';
import type { SportSlug } from '@/lib/articles';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const query = normalizeSearchQuery(req.nextUrl.searchParams.get('q'));
  const sport = (req.nextUrl.searchParams.get('sport') ?? 'all') as SportSlug | 'all';
  if (query.length < SEARCH_MIN_QUERY_LENGTH) {
    return NextResponse.json({ ok: true, query, results: [], message: 'Use at least 2 characters.' });
  }

  const articles = await getAllArticles();
  const results = searchArticles(articles, query, sport).slice(0, 20).map((result) => ({
    score: result.score,
    matchedFields: result.matchedFields,
    article: {
      slug: result.article.slug,
      title: result.article.title,
      dek: result.article.dek ?? result.article.excerpt,
      sport: result.article.sport,
      date: result.article.date,
      readingTimeMinutes: result.article.readingTimeMinutes,
      aiAssisted: result.article.aiAssisted,
      hero: result.article.hero,
      heroAlt: result.article.heroAlt,
    },
  }));

  return NextResponse.json({ ok: true, query, results });
}
