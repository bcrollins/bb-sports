import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getAllArticles, formatDate, type SportSlug } from '@/lib/articles';
import { sportMeta } from '@/lib/sport-meta';
import NewsletterSignup from '@/components/NewsletterSignup';
import {
  buildAllRankings,
  getRecentMovements,
  LEAGUE_ORDER,
  type LeagueRanking,
  type RankedFranchise,
  type RankingLeague,
  type RecentMovement,
} from '@/lib/rankings';

// Per-league silhouette + sport-meta accent. Used in both the sticky
// league nav and the league-header on the page.
const LEAGUE_SILHOUETTE: Record<RankingLeague, string> = {
  nfl: '/images/player-nfl.svg',
  mlb: '/images/player-mlb.svg',
  nhl: '/images/player-nhl.svg',
  nba: '/images/player-nba.svg',
};

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Franchise rankings',
  description:
    "Brad Benson's top-25 franchise rankings across the NFL, MLB, NHL and NBA. Bias turned all the way up — when a team gets trashed in a column, the ranking moves and the reason is on the page.",
  alternates: { canonical: '/rankings' },
  openGraph: {
    title: 'BB Sports — Franchise rankings',
    description:
      "Top 25 in every league, ranked by Brad. When Brad trashes a team in a column, the ranking moves and the reason gets logged here.",
  },
};

