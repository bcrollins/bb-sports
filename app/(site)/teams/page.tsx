import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getSportsEncyclopediaStats,
  listSportsLeagues,
  listSportsTeams,
} from '@/lib/sports-encyclopedia/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Teams encyclopedia',
  description:
    'BB Sports first-party franchise registry for the NFL, MLB, NHL, and NBA — public team identity with source citations. Not a licensed stats feed.',
  alternates: { canonical: '/teams' },
};

export default async function TeamsIndexPage() {
  const [leagues, teams, stats] = await Promise.all([
    listSportsLeagues(),
    listSportsTeams({ limit: 200 }),
    getSportsEncyclopediaStats(),
  ]);

  const byLeague = new Map<string, typeof teams>();
  for (const team of teams) {
    const list = byLeague.get(team.leagueKey) ?? [];
    list.push(team);
    byLeague.set(team.leagueKey, list);
  }

  return (
    <div className="bg-bone">
      <header className="bg-navy text-bone">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="bb-eyebrow !text-breaking !tracking-[0.3em]">Sports encyclopedia</p>
          <h1 className="mt-3 font-display text-4xl italic uppercase leading-[0.95] sm:text-6xl">
            Every franchise. Named sources. No fake stats.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-bone/75 sm:text-base">
            First-party BB Sports registry of active NFL, MLB, NHL, and NBA franchises.
            Identity facts only (market, nickname, conference/division, official club URL)
            with citations on every row. This is not a scrape of proprietary box-score
            encyclopedias.
          </p>
          <dl className="mt-6 grid grid-cols-3 gap-3 max-w-lg">
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <dt className="text-[10px] font-black uppercase tracking-wide text-bone/60">Leagues</dt>
              <dd className="font-display text-2xl">{stats.leagues}</dd>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <dt className="text-[10px] font-black uppercase tracking-wide text-bone/60">Teams</dt>
              <dd className="font-display text-2xl">{stats.teams}</dd>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <dt className="text-[10px] font-black uppercase tracking-wide text-bone/60">People</dt>
              <dd className="font-display text-2xl">{stats.people}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6">
        {leagues.map((league) => {
          const leagueTeams = byLeague.get(league.leagueKey) ?? [];
          return (
            <section key={league.leagueKey} id={league.leagueKey} className="scroll-mt-24">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-navy/10 pb-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/45">
                    {league.shortName}
                  </p>
                  <h2 className="font-display text-2xl uppercase text-navy-deep sm:text-3xl">
                    {league.displayName}
                  </h2>
                  <p className="mt-1 text-xs text-navy/55">
                    {leagueTeams.length} / {league.teamCount} franchises · Source:{' '}
                    <a
                      className="underline decoration-navy/30 underline-offset-2 hover:decoration-navy"
                      href={league.dataSourceUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {league.dataSource}
                    </a>
                  </p>
                </div>
                <Link
                  href={`/teams/${league.leagueKey}`}
                  className="min-h-11 rounded-lg border border-navy/15 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-navy hover:border-navy/40"
                >
                  View league
                </Link>
              </div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {leagueTeams.map((team) => (
                  <li key={team.id}>
                    <Link
                      href={`/teams/${team.leagueKey}/${team.teamKey}`}
                      className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-navy/10 bg-white px-4 py-3 shadow-sm transition hover:border-navy/30"
                    >
                      <span>
                        <span className="block text-sm font-bold text-navy-deep">
                          {team.displayName}
                        </span>
                        <span className="block text-[11px] text-navy/50">
                          {team.conference}
                          {team.division ? ` · ${team.division}` : ''}
                        </span>
                      </span>
                      <span className="font-mono text-xs font-bold text-navy/40">
                        {team.abbreviation}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
