import Image from 'next/image';
import Link from 'next/link';
import ArticleCard from '@/components/ArticleCard';
import GeneratedMediaRail from '@/components/GeneratedMediaRail';
import NewsletterSignup from '@/components/NewsletterSignup';
import SportTag from '@/components/SportTag';
import {
  getAllArticles,
  formatDate,
  sportLabel,
  type Article,
  type SportSlug,
} from '@/lib/articles';
import { buildHomepageDesk, HOME_PRIMARY_ACTIONS } from '@/lib/homepage';
import { getConfig } from '@/lib/queries';
import { sportMeta } from '@/lib/sport-meta';

export const revalidate = 60;

export default async function HomePage() {
  const [articles, heroConfig] = await Promise.all([
    getAllArticles(),
    getConfig<HomepageHeroConfig | null>('hero', null),
  ]);
  const desk = buildHomepageDesk(articles);
  const hero = normalizeHero(heroConfig);

  return (
    <div className="min-h-[60vh] bg-bone">
      <section className="bg-bone-50 border-b border-navy/15">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-8">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-3 text-[10.5px] font-black uppercase tracking-[0.22em] text-navy/70">
              <span className="inline-flex min-h-[32px] items-center bg-breaking px-3 text-white">
                BB Sports Front Page
              </span>
              <span>{hero.eyebrow}</span>
              <span className="hidden text-navy/30 sm:inline">|</span>
              <span className="text-navy/80">{desk.provider.label}</span>
            </div>

            {desk.lead ? (
              <LeadStory article={desk.lead} summary={hero.sub} />
            ) : (
              <EmptyFrontPage />
            )}
          </div>

          <aside className="grid gap-4 lg:content-start">
            <section className="border border-navy/15 bg-white">
              <div className="border-b border-navy/15 bg-navy px-4 py-3 text-bone">
                <h2 className="font-display text-xl italic uppercase tracking-normal text-bone">
                  Top headlines
                </h2>
              </div>
              <div className="divide-y divide-navy/10 px-4">
                {desk.topStories.length > 0 ? (
                  desk.topStories.map((article) => <MiniStory key={article.slug} article={article} />)
                ) : (
                  <p className="py-5 text-sm text-charcoal/75">
                    Brad's next approved piece lands here first.
                  </p>
                )}
              </div>
            </section>

            <section className="border border-navy/15 bg-white p-4">
              <h2 className="bb-eyebrow">Two-tap desk</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {HOME_PRIMARY_ACTIONS.map((action) =>
                  action.external ? (
                    <a
                      key={action.href}
                      href={action.href}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex min-h-[44px] items-center justify-center border border-navy/20 px-3 text-center text-[11px] font-black uppercase tracking-[0.16em] text-navy transition-colors hover:border-breaking hover:text-breaking"
                    >
                      {action.label}
                    </a>
                  ) : (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="inline-flex min-h-[44px] items-center justify-center border border-navy/20 px-3 text-center text-[11px] font-black uppercase tracking-[0.16em] text-navy transition-colors hover:border-breaking hover:text-breaking"
                    >
                      {action.label}
                    </Link>
                  ),
                )}
              </div>
            </section>

            <section className="border-l-4 border-breaking bg-navy p-4 text-bone">
              <h2 className="bb-eyebrow !text-bone/70">Bias disclosed</h2>
              <p className="mt-2 text-sm leading-relaxed text-bone/85">
                Brad roots for the Bears, Panthers, Manchester United, Florida Gators, Bulls, and Cubs.
                The house rule is simple: say it, source it, correct it publicly.
              </p>
              <Link href="/editorial-standards" className="mt-3 inline-block text-sm font-semibold underline decoration-breaking underline-offset-4 hover:text-breaking">
                Editorial standards
              </Link>
            </section>
          </aside>
        </div>
      </section>

      <section className="border-b border-navy/15 bg-white" aria-label="Scoreboard-style editorial board">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="bb-eyebrow !text-breaking !tracking-[0.28em]">Game board</p>
              <h2 className="font-display text-2xl italic uppercase text-navy">Coverage lanes, not unlicensed scores</h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-charcoal/70">
              {desk.provider.disclaimer}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            {desk.watchBoard.map((item) => (
              <WatchBoardCard key={item.sport} item={item} />
            ))}
          </div>
        </div>
      </section>

      <GeneratedMediaRail placement="homepage" />

      <section id="latest" className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div>
          <div className="bb-thin-rule mb-6 flex items-end justify-between gap-4 pb-3">
            <div className="flex items-center gap-3">
              <span className="block h-7 w-1.5 bg-breaking" aria-hidden="true" />
              <h2 className="font-display text-3xl italic uppercase text-navy-900">
                Latest from Brad
              </h2>
            </div>
            <Link href="/articles" className="bb-link text-sm">
              All articles
            </Link>
          </div>

          {desk.latest.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2">
              {desk.latest.map((article) => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </div>
          ) : (
            <div className="border border-navy/15 bg-white p-6">
              <h3 className="font-serif text-2xl font-bold text-navy-900">The archive is warming up.</h3>
              <p className="mt-2 text-charcoal/75">
                Published, Brad-approved pieces appear here automatically from the internal CMS.
              </p>
            </div>
          )}
        </div>

        <aside className="grid gap-5 content-start">
          <NewsletterSignup variant="block" />
          <section className="border border-navy/15 bg-white p-5">
            <p className="bb-eyebrow !text-breaking">Support the desk</p>
            <h2 className="mt-2 font-serif text-2xl font-bold leading-tight text-navy-900">
              Keep every article free. No premium wall. No gambling promos.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-charcoal/75">
              BB Sports stores supporter interest first-party and only sends money through Stripe when the
              account is verified for public launch.
            </p>
            <Link href="/support" className="mt-4 inline-flex min-h-[44px] items-center bg-navy px-4 text-sm font-bold text-bone transition-colors hover:bg-breaking">
              Support BB Sports
            </Link>
          </section>
        </aside>
      </section>

      <section className="border-y border-navy/15 bg-bone-50">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="bb-thin-rule mb-6 flex items-end gap-3 pb-3">
            <span className="block h-7 w-1.5 bg-breaking" aria-hidden="true" />
            <h2 className="font-display text-3xl italic uppercase text-navy-900">
              League desks
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {desk.sportHubs.map((hub) => (
              <SportDeskCard key={hub.sport} hub={hub} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-navy-deep text-bone">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="bb-eyebrow !text-breaking !tracking-[0.3em]">Watch and listen</p>
            <h2 className="mt-3 font-display text-4xl italic uppercase leading-[0.95] text-bone sm:text-5xl">
              The video and podcast rails are already named homes.
            </h2>
            <p className="mt-4 max-w-2xl text-bone/80">
              ESPN-level behavior means fans never hunt for the show, the clip, or the next column.
              BB Sports keeps those surfaces separate and discoverable while Brad builds the content bench.
            </p>
          </div>
          <div className="grid gap-3 content-center sm:grid-cols-2 lg:grid-cols-1">
            <Link href="/videos" className="border border-bone/20 bg-bone/10 p-4 transition-colors hover:border-breaking hover:bg-breaking">
              <span className="bb-eyebrow !text-bone/70">Video</span>
              <span className="mt-2 block font-serif text-2xl font-bold text-bone">Clips and reactions</span>
            </Link>
            <Link href="/podcast" className="border border-bone/20 bg-bone/10 p-4 transition-colors hover:border-breaking hover:bg-breaking">
              <span className="bb-eyebrow !text-bone/70">Audio</span>
              <span className="mt-2 block font-serif text-2xl font-bold text-bone">The BB Sports show</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-bone-50">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 text-sm sm:grid-cols-3 sm:px-6">
          {[
            { label: 'Voice', body: 'Opinion-led, first-person, and Brad-approved before a byline ships.' },
            { label: 'Sources', body: 'Stats link, quotes attribute, and corrections stay public.' },
            { label: 'AI policy', body: 'AI-assisted work is labeled and blocked from publish without Brad&apos;s take.' },
          ].map((item) => (
            <div key={item.label} className="border-t-[3px] border-breaking bg-white p-5">
              <div className="bb-eyebrow">{item.label}</div>
              <p className="mt-2 text-charcoal/80" dangerouslySetInnerHTML={{ __html: item.body }} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function LeadStory({ article, summary }: { article: Article; summary: string }) {
  const meta = sportMeta(article.sport);
  return (
    <article className="grid overflow-hidden border border-navy/15 bg-white shadow-sm md:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.92fr)]">
      <Link href={`/articles/${article.slug}`} className="group relative block min-h-[280px] bg-navy/10 md:min-h-[430px]">
        {article.hero ? (
          <Image
            src={article.hero}
            alt={article.heroAlt ?? article.title}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03] md:object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#06122A,#0A1F44_60%,#D7263D)]" />
        )}
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <SportTag sport={article.sport} size="sm" asLink={false} />
          {article.aiAssisted && <span className="bb-ai-badge !bg-bone/95">AI - Brad-edited</span>}
        </div>
      </Link>
      <div className="flex flex-col justify-between p-5 sm:p-7">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-charcoal/65">
            <span className="font-black uppercase tracking-[0.18em]" style={{ color: meta.accent }}>
              Lead take
            </span>
            <span>|</span>
            <time dateTime={article.date}>{formatDate(article.date)}</time>
            <span>|</span>
            <span>{article.readingTimeMinutes} min read</span>
          </div>
          <Link href={`/articles/${article.slug}`}>
            <h1 className="mt-4 break-words font-serif text-3xl font-black leading-[1.02] tracking-tight text-navy-900 transition-colors hover:text-breaking sm:text-5xl sm:leading-[0.95] lg:text-6xl">
              {article.title}
            </h1>
          </Link>
          {article.dek && (
            <p className="mt-4 text-lg leading-relaxed text-charcoal/82">
              {article.dek}
            </p>
          )}
          <p className="mt-4 text-sm leading-relaxed text-charcoal/70">
            {summary}
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/articles/${article.slug}`} className="bb-button-primary !bg-breaking hover:!bg-breaking/90">
            Read lead take
          </Link>
          <Link href="/articles" className="bb-button-ghost">
            Open archive
          </Link>
        </div>
      </div>
    </article>
  );
}

function MiniStory({ article }: { article: Article }) {
  return (
    <Link href={`/articles/${article.slug}`} className="group block py-4">
      <div className="flex items-center gap-2">
        <SportTag sport={article.sport} size="xs" asLink={false} />
        <time className="text-xs text-charcoal/55" dateTime={article.date}>
          {formatDate(article.date)}
        </time>
      </div>
      <h3 className="mt-2 font-serif text-xl font-bold leading-tight text-navy-900 transition-colors group-hover:text-breaking">
        {article.title}
      </h3>
    </Link>
  );
}

function WatchBoardCard({ item }: { item: { sport: SportSlug; label: string; href: string; status: string; detail: string; freshnessLabel: string } }) {
  const meta = sportMeta(item.sport);
  return (
    <Link href={item.href} className="group border border-navy/15 bg-bone-50 p-3 transition-colors hover:border-breaking hover:bg-white">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: meta.accent }}>
          {sportLabel(item.sport)}
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-charcoal/50">
          {item.status}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-navy-900 group-hover:text-breaking">
        {item.detail}
      </p>
      <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-charcoal/50">
        {item.freshnessLabel}
      </p>
    </Link>
  );
}

function SportDeskCard({ hub }: { hub: { sport: SportSlug; label: string; href: string; count: number; lead: Article | null; latest: Article[] } }) {
  const meta = sportMeta(hub.sport);
  return (
    <section className="border border-navy/15 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-navy/10 px-4 py-3">
        <div>
          <p className="bb-eyebrow" style={{ color: meta.accent }}>{hub.label}</p>
          <h3 className="font-serif text-xl font-bold text-navy-900">
            {hub.lead ? hub.lead.title : 'Desk open'}
          </h3>
        </div>
        <Link href={hub.href} className="shrink-0 text-[11px] font-black uppercase tracking-[0.16em] text-navy hover:text-breaking">
          {hub.count} takes
        </Link>
      </div>
      <div className="divide-y divide-navy/10 px-4">
        {hub.lead ? <MiniStory article={hub.lead} /> : (
          <p className="py-4 text-sm text-charcoal/70">
            This league has a named home before the first column ships.
          </p>
        )}
        {hub.latest.map((article) => <MiniStory key={article.slug} article={article} />)}
      </div>
    </section>
  );
}

function EmptyFrontPage() {
  return (
    <section className="border border-navy/15 bg-white p-8">
      <h1 className="font-serif text-4xl font-black text-navy-900">BB Sports is warming up.</h1>
      <p className="mt-3 max-w-2xl text-charcoal/75">
        The front page fills from Brad-approved articles in the internal CMS. No mock engagement, no fake scores,
        no placeholder takes.
      </p>
      <Link href="/admin" className="mt-5 inline-flex min-h-[44px] items-center bg-navy px-4 text-sm font-bold text-bone hover:bg-breaking">
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
  sub: 'Opinion-led NFL, NHL, college football, soccer, NBA, and MMA - written like a fan, sourced like a reporter.',
};

function normalizeHero(config: HomepageHeroConfig | null) {
  if (!config?.version) return DEFAULT_HERO;
  return {
    eyebrow: config.eyebrow || DEFAULT_HERO.eyebrow,
    sub: config.sub || DEFAULT_HERO.sub,
  };
}