export default async function RankingsPage() {
  const articles = await getAllArticles();
  const leagues = buildAllRankings(articles);
  // Recent movement rail shares its source-of-truth with the homepage rail
  // via getRecentMovements (lib/rankings.ts). Same chronological sort, same
  // shape — no inline transform, no drift between pages.
  const recentMovements = getRecentMovements(articles, 6);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bbsports.fans';
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'BB Sports Franchise Rankings',
    description:
      "Brad Benson's top-25 franchise rankings across the NFL, MLB, NHL and NBA.",
    url: `${siteUrl}/rankings`,
    itemListElement: leagues.flatMap((league) =>
      league.ranked.map((team) => ({
        '@type': 'ListItem',
        position: team.currentRank,
        name: `${team.city} ${team.name}`,
        url: `${siteUrl}/rankings#${league.league}`,
      })),
    ),
  };

  return (
    <div className="bg-bone">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <header className="bg-navy text-bone">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="bb-eyebrow !text-breaking !tracking-[0.3em]">Franchise rankings</p>
          <h1 className="mt-3 font-display text-4xl italic uppercase leading-[0.95] sm:text-6xl">
            Top 25 in every league. Ranked by me. No committee.
          </h1>
          <p className="mt-5 max-w-2xl text-bone/85 text-lg leading-relaxed">
            NFL, MLB, NHL, NBA. Twenty-five teams each. Order is{' '}
            <strong className="text-bone">my opinion</strong> — bias disclosed,
            argument welcome. When I trash a team in a column, that team drops here
            and you can read exactly why right next to its name.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {LEAGUE_ORDER.map((l) => (
              <a
                key={l}
                href={`#${l}`}
                className="inline-flex min-h-[44px] items-center border border-bone/30 px-4 text-[12px] font-black uppercase tracking-[0.18em] text-bone transition-colors hover:bg-breaking hover:border-breaking"
              >
                {l.toUpperCase()}
              </a>
            ))}
          </div>
        </div>
      </header>

      {/* Sticky league nav — surfaces below the hero, lives above the
          movement rail and league lists. Lets the reader hop directly to
          any league without scrolling through 100 rows. */}
      <nav
        aria-label="Jump to league"
        className="sticky top-0 z-20 border-b border-navy/15 bg-bone-50/95 backdrop-blur"
      >
        <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {LEAGUE_ORDER.map((l) => {
            const meta = sportMeta(l as SportSlug);
            return (
              <li key={l}>
                <a
                  href={`#${l}`}
                  className="inline-flex min-h-[48px] items-center gap-2 border-b-2 border-transparent px-3 text-[11px] font-black uppercase tracking-[0.2em] text-navy transition-colors hover:text-breaking sm:px-4"
                  style={{ borderBottomColor: 'transparent' }}
                >
                  <span
                    className="block h-2 w-2 rounded-full"
                    style={{ backgroundColor: meta.accent }}
                    aria-hidden="true"
                  />
                  {l.toUpperCase()}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {recentMovements.length > 0 && (
        <section className="border-b border-navy/15 bg-bone-50">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <div className="bb-thin-rule mb-5 flex items-end gap-3 pb-3">
              <span className="block h-7 w-1.5 bg-breaking" aria-hidden="true" />
              <h2 className="font-display text-2xl italic uppercase text-navy-900">
                Recent movement
              </h2>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentMovements.map((m) => (
                <RecentMovementCard key={`${m.league}-${m.team.id}-${m.article.slug}`} movement={m} />
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:px-6">
        {leagues.map((league) => (
          <LeagueBlock key={league.league} league={league} />
        ))}
      </div>

      <section className="border-t border-navy/15 bg-bone-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <h2 className="font-display text-2xl italic uppercase text-navy-900">How the list moves</h2>
            <p className="mt-3 text-charcoal/85 leading-relaxed">
              Baseline is my opinion the day this page shipped. When I publish a
              column that trashes a team on the list, that team drops a few slots and
              the reason — with a link to the column — appears next to its name. No
              secret algorithm. No power-ranking committee. The list is the receipt
              of every take I&rsquo;ve published.
            </p>
            <p className="mt-3 text-charcoal/85 leading-relaxed">
              Want the machine-readable version? The same data is on{' '}
              <Link href="/api/rankings" className="font-bold text-navy underline decoration-breaking underline-offset-4 hover:text-breaking">
                /api/rankings
              </Link>
              {' '}for the newsletter generator and anyone else who wants to embed it.
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

function LeagueBlock({ league }: { league: LeagueRanking }) {
  const meta = sportMeta(league.league as SportSlug);
  const silhouette = LEAGUE_SILHOUETTE[league.league];
  return (
    <section id={league.league} className="scroll-mt-24">
      <div
        className="mb-6 flex items-end justify-between gap-3 border-b-[3px] pb-3"
        style={{ borderColor: meta.accent }}
      >
        <div className="flex items-center gap-4">
          <div
            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-sm border border-navy/15"
            aria-hidden="true"
          >
            <Image src={silhouette} alt="" fill sizes="56px" className="object-cover" />
          </div>
          <div>
            <p
              className="text-[10px] font-black uppercase tracking-[0.22em]"
              style={{ color: meta.accent }}
            >
              Top 25 · ranked by Brad
            </p>
            <h2 className="font-display text-4xl italic uppercase leading-none text-navy-900">
              {league.label}
            </h2>
          </div>
        </div>
        <p className="hidden text-xs uppercase tracking-[0.18em] text-charcoal/55 sm:block">
          {league.movements.length} moved · {league.ranked.length} total
        </p>
      </div>
      <ol className="grid gap-3">
        {league.ranked.map((team) => (
          <FranchiseRow key={team.id} team={team} accent={meta.accent} />
        ))}
      </ol>
    </section>
  );
}

function FranchiseRow({ team, accent }: { team: RankedFranchise; accent: string }) {
  const moved = team.currentRank - team.baseRank;
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
          <span className="font-serif text-xl font-bold text-navy-900 sm:text-2xl">
            {team.city} {team.name}
          </span>
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
            <p className="bb-eyebrow !text-breaking">
              Why they moved
            </p>
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
      </div>
    </li>
  );
}

function RecentMovementCard({ movement }: { movement: RecentMovement }) {
  const meta = sportMeta(movement.league as SportSlug);
  const moved = movement.team.currentRank - movement.team.baseRank;
  return (
    <li className="border border-navy/15 border-l-[3px] bg-white p-4" style={{ borderLeftColor: meta.accent }}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono font-black uppercase tracking-[0.18em]" style={{ color: meta.accent }}>
          {movement.leagueLabel}
        </span>
        <span className="font-bold text-charcoal/70">
          #{movement.team.baseRank} → #{movement.team.currentRank}
          {moved > 0 && <span className="ml-1 text-breaking">▼ {moved}</span>}
        </span>
      </div>
      <p className="mt-2 font-serif text-xl font-bold text-navy-900">
        {movement.team.city} {movement.team.name}
      </p>
      <p className="mt-2 text-sm leading-snug text-charcoal/80">
        {movement.reason || 'See linked column for the case.'}
      </p>
      <Link
        href={`/articles/${movement.article.slug}`}
        className="mt-3 inline-block text-[11px] font-black uppercase tracking-[0.18em] text-navy underline decoration-breaking underline-offset-4 hover:text-breaking"
      >
        Read the column →
      </Link>
    </li>
  );
}
