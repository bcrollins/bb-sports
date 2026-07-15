import { NextResponse } from 'next/server';
import {
  getSportsEncyclopediaStats,
  listSportsLeagues,
  listSportsPeople,
  listSportsTeams,
  searchSportsPeople,
  searchSportsTeams,
} from '@/lib/sports-encyclopedia/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const league = url.searchParams.get('league') ?? undefined;
    const q = url.searchParams.get('q') ?? '';
    const includePeople = url.searchParams.get('people') === '1' || Boolean(q);

    if (q.trim().length >= 2) {
      const [teams, people, stats] = await Promise.all([
        searchSportsTeams(q, 30),
        searchSportsPeople(q, 30),
        getSportsEncyclopediaStats(),
      ]);
      return NextResponse.json(
        {
          data: {
            stats,
            query: q.trim(),
            teams,
            people,
            note:
              'BB Sports first-party encyclopedia search. Identity only — not a licensed stats feed.',
          },
        },
        { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
      );
    }

    const [leagues, teams, people, stats] = await Promise.all([
      listSportsLeagues(),
      listSportsTeams({ leagueKey: league ?? undefined, limit: 200 }),
      includePeople
        ? listSportsPeople({ leagueKey: league ?? undefined, limit: 200 })
        : Promise.resolve([]),
      getSportsEncyclopediaStats(),
    ]);
    return NextResponse.json(
      {
        data: {
          stats,
          leagues,
          teams,
          people,
          note:
            'BB Sports first-party franchise identity registry. Not a licensed stats feed. Each row carries dataSource / dataConfidence.',
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Teams encyclopedia unavailable.',
      },
      { status: 503 },
    );
  }
}
