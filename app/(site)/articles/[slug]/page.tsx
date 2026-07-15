import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { getAllArticles, getArticleBySlug, getRelatedArticles, formatDate, sportLabel } from '@/lib/articles';
import { sportMeta } from '@/lib/sport-meta';
import { getDemotionImpacts, type DemotionImpact } from '@/lib/rankings';
import { serializeJsonLd } from '@/lib/json-ld';
import ArticleCard from '@/components/ArticleCard';
import ArticleComments from '@/components/ArticleComments';
import NewsletterSignup from '@/components/NewsletterSignup';
import SportTag from '@/components/SportTag';

type Props = { params: Promise<{ slug: string }> };

// Revalidate every 60s as a safety net; an explicitly approved publication or
// unpublication also invalidates this surface immediately. Draft edits remain private.
export const revalidate = 60;

export async function generateStaticParams() {
  const all = await getAllArticles();
  return all.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};
  const authorName = article.authorName?.trim() || 'Brad Benson';
  return {
    title: article.title,
    description: article.dek ?? article.excerpt,
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.dek ?? article.excerpt,
      publishedTime: article.date,
      authors: [authorName],
      tags: article.tags,
      images: article.hero ? [{ url: article.hero, alt: article.heroAlt ?? article.title }] : undefined
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.dek ?? article.excerpt
    }
  };
}

