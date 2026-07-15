import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getSportsEncyclopediaStats,
  listSportsPeople,
} from '@/lib/sports-encyclopedia/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'People encyclopedia',
  description:
    'BB Sports first-party people notes for figures material to coverage — identity and role with citations, not scraped career stats.',
  alternates: { canonical: '/people' },
};

export default async function PeopleIndexPage() {
  const [people, stats] = await Promise.all([
    listSportsPeople({ limit: 200 }),
    getSportsEncyclopediaStats(),
  ]);

  const byLeague = new Map<string, typeof people>();
  for (const person of people) {
    const list = byLeague.get(person.leagueKey) ?? [];
    list.push(person);
    byLeague.set(person.leagueKey, list);
  }

  return (
    <div className="bg-bone">
      <header className="bg-navy text-bone">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="bb-eyebrow !text-breaking !tracking-[0.3em]">Sports encyclopedia</p>
          <h1 className="mt-3 font-display text-4xl italic uppercase leading-[0.95] sm:text-5xl">
            People on the BB Sports radar
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-bone/75">
            First-party identity notes for figures material to columns and rankings.
            Not a full-league roster dump and not a proprietary stats scrape.
            {stats.people} people · {stats.teams} franchises.
          </p>
          <Link
            href="/teams"
            className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-white px-4 text-xs font-black uppercase tracking-wide text-navy"
          >
            Browse teams
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
        {[...byLeague.entries()].map(([leagueKey, leaguePeople]) => (
          <section key={leagueKey}>
            <h2 className="font-display text-2xl uppercase text-navy-deep">
              {leagueKey.toUpperCase()}
              <span className="ml-2 text-sm font-sans font-bold text-navy/40">
                {leaguePeople.length}
              </span>
            </h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {leaguePeople.map((person) => (
                <li key={person.id}>
                  <Link
                    href={`/people/${person.personKey}`}
                    className="block min-h-11 rounded-xl border border-navy/10 bg-white px-4 py-3 shadow-sm hover:border-navy/30"
                  >
                    <p className="text-sm font-bold text-navy-deep">{person.commonName}</p>
                    <p className="text-[11px] uppercase tracking-wide text-navy/45">
                      {person.role.replaceAll('_', ' ')} · {person.positionOrTitle}
                    </p>
                    <p className="mt-1 text-xs text-navy/55 line-clamp-2">{person.summary}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
