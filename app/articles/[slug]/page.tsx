import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllArticles, getArticleBySlug, getRelatedArticles, formatDate, sportLabel } from '@/lib/articles';
import { sportMeta } from '@/lib/sport-meta';
import ArticleCard from '@/components/ArticleCard';
import NewsletterSignup from '@/components/NewsletterSignup';
import SportTag from '@/components/SportTag';

type Props = { params: { slug: string } };

// Revalidate every 60s so admin edits to a published article surface live and
// the layout's BreakingNewsBar / footer tagline don't go stale.
export const revalidate = 60;

export async function generateStaticParams() {
  const all = await getAllArticles();
  return all.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticleBySlug(params.slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.dek ?? article.excerpt,
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.dek ?? article.excerpt,
      publishedTime: article.date,
      authors: ['Brad Benson'],
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
  const article = await getArticleBySlug(params.slug);
  if (!article) return notFound();
  const related = await getRelatedArticles(article, 3);
  const m = sportMeta(article.sport);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bbsports.media';
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
    datePublished: article.date,
    dateModified: article.date,
    mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
    author: {
      '@type': 'Person',
      name: 'Brad Benson',
      url: `${siteUrl}/about`,
    },
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: 'BB Sports',
      logo: { '@type': 'ImageObject', url: `${siteUrl}/icon.svg` },
    },
    image: absoluteHero ? [absoluteHero] : undefined,
    articleSection: sportLabel(article.sport),
    keywords: article.tags.length > 0 ? article.tags.join(', ') : undefined,
  };

  return (
    <article className="bg-bone">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
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
            <span className="font-bold uppercase tracking-[0.18em] text-[11px] text-bone">By Brad Benson</span>
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
            <img
              src={article.hero}
              alt={article.heroAlt ?? article.title}
              className="w-full h-auto object-cover"
              loading="eager"
              decoding="async"
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
              `https://bbsports.media/articles/${article.slug}`
            )}`}
            className="bb-button-ghost"
          >
            Share on X
          </a>
          <a
            target="_blank"
            rel="noopener"
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
              `https://bbsports.media/articles/${article.slug}`
            )}`}
            className="bb-button-ghost"
          >
            Facebook
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent(article.title)}&body=${encodeURIComponent(
              `https://bbsports.media/articles/${article.slug}`
            )}`}
            className="bb-button-ghost"
          >
            Email
          </a>
        </div>
      </div>

      {/* Comments stub */}
      <section className="max-w-readable mx-auto px-4 sm:px-6 pb-10">
        <div className="bb-thin-rule pb-3 mb-4 flex items-end gap-3">
          <span className="block w-1.5 h-7 bg-breaking" aria-hidden="true" />
          <h2 className="font-display uppercase italic text-navy-900 text-2xl tracking-[-0.01em] flex-1">
            Yell at me
          </h2>
          <span className="text-xs text-charcoal/60">Comments open at public launch</span>
        </div>
        <div className="bg-white border border-navy/15 rounded-sm p-5">
          <p className="text-charcoal/80">
            Reddit-style threaded comments are coming with the public launch. In the meantime, the fastest way to argue with Brad is{' '}
            <a className="bb-link" href="https://x.com/bbsports" target="_blank" rel="noopener">
              on X
            </a>{' '}
            or via the{' '}
            <Link href="/contact" className="bb-link">
              contact form
            </Link>
            .
          </p>
        </div>
      </section>

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
