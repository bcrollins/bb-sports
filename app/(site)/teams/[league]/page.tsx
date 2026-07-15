import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getSportsLeague,
  isSportsLeagueKey,
  listSportsTeams,
} from '@/lib/sports-encyclopedia/queries';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ league: string }>;
  searchParams: Promise<{ conference?: string; division?: string }>;
};

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

export default async function LeagueTeamsPage({ params, searchParams }: Props) {
  const { league } = await params;
  const filters = await searchParams;
  if (!isSportsLeagueKey(league)) notFound();
  const [leagueRow, teams] = await Promise.all([
    getSportsLeague(league),
    listSportsTeams({ leagueKey: league, limit: 64 }),
  ]);
  if (!leagueRow) notFound();

  const conferenceFilter = (filters.conference ?? '').trim();
  const divisionFilter = (filters.division ?? '').trim();
  const conferences = [...new Set(teams.map((t) => t.conference).filter(Boolean))] as string[];
  const divisions = [
    ...new Set(
      teams
        .filter((t) => !conferenceFilter || t.conference === conferenceFilter)
        .map((t) => t.division)
        .filter(Boolean),
    ),
  ] as string[];

  const filtered = teams.filter((team) => {
    if (conferenceFilter && team.conference !== conferenceFilter) return false;
    if (divisionFilter && team.division !== divisionFilter) return false;
    return true;
  });

  // Group by conference then division for scannable desk layout.
  const groups = new Map<string, typeof filtered>();
  for (const team of filtered) {
    const key = [team.conference || 'League', team.division || '—'].join(' · ');
    const list = groups.get(key) ?? [];
    list.push(team);
    groups.set(key, list);
  }

  function hrefFor(next: { conference?: string; division?: string }) {
    const params = new URLSearchParams();
    if (next.conference) params.set('conference', next.conference);
    if (next.division) params.set('division', next.division);
    const qs = params.toString();
    return qs ? `/teams/${league}?${qs}` : `/teams/${league}`;
  }

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
            Showing {filtered.length} of {teams.length} franchises · Source verified{' '}
            {leagueRow.dataVerifiedDate.toISOString().slice(0, 10)} · Confidence{' '}
            {leagueRow.dataConfidence}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap gap-2" aria-label="Conference filters">
          <Link
            href={hrefFor({})}
            className={`min-h-11 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${
              !conferenceFilter
                ? 'bg-navy text-white'
                : 'border border-navy/15 bg-white text-navy'
            }`}
          >
            All
          </Link>
          {conferences.map((conference) => (
            <Link
              key={conference}
              href={hrefFor({ conference })}
              className={`min-h-11 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${
                conferenceFilter === conference
                  ? 'bg-navy text-white'
                  : 'border border-navy/15 bg-white text-navy'
              }`}
            >
              {conference}
            </Link>
          ))}
        </div>

        {conferenceFilter && divisions.length > 0 ? (
          <div className="flex flex-wrap gap-2" aria-label="Division filters">
            <Link
              href={hrefFor({ conference: conferenceFilter })}
              className={`min-h-11 rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-wide ${
                !divisionFilter
                  ? 'bg-navy/90 text-white'
                  : 'border border-navy/10 bg-white text-navy/80'
              }`}
            >
              All divisions
            </Link>
            {divisions.map((division) => (
              <Link
                key={division}
                href={hrefFor({ conference: conferenceFilter, division })}
                className={`min-h-11 rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-wide ${
                  divisionFilter === division
                    ? 'bg-navy/90 text-white'
                    : 'border border-navy/10 bg-white text-navy/80'
                }`}
              >
                {division}
              </Link>
            ))}
          </div>
        ) : null}

        {[...groups.entries()].map(([group, groupTeams]) => (
          <section key={group}>
            <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-navy/45">
              {group}
            </h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {groupTeams.map((team) => (
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
          </section>
        ))}

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-navy/10 bg-white px-4 py-6 text-sm text-navy/60">
            No franchises match that conference/division filter.
          </p>
        ) : null}
      </div>
    </div>
  );
}
