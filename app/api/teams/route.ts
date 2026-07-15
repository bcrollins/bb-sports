import { NextResponse } from 'next/server';
import {
  getSportsEncyclopediaStats,
  listSportsLeagues,
  listSportsTeams,
} from '@/lib/sports-encyclopedia/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const league = url.searchParams.get('league') ?? undefined;
    const [leagues, teams, stats] = await Promise.all([
      listSportsLeagues(),
      listSportsTeams({ leagueKey: league ?? undefined, limit: 200 }),
      getSportsEncyclopediaStats(),
    ]);
    return NextResponse.json(
      {
        data: {
          stats,
          leagues,
          teams,
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
