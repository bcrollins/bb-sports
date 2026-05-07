import Link from 'next/link';
import Image from 'next/image';
import type { Article } from '@/lib/articles';
import { formatDate } from '@/lib/articles';
import { sportMeta } from '@/lib/sport-meta';
import SportTag from './SportTag';

type Props = {
  article: Article;
  variant?: 'lead' | 'standard' | 'compact';
};

export default function ArticleCard({ article, variant = 'standard' }: Props) {
  const isLead = variant === 'lead';
  const isCompact = variant === 'compact';
  const meta = sportMeta(article.sport);

  if (isCompact) {
    return (
      <Link href={`/articles/${article.slug}`} className="group block py-4 border-b border-navy/10">
        <div className="flex items-baseline gap-3">
          <SportTag sport={article.sport} size="xs" asLink={false} />
          {article.aiAssisted && <span className="bb-ai-badge !text-[10px]">AI · Brad-edited</span>}
          <time className="text-xs text-charcoal/60">{formatDate(article.date)}</time>
        </div>
        <h3 className="mt-1.5 font-serif font-bold text-lg sm:text-xl text-navy-900 group-hover:text-breaking transition-colors leading-tight">
          {article.title}
        </h3>
        {article.dek && (
          <p className="mt-1 text-sm text-charcoal/80 line-clamp-2">{article.dek}</p>
        )}
      </Link>
    );
  }

  return (
    <article className={`bb-card group/card relative ${isLead ? 'md:row-span-2' : ''}`}>
      {/* Top broadcast accent rule, sport-tinted */}
      <div className="h-1 w-full" style={{ backgroundColor: meta.accent }} aria-hidden="true" />

      <Link href={`/articles/${article.slug}`} className="block group">
        {article.hero && (
          <div className={`relative ${isLead ? 'aspect-[16/9]' : 'aspect-[16/10]'} bg-navy/10 overflow-hidden`}>
            <Image
              src={article.hero}
              alt={article.heroAlt ?? article.title}
              fill
              sizes={isLead ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
            />
            {/* Sport bug, top-left, broadcast-style */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <SportTag sport={article.sport} size="sm" asLink={false} />
              {article.aiAssisted && <span className="bb-ai-badge !bg-bone/95">AI · Brad-edited</span>}
            </div>
          </div>
        )}
        <div className={`p-4 sm:p-6 ${isLead ? 'sm:p-8' : ''}`}>
          <div className="flex items-baseline flex-wrap gap-2 sm:gap-3 text-xs">
            {!article.hero && <SportTag sport={article.sport} size="xs" asLink={false} />}
            <time className="text-charcoal/60">{formatDate(article.date)}</time>
            <span className="text-charcoal/40">·</span>
            <span className="text-charcoal/60">{article.readingTimeMinutes} min read</span>
          </div>
          <h3
            className={`mt-3 font-serif font-bold text-navy-900 leading-[1.05] tracking-tight group-hover:text-breaking transition-colors ${
              isLead ? 'text-3xl md:text-5xl' : 'text-2xl sm:text-3xl'
            }`}
          >
            {article.title}
          </h3>
          {article.dek && (
            <p className={`mt-3 text-charcoal/85 leading-relaxed ${isLead ? 'text-lg' : 'text-base'}`}>
              {article.dek}
            </p>
          )}
          <div className="mt-4 flex items-center gap-3 text-sm">
            <span className="font-bold uppercase tracking-[0.18em] text-[11px] text-navy">By Brad Benson</span>
            <span className="text-charcoal/40">·</span>
            <span className="bb-link group-hover:text-breaking">Read the take →</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
