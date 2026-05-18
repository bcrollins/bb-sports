/**
 * /rankings/[league] — one page per league (NFL / MLB / NHL / NBA).
 *
 * Deep-link surface for a single league's top 25 — cleaner share URL
 * than /rankings#mlb and a separate page Google can rank for queries
 * like "NBA franchise rankings" without competing with the multi-league
 * /rankings page.
 *
 * Pulls from the same buildLeagueRanking() engine, so cumulative
 * demotions are reflected here too.
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { getAllArticles, formatDate, type SportSlug } from '@/lib/articles';
import { sportMeta } from '@/lib/sport-meta';
import NewsletterSignup from '@/components/NewsletterSignup';
import {
  buildLeagueRanking,
  LEAGUE_LABELS,
  LEAGUE_ORDER,
  type LeagueRanking,
  type RankedFranchise,
  type RankingLeague,
} from '@/lib/rankings';

type Params = { league: string };
type Props = { params: Promise<Params> };

export const revalidate = 60;

const LEAGUE_SILHOUETTE: Record<RankingLeague, string> = {
  nfl: '/images/player-nfl.svg',
  mlb: '/images/player-mlb.svg',
  nhl: '/images/player-nhl.svg',
  nba: '/images/player-nba.svg',
};

function isLeague(value: string): value is RankingLeague {
  return LEAGUE_ORDER.includes(value as RankingLeague);
}

export async function generateStaticParams(): Promise<Params[]> {
  return LEAGUE_ORDER.map((league) => ({ league }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { league } = await params;
  if (!isLeague(league)) return {};
  return {
    title: `${LEAGUE_LABELS[league]} franchise rankings`,
    description: `Brad Benson's top-25 ${LEAGUE_LABELS[league]} franchise rankings. Bias turned all the way up — when a team gets trashed in a column, the ranking moves and the reason is on the page.`,
    alternates: {
      canonical: `/rankings/${league}`,
      types: { 'application/json': `/api/rankings?league=${league}` },
    },
    openGraph: {
      title: `BB Sports — ${LEAGUE_LABELS[league]} top 25`,
      description: `Brad's top-25 ${LEAGUE_LABELS[league]} franchise rankings.`,
    },
  };
}

export default async function LeagueRankingPage({ params }: Props) {
  const { league } = await params;
  if (!isLeague(league)) notFound();
  const articles = await getAllArticles();
  const ranking = buildLeagueRanking(league, articles);
  const meta = sportMeta(league as SportSlug);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bbsports.fans';
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `BB Sports ${LEAGUE_LABELS[league]} Franchise Rankings`,
    description: `Brad Benson's top-25 ${LEAGUE_LABELS[league]} franchise rankings.`,
    url: `${siteUrl}/rankings/${league}`,
    itemListElement: ranking.ranked.map((team) => ({
      '@type': 'ListItem',
      position: team.currentRank,
      name: `${team.city} ${team.name}`,
      url: `${siteUrl}/rankings/${league}/${team.id}`,
    })),
  };

  return (
    <div className="bg-bone">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <header className="relative isolate overflow-hidden bg-navy text-bone">
        <div className="absolute inset-0 opacity-20">
          <Image
            src={LEAGUE_SILHOUETTE[league]}
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-right"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/85 to-navy/40" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <Link
            href="/rankings"
            className="inline-flex items-center text-[11px] font-black uppercase tracking-[0.22em] text-bone/75 hover:text-breaking"
          >
            ← All four leagues
          </Link>
          <p
            className="mt-4 font-mono text-[11px] font-black uppercase tracking-[0.28em]"
            style={{ color: meta.accent }}
          >
            Top 25 · ranked by Brad
          </p>
          <h1 className="mt-3 font-display text-5xl italic uppercase leading-[0.95] sm:text-7xl">
            {LEAGUE_LABELS[league]} <span className="text-breaking">rankings</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-bone/85">
            Every {LEAGUE_LABELS[league]} franchise from #1 to #25, ranked by my
            opinion. Bias disclosed. When I publish a column that trashes a team,
            it drops here.
          </p>
          {ranking.movements.length > 0 && (
            <p className="mt-3 text-sm uppercase tracking-[0.16em] text-bone/65">
              {ranking.movements.length} team{ranking.movements.length === 1 ? '' : 's'} moved since baseline
            </p>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <ol className="grid gap-3">
          {ranking.ranked.map((team) => (
            <FranchiseRow key={team.id} team={team} accent={meta.accent} />
          ))}
        </ol>
      </section>

      <section className="border-t border-navy/15 bg-bone-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <h2 className="font-display text-2xl italic uppercase text-navy-900">
              The other three leagues
            </h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-3">
              {LEAGUE_ORDER.filter((l) => l !== league).map((other) => (
                <li key={other}>
                  <Link
                    href={`/rankings/${other}`}
                    className="inline-flex min-h-[44px] w-full items-center justify-center border border-navy/20 px-3 text-[12px] font-black uppercase tracking-[0.18em] text-navy transition-colors hover:border-breaking hover:bg-breaking hover:text-bone"
                  >
                    {LEAGUE_LABELS[other]} rankings
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-charcoal/85 leading-relaxed">
              Want the JSON?{' '}
              <Link
                href={`/api/rankings?league=${league}`}
                className="font-bold text-navy underline decoration-breaking underline-offset-4 hover:text-breaking"
              >
                /api/rankings?league={league}
              </Link>
            </p>
          </div>
          <aside>
            <NewsletterSignup variant="block" />
          </aside>
        </div>
      </section>
    </div>
  );
}

function FranchiseRow({ team, accent }: { team: RankedFranchise; accent: string }) {
  const moved = team.currentRank - team.baseRank;
  const teamHref = `/rankings/${team.league}/${team.id}`;
  return (
    <li
      className="grid gap-3 border border-navy/15 border-l-[3px] bg-white p-4 sm:grid-cols-[80px_minmax(0,1fr)] sm:p-5"
      style={{ borderLeftColor: accent }}
    >
      <div className="flex items-start gap-3 sm:flex-col sm:items-center sm:gap-1">
        <div className="font-display text-4xl italic font-black leading-none text-navy-900">
          {team.currentRank}
        </div>
        {moved !== 0 && (
          <div
            className={`text-[10px] font-black uppercase tracking-[0.18em] ${
              moved > 0 ? 'text-breaking' : 'text-emerald-700'
            }`}
            aria-label={moved > 0 ? `Down ${moved} from baseline` : `Up ${-moved} from baseline`}
          >
            {moved > 0 ? '▼' : '▲'} {Math.abs(moved)}
          </div>
        )}
      </div>
      <div>
        <div className="flex items-baseline flex-wrap gap-x-2">
          <Link
            href={teamHref}
            className="font-serif text-xl font-bold text-navy-900 hover:text-breaking sm:text-2xl"
          >
            {team.city} {team.name}
          </Link>
          {team.bradTeam && (
            <span className="inline-flex items-center gap-1 rounded-sm border border-navy/25 bg-bone-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-navy" title="House rule #1: bias disclosed.">
              <span aria-hidden="true">⚑</span>
              Brad&rsquo;s team
            </span>
          )}
          {moved > 0 && (
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-breaking">
              Demoted from #{team.baseRank}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-charcoal/85 sm:text-base">
          {team.brad}
        </p>
        {team.demotions.length > 0 && (
          <div className="mt-3 border-l-2 border-breaking bg-bone-50 p-3">
            <p className="bb-eyebrow !text-breaking">Why they moved</p>
            <ul className="mt-2 space-y-2">
              {team.demotions.map((d, idx) => (
                <li key={`${d.articleSlug}-${idx}`} className="text-sm text-charcoal/85 leading-snug">
                  &ldquo;{d.reason}&rdquo;{' '}
                  <Link
                    href={`/articles/${d.articleSlug}`}
                    className="font-bold text-navy underline decoration-breaking underline-offset-4 hover:text-breaking"
                  >
                    {d.articleTitle}
                  </Link>
                  <span className="block text-[11px] uppercase tracking-[0.12em] text-charcoal/55">
                    {formatDate(d.date)} · dropped {d.drop} slot{d.drop === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Link
          href={teamHref}
          className="mt-3 inline-flex items-center text-[11px] font-black uppercase tracking-[0.18em] text-navy hover:text-breaking"
        >
          Open team page →
        </Link>
      </div>
    </li>
  );
}

// Avoid unused-import warnings — buildLeagueRanking is used above; LeagueRanking
// type re-exported for consumers that import this page's helpers.
export type { LeagueRanking };
