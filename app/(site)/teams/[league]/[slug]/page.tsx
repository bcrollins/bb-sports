import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getSportsTeam,
  isSportsLeagueKey,
  listPeopleForTeam,
} from '@/lib/sports-encyclopedia/queries';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ league: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { league, slug } = await params;
  const team = await getSportsTeam(league, slug);
  if (!team) return { title: 'Team not found' };
  return {
    title: team.displayName,
    description: `${team.displayName} franchise identity in the BB Sports first-party encyclopedia.`,
    alternates: { canonical: `/teams/${team.leagueKey}/${team.teamKey}` },
  };
}

export default async function TeamDetailPage({ params }: Props) {
  const { league, slug } = await params;
  if (!isSportsLeagueKey(league)) notFound();
  const team = await getSportsTeam(league, slug);
  if (!team) notFound();
  const people = await listPeopleForTeam(league, slug);

  return (
    <div className="bg-bone">
      <header className="bg-navy text-bone">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-bone/60">
            <Link href="/teams" className="hover:text-white">
              Teams
            </Link>{' '}
            /{' '}
            <Link href={`/teams/${team.leagueKey}`} className="hover:text-white">
              {team.leagueKey.toUpperCase()}
            </Link>
          </p>
          <h1 className="mt-3 font-display text-4xl uppercase italic sm:text-5xl">
            {team.displayName}
          </h1>
          <p className="mt-3 text-sm text-bone/70">
            {[team.city, team.conference, team.division].filter(Boolean).join(' · ')}
            {team.foundedYear ? ` · Founded ${team.foundedYear}` : ''}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={team.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 rounded-lg bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-navy"
            >
              Official site
            </a>
            {team.rankingsId ? (
              <Link
                href={`/rankings/${team.leagueKey}/${team.rankingsId}`}
                className="min-h-11 rounded-lg border border-white/30 px-4 py-2 text-xs font-black uppercase tracking-wide text-white"
              >
                Brad ranking page
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
          <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-navy/45">
            Franchise identity
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-navy/45">Abbreviation</dt>
              <dd className="font-mono font-bold text-navy-deep">{team.abbreviation}</dd>
            </div>
            <div>
              <dt className="text-navy/45">Nickname</dt>
              <dd className="font-bold text-navy-deep">{team.nickname}</dd>
            </div>
            <div>
              <dt className="text-navy/45">Conference</dt>
              <dd className="font-bold text-navy-deep">{team.conference ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-navy/45">Division</dt>
              <dd className="font-bold text-navy-deep">{team.division ?? '—'}</dd>
            </div>
          </dl>
          <div className="mt-5 rounded-xl bg-ink/5 p-3 text-xs leading-5 text-navy/70">
            <p className="font-bold text-navy/50">Source citation</p>
            <p className="mt-1">{team.dataSource}</p>
            <p>
              <a
                className="underline"
                href={team.dataSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {team.dataSourceUrl}
              </a>
            </p>
            <p className="mt-1">
              Verified {team.dataVerifiedDate.toISOString().slice(0, 10)} · Confidence{' '}
              {team.dataConfidence}
            </p>
            {team.dataNotes ? <p className="mt-1">{team.dataNotes}</p> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
          <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-navy/45">
            People on BB Sports radar
          </h2>
          {people.length === 0 ? (
            <p className="mt-3 text-sm text-navy/60">
              No first-party person notes yet for this franchise. We only store
              carefully cited identity rows — not scraped career stat dumps.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {people.map((person) => (
                <li key={person.id}>
                  <Link
                    href={`/people/${person.personKey}`}
                    className="block rounded-xl border border-navy/10 px-3 py-3 hover:border-navy/30"
                  >
                    <p className="text-sm font-bold text-navy-deep">{person.commonName}</p>
                    <p className="text-[11px] uppercase tracking-wide text-navy/45">
                      {person.role.replaceAll('_', ' ')} · {person.positionOrTitle}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-navy/70">{person.summary}</p>
                    <p className="mt-2 text-[10px] text-navy/45">
                      {person.dataConfidence} · {person.dataSource}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
