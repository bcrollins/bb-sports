import Image from 'next/image';
import Link from 'next/link';
import ArticleCard from '@/components/ArticleCard';
import GeneratedMediaRail from '@/components/GeneratedMediaRail';
import NewsletterSignup from '@/components/NewsletterSignup';
import RankingsImpactPill from '@/components/RankingsImpactPill';
import SportTag from '@/components/SportTag';
import AiAssistedBadge from '@/components/AiAssistedBadge';
import {
  getAllArticles,
  formatDate,
  type Article,
  type SportSlug,
} from '@/lib/articles';
import { buildHomepageDesk } from '@/lib/homepage';
import { getConfig } from '@/lib/queries';
import {
  buildAllRankings,
  getRecentMovements,
  LEAGUE_LABELS,
  type RecentMovement,
} from '@/lib/rankings';
import { sportMeta } from '@/lib/sport-meta';

export const revalidate = 60;

// Player faces rail — original silhouette art on the face of the homepage,
// per Brad's directive to put "more imagery of different sports players on
// the face of the website." Static files in /public/images, all original
// commercial-safe artwork.
const PLAYER_FACES = [
  { src: '/images/player-nfl.svg',    label: 'NFL',    href: '/teams/nfl' },
  { src: '/images/player-mlb.svg',    label: 'MLB',    href: '/teams/mlb' },
  { src: '/images/player-nba.svg',    label: 'NBA',    href: '/teams/nba' },
  { src: '/images/player-nhl.svg',    label: 'NHL',    href: '/teams/nhl' },
  { src: '/images/player-cfb.svg',    label: 'CFB',    href: '/articles?sport=college-football' },
  { src: '/images/player-soccer.svg', label: 'Soccer', href: '/articles?sport=soccer' },
];