export default async function ArticleDetail({ params }: Props) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return notFound();
  const authorName = article.authorName?.trim() || 'Brad Benson';
  const [related, allArticles] = await Promise.all([
    getRelatedArticles(article, 3),
    getAllArticles(),
  ]);
  const m = sportMeta(article.sport);
  const demotionImpacts = getDemotionImpacts(article, allArticles);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bbsports.fans';
  const articleUrl = `${siteUrl}/articles/${article.slug}`;
  // schema.org requires absolute URLs for image/logo. Prepend siteUrl when
  // the configured value is relative (filesystem articles use /images/foo.svg;
  // DB-backed entries can be full URLs already).
  const absoluteHero = article.hero
    ? article.hero.startsWith('http') ? article.hero : `${siteUrl}${article.hero}`
    : undefined;

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.dek ?? article.excerpt,
    url: articleUrl,
    datePublished: article.date,
    dateModified: article.date,
    mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
    isAccessibleForFree: true,
    isPartOf: { '@type': 'WebSite', name: 'BB Sports', url: siteUrl },
    author: {
      '@type': 'Person',
      name: authorName,
      ...(authorName === 'Brad Benson' ? { url: `${siteUrl}/about` } : {}),
    },
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: 'BB Sports',
      url: siteUrl,
      logo: { '@type': 'ImageObject', url: `${siteUrl}/icon.svg` },
    },
    image: absoluteHero ? [absoluteHero] : undefined,
    articleSection: sportLabel(article.sport),
    keywords: article.tags.length > 0 ? article.tags.join(', ') : undefined,
    about: {
      '@type': 'Thing',
      name: sportLabel(article.sport),
    },
    ...(article.aiAssisted
      ? {
          creativeWorkStatus: 'AI-assisted draft, edited by Brad Benson',
        }
      : {}),
  };

  return (
    <article className="bg-bone">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleJsonLd) }}
      />

      {/* Article header — broadcast-grade slug */}
      <header className="bg-navy-deep text-bone relative overflow-hidden">
        <div className="h-1" style={{ backgroundColor: m.accent }} aria-hidden="true" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <SportTag sport={article.sport} size="md" />
            {article.aiAssisted && <span className="bb-ai-badge !bg-bone/15 !border-bone/30 !text-bone">AI · Brad-edited</span>}
          </div>
          <h1
            className="mt-5 font-display uppercase italic tracking-[-0.025em] leading-[0.92] text-bone"
            style={{ fontSize: 'clamp(2rem, 6.5vw, 4.5rem)' }}
          >
            {article.title}
          </h1>
          {article.dek && (
            <p className="mt-5 text-lg sm:text-xl text-bone/85 leading-relaxed font-serif italic max-w-2xl">
              {article.dek}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-bone/80">
            <span className="font-bold uppercase tracking-[0.18em] text-[11px] text-bone">By {authorName}</span>
            <span className="text-bone/40">·</span>
            <time dateTime={article.date}>{formatDate(article.date)}</time>
            <span className="text-bone/40">·</span>
            <span>{article.readingTimeMinutes} min read</span>
          </div>
        </div>
      </header>

      {/* Hero image */}
      {article.hero && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-6">
          <figure className="rounded-sm overflow-hidden border border-navy/10">
            <Image
              src={article.hero}
              alt={article.heroAlt ?? article.title}
              width={1600}
              height={900}
              sizes="(min-width: 1024px) 896px, calc(100vw - 2rem)"
              className="w-full h-auto object-cover"
              priority
            />
            {article.heroCredit && (
              <figcaption className="text-xs text-charcoal/60 px-3 py-2 bg-bone-50 border-t border-navy/10">
                Photo: {article.heroCredit}
              </figcaption>
            )}
          </figure>
        </div>
      )}

      {/* Body */}
      <div className="max-w-readable mx-auto px-4 sm:px-6 py-10">
        <div
          className="article-body prose-newspaper"
          dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
        />

        {/* Brad's Take callout — required slot on AI-assisted pieces.
            Renders only when both flags are present so AI drafts can't ship
            without Brad's actual voice attached. */}
        {article.aiAssisted && article.bradsTake && (
          <aside className="mt-10 border-l-4 border-breaking bg-white/70 px-5 py-5 rounded-sm">
            <div className="bb-eyebrow !text-breaking !tracking-[0.32em]">Brad&rsquo;s Take</div>
            <p className="mt-2 font-serif italic text-lg leading-relaxed text-charcoal/95">
              {article.bradsTake}
            </p>
          </aside>
        )}

        {/* Rankings impact — only renders when this column trashed a team
            on /rankings. Pulls cumulative state across every published
            demotion so the displayed rank is the live page state. */}
        {demotionImpacts.length > 0 && <RankingsImpact impacts={demotionImpacts} />}

        {/* Editorial signature */}
        <div className="mt-10 pt-6 border-t border-navy/15 text-sm text-charcoal/75">
          <p>
            <strong>Editorial note:</strong> bias disclosed where material; sources cited inline; corrections logged on the{' '}
            <Link href="/corrections" className="bb-link">
              corrections page
            </Link>
            . Tip Brad on the{' '}
            <Link href="/contact" className="bb-link">
              tips form
            </Link>
            .
          </p>
        </div>

        {/* Share row */}
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            target="_blank"
            rel="noopener"
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(
              `https://bbsports.fans/articles/${article.slug}`
            )}`}
            className="bb-button-ghost"
          >
            Share on X
          </a>
          <a
            target="_blank"
            rel="noopener"
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
              `https://bbsports.fans/articles/${article.slug}`
            )}`}
            className="bb-button-ghost"
          >
            Facebook
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent(article.title)}&body=${encodeURIComponent(
              `https://bbsports.fans/articles/${article.slug}`
            )}`}
            className="bb-button-ghost"
          >
            Email
          </a>
        </div>
      </div>

      <ArticleComments slug={article.slug} />

      {/* Related */}
      {related.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
          <div className="bb-thin-rule pb-3 mb-6 flex items-end justify-between">
            <div className="flex items-center gap-3">
              <span className="block w-1.5 h-7 bg-breaking" aria-hidden="true" />
              <h2 className="font-display uppercase italic text-navy-900 text-2xl tracking-[-0.01em]">
                Recent takes
              </h2>
            </div>
            <Link href="/articles" className="bb-link text-sm">
              All articles →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {related.map((a) => (
              <ArticleCard key={a.slug} article={a} />
            ))}
          </div>
        </section>
      )}

      {/* Newsletter */}
      <section className="max-w-readable mx-auto px-4 sm:px-6 pb-16">
        <NewsletterSignup variant="block" />
      </section>
    </article>
  );
}

function RankingsImpact({ impacts }: { impacts: DemotionImpact[] }) {
  return (
    <aside className="mt-10 border-2 border-breaking bg-bone-50">
      <div className="border-b border-breaking/40 bg-breaking px-4 py-2 text-bone">
        <p className="text-[11px] font-black uppercase tracking-[0.22em]">
          This take moved the franchise rankings
        </p>
      </div>
      <ul className="divide-y divide-navy/10">
        {impacts.map((impact) => {
          const moved = impact.team.currentRank - impact.team.baseRank;
          return (
            <li key={`${impact.league}-${impact.team.id}`} className="px-4 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <Link
                  href={`/rankings/${impact.league}/${impact.team.id}`}
                  className="font-serif text-xl font-bold text-navy-900 hover:text-breaking"
                >
                  {impact.team.city} {impact.team.name}
                </Link>
                <div className="font-mono text-xs font-black uppercase tracking-[0.18em] text-charcoal/70">
                  {impact.leagueLabel} · #{impact.team.baseRank} → #{impact.team.currentRank}
                  {moved > 0 && (
                    <span className="ml-2 text-breaking">▼ {moved}</span>
                  )}
                </div>
              </div>
              {impact.reason && (
                <p className="mt-2 text-sm leading-snug text-charcoal/85">
                  &ldquo;{impact.reason}&rdquo;
                </p>
              )}
              <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-charcoal/55">
                Dropped {impact.appliedDrop} slot{impact.appliedDrop === 1 ? '' : 's'} on this column
              </p>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-navy/15 bg-white px-4 py-3">
        <Link
          href="/rankings"
          className="inline-flex min-h-[44px] items-center text-[12px] font-black uppercase tracking-[0.2em] text-navy hover:text-breaking"
        >
          See the full top-25 across every league →
        </Link>
      </div>
    </aside>
  );
}
