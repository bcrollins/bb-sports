import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getSportsLeague,
  isSportsLeagueKey,
  listSportsTeams,
} from '@/lib/sports-encyclopedia/queries';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ league: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { league } = await params;
  const row = await getSportsLeague(league);
  if (!row) return { title: 'League not found' };
  return {
    title: `${row.shortName} teams`,
    description: `BB Sports first-party franchise registry for the ${row.displayName}.`,
    alternates: { canonical: `/teams/${row.leagueKey}` },
  };
}

export default async function LeagueTeamsPage({ params }: Props) {
  const { league } = await params;
  if (!isSportsLeagueKey(league)) notFound();
  const [leagueRow, teams] = await Promise.all([
    getSportsLeague(league),
    listSportsTeams({ leagueKey: league, limit: 64 }),
  ]);
  if (!leagueRow) notFound();

  return (
    <div className="bg-bone">
      <header className="bg-navy text-bone">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-bone/60">
            <Link href="/teams" className="hover:text-white">
              Teams
            </Link>{' '}
            / {leagueRow.shortName}
          </p>
          <h1 className="mt-3 font-display text-4xl uppercase italic sm:text-5xl">
            {leagueRow.displayName}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-bone/70">
            {teams.length} franchises · Source verified{' '}
            {leagueRow.dataVerifiedDate.toISOString().slice(0, 10)} · Confidence{' '}
            {leagueRow.dataConfidence}
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ul className="grid gap-2 sm:grid-cols-2">
          {teams.map((team) => (
            <li key={team.id}>
              <Link
                href={`/teams/${team.leagueKey}/${team.teamKey}`}
                className="block min-h-11 rounded-xl border border-navy/10 bg-white px-4 py-4 shadow-sm hover:border-navy/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-navy-deep">{team.displayName}</p>
                    <p className="text-xs text-navy/55">
                      {[team.conference, team.division].filter(Boolean).join(' · ')}
                      {team.foundedYear ? ` · est. ${team.foundedYear}` : ''}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-navy/40">
                    {team.abbreviation}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
