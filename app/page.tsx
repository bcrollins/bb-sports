import Link from 'next/link';
import ArticleCard from '@/components/ArticleCard';
import GeneratedMediaRail from '@/components/GeneratedMediaRail';
import NewsletterSignup from '@/components/NewsletterSignup';
import { getAllArticles, sportLabel } from '@/lib/articles';
import { getConfig } from '@/lib/queries';

export const revalidate = 60;

export default async function HomePage() {
  const [articles, heroConfig] = await Promise.all([
    getAllArticles(),
    getConfig<HomepageHeroConfig | null>('hero', null),
  ]);
  const [lead, ...rest] = articles;
  const featured = rest.slice(0, 3);
  const more = rest.slice(3, 9);
  const hero = normalizeHero(heroConfig);

  return (
    <div className="bg-bone min-h-[60vh]">
      {/* HERO — broadcast-style "show open" */}
      <section className="relative bg-navy-deep text-bone overflow-hidden">
        {/* network ambient pattern */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(-12deg, transparent 0 14px, #F5F2EC 14px 16px)'
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 grid md:grid-cols-12 gap-8 items-end">
          <div className="md:col-span-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="bb-eyebrow !text-bone/80 !tracking-[0.32em]">ISSUE 001</span>
              <span className="h-[2px] w-10 bg-breaking" aria-hidden="true" />
              <span className="bb-eyebrow !text-breaking !tracking-[0.32em]">{hero.eyebrow}</span>
            </div>
            <h1
              className="font-display uppercase italic tracking-[-0.025em] leading-[0.86] text-bone"
              style={{ fontSize: 'clamp(2.5rem, 9vw, 7rem)' }}
            >
              {hero.headlineLines.map((line, index) => (
                <span key={`${line}-${index}`}>
                  {index > 0 ? <br /> : null}
                  <span className={index === hero.headlineLines.length - 1 ? 'text-breaking' : undefined}>{line}</span>
                </span>
              ))}
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-bone/85 max-w-2xl leading-relaxed">
              {hero.sub}{' '}
              <Link href="/about" className="underline underline-offset-4 decoration-breaking hover:text-breaking">
                Brad Benson
              </Link>
              .
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={hero.ctaPrimary.href} className="bb-button-primary !bg-breaking hover:!bg-breaking/90">
                {hero.ctaPrimary.label}
              </Link>
              <Link
                href={hero.ctaSecondary.href}
                className="bb-button-ghost !border-bone !text-bone hover:!bg-bone/10"
              >
                {hero.ctaSecondary.label}
              </Link>
            </div>
          </div>

          <aside className="md:col-span-4 bg-bone text-charcoal p-5 rounded-sm border-t-[3px] border-breaking">
            <div className="bb-eyebrow">Disclosure · House rule #1</div>
            <p className="mt-2 text-sm leading-relaxed text-charcoal/85">
              Brad roots openly for the <strong>Bears</strong>, <strong>Panthers</strong>,{' '}
              <strong>Manchester United</strong>, <strong>Florida Gators</strong>,{' '}
              <strong>Bulls</strong>, and <strong>Cubs</strong>. Bias is disclosed, not hidden.
            </p>
            <Link href="/editorial-standards" className="mt-3 inline-block text-sm bb-link">
              Editorial standards →
            </Link>
          </aside>
        </div>
      </section>

      <GeneratedMediaRail placement="homepage" />

      {/* SCORE-TICKER STYLE COVERAGE STRIP (broadcast cue) */}
      <section className="bg-bone-50 border-b-[2px] border-navy">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <ul className="grid grid-cols-3 sm:grid-cols-6 gap-1 sm:gap-2">
            {(['nfl', 'nhl', 'college-football', 'soccer', 'nba', 'mma'] as const).map((s) => (
              <li key={s}>
                <Link
                  href={`/articles?sport=${s}`}
                  className="block text-center py-2 sm:py-2.5 px-1 text-[11px] sm:text-xs uppercase tracking-[0.2em] font-bold text-navy hover:bg-navy hover:text-bone transition-colors min-h-[40px]"
                >
                  {sportLabel(s)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* LEAD STORY + FEATURED GRID */}
      {articles.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <div className="bb-thin-rule pb-3 mb-6 flex items-end justify-between">
            <div className="flex items-center gap-3">
              <span className="block w-1.5 h-7 bg-breaking" aria-hidden="true" />
              <h2 className="font-display uppercase italic text-navy-900 text-2xl tracking-[-0.01em]">
                Latest takes
              </h2>
            </div>
            <Link href="/articles" className="bb-link text-sm">
              All articles →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {lead && <ArticleCard article={lead} variant="lead" />}
            <div className="grid gap-6">
              {featured.map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* MORE ARTICLES */}
      {more.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="bb-thin-rule pb-3 mb-6 flex items-end gap-3">
            <span className="block w-1.5 h-7 bg-breaking" aria-hidden="true" />
            <h2 className="font-display uppercase italic text-navy-900 text-2xl tracking-[-0.01em]">
              More from BB Sports
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {more.map((a) => (
              <ArticleCard key={a.slug} article={a} />
            ))}
          </div>
        </section>
      )}

      {/* MISSION STATEMENT — pulled-quote slab */}
      <section id="newsletter" className="bg-navy text-bone">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-7">
            <div className="bb-eyebrow !text-breaking !tracking-[0.32em]">The mission</div>
            <h2
              className="mt-4 font-display uppercase italic text-bone leading-[0.95] tracking-[-0.02em]"
              style={{ fontSize: 'clamp(1.75rem, 4.5vw, 3.5rem)' }}
            >
              I'm so tired of the by-the-book version of sports journalism.
            </h2>
            <p className="mt-5 text-bone/85 text-lg leading-relaxed max-w-2xl">
              I want to write the way fans actually talk about sports. Loud. Specific. With receipts. With opinions you can argue with — not the hedge-everything stuff you've read a thousand times. That's the whole project.
            </p>
            <p className="mt-3 text-bone/85 text-lg leading-relaxed max-w-2xl">
              Bias is disclosed. Sources are cited. Corrections are public. AI helps me do the volume that one person otherwise can't — but every word with my byline is mine.
            </p>
            <Link
              href="/about"
              className="mt-6 inline-block underline underline-offset-4 decoration-breaking text-bone hover:text-breaking font-semibold"
            >
              Read the long version →
            </Link>
          </div>
          <div className="md:col-span-5">
            <NewsletterSignup variant="block" />
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="bg-bone-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid sm:grid-cols-3 gap-6 text-sm">
          {[
            { label: 'Bias', body: 'Disclosed in every column where it’s material. Brad’s teams are listed in his bio.' },
            { label: 'Sources', body: 'Cited inline. Quotes attributed. No fabricated quotes.' },
            { label: 'Corrections', body: <>Logged publicly with date and what changed. <Link href="/corrections" className="bb-link">Read the log →</Link></> }
          ].map((item) => (
            <div key={item.label} className="bg-white border border-navy/15 p-5 rounded-sm border-t-[3px] !border-t-breaking">
              <div className="bb-eyebrow">{item.label}</div>
              <div className="mt-2 text-charcoal/85">{item.body}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
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
  eyebrow: 'SOFT LAUNCH',
  headlineLines: ['Sports from', "the fan's view.", 'No bullshit.'],
  sub: 'Opinion-led NFL, NHL, college football, soccer, NBA, and MMA — written like a fan, sourced like a reporter. Founded and edited by',
  ctaPrimary: { label: 'Read the takes', href: '/articles' },
  ctaSecondary: { label: 'Get the newsletter', href: '/#newsletter' },
};

function normalizeHero(config: HomepageHeroConfig | null) {
  if (!config?.version) return DEFAULT_HERO;
  const headlineLines = String(config.headline || DEFAULT_HERO.headlineLines.join('\n'))
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    eyebrow: config.eyebrow || DEFAULT_HERO.eyebrow,
    headlineLines: headlineLines.length > 0 ? headlineLines : DEFAULT_HERO.headlineLines,
    sub: config.sub || DEFAULT_HERO.sub,
    ctaPrimary: {
      label: config.cta_primary?.label || DEFAULT_HERO.ctaPrimary.label,
      href: config.cta_primary?.href || DEFAULT_HERO.ctaPrimary.href,
    },
    ctaSecondary: {
      label: config.cta_secondary?.label || DEFAULT_HERO.ctaSecondary.label,
      href: config.cta_secondary?.href || DEFAULT_HERO.ctaSecondary.href,
    },
  };
}
