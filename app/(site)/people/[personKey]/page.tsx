import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSportsPerson, getSportsTeam } from '@/lib/sports-encyclopedia/queries';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ personKey: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { personKey } = await params;
  const person = await getSportsPerson(personKey);
  if (!person) return { title: 'Person not found' };
  return {
    title: person.commonName,
    description: person.summary.slice(0, 160),
    alternates: { canonical: `/people/${person.personKey}` },
  };
}

export default async function PersonDetailPage({ params }: Props) {
  const { personKey } = await params;
  const person = await getSportsPerson(personKey);
  if (!person) notFound();
  const team = await getSportsTeam(person.leagueKey, person.teamKey);

  return (
    <div className="bg-bone">
      <header className="bg-navy text-bone">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-14">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-bone/60">
            <Link href="/people" className="hover:text-white">
              People
            </Link>{' '}
            / {person.leagueKey.toUpperCase()}
          </p>
          <h1 className="mt-3 font-display text-4xl uppercase italic sm:text-5xl">
            {person.commonName}
          </h1>
          <p className="mt-3 text-sm text-bone/70">
            {person.role.replaceAll('_', ' ')} · {person.positionOrTitle}
            {person.fullName !== person.commonName ? ` · ${person.fullName}` : ''}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6">
        <section className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
          <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-navy/45">
            BB Sports note
          </h2>
          <p className="mt-3 text-sm leading-6 text-navy/80">{person.summary}</p>
        </section>

        <section className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
          <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-navy/45">
            Team association
          </h2>
          {team ? (
            <div className="mt-3">
              <Link
                href={`/teams/${team.leagueKey}/${team.teamKey}`}
                className="text-base font-bold text-navy-deep underline-offset-2 hover:underline"
              >
                {team.displayName}
              </Link>
              <p className="mt-1 text-xs text-navy/55">
                {[team.conference, team.division].filter(Boolean).join(' · ')}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-navy/60">
              {person.leagueKey}/{person.teamKey}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
          <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-navy/45">
            Source citation
          </h2>
          <p className="mt-3 text-sm text-navy/75">{person.dataSource}</p>
          {person.officialUrl ? (
            <p className="mt-1 text-sm">
              <a
                href={person.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {person.officialUrl}
              </a>
            </p>
          ) : null}
          <p className="mt-2 text-xs text-navy/50">
            Verified {person.dataVerifiedDate.toISOString().slice(0, 10)} · Confidence{' '}
            {person.dataConfidence}
          </p>
          {person.dataNotes ? (
            <p className="mt-2 text-xs leading-5 text-navy/55">{person.dataNotes}</p>
          ) : null}
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-amber-800/80">
            Identity/role only — no proprietary stats tables
          </p>
        </section>
      </div>
    </div>
  );
}
