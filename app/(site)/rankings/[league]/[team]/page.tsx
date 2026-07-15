/**
 * /rankings/[league]/[team] — per-franchise deep-link page.
 *
 * One page per team across NFL/MLB/NHL/NBA (100 total). Renders:
 *   - Current rank + delta from baseline.
 *   - Brad's one-line take from the baseline.
 *   - Full demotion history (every published column that moved them).
 *   - Siblings (the team one slot above and one slot below).
 *   - Related articles in this sport.
 *
 * SEO win: each franchise becomes a shareable, indexable surface.
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { getAllArticles, formatDate, sportLabel, type SportSlug } from '@/lib/articles';
import { sportMeta } from '@/lib/sport-meta';
import { serializeJsonLd } from '@/lib/json-ld';
import ArticleCard from '@/components/ArticleCard';
import {
  buildLeagueRanking,
  LEAGUE_ORDER,
  LEAGUE_LABELS,
  type RankingLeague,
} from '@/lib/rankings';

type Params = { league: string; team: string };
type Props = { params: Promise<Params> };

export const revalidate = 60;

const LEAGUE_SILHOUETTE: Record<RankingLeague, string> = {
  nfl: '/images/player-nfl.svg',
  mlb: '/images/player-mlb.svg',
  nhl: '/images/player-nhl.svg',
  nba: '/images/player-nba.svg',
};

const LEAGUE_TO_SPORT: Record<RankingLeague, SportSlug> = {
  nfl: 'nfl',
  mlb: 'mlb',
  nhl: 'nhl',
  nba: 'nba',
};

function isLeague(value: string): value is RankingLeague {
  return LEAGUE_ORDER.includes(value as RankingLeague);
}

export async function generateStaticParams(): Promise<Params[]> {
  // Pre-render every team page across every league. Baseline alone defines
  // the universe; articles never add or remove rows, only move them.
  const out: Params[] = [];
  for (const league of LEAGUE_ORDER) {
    const ranking = buildLeagueRanking(league, []);
    for (const team of ranking.ranked) {
      out.push({ league, team: team.id });
    }
  }
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { league, team } = await params;
  if (!isLeague(league)) return {};
  const articles = await getAllArticles();
  const ranking = buildLeagueRanking(league, articles);
  const row = ranking.ranked.find((r) => r.id === team);
  if (!row) return {};
  return {
    title: `${row.city} ${row.name} — #${row.currentRank} ${LEAGUE_LABELS[league]} on Brad's franchise rankings`,
    description: row.brad,
    alternates: { canonical: `/rankings/${league}/${team}` },
    openGraph: {
      title: `${row.city} ${row.name} · #${row.currentRank} ${LEAGUE_LABELS[league]}`,
      description: row.brad,
    },
  };
}

export default async function TeamPage({ params }: Props) {
  const { league, team } = await params;
  if (!isLeague(league)) notFound();
  const articles = await getAllArticles();
  const ranking = buildLeagueRanking(league, articles);
  const row = ranking.ranked.find((r) => r.id === team);
  if (!row) notFound();

  const meta = sportMeta(league as SportSlug);
  const above = ranking.ranked.find((r) => r.currentRank === row.currentRank - 1);
  const below = ranking.ranked.find((r) => r.currentRank === row.currentRank + 1);
  const movedDelta = row.currentRank - row.baseRank;

  // Related articles: same sport, excluding ones already linked from
  // demotions[]. Capped to 3 so the page stays readable.
  const demotionSlugs = new Set(row.demotions.map((d) => d.articleSlug));
  const sportSlug = LEAGUE_TO_SPORT[league];
  const relatedArticles = articles
    .filter((a) => a.sport === sportSlug && !demotionSlugs.has(a.slug))
    .slice(0, 3);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bbsports.fans';
  const teamUrl = `${siteUrl}/rankings/${league}/${team}`;
  const sportsTeamJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: `${row.city} ${row.name}`,
    sport: LEAGUE_LABELS[league],
    url: teamUrl,
    location: { '@type': 'Place', name: row.city },
    description: row.brad,
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Franchise rankings', item: `${siteUrl}/rankings` },
      {
        '@type': 'ListItem',
        position: 3,
        name: LEAGUE_LABELS[league],
        item: `${siteUrl}/rankings#${league}`,
      },
      { '@type': 'ListItem', position: 4, name: `${row.city} ${row.name}`, item: teamUrl },
    ],
  };

  return (
    <article className="bg-bone">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(sportsTeamJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
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
        <div className="relative mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <Link
            href={`/rankings#${league}`}
            className="inline-flex items-center text-[11px] font-black uppercase tracking-[0.22em] text-bone/75 hover:text-breaking"
          >
            ← {LEAGUE_LABELS[league]} top 25
          </Link>
          <p
            className="mt-4 font-mono text-[11px] font-black uppercase tracking-[0.28em]"
            style={{ color: meta.accent }}
          >
            {LEAGUE_LABELS[league]} · ranked by Brad
          </p>
          <h1 className="mt-3 font-display text-5xl italic uppercase leading-[0.95] sm:text-7xl">
            {row.city} <span className="text-breaking">{row.name}</span>
          </h1>
          {row.bradTeam && (
            <p className="mt-3 inline-flex w-fit items-center gap-2 border border-bone/30 bg-bone/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-bone">
              <span aria-hidden="true">⚑</span>
              Bias disclosed · Brad&rsquo;s team
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-end gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-bone/60">
                Current rank
              </p>
              <p className="font-display text-6xl italic font-black leading-none text-bone">
                #{row.currentRank}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-bone/60">
                Baseline
              </p>
              <p className="font-display text-3xl italic font-black leading-none text-bone/80">
                #{row.baseRank}
              </p>
            </div>
            {movedDelta !== 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-bone/60">
                  Delta
                </p>
                <p
                  className={`font-display text-3xl italic font-black leading-none ${
                    movedDelta > 0 ? 'text-breaking' : 'text-emerald-300'
                  }`}
                >
                  {movedDelta > 0 ? '▼' : '▲'} {Math.abs(movedDelta)}
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="bb-eyebrow !text-breaking">Brad on this franchise</p>
        <p className="mt-3 font-serif text-xl leading-relaxed text-charcoal/90 sm:text-2xl">
          &ldquo;{row.brad}&rdquo;
        </p>
      </section>

      {row.demotions.length > 0 && (
        <section className="border-t border-navy/15 bg-bone-50">
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
            <h2 className="bb-eyebrow !text-breaking">Every column that moved them</h2>
            <ul className="mt-4 space-y-4">
              {row.demotions.map((d, idx) => (
                <li key={`${d.articleSlug}-${idx}`} className="border-l-2 border-breaking bg-white p-4">
                  <p className="text-sm leading-snug text-charcoal/85">
                    &ldquo;{d.reason || 'See the linked column.'}&rdquo;
                  </p>
                  <Link
                    href={`/articles/${d.articleSlug}`}
                    className="mt-2 inline-block font-bold text-navy underline decoration-breaking underline-offset-4 hover:text-breaking"
                  >
                    {d.articleTitle}
                  </Link>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-charcoal/55">
                    {formatDate(d.date)} · dropped {d.drop} slot{d.drop === 1 ? '' : 's'}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="border-t border-navy/15">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <h2 className="bb-eyebrow !text-breaking">In context</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {above ? (
              <SiblingCard
                label={`#${above.currentRank} · one above`}
                team={above.city + ' ' + above.name}
                href={`/rankings/${league}/${above.id}`}
                accent={meta.accent}
              />
            ) : (
              <div className="border border-dashed border-navy/20 bg-white p-4 text-xs uppercase tracking-[0.18em] text-charcoal/55">
                Top of the {LEAGUE_LABELS[league]} list.
              </div>
            )}
            {below ? (
              <SiblingCard
                label={`#${below.currentRank} · one below`}
                team={below.city + ' ' + below.name}
                href={`/rankings/${league}/${below.id}`}
                accent={meta.accent}
              />
            ) : (
              <div className="border border-dashed border-navy/20 bg-white p-4 text-xs uppercase tracking-[0.18em] text-charcoal/55">
                Bottom of the {LEAGUE_LABELS[league]} list.
              </div>
            )}
          </div>
        </div>
      </section>

      {relatedArticles.length > 0 && (
        <section className="border-t border-navy/15 bg-bone-50">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <div className="bb-thin-rule mb-5 flex items-end justify-between gap-3 pb-3">
              <h2 className="font-display text-2xl italic uppercase text-navy-900">
                More {sportLabel(sportSlug)} from Brad
              </h2>
              <Link href={`/articles?sport=${sportSlug}`} className="bb-link text-sm">
                All {sportLabel(sportSlug)} →
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedArticles.map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}

function SiblingCard({
  label,
  team,
  href,
  accent,
}: {
  label: string;
  team: string;
  href: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="group block border border-navy/15 border-l-[3px] bg-white p-4 transition-colors hover:bg-bone-50"
      style={{ borderLeftColor: accent }}
    >
      <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>
        {label}
      </p>
      <p className="mt-2 font-serif text-xl font-bold leading-tight text-navy-900 group-hover:text-breaking">
        {team}
      </p>
      <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-navy group-hover:text-breaking">
        Open the team →
      </p>
    </Link>
  );
}