export default async function HomePage() {
  const [articles, heroConfig] = await Promise.all([
    getAllArticles(),
    getConfig<HomepageHeroConfig | null>('hero', null),
  ]);
  const desk = buildHomepageDesk(articles);
  const hero = normalizeHero(heroConfig);
  const recentMovements = getRecentMovements(articles, 3);
  const leagueLeaders = buildAllRankings(articles).map((ranking) => ({
    league: ranking.league,
    label: LEAGUE_LABELS[ranking.league],
    leader: ranking.ranked.find((t) => t.currentRank === 1) ?? null,
  }));

  return (
    <div className="min-h-[60vh] bg-bone">
      {/* PLAYERS' TRIBUNE-INSPIRED HERO
          Single big image, headline overlay, one CTA. No sidebar widgets, no
          ticker rails, no two-tap action grid. Slick and simple. */}
      <section className="relative bg-navy-deep text-bone">
        <div className="relative isolate overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src="/images/hero-marquee.svg"
              alt="Composite of stylized player silhouettes across NFL, MLB, NHL, NBA, college football and soccer"
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy-deep via-navy-deep/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-navy-deep/85 via-navy-deep/35 to-transparent" />
          </div>
          <div className="relative mx-auto flex min-h-[460px] max-w-7xl flex-col justify-end px-4 py-12 sm:px-6 sm:py-16 lg:min-h-[560px] lg:py-20">
            <p className="bb-eyebrow !text-breaking !tracking-[0.32em]">
              {hero.eyebrow}
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-5xl italic uppercase leading-[0.95] sm:text-7xl lg:text-[88px]">
              Sports from the fan&rsquo;s view.
              <span className="block text-breaking">No BS.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-bone/85">
              The most recent sports news. Bias turned all the way up. One byline.
              <span className="hidden sm:inline"> Take it or argue with me in the comments.</span>
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="#latest"
                className="inline-flex min-h-[48px] items-center bg-breaking px-5 text-sm font-black uppercase tracking-[0.2em] text-bone transition-colors hover:bg-breaking/90"
              >
                Latest takes
              </Link>
              <Link
                href="/rankings"
                className="inline-flex min-h-[48px] items-center border border-bone/40 px-5 text-sm font-black uppercase tracking-[0.2em] text-bone transition-colors hover:bg-bone hover:text-navy"
              >
                Franchise rankings
              </Link>
              <Link
                href="/teams"
                className="inline-flex min-h-[48px] items-center border border-bone/40 px-5 text-sm font-black uppercase tracking-[0.2em] text-bone transition-colors hover:bg-bone hover:text-navy"
              >
                Teams encyclopedia
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* PLAYER FACES RAIL
          Imagery on the face of the website, sport-agnostic but visually
          loud. Tap a face to open that sport's archive. Kept to one row,
          horizontally scrollable on mobile, equal-weight on desktop. */}
      <section className="border-b border-navy/15 bg-bone-50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <ul className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-6 sm:gap-4 sm:overflow-visible [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {PLAYER_FACES.map((face) => (
              <li key={face.label} className="shrink-0">
                <Link
                  href={face.href}
                  className="group block w-[140px] sm:w-auto"
                  aria-label={`${face.label} coverage`}
                >
                  <div className="relative aspect-[4/5] overflow-hidden border border-navy/15 bg-navy">
                    <Image
                      src={face.src}
                      alt={`Stylized ${face.label} player silhouette`}
                      fill
                      sizes="(min-width: 640px) 16vw, 140px"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="mt-2 text-center text-[11px] font-black uppercase tracking-[0.2em] text-navy group-hover:text-breaking">
                    {face.label}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* LEAGUE-LEADER TEASE
          Four #1s, one per league, with the team page link. The same
          baseline that powers /rankings. Bias is on full display
          because three of four #1s are Brad's own teams — house rule
          #1 made hilarious in the corner of the homepage. */}
      <section className="border-b border-navy/15 bg-navy text-bone">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="bb-eyebrow !text-breaking !tracking-[0.3em]">
                Brad&rsquo;s #1 in every league
              </p>
              <p className="mt-1 text-sm text-bone/70">
                Yes the bias is showing. Yes the case is on the page.
              </p>
            </div>
            <Link
              href="/rankings"
              className="inline-flex min-h-[40px] items-center border border-bone/30 px-3 text-[11px] font-black uppercase tracking-[0.18em] text-bone transition-colors hover:border-breaking hover:bg-breaking"
            >
              See the top 25 →
            </Link>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {leagueLeaders.map(({ league, label, leader }) => {
              const accent = sportMeta(league as SportSlug).accent;
              return (
                <li key={league}>
                  {leader ? (
                    <Link
                      href={`/rankings/${league}/${leader.id}`}
                      className="group flex items-center gap-3 border border-bone/15 bg-bone/5 px-3 py-3 transition-colors hover:bg-bone/10"
                    >
                      <span className="font-mono text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>
                        {label}
                      </span>
                      <span className="font-display text-xl italic font-black text-bone">#1</span>
                      <span className="min-w-0 flex-1 truncate font-serif text-base font-bold text-bone group-hover:text-breaking">
                        {leader.city} {leader.name}
                      </span>
                      {leader.bradTeam && (
                        <span className="font-mono text-[9px] font-black uppercase tracking-[0.18em] text-bone/55" title="House rule #1: bias disclosed.">
                          ⚑
                        </span>
                      )}
                    </Link>
                  ) : (
                    <div className="border border-dashed border-bone/20 px-3 py-3 text-[11px] uppercase tracking-[0.18em] text-bone/55">
                      {label} ranking pending
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* LEAD STORY
          Single, big, photo-first story. No "Top headlines" sidebar, no
          "Bias disclosed" callout cluttering the front page (that lives on
          /editorial-standards now). */}
      {desk.lead ? (
        <section className="bg-bone">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
            <p className="bb-eyebrow !text-breaking">Lead take</p>
            <LeadStory article={desk.lead} />
          </div>
        </section>
      ) : (
        <section className="bg-bone">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
            <EmptyFrontPage summary={hero.sub} />
          </div>
        </section>
      )}

      {/* RANKINGS MOVEMENT RAIL
          Surfaces the demotion engine directly on the homepage so a first-
          time visitor sees the franchise rankings working immediately —
          not just a CTA card. Renders only when there's actual movement
          to show; the sidebar Rankings card below stays as the evergreen
          entrypoint. */}
      {recentMovements.length > 0 && (
        <section className="border-y border-navy/15 bg-navy text-bone">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
            <div className="mb-6 flex items-end justify-between gap-3">
              <div>
                <p className="bb-eyebrow !text-breaking !tracking-[0.32em]">
                  Brad&apos;s rankings · editorial
                </p>
                <h2 className="mt-2 font-display text-3xl italic uppercase leading-tight sm:text-4xl">
                  Teams Brad just moved
                </h2>
              </div>
              <Link
                href="/rankings"
                className="hidden min-h-[44px] items-center border border-bone/30 px-4 text-[11px] font-black uppercase tracking-[0.18em] text-bone transition-colors hover:border-breaking hover:bg-breaking sm:inline-flex"
              >
                Top 25 in every league
              </Link>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentMovements.map((m) => (
                <MovementCard key={`${m.league}-${m.team.id}-${m.article.slug}`} movement={m} />
              ))}
            </ul>
            <Link
              href="/rankings"
              className="mt-6 inline-flex min-h-[44px] items-center border border-bone/30 px-4 text-[11px] font-black uppercase tracking-[0.18em] text-bone transition-colors hover:border-breaking hover:bg-breaking sm:hidden"
            >
              Top 25 in every league
            </Link>
          </div>
        </section>
      )}

      <GeneratedMediaRail placement="homepage" />

      {/* LATEST FEED — chronological, sport-agnostic.
          One stream of the most recent stories. No sport-binned league
          desks underneath — Brad's directive is "stories only cover main
          sports news and are not split into different categories based on
          different sports." */}
      <section id="latest" className="bg-bone-50 border-y border-navy/15">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div>
            <div className="bb-thin-rule mb-6 flex items-end justify-between gap-4 pb-3">
              <div className="flex items-center gap-3">
                <span className="block h-7 w-1.5 bg-breaking" aria-hidden="true" />
                <h2 className="font-display text-3xl italic uppercase text-navy-900 sm:text-4xl">
                  Latest
                </h2>
              </div>
              <Link href="/articles" className="bb-link text-sm">
                All articles
              </Link>
            </div>

            {desk.latest.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2">
                {desk.latest.map((article) => (
                  <div key={article.slug}>
                    <ArticleCard article={article} />
                    <RankingsImpactPill article={article} className="mt-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-navy/15 bg-white p-6">
                <h3 className="font-serif text-2xl font-bold text-navy-900">
                  The archive is warming up.
                </h3>
                <p className="mt-2 text-charcoal/75">
                  Published, Brad-approved pieces appear here automatically.
                </p>
              </div>
            )}
          </div>

          <aside className="grid gap-5 content-start">
            <NewsletterSignup variant="block" />
            <section className="border border-navy/15 bg-white p-5">
              <p className="bb-eyebrow !text-breaking">Franchise rankings</p>
              <h2 className="mt-2 font-serif text-2xl font-bold leading-tight text-navy-900">
                Top 25 in every league. Ranked by me.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-charcoal/75">
                NFL, MLB, NHL, NBA. When I trash a team in a column, the team
                drops here and you can read exactly why.
              </p>
              <Link
                href="/rankings"
                className="mt-4 inline-flex min-h-[44px] items-center bg-navy px-4 text-sm font-bold text-bone transition-colors hover:bg-breaking"
              >
                Open the rankings
              </Link>
            </section>
            <section className="border-l-4 border-breaking bg-white p-5">
              <p className="bb-eyebrow !text-breaking">Support the desk</p>
              <p className="mt-2 text-sm leading-relaxed text-charcoal/85">
                Every article free. No paywall. Donations welcome.
              </p>
              <Link
                href="/support"
                className="mt-3 inline-flex min-h-[44px] items-center bg-navy px-4 text-sm font-bold text-bone transition-colors hover:bg-breaking"
              >
                Support BB Sports
              </Link>
            </section>
          </aside>
        </div>
      </section>
    </div>
  );
}

function LeadStory({ article }: { article: Article }) {
  return (
    <article className="grid overflow-hidden border border-navy/15 bg-white shadow-sm md:grid-cols-[minmax(0,1.2fr)_minmax(280px,1fr)]">
      <Link
        href={`/articles/${article.slug}`}
        className="group relative block min-h-[320px] bg-navy/10 md:min-h-[500px]"
      >
        {article.hero ? (
          <Image
            src={article.hero}
            alt={article.heroAlt ?? article.title}
            fill
            priority
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#06122A,#0A1F44_60%,#D7263D)]" />
        )}
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <SportTag sport={article.sport} size="sm" asLink={false} />
          {article.aiAssisted && <AiAssistedBadge tone="bone" />}
        </div>
      </Link>
      <div className="flex flex-col justify-between p-6 sm:p-8">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-charcoal/65">
            <time dateTime={article.date}>{formatDate(article.date)}</time>
            <span>·</span>
            <span>{article.readingTimeMinutes} min read</span>
            <span>·</span>
            <span className="font-bold uppercase tracking-[0.18em] text-navy">By Brad Benson</span>
          </div>
          <Link href={`/articles/${article.slug}`}>
            <h2 className="mt-4 break-words font-serif text-3xl font-black leading-[1.02] tracking-tight text-navy-900 transition-colors hover:text-breaking sm:text-5xl sm:leading-[0.95]">
              {article.title}
            </h2>
          </Link>
          {article.dek && (
            <p className="mt-4 text-lg leading-relaxed text-charcoal/82">{article.dek}</p>
          )}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/articles/${article.slug}`}
            className="bb-button-primary !bg-breaking hover:!bg-breaking/90"
          >
            Read the take
          </Link>
          <Link href="/articles" className="bb-button-ghost">
            All articles
          </Link>
        </div>
      </div>
    </article>
  );
}

function EmptyFrontPage({ summary }: { summary: string }) {
  return (
    <section className="border border-navy/15 bg-white p-8">
      <h1 className="font-serif text-4xl font-black text-navy-900">BB Sports is warming up.</h1>
      <p className="mt-3 max-w-2xl text-charcoal/75">{summary}</p>
      <Link
        href="/admin"
        className="mt-5 inline-flex min-h-[44px] items-center bg-navy px-4 text-sm font-bold text-bone hover:bg-breaking"
      >
        Open admin
      </Link>
    </section>
  );
}

interface HomepageHeroConfig {
  version?: number;
  eyebrow?: string;
  headline?: string;
  sub?: string;
  cta_primary?: { label?: string; href?: string };
  cta_secondary?: { label?: string; href?: string };
}

const DEFAULT_HERO = {
  eyebrow: 'Soft launch',
  sub: 'The most recent sports news. Bias turned all the way up. One byline.',
};

function normalizeHero(config: HomepageHeroConfig | null) {
  if (!config?.version) return DEFAULT_HERO;
  return {
    eyebrow: config.eyebrow || DEFAULT_HERO.eyebrow,
    sub: config.sub || DEFAULT_HERO.sub,
  };
}

function MovementCard({ movement }: { movement: RecentMovement }) {
  const meta = sportMeta(movement.league as SportSlug);
  const moved = movement.team.currentRank - movement.team.baseRank;
  return (
    <li className="border-l-[3px] bg-bone-50 text-charcoal transition-colors hover:bg-white" style={{ borderColor: meta.accent }}>
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 text-xs">
          <Link
            href={`/rankings/${movement.league}/${movement.team.id}`}
            className="font-mono font-black uppercase tracking-[0.18em] hover:opacity-80"
            style={{ color: meta.accent }}
          >
            {movement.leagueLabel}
          </Link>
          <span className="font-bold text-charcoal/70">
            #{movement.team.baseRank} → #{movement.team.currentRank}
            {moved > 0 && (
              <span className="ml-1 text-breaking">▼ {moved}</span>
            )}
          </span>
        </div>
        <Link
          href={`/rankings/${movement.league}/${movement.team.id}`}
          className="mt-2 block font-serif text-xl font-bold leading-tight text-navy-900 hover:text-breaking"
        >
          {movement.team.city} {movement.team.name}
        </Link>
        {movement.reason && (
          <p className="mt-2 line-clamp-3 text-sm leading-snug text-charcoal/80">
            &ldquo;{movement.reason}&rdquo;
          </p>
        )}
        <Link
          href={`/articles/${movement.article.slug}`}
          className="mt-3 inline-block text-[11px] font-black uppercase tracking-[0.18em] text-navy hover:text-breaking"
        >
          Read the column →
        </Link>
      </div>
    </li>
  );
}
