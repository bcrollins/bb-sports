/**
 * GET /api/rankings — public, machine-readable franchise rankings.
 *
 * Powers the newsletter, social posts, future internal/external integrations.
 * Mirrors the data on /rankings (HTML) but as JSON so it can be embedded
 * in emails or pulled by other surfaces without scraping HTML.
 *
 *   GET /api/rankings              → all four leagues
 *   GET /api/rankings?league=nba   → one league
 *
 * Public, gate-bypassed, no auth required, 5-minute cache. Returns the
 * baseline order with movement annotations and the article slugs that
 * drove the movement.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getAllArticles } from '@/lib/articles';
import {
  buildAllRankings,
  buildLeagueRanking,
  LEAGUE_ORDER,
  type LeagueRanking,
  type RankingLeague,
} from '@/lib/rankings';

export const runtime = 'nodejs';
export const revalidate = 300; // 5 minutes

function isRankingLeague(value: string | null): value is RankingLeague {
  return LEAGUE_ORDER.includes(value as RankingLeague);
}

function serialize(ranking: LeagueRanking) {
  return {
    league: ranking.league,
    label: ranking.label,
    teams: ranking.ranked.map((t) => ({
      id: t.id,
      city: t.city,
      name: t.name,
      brad: t.brad,
      bradTeam: Boolean(t.bradTeam),
      baseRank: t.baseRank,
      currentRank: t.currentRank,
      moved: t.currentRank - t.baseRank,
      demotions: t.demotions.map((d) => ({
        articleSlug: d.articleSlug,
        articleTitle: d.articleTitle,
        date: d.date,
        drop: d.drop,
        reason: d.reason,
      })),
    })),
  };
}

export async function GET(req: NextRequest) {
  const articles = await getAllArticles();
  const leagueParam = req.nextUrl.searchParams.get('league')?.toLowerCase() ?? null;

  if (leagueParam) {
    if (!isRankingLeague(leagueParam)) {
      return NextResponse.json(
        {
          error: 'Unknown league',
          allowed: LEAGUE_ORDER,
        },
        { status: 400 },
      );
    }
    const ranking = buildLeagueRanking(leagueParam, articles);
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        leagues: [serialize(ranking)],
      },
      {
        status: 200,
        headers: {
          'cache-control': 'public, max-age=300, s-maxage=300',
        },
      },
    );
  }

  const all = buildAllRankings(articles).map(serialize);
  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      leagues: all,
    },
    {
      status: 200,
      headers: {
        'cache-control': 'public, max-age=300, s-maxage=300',
      },
    },
  );
}
